import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
from starlette.types import ASGIApp, Receive, Scope, Send

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
    for route in app.routes:
        logger.info("Route: %s -> %s", getattr(route, "path", "(no path)"), type(route).__name__)

    async with mcp.session_manager.run():
        task = asyncio.create_task(expiration.run_expiration_loop())
        yield
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


logger = logging.getLogger(__name__)


class _RequestLogger:
    """Pure ASGI middleware — logs every HTTP request before routing."""
    def __init__(self, app: ASGIApp) -> None:
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            logger.info(
                "REQUEST %s %s headers=%s",
                scope.get("method", "?"),
                scope.get("path", "?"),
                {k.decode(): v.decode("utf-8", errors="replace")
                 for k, v in scope.get("headers", [])
                 if k.lower() in (b"authorization", b"content-type", b"mcp-session-id")},
            )
        await self._app(scope, receive, send)


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
# Outermost middleware — logs every request before CORS or routing touches it.
app.add_middleware(_RequestLogger)

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


# MCP server — Streamable HTTP transport at /mcp.
# Registered as explicit routes instead of app.mount() because Starlette 1.0
# changed Mount path regex to require a trailing slash separator, which means
# app.mount("/mcp") no longer matches bare POST /mcp.
_mcp_handler = MCPBearerMiddleware(_mcp_app, settings.API_URL)


async def _mcp_proxy(request: Request) -> StreamingResponse:
    """ASGI proxy: rewrites path to '/' and forwards to the FastMCP handler."""
    scope = dict(request.scope)
    scope["path"] = "/"
    scope["raw_path"] = b"/"

    headers_ready = asyncio.Event()
    _status: list[int] = []
    _resp_headers: list = []
    body_queue: asyncio.Queue[tuple[bytes, bool]] = asyncio.Queue()

    async def _send(message: dict) -> None:
        if message["type"] == "http.response.start":
            _status.append(message["status"])
            _resp_headers.extend(message.get("headers", []))
            headers_ready.set()
        elif message["type"] == "http.response.body":
            await body_queue.put((
                message.get("body", b""),
                message.get("more_body", False),
            ))

    handler_task = asyncio.create_task(
        _mcp_handler(scope, request._receive, _send)
    )

    await asyncio.wait_for(headers_ready.wait(), timeout=30.0)

    async def _body_stream():
        while True:
            body, more = await body_queue.get()
            if body:
                yield body
            if not more:
                break
        await handler_task

    resp_headers = {k.decode(): v.decode() for k, v in _resp_headers}
    return StreamingResponse(
        _body_stream(),
        status_code=_status[0],
        headers=resp_headers,
    )


# Both /mcp and /mcp/ are registered so clients that append a trailing slash
# also reach the handler (redirect_slashes=False means no automatic redirect).
app.add_api_route("/mcp", _mcp_proxy, methods=["GET", "POST", "DELETE"], include_in_schema=False)
app.add_api_route("/mcp/", _mcp_proxy, methods=["GET", "POST", "DELETE"], include_in_schema=False)
