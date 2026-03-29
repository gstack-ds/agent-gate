# AgentGate Backend

FastAPI authorization gateway. Agents POST to `/v1/authorize`; humans approve via the dashboard.

## Stack
- FastAPI + SQLAlchemy async + asyncpg
- Supabase (PostgreSQL + auth)
- Deployed on Railway
- MCP server at `/mcp` (Streamable HTTP)

## Key Files
- `app/main.py` — app factory, middleware, lifespan, router registration, MCP mount
- `app/mcp_server.py` — FastMCP instance + 3 MCP tools
- `app/api/authorize.py` — core authorization endpoints (POST/GET/DELETE `/v1/authorize`)
- `app/api/rules.py` — rule CRUD
- `app/services/rule_engine.py` — rule evaluation logic (DO NOT TOUCH without careful thought)
- `app/config.py` — pydantic-settings config

## Running Locally
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Tests
```bash
pytest          # 79 tests, all must pass before any commit
```

---

## Gotchas Log

**Date:** 2026-03-29
**What happened:** `app.mount("/mcp", mcp.streamable_http_app())` caused every /mcp request to 500 with "Task group is not initialized."
**Root cause:** FastAPI does NOT call the lifespan of mounted sub-applications. `StreamableHTTPSessionManager` requires its `run()` context manager to initialize the anyio task group.
**Fix:** Call `mcp.streamable_http_app()` at module level (initializes `_session_manager`), then add `async with mcp.session_manager.run():` inside the FastAPI lifespan.
**Rule:** Any FastMCP server mounted inside FastAPI must have its session manager started explicitly in the FastAPI lifespan.

---

**Date:** 2026-03-29
**What happened:** `/mcp` was returning 404 — MCP endpoint unreachable.
**Root cause:** `streamable_http_path` defaults to `"/mcp"` inside the Starlette sub-app. When FastAPI mounts the sub-app at `/mcp` it strips the prefix, so requests arrive at `/` but the internal route was at `/mcp`.
**Fix:** Set `streamable_http_path="/"` in the FastMCP constructor so the internal route is at `/`.
**Rule:** When mounting FastMCP as a FastAPI sub-app, always set `streamable_http_path="/"`.

---

**Date:** 2026-03-29
**What happened:** Remote calls to `/mcp` returned "Invalid Host header" (421).
**Root cause:** FastMCP auto-enables DNS rebinding protection when `host` defaults to `127.0.0.1`, blocking any Host header that isn't localhost.
**Fix:** Pass `transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False)`. DNS rebinding is a local-server attack; Railway HTTPS + FastAPI CORS already cover protection.
**Rule:** Always disable DNS rebinding protection when mounting FastMCP inside a deployed FastAPI app.

---

## Design Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-29 | MCP server mounted at `/mcp` inside main FastAPI app | Single Railway process, no separate port/service needed |
| 2026-03-29 | MCP tools are thin HTTP passthroughs to live API | All business logic stays in FastAPI; MCP is just a protocol adapter |
| 2026-03-29 | Disabled DNS rebinding protection on MCP server | Deployed HTTPS server, not a local server — attack vector doesn't apply |
| 2026-03-29 | `AGENTGATE_API_URL` env var for MCP tool base URL | Allows local dev to point at localhost instead of production |
| 2026-03-29 | Plan limits in `app/plans.py`, not `app/config.py` | `config.py` is a file not a directory; kept plans separate and importable |
| 2026-03-29 | 60s in-memory cache for monthly request count | COUNT on every authorize call would be expensive at scale; 60s staleness is acceptable given 10% grace period |
| 2026-03-29 | $10k ceiling applied after rule evaluation, not inside rule engine | Rule engine is frozen; ceiling is a platform-level guardrail separate from user-configured rules |
| 2026-03-29 | `plan_warning` added to `AuthorizeResponse` (additive) | Allows agents to surface overage warnings without breaking existing schema consumers |

---

## Current TODOs

- [ ] Branch `fix/mcp-check-status-debug-url` has all session work — needs PR and merge to main
- [ ] Run `supabase db push` (or paste `supabase/migrations/002_add_plan_column.sql` in Supabase SQL editor) to add `plan` column to production `users` table
- [ ] Verify usage bar shows on live dashboard after deploy
- [ ] Verify MCP endpoint works end-to-end on Railway after latest deploy
- [ ] Add Stripe billing (upgrade button charges + sets `user.plan`) — `UPGRADE_URL` already points to `/billing`
- [ ] Consider adding MCP tool tests (currently no test coverage for `mcp_server.py`)
