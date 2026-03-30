"""
AgentGate MCP Server

Exposes AgentGate's authorization API as MCP tools so any AI agent on any
platform (Claude, ChatGPT, Cursor, VS Code) can use AgentGate as a native
tool — no SDK install required.

Tools:
    authorize_transaction       — submit a transaction for authorization
    check_authorization_status  — poll a pending request
    cancel_authorization        — cancel a pending request
"""

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

AGENTGATE_API_URL = os.getenv(
    "AGENTGATE_API_URL",
    "https://agent-gate-production.up.railway.app",
).rstrip("/")

# streamable_http_path="/" so the internal Starlette route sits at "/".
# When FastAPI mounts this sub-app at "/mcp" it strips the prefix, so the
# MCP endpoint is reachable at /mcp (not /mcp/mcp).
#
# transport_security: DNS rebinding protection is disabled because this server
# is deployed on Railway behind HTTPS — it is not a local server. The attack
# vector (malicious page tricking a local server) does not apply here.
# FastAPI's CORS middleware already handles cross-origin protection.
mcp = FastMCP(
    "AgentGate",
    streamable_http_path="/",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False,
    ),
)


def _headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


@mcp.tool()
async def authorize_transaction(
    api_key: str,
    action: str,
    amount: float,
    vendor: str,
    category: str | None = None,
    description: str | None = None,
    currency: str = "USD",
) -> dict[str, Any]:
    """Request authorization before an AI agent makes a purchase, booking, or
    financial transaction.

    Call this BEFORE executing any transaction. The response tells you whether
    to proceed:

    - status="auto_approved"  → proceed immediately; use the approval_token if
                                 your downstream API requires it.
    - status="pending"        → a human is reviewing; poll
                                 check_authorization_status with the returned
                                 request_id until it resolves. Do NOT execute
                                 the transaction yet.
    - status="denied"         → do not proceed; explain to the user that the
                                 transaction was blocked by their spending rules.

    Args:
        api_key:     Your AgentGate API key (from the dashboard → Agents tab).
        action:      Short description of the action, e.g. "purchase flight tickets".
        amount:      Transaction amount as a number, e.g. 149.99.
        vendor:      Merchant or service name, e.g. "Delta Airlines".
        category:    Optional spending category, e.g. "travel", "software", "food".
        description: Optional longer description for the human reviewer.
        currency:    ISO 4217 currency code. Defaults to "USD".

    Returns:
        JSON response with at minimum: status, request_id. May include
        approval_token (on auto_approved) or expires_at (on pending).
    """
    payload: dict[str, Any] = {
        "action": action,
        "amount": amount,
        "vendor": vendor,
        "currency": currency,
    }
    if category is not None:
        payload["category"] = category
    if description is not None:
        payload["description"] = description

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{AGENTGATE_API_URL}/v1/authorize",
                json=payload,
                headers=_headers(api_key),
            )
        if resp.status_code in (200, 202):
            return resp.json()
        return {
            "error": True,
            "status_code": resp.status_code,
            "detail": resp.json().get("detail", resp.text),
        }
    except httpx.TimeoutException:
        return {"error": True, "detail": "Request timed out. The AgentGate API did not respond in time."}
    except Exception as exc:
        return {"error": True, "detail": str(exc)}


@mcp.tool()
async def check_authorization_status(
    api_key: str,
    request_id: str,
) -> dict[str, Any]:
    """Check the status of a pending authorization request.

    Use this to poll for human approval after authorize_transaction returns
    status="pending". Poll every 5–10 seconds; stop when status changes from
    "pending" to "approved", "denied", "expired", or "cancelled".

    Typical polling loop:
        1. Call authorize_transaction → status="pending", request_id="abc-123"
        2. Wait 10 seconds.
        3. Call check_authorization_status(request_id="abc-123") → status="pending"
        4. Wait 10 seconds.
        5. Call check_authorization_status(request_id="abc-123") → status="approved"
        6. Proceed with the transaction.

    Args:
        api_key:    Your AgentGate API key.
        request_id: The request ID returned by authorize_transaction.

    Returns:
        JSON with status field. If status="approved", an approval_token is
        also included.
    """
    url = f"{AGENTGATE_API_URL}/v1/authorize/{request_id}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=_headers(api_key))
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 404:
            return {
                "error": True,
                "status_code": 404,
                "detail": "Authorization request not found — it may have expired (requests expire after 5 minutes).",
                "url_called": url,
            }
        try:
            detail = resp.json().get("detail", resp.text)
        except Exception:
            detail = resp.text
        return {
            "error": True,
            "status_code": resp.status_code,
            "detail": detail,
            "url_called": url,
        }
    except httpx.TimeoutException:
        return {"error": True, "detail": "Request timed out.", "url_called": url}
    except Exception as exc:
        return {"error": True, "detail": str(exc), "url_called": url}


@mcp.tool()
async def cancel_authorization(
    api_key: str,
    request_id: str,
) -> dict[str, Any]:
    """Cancel a pending authorization request that is no longer needed.

    Use this when you submitted a transaction for human approval but the user
    has since decided not to proceed, or the context has changed and the
    request is no longer relevant. Only pending requests can be cancelled.

    Args:
        api_key:    Your AgentGate API key.
        request_id: The request ID to cancel.

    Returns:
        {"cancelled": true} on success, or an error dict on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.delete(
                f"{AGENTGATE_API_URL}/v1/authorize/{request_id}",
                headers=_headers(api_key),
            )
        if resp.status_code == 204:
            return {"cancelled": True, "request_id": request_id}
        return {
            "error": True,
            "status_code": resp.status_code,
            "detail": resp.json().get("detail", resp.text),
        }
    except httpx.TimeoutException:
        return {"error": True, "detail": "Request timed out. The AgentGate API did not respond in time."}
    except Exception as exc:
        return {"error": True, "detail": str(exc)}
