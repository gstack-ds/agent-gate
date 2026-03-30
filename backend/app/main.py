import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.agents import router as agents_router
from app.api.authorize import router as authorize_router
from app.api.dashboard import router as dashboard_router
from app.api.oauth import router as oauth_router
from app.api.oauth_bearer import MCPBearerMiddleware
from app.api.requests import router as requests_router
from app.api.rules import router as rules_router
from app.api.usage import router as usage_router
from app.mcp_server import mcp
from app.services import expiration

# Build the MCP sub-app now so session_manager is initialised before lifespan runs.
_mcp_app = mcp.streamable_http_app()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Use os.getenv() directly to bypass pydantic-settings and show exactly
    # what Railway injected — disambiguates "var not set" from "pydantic loaded
    # an empty .env value".
    _raw_url = os.getenv("SUPABASE_URL", "")
    _raw_key = os.getenv("SUPABASE_ANON_KEY", "")
    _raw_api = os.getenv("API_URL", "")
    anon_preview = (_raw_key[:10] + "...") if _raw_key else "(not set)"
    logger.info(
        "AgentGate startup (raw env) — SUPABASE_URL=%s SUPABASE_ANON_KEY=%s API_URL=%s",
        _raw_url or "(not set)",
        anon_preview,
        _raw_api or "(not set — will use pydantic default)",
    )
    logger.info(
        "AgentGate startup (pydantic) — SUPABASE_URL=%s SUPABASE_ANON_KEY=%s API_URL=%s",
        settings.SUPABASE_URL or "(not set)",
        (settings.SUPABASE_ANON_KEY[:10] + "...") if settings.SUPABASE_ANON_KEY else "(not set)",
        settings.API_URL,
    )
    # mcp.session_manager.run() provides the anyio task group the MCP handler
    # requires — without it every request returns 500 "Task group not initialized".
    async with mcp.session_manager.run():
        task = asyncio.create_task(expiration.run_expiration_loop())
        yield
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


logger = logging.getLogger(__name__)

app = FastAPI(
    lifespan=lifespan,
    redirect_slashes=False,
    title="AgentGate API",
    description=(
        "Human authorization gateway for AI agent transactions. "
        "Agents submit requests; humans approve or deny via the dashboard."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://agentgate-two.vercel.app",
]
_extra = os.getenv("CORS_ORIGINS", "")
if _extra:
    _origins.extend([o.strip() for o in _extra.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Agent-facing endpoints (API key auth)
app.include_router(authorize_router, prefix="/v1", tags=["authorization"])

# Human-facing endpoints (Supabase JWT auth)
app.include_router(agents_router, prefix="/v1", tags=["agents"])
app.include_router(rules_router, prefix="/v1", tags=["rules"])
app.include_router(requests_router, prefix="/v1", tags=["requests"])
app.include_router(dashboard_router, prefix="/v1", tags=["dashboard"])
app.include_router(usage_router, prefix="/v1", tags=["usage"])

# OAuth 2.1 endpoints (no prefix — includes /.well-known path)
app.include_router(oauth_router, tags=["oauth"])


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}


# MCP server — Streamable HTTP transport, mounted at /mcp.
# Wrapped in MCPBearerMiddleware: returns 401 + WWW-Authenticate when no
# Bearer token present, injects the token into a ContextVar otherwise.
app.mount("/mcp", MCPBearerMiddleware(_mcp_app, settings.API_URL))
