"""OAuth 2.1 service: PKCE verification, code/token generation, token lookup."""

import base64
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.database import Agent, OAuthAuthCode, OAuthClient, OAuthToken, User

_CODE_TTL_SECONDS = 600       # 10 minutes
_TOKEN_TTL_DAYS = 30
_LOGIN_PROOF_TTL_SECONDS = 300  # 5 minutes


# ---------------------------------------------------------------------------
# Hashing helpers
# ---------------------------------------------------------------------------

def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


# ---------------------------------------------------------------------------
# PKCE
# ---------------------------------------------------------------------------

def verify_pkce(code_verifier: str, code_challenge: str, method: str) -> bool:
    """Return True if code_verifier matches the stored code_challenge."""
    if method != "S256":
        return False
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    computed = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return secrets.compare_digest(computed, code_challenge)


# ---------------------------------------------------------------------------
# Login proof JWT (stateless; carries OAuth params through the consent step)
# ---------------------------------------------------------------------------

def create_login_proof(
    user_id: uuid.UUID,
    client_id: str,
    redirect_uri: str,
    code_challenge: str,
    code_challenge_method: str,
    scope: str,
    state: Optional[str],
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code_challenge": code_challenge,
        "code_challenge_method": code_challenge_method,
        "scope": scope,
        "state": state or "",
        "type": "login_proof",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=_LOGIN_PROOF_TTL_SECONDS)).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_login_proof(token: str) -> dict:
    """Decode and verify a login_proof JWT. Raises JWTError on invalid/expired."""
    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )
    if payload.get("type") != "login_proof":
        raise JWTError("Not a login_proof token")
    return payload


# ---------------------------------------------------------------------------
# Supabase credential validation
# ---------------------------------------------------------------------------

async def validate_supabase_credentials(email: str, password: str) -> Optional[str]:
    """Validate email/password against Supabase. Returns Supabase user UUID or None."""
    url = f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json={"email": email, "password": password}, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("user", {}).get("id")
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Client validation
# ---------------------------------------------------------------------------

async def get_client(db: AsyncSession, client_id: str) -> Optional[OAuthClient]:
    result = await db.execute(select(OAuthClient).where(OAuthClient.client_id == client_id))
    return result.scalar_one_or_none()


def validate_redirect_uri(client: OAuthClient, redirect_uri: str) -> bool:
    """Return True if redirect_uri starts with one of the client's allowed prefixes."""
    for prefix in (client.redirect_uri_prefixes or []):
        if redirect_uri.startswith(prefix):
            return True
    return False


# ---------------------------------------------------------------------------
# Auth code lifecycle
# ---------------------------------------------------------------------------

async def create_auth_code(
    db: AsyncSession,
    user_id: uuid.UUID,
    client_id: str,
    redirect_uri: str,
    code_challenge: str,
    code_challenge_method: str,
    scope: str = "authorize",
) -> str:
    code = secrets.token_urlsafe(32)
    record = OAuthAuthCode(
        code_hash=_sha256(code),
        user_id=user_id,
        client_id=client_id,
        redirect_uri=redirect_uri,
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method,
        scope=scope,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=_CODE_TTL_SECONDS),
    )
    db.add(record)
    await db.commit()
    return code


async def exchange_code_for_token(
    db: AsyncSession,
    code: str,
    code_verifier: str,
    redirect_uri: str,
    client_id: str,
) -> tuple[Optional[str], Optional[str]]:
    """Exchange an auth code for an access token.

    Returns (token, None) on success, (None, error_code) on failure.
    """
    code_hash = _sha256(code)
    result = await db.execute(
        select(OAuthAuthCode).where(OAuthAuthCode.code_hash == code_hash)
    )
    auth_code = result.scalar_one_or_none()

    if auth_code is None or auth_code.used_at is not None:
        return None, "invalid_grant"
    if auth_code.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None, "invalid_grant"
    if auth_code.client_id != client_id:
        return None, "invalid_client"
    if auth_code.redirect_uri != redirect_uri:
        return None, "invalid_grant"
    if not verify_pkce(code_verifier, auth_code.code_challenge, auth_code.code_challenge_method):
        return None, "invalid_grant"

    # Mark code consumed (single-use)
    auth_code.used_at = datetime.now(timezone.utc)

    token = secrets.token_urlsafe(48)
    token_record = OAuthToken(
        token_hash=_sha256(token),
        user_id=auth_code.user_id,
        client_id=client_id,
        scope=auth_code.scope,
        expires_at=datetime.now(timezone.utc) + timedelta(days=_TOKEN_TTL_DAYS),
    )
    db.add(token_record)
    await db.commit()
    return token, None


# ---------------------------------------------------------------------------
# Token → User/Agent resolution (used by require_agent)
# ---------------------------------------------------------------------------

async def get_agent_from_oauth_token(
    db: AsyncSession, raw_token: str
) -> Optional[Agent]:
    """Resolve an OAuth Bearer token to the user's first active agent."""
    token_hash = _sha256(raw_token)
    result = await db.execute(
        select(OAuthToken).where(
            OAuthToken.token_hash == token_hash,
            OAuthToken.expires_at > datetime.now(timezone.utc),
        )
    )
    token_record = result.scalar_one_or_none()
    if token_record is None:
        return None

    result = await db.execute(
        select(Agent)
        .where(Agent.user_id == token_record.user_id, Agent.status == "active")
        .order_by(Agent.created_at)
        .limit(1)
    )
    return result.scalar_one_or_none()
