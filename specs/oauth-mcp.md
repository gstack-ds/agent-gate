# OAuth 2.1 MCP Authentication

## Goal
Allow MCP clients (Claude Desktop, Cursor, Claude Code) to authenticate by logging in through a browser instead of manually copying API keys. The MCP config becomes just the server URL — credentials flow automatically via OAuth 2.1 + PKCE.

## Approach
Standard OAuth 2.1 Authorization Code flow with PKCE (S256). Public clients only (no client_secret). Tokens stored as SHA-256 hashes, same as agent API keys.

### Flow
1. MCP client connects to `/mcp` → middleware returns 401 + `WWW-Authenticate: Bearer resource_metadata="/.well-known/oauth-authorization-server"`
2. Client fetches metadata → gets `authorization_endpoint`, `token_endpoint`
3. Client opens browser to `/oauth/authorize?...` → server shows login form
4. User enters email/password → validated against Supabase → login_proof JWT issued (5 min TTL)
5. Browser redirected to `/oauth/consent?lp=...` → server shows consent page
6. User clicks Allow → server issues auth code → redirect to `redirect_uri?code=...`
7. Client POSTs to `/oauth/token` with code + code_verifier → PKCE verified → access token returned
8. Client re-connects to `/mcp` with `Authorization: Bearer <token>` → middleware stores in ContextVar → MCP tools use it

### Token → Agent resolution
`require_agent` tries agent API key hash first; if not found, tries OAuth token hash → gets user → first active agent.

## Key Files
- NEW: `supabase/migrations/003_oauth_tables.sql`
- NEW: `backend/app/services/oauth_service.py`
- NEW: `backend/app/api/oauth.py`
- NEW: `backend/app/api/oauth_bearer.py`
- NEW: `backend/tests/test_oauth.py`
- EDIT: `backend/app/models/database.py` (3 ORM models)
- EDIT: `backend/app/middleware/auth.py` (extend require_agent)
- EDIT: `backend/app/mcp_server.py` (remove api_key params, use ContextVar)
- EDIT: `backend/app/main.py` (register router, wrap MCP)
- EDIT: `backend/app/config.py` (add API_URL)
- EDIT: `backend/app/services/expiration.py` (clean up expired OAuth rows)

## Done When
- `pytest` passes (90+ tests)
- `/.well-known/oauth-authorization-server` returns valid metadata JSON
- `/mcp` returns 401 with WWW-Authenticate when no Bearer token
- MCP tools work without `api_key` parameter
- Dynamic client registration works at `/oauth/register`
