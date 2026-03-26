# AgentGate — Agent Authorization Gateway

## Project Overview

AgentGate is a lightweight authorization gateway that sits between AI agents and financial transactions. It gives humans control over what their AI agents can spend, with configurable auto-approval rules and real-time notifications for out-of-bounds requests.

**Core Value Prop:** Three lines of code for the developer. One swipe to approve for the human.

```python
from agentgate import AgentGate
gate = AgentGate(api_key="sk-...")
approval = gate.authorize(action="purchase", amount=49.99, vendor="AWS", description="Provision EC2 instance")
```

**Product Philosophy:** The developer experience IS the product. If integration feels like a burden, nobody uses it. The system should be invisible when things are within bounds and instant when human approval is needed.

---

## Architecture

### System Components

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Agent SDK   │────▶│  AgentGate API   │────▶│  Human Dashboard│
│  (Python/JS) │◀────│  (FastAPI/Lambda) │◀────│  (React SPA)    │
└──────────────┘     └────────┬─────────┘     └─────────────────┘
                              │
                     ┌────────┴─────────┐
                     │    Supabase      │
                     │  - Auth          │
                     │  - PostgreSQL    │
                     │  - Realtime WS   │
                     └──────────────────┘
```

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| API Backend | FastAPI (Python) | Fast, async, auto-generates OpenAPI docs |
| Database | Supabase (PostgreSQL) | Auth, DB, realtime subscriptions in one |
| Dashboard | React + Tailwind | Familiar stack, mobile-responsive |
| Notifications | Supabase Realtime + Email (Resend) | Start simple, add SMS/push later |
| SDK | Python package (PyPI) | Primary audience is agent developers |
| Auth | Supabase Auth + API keys | Humans use Supabase Auth, agents use API keys |
| Hosting | TBD (Railway, Fly.io, or AWS Lambda) | Evaluate at deploy time — prioritize speed for MVP |

---

## Data Model

### Tables

```sql
-- Human users who own agents
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    supabase_auth_id UUID UNIQUE,
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registered AI agents
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                    -- "My Shopping Agent"
    api_key_hash TEXT UNIQUE NOT NULL,     -- hashed API key
    api_key_prefix TEXT NOT NULL,          -- "sk-abc..." for display
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
    metadata JSONB DEFAULT '{}',           -- agent framework, version, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spending rules and permissions per agent
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'max_per_transaction',     -- single transaction limit
        'max_per_day',             -- daily aggregate limit
        'max_per_month',           -- monthly aggregate limit
        'allowed_vendors',         -- whitelist of vendors
        'blocked_vendors',         -- blacklist of vendors
        'allowed_categories',      -- e.g., "cloud_services", "office_supplies"
        'blocked_categories',      -- categories to always deny
        'require_approval_above',  -- always ask human above this amount
        'auto_approve_below'       -- always approve below this amount
    )),
    value JSONB NOT NULL,          -- {"amount": 50.00} or {"vendors": ["AWS", "GCP"]}
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Authorization requests from agents
CREATE TABLE authorization_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id),
    action TEXT NOT NULL,               -- "purchase", "subscribe", "transfer"
    amount DECIMAL(12,2),
    currency TEXT DEFAULT 'USD',
    vendor TEXT,
    category TEXT,
    description TEXT,                   -- agent's description of why
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'auto_approved',    -- within rules, no human needed
        'pending',          -- waiting for human
        'approved',         -- human approved
        'denied',           -- human denied
        'expired',          -- timed out waiting for human
        'cancelled'         -- agent cancelled the request
    )),
    approval_token TEXT UNIQUE,         -- signed JWT for approved requests
    rule_evaluation JSONB,              -- which rules matched and why
    resolved_by TEXT,                   -- 'system' or 'human'
    resolved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,             -- requests expire if not acted on
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for all activity
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    agent_id UUID REFERENCES agents(id),
    request_id UUID REFERENCES authorization_requests(id),
    event_type TEXT NOT NULL,           -- 'request_created', 'auto_approved', 'human_approved', etc.
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auth_requests_agent ON authorization_requests(agent_id);
CREATE INDEX idx_auth_requests_status ON authorization_requests(status);
CREATE INDEX idx_auth_requests_created ON authorization_requests(created_at);
CREATE INDEX idx_rules_agent ON rules(agent_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

---

## API Endpoints

### Agent-Facing (API Key Auth)

```
POST   /v1/authorize              - Submit authorization request
GET    /v1/authorize/{request_id} - Check request status (poll)
DELETE /v1/authorize/{request_id} - Cancel pending request
```

### Human-Facing (Supabase Auth / JWT)

```
# Agents
GET    /v1/agents                 - List my agents
POST   /v1/agents                 - Register new agent (returns API key)
PATCH  /v1/agents/{id}            - Update agent (name, status)
DELETE /v1/agents/{id}            - Revoke agent

# Rules
GET    /v1/agents/{id}/rules      - List rules for agent
POST   /v1/agents/{id}/rules      - Add rule
PATCH  /v1/rules/{id}             - Update rule
DELETE /v1/rules/{id}             - Delete rule

# Requests
GET    /v1/requests               - List pending/recent requests
POST   /v1/requests/{id}/approve  - Approve pending request
POST   /v1/requests/{id}/deny     - Deny pending request

# Dashboard
GET    /v1/dashboard/stats        - Spending summary, approval rates
GET    /v1/dashboard/activity     - Recent activity feed
```

### Webhook (Outbound)

```
POST   {user_webhook_url}         - Notify on pending request (optional)
```

---

## Authorization Flow

```
Agent calls POST /v1/authorize
    │
    ▼
Validate API key → identify agent + owner
    │
    ▼
Load agent's rules
    │
    ▼
Evaluate rules against request
    │
    ├── All rules pass → AUTO_APPROVE
    │   └── Return approval token immediately
    │
    ├── Explicit deny rule matched → DENY
    │   └── Return denied status immediately
    │
    └── Needs human review → PENDING
        ├── Send notification to human (realtime + email)
        ├── Agent polls or uses websocket for status
        └── Human approves/denies from dashboard
            └── Return approval token or denied status
```

### Rule Evaluation Logic (Priority Order)

1. Check `blocked_vendors` / `blocked_categories` → instant DENY
2. Check `auto_approve_below` → if amount under threshold, AUTO_APPROVE
3. Check `require_approval_above` → if amount over threshold, PENDING
4. Check `max_per_transaction` → if over, PENDING
5. Check `max_per_day` (aggregate today's approved amounts) → if would exceed, PENDING
6. Check `max_per_month` (aggregate this month) → if would exceed, PENDING
7. Check `allowed_vendors` / `allowed_categories` → if not in whitelist, PENDING
8. Default: PENDING (no rules configured → always requires human review until user sets auto-approve thresholds)

---

## Phases

### Phase 1: Core API + Basic Dashboard (MVP)
**Goal:** Working authorization flow end-to-end

- [ ] Supabase project setup (auth, database, realtime)
- [ ] Database migrations (all tables above)
- [ ] FastAPI backend with core endpoints
  - [ ] Agent registration + API key generation
  - [ ] POST /v1/authorize with rule evaluation engine
  - [ ] GET /v1/authorize/{id} for polling
  - [ ] Human approve/deny endpoints
- [ ] Rule evaluation engine
- [ ] JWT approval token generation + signing
- [ ] React dashboard (minimal)
  - [ ] Login/signup (Supabase Auth)
  - [ ] Register agent → get API key
  - [ ] Set basic rules (max per transaction, daily limit)
  - [ ] View pending requests → approve/deny
  - [ ] Transaction history list
- [ ] Python SDK (`agentgate` package)
  - [ ] `AgentGate(api_key=...)` client
  - [ ] `gate.authorize(action, amount, vendor, description)` → blocks until resolved
  - [ ] `gate.authorize_async(...)` → returns request_id for polling
- [ ] Supabase Realtime for live pending request updates on dashboard
- [ ] Email notifications via Resend for pending requests

### Phase 2: Polish + Developer Experience
**Goal:** Make it production-ready for early adopters

- [ ] SDK improvements
  - [ ] JavaScript/TypeScript SDK
  - [ ] LangChain integration (as a tool wrapper)
  - [ ] CrewAI integration
  - [ ] Detailed error messages and retry logic
- [ ] Dashboard improvements
  - [ ] Spending analytics charts (daily/weekly/monthly)
  - [ ] Rule templates ("Conservative", "Moderate", "Permissive")
  - [ ] Agent activity timeline
  - [ ] Mobile-responsive approval flow
- [ ] SMS notifications (Twilio)
- [ ] Push notifications (web push)
- [ ] Request expiration handling (background job)
- [ ] Rate limiting on API
- [ ] OpenAPI spec published

### Phase 3: Open Protocol + Growth
**Goal:** Establish the standard, grow adoption

- [ ] Publish Agent Transaction Authorization Protocol (ATAP) spec
  - [ ] JSON Schema for authorization requests/responses
  - [ ] Protocol documentation on GitHub
  - [ ] Reference implementation
- [ ] Vendor-side verification endpoint
  - [ ] Merchants can verify approval tokens
  - [ ] Token introspection API
- [ ] Webhook system for integrations
- [ ] Multi-agent support (teams of agents under one owner)
- [ ] Tiered pricing implementation
  - [ ] Free: 100 requests/month, 1 agent
  - [ ] Pro ($29/mo): 5,000 requests, 10 agents, SMS
  - [ ] Business ($99/mo): 50,000 requests, unlimited agents, webhooks, analytics export
  - [ ] Enterprise ($299/mo): custom limits, SSO, audit compliance, SLA

### Phase 4: Intelligence Layer
**Goal:** Differentiate with data

- [ ] Anomaly detection (unusual spending patterns)
- [ ] Smart rule suggestions based on agent behavior
- [ ] Aggregated market intelligence dashboard
- [ ] Budget forecasting based on agent activity trends
- [ ] Compliance reporting (exportable audit trails)
- [ ] Multi-currency support

---

## Project Structure

```
agentgate/
├── CLAUDE.md
├── README.md
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Settings, env vars
│   │   ├── models/
│   │   │   ├── database.py      # SQLAlchemy/Supabase models
│   │   │   └── schemas.py       # Pydantic request/response models
│   │   ├── api/
│   │   │   ├── agents.py        # Agent CRUD endpoints
│   │   │   ├── authorize.py     # Core authorization endpoint
│   │   │   ├── rules.py         # Rule CRUD endpoints
│   │   │   ├── requests.py      # Human approve/deny endpoints
│   │   │   └── dashboard.py     # Stats and activity endpoints
│   │   ├── services/
│   │   │   ├── rule_engine.py   # Rule evaluation logic
│   │   │   ├── token_service.py # JWT approval token generation
│   │   │   ├── notification.py  # Email/SMS dispatch
│   │   │   └── audit.py         # Audit logging
│   │   └── middleware/
│   │       ├── auth.py          # API key + Supabase JWT auth
│   │       └── rate_limit.py    # Rate limiting
│   ├── requirements.txt
│   └── template.yaml            # SAM template for Lambda deploy
├── dashboard/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Agents.jsx
│   │   │   ├── Rules.jsx
│   │   │   ├── Requests.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── components/
│   │   │   ├── ApprovalCard.jsx
│   │   │   ├── RuleEditor.jsx
│   │   │   ├── SpendingChart.jsx
│   │   │   └── AgentCard.jsx
│   │   └── lib/
│   │       ├── supabase.js
│   │       └── api.js
│   ├── package.json
│   └── tailwind.config.js
├── sdk/
│   ├── python/
│   │   ├── agentgate/
│   │   │   ├── __init__.py
│   │   │   ├── client.py        # AgentGate class
│   │   │   ├── models.py        # Response types
│   │   │   └── exceptions.py    # Custom errors
│   │   ├── setup.py
│   │   └── README.md
│   └── javascript/              # Phase 2
│       ├── src/
│       │   └── index.ts
│       └── package.json
├── protocol/                     # Phase 3
│   ├── ATAP-spec-v1.md
│   └── schemas/
│       ├── authorize-request.json
│       └── authorize-response.json
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## SDK Design

### Python SDK (Primary)

```python
from agentgate import AgentGate, AuthorizationError, AuthorizationDenied, AuthorizationExpired

# Initialize
gate = AgentGate(
    api_key="sk-ag-abc123...",
    base_url="https://api.agentgate.dev",  # optional, defaults to production
    timeout=300,                             # max seconds to wait for human approval
    poll_interval=2,                         # seconds between status checks
)

# Simple authorize (blocks until resolved)
try:
    approval = gate.authorize(
        action="purchase",
        amount=49.99,
        vendor="AWS",
        category="cloud_services",
        description="Provision t3.medium EC2 instance for data processing"
    )
    print(approval.token)       # signed JWT to pass to vendor
    print(approval.status)      # "auto_approved" or "approved"
    print(approval.resolved_by) # "system" or "human"
except AuthorizationDenied as e:
    print(f"Request denied: {e.reason}")
except AuthorizationExpired:
    print("Human didn't respond in time")

# Async authorize (non-blocking)
request = gate.authorize_async(
    action="subscribe",
    amount=29.99,
    vendor="OpenAI",
    description="Monthly API subscription"
)
print(request.id)       # UUID
print(request.status)   # "pending"

# Check later
status = gate.check(request.id)
print(status["status"])  # "pending", "approved", "denied", "expired"
```

---

## Absolute Rules

1. **Never store API keys in plaintext** — SHA-256 hash on write, hash on lookup
2. **Never skip or disable failing tests** — fix the issue or flag it
3. **Never merge PRs** — leave merging to Gary
4. **Audit log entries are added to the session but NOT committed** — caller commits atomically with the primary record
5. **`Agent.metadata_` (underscore) is the Python attribute** — maps to `metadata` column. Never use `Agent.metadata` — that's SQLAlchemy's `MetaData` object at the class level

---

## Active Gotchas

**2026-03-23**
**What happened:** `AgentResponse` couldn't serialize ORM `Agent` objects — Pydantic read `agent.metadata` and got SQLAlchemy's `MetaData()` object, not our dict.
**Root cause:** `DeclarativeBase` exposes a class-level `.metadata` (`MetaData`) attribute that shadows our JSON column when accessed via `agent.metadata`.
**Fix:** Column stored as `metadata_` in Python (`mapped_column("metadata", ...)`), schema uses `Field(validation_alias="metadata_")` with `populate_by_name=True`.
**Rule:** Always use `metadata_` for the Python attribute. Never use `Field(alias=...)` alone — use `validation_alias` + `populate_by_name=True`.

**2026-03-23**
**What happened:** `Rule.__new__(Rule)` then setting attributes via assignment raised `AttributeError: 'NoneType' object has no attribute 'set'` in SQLAlchemy instrumented columns.
**Root cause:** SQLAlchemy ORM instruments attributes during `__init__`. Bypassing `__init__` via `__new__` leaves descriptors uninitialized.
**Fix:** Always use proper constructors: `Rule(id=..., rule_type=..., ...)`. Use `SimpleNamespace` for pure unit tests that don't need ORM.
**Rule:** Never use `Foo.__new__(Foo)` for ORM models in tests.

**2026-03-26**
**What happened:** Supabase switched JWT signing from HS256 (shared secret) to ES256 (ECC P-256). `require_user` was using `SUPABASE_JWT_SECRET` with `jwt.decode()` and all dashboard requests started returning 401.
**Root cause:** Supabase now signs with a private EC key; the shared secret is no longer valid for verification.
**Fix:** Replaced shared-secret verification with JWKS fetch from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Module-level `_jwks_cache` avoids fetching on every request. Removed `SUPABASE_JWT_SECRET` from config.
**Rule:** Never use a Supabase shared JWT secret for token verification. Always use the JWKS endpoint. The `JWT_SECRET` in config is only for our own approval tokens (HS256).

**2026-03-26**
**What happened:** Dashboard activity feed rendered colored dots but no text — sentences were silently dropped.
**Root cause:** `buildSentence()` was only looking at `details.agent_name` but the backend returns `agent_name` as a top-level field on the activity event object.
**Fix:** Check top-level `event.agent_name` first, then `event.details?.agent_name`, then fall back to `"An agent"`. Apply the same top-level-first pattern to all fields from `GET /v1/dashboard/activity`.
**Rule:** When consuming activity feed events, always check top-level fields before drilling into `details`.

**2026-03-26**
**What happened:** Railway deploy failed — "COPY app/ app/ not found". `dockerfilePath` was set but not `buildContext`.
**Root cause:** Railway resolves `COPY` paths relative to `buildContext`, not the Dockerfile location. Without `buildContext = "backend"`, Docker's build context was the repo root where `app/` doesn't exist.
**Fix:** Added `buildContext = "backend"` to `railway.toml`.
**Rule:** When `dockerfilePath` is not at the repo root, always set `buildContext` explicitly in `railway.toml`.

**2026-03-26**
**What happened:** Railway deploy crashed with `DuplicatePreparedStatementError` on every DB query.
**Root cause:** Supabase Transaction Pooler uses pgbouncer, which doesn't support PostgreSQL prepared statements. asyncpg's prepared statement cache sends `PREPARE` commands that confuse the pooler.
**Fix:** Added `connect_args={"statement_cache_size": 0}` to `create_async_engine()` in `database.py`.
**Rule:** Always set `statement_cache_size=0` when connecting through Supabase Transaction Pooler (pgbouncer). Session Pooler or Direct Connection don't need this.

---

## Design Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-23 | SHA-256 for API key hashing (not bcrypt) | Deterministic + indexed lookup. bcrypt is for passwords (user-chosen secrets); random 32-byte tokens don't need a cost factor |
| 2026-03-23 | `id=uuid.uuid4()` set explicitly in handlers | Avoids DB round-trip dependency in tests; `server_default` only fires on real DB inserts |
| 2026-03-23 | Audit log uses `db.add()` without commit | Ensures audit entry and primary record commit atomically — caller commits both |
| 2026-03-23 | `filter_status: Optional[RequestStatus] = Query(None, alias="status")` | `status` as a parameter name shadows `fastapi.status` module; aliased param keeps URL clean |
| 2026-03-24 | `RateLimiter` as module-level singleton in `rate_limiter.py` | Simple in-process sliding window; good enough for MVP; `reset()` method enables clean test isolation |
| 2026-03-24 | Expiration via `asyncio.create_task` in FastAPI lifespan | No external scheduler needed for MVP; task cancelled cleanly on shutdown |
| 2026-03-24 | Rule templates are static data in `rules.py` | No DB needed for read-only presets; templates are returned as-is, user applies them via separate create_rule calls |
| 2026-03-26 | Rule engine Step 8 default changed from `auto_approved` → `pending` | New agents with no rules must require human approval for everything. Users must explicitly set `auto_approve_below` to enable any automatic approvals. Safer default. |
| 2026-03-26 | Supabase JWT verification via JWKS, not shared secret | Supabase migrated to ES256. JWKS endpoint is the correct long-term approach. `SUPABASE_JWT_SECRET` removed from config. |
| 2026-03-26 | Dashboard: Next.js 16, App Router, Tailwind v4, shadcn/ui v4, SWR, next-themes, sonner | Built from scratch in `dashboard/`. `middleware.ts` is named `proxy.ts` in Next.js 16. shadcn Button no longer supports `asChild`. |
| 2026-03-26 | Dashboard auto-creates two default rules on agent registration | `require_approval_above $25` + `max_per_day $100` posted immediately after agent creation. Graceful fallback if rules API fails. |
| 2026-03-26 | Backend deployed to Railway; dashboard to Vercel (agentgate-two.vercel.app) | Railway uses `backend/Dockerfile` + `buildContext = "backend"`. CORS hardcodes Vercel origin; `CORS_ORIGINS` env var extends the list without redeploying. |
| 2026-03-26 | CORS: hardcoded baseline origins + env var extension | `CORS_ORIGINS` env var was silently not being read in production. Hardcoded localhost + Vercel URL as baseline in `main.py`; env var appends on top. |
| 2026-03-26 | `statement_cache_size=0` for pgbouncer compatibility | Supabase Transaction Pooler (pgbouncer) doesn't support prepared statements. Disabling asyncpg's cache fixes `DuplicatePreparedStatementError`. |

---

## Current TODOs

### Completed ✅
- FastAPI scaffold + Supabase DB migrations
- `api/agents.py` — full CRUD + audit logging
- `api/authorize.py` — full auth flow + audit + notifications + rate limiting
- `services/rule_engine.py` — 8-step evaluation (Step 8 default: **PENDING**, not auto_approved)
- `services/token_service.py` — JWT approval tokens
- `services/audit.py` — atomic audit logging
- `services/notification.py` — Resend email via BackgroundTasks
- `services/rate_limiter.py` — sliding window, 10 req/60s per agent
- `services/expiration.py` — background loop, runs every 30s
- `api/rules.py` — full CRUD + rule templates endpoint
- `api/requests.py` — list, approve, deny with audit
- `api/dashboard.py` — aggregate stats + activity feed
- `sdk/python/agentgate/` — AgentGate client with authorize/authorize_async/check
- `middleware/auth.py` — Supabase JWT via JWKS/ES256, agent API key via SHA-256
- 79 backend tests passing
- **React dashboard** (`dashboard/`) — Next.js 16, App Router, TypeScript, Tailwind v4, shadcn/ui v4
  - Login/Signup (Supabase Auth)
  - Overview with metric cards (null-safe stats, correct total_spend + approval_rate)
  - Pending Requests with approve/deny + optional deny reason textarea + countdown timer
  - Agents page: revoked cards grayed out, sorted active-first, revoked agents excluded from Rules dropdown
  - Rules page with Conservative/Moderate/Permissive template cards
  - Activity feed with sentence descriptions + timeline layout
  - Dark mode toggle (light ↔ dark only, no system mode), DM Sans + IBM Plex fonts
- **Backend deployed on Railway** — `backend/Dockerfile`, `railway.toml` with `buildContext = "backend"`
- **Dashboard deployed on Vercel** — `https://agentgate-two.vercel.app`

### Up Next (Priority Order)
1. **Remove startup debug logs** — `logger.info(f"SUPABASE_URL starts with: ...")` and `logger.info(f"CORS_ORIGINS: ...")` in `backend/app/main.py` were added for Railway env var debugging. Remove once confirmed working.
2. **Verify Railway deployment is healthy** — check Railway logs to confirm `SUPABASE_URL` and `CORS_ORIGINS` are reading correctly. Confirm dashboard on Vercel can authenticate and hit the API.
3. **Supabase Realtime** — push pending requests to dashboard via websocket subscription on `authorization_requests` where `status=pending`. Dashboard currently polls every 8–10s — real-time would be better UX.
4. **Spending analytics charts** — `GET /v1/dashboard/stats` already returns all data; needs a chart component (recharts or similar) on the Overview page.
5. **JavaScript SDK** — Phase 2. Mirror the Python SDK at `sdk/javascript/`.
6. **LangChain / CrewAI integrations** — thin wrappers around the Python SDK.

### Next Session Should Start With
Check Railway logs to confirm env vars are being read (look for the SUPABASE_URL/CORS_ORIGINS startup log lines). If confirmed, remove the two debug `logger.info` lines from `backend/app/main.py`. Then do an end-to-end smoke test: login → register agent → set rules → authorize request → approve in dashboard.

---

## Common Mistakes / Active Rules

- **Test helpers for ORM models:** Use `Model(id=uuid.uuid4(), ...)` constructors, not `__new__`. Use `SimpleNamespace` for pure unit tests.
- **`mock_db.execute` side_effect for multi-call tests:** When a handler calls `db.execute` more than once (e.g., list_rules calls it twice — once for agent, once for rules), use `side_effect=[result1, result2]`.
- **Rate limiter state leaks between tests:** The `test_rate_limiter.py` `autouse` fixture calls `authorize_limiter.reset()` before/after each test. Any new test that hits POST /v1/authorize should do the same.
- **`AgentGate_CLAUDE.md` is the project CLAUDE.md** — there is no separate `CLAUDE.md` at the repo root. Pass this file path when starting a new session.
- **`agentgate api keys.txt` must never be committed** — contains real Supabase JWT secret + anon key. Add to `.gitignore` if not already there.
- **Dashboard `proxy.ts` not `middleware.ts`** — Next.js 16 renamed the auth redirect file. Don't create a `middleware.ts` or it will be ignored.
- **shadcn/ui v4: Button no longer supports `asChild`** — wrap `<Link>` around `<Button>` instead. Using `asChild` will throw a runtime error.
- **Dashboard rule templates need an agentId** — `GET /v1/agents/{id}/rules/templates` is per-agent. Template cards show always, but Apply is disabled until an agent is selected. Fallback templates are hardcoded in the frontend in case the endpoint fails.
- **Railway `buildContext` is required** — setting only `dockerfilePath` in `railway.toml` is not enough. Always pair it with `buildContext = "backend"` (or the appropriate subdirectory) or COPY commands will fail.
- **pgbouncer (Supabase Transaction Pooler) requires `statement_cache_size=0`** — always include `connect_args={"statement_cache_size": 0}` in `create_async_engine()` when targeting Supabase. Session Pooler and Direct Connection don't need this.
- **`DashboardStats` field names must match exactly** — backend returns `total_spend` and `approval_rate` (0.0–1.0 decimal); frontend `formatPct` multiplies by 100. If the field name drifts the stat shows $0 / 0%.
