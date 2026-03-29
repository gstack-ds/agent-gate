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
from app.api.requests import router as requests_router
from app.api.rules import router as rules_router
from app.api.usage import router as usage_router
from app.mcp_server import mcp
from app.services import expiration

# Build the MCP sub-app now so session_manager is initialised before lifespan runs.
_mcp_app = mcp.streamable_http_app()


@asynccontextmanager
async def lifespan(app: FastAPI):
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


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}


# MCP server — Streamable HTTP transport, mounted at /mcp
app.mount("/mcp", _mcp_app)
