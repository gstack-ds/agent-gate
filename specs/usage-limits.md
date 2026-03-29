# Usage Limits — Implementation Plan

## Goal
Enforce per-plan monthly request limits and agent counts. Add upsell signals at 80%/100% usage. Add $10k hard ceiling on auto-approvals. Add high-threshold rule warning. No Stripe yet — all users stay on "free".

## Approach

### Backend (8 changes)

**1. DB migration** — `supabase/migrations/002_add_plan_column.sql`
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free'`
- No table recreate, no data loss.

**2. `backend/app/config/plans.py`** (new file)
- `PLAN_LIMITS` dict with free/starter/pro/business tiers
- `PLAN_ORDER` list for "next tier" logic in upsell errors
- Helper `get_next_plan(plan)` → returns next tier name or None

**3. `backend/app/models/database.py`** — add `plan` column to `User`

**4. `backend/app/services/usage.py`** (new file)
- `UsageCache` — in-memory cache (60s TTL) for request counts per user
- `async get_requests_this_month(user_id, db)` — SELECT COUNT via agents JOIN
- `async get_active_agents(user_id, db)` — SELECT COUNT agents WHERE status='active'
- `invalidate(user_id)` — called on cache miss or explicit clear

**5. `backend/app/api/authorize.py`** — request throttle + hard ceiling
- Before rule evaluation: fetch user, call `get_requests_this_month`
  - If `limit is None`: skip
  - If `count >= limit * 1.1`: 429 with upsell JSON body
  - If `count >= limit`: proceed but add `plan_warning` to response
- After rule evaluation: if `decision == "auto_approved"` and `amount > 10_000`: override to `"pending"` (hard ceiling)
- Need to load `user` here — it's already loaded for notifications in the existing code, so move that load up.

**6. `backend/app/api/agents.py`** — agent throttle
- On `POST /v1/agents`: count active agents before creating
  - If `count >= limit`: 403 with upsell JSON body

**7. `backend/app/api/usage.py`** (new file)
- `GET /v1/usage` → `UsageResponse` (plan, requests_this_month, requests_limit, agents_active, agents_limit)
- Uses `UserDep`, calls the usage service

**8. `backend/app/main.py`** — register usage router

### Schema changes (additive only)
- `AuthorizeResponse`: add optional `plan_warning: Optional[str] = None`
- New `UsageResponse` schema in schemas.py

### Dashboard (3 changes)

**9. `dashboard/src/lib/api.ts`**
- Add `UsageData` interface
- Add `getUsage()` function → `GET /v1/usage`

**10. `dashboard/src/app/(dashboard)/page.tsx`** — usage bar + upsell
- SWR fetch `getUsage()`
- Below metric cards: render `UsageBar` showing "X / Y requests this month" with amber at 80%, red at 100%
- At 80%+: show upsell card with next-tier CTA
- At 100%: show full-width banner (agents paused message)

**11. `dashboard/src/app/(dashboard)/rules/page.tsx`** (or wherever rules are created)
- High-threshold warning: when creating an `auto_approve_below` or `require_approval_above` rule with value > 1_000, show shadcn `AlertDialog` confirmation before submitting.

### Tests (1 change)

**12. `backend/tests/test_usage_limits.py`** (new file)
- Test request throttle: under limit → 200, at limit → 429 with upsell body
- Test grace period: count at 100% → proceed + warning, at 110% → 429
- Test agent throttle: under limit → 201, at limit → 403 with upsell body
- Test `GET /v1/usage` returns correct counts
- Test $10k ceiling: auto_approve rule + amount > 10k → status is pending

## Key decisions

- **Grace period**: overage warning included in the response as `plan_warning` field (additive, doesn't break existing schema consumers).
- **Cache**: same in-memory pattern as `RateLimiter`. 60s TTL per `user_id`. Invalidation not needed for correctness given grace period.
- **$10k ceiling**: applied AFTER rule evaluation (doesn't touch rule engine), overrides only `auto_approved` → `pending`.
- **Downgrade protection** (item 10): skip — no plan management endpoint exists yet. Will be relevant when Stripe is connected.
- **User load in authorize**: move the existing user query (currently inside the `if result.decision == "pending"` block) to before rule evaluation so we can read `user.plan`.

## Files touched
| File | Action |
|------|--------|
| `supabase/migrations/002_add_plan_column.sql` | New |
| `backend/app/config/plans.py` | New |
| `backend/app/services/usage.py` | New |
| `backend/app/api/usage.py` | New |
| `backend/app/tests/test_usage_limits.py` | New |
| `backend/app/models/database.py` | Edit (add plan column) |
| `backend/app/models/schemas.py` | Edit (add plan_warning to AuthorizeResponse, add UsageResponse) |
| `backend/app/api/authorize.py` | Edit (throttle + ceiling) |
| `backend/app/api/agents.py` | Edit (agent throttle) |
| `backend/app/main.py` | Edit (register usage router) |
| `dashboard/src/lib/api.ts` | Edit (add getUsage) |
| `dashboard/src/app/(dashboard)/page.tsx` | Edit (usage bar + upsell) |
| `dashboard/src/app/(dashboard)/rules/page.tsx` | Edit (high-threshold dialog) |

## Done looks like
- `pytest` passes (79 existing + new tests)
- `npm run build` passes
- Free user hitting 200 requests gets 429 with upsell body
- Free user with 201 requests gets 10% grace (overage warning in response)
- Free user at 220 requests gets hard 429
- Creating 3rd agent on free plan returns 403
- `GET /v1/usage` returns correct counts
- Dashboard Overview shows usage bar
- Auto-approve rule + $11k transaction → status is pending
