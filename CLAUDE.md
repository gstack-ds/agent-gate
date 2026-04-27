# SpendNod (formerly AgentGate)

Authorization gateway for AI agents and financial transactions.

## Documentation

- **Backend:** `backend/CLAUDE.md`
- **Dashboard:** `dashboard/CLAUDE.md`

## Completed

- [x] Backend split into private repo `gstack-ds/spendnod-backend` (Railway reconnect needed for auto-deploy)
- [x] Dashboard repo `gstack-ds/agent-gate` made public — Vercel deploys now work
- [x] SpendNod shield logo + favicon added to dashboard sidebar, login page, landing page, enterprise page
- [x] Google and GitHub OAuth added to login page (proxy.ts fixed to allow /auth/ routes, x-forwarded-host fix for Vercel, OAuth user auto-provisioning in backend)
- [x] Landing page pricing cards updated: "Coming Soon" → "Sign Up Now"
- [x] DNS fully configured: app.spendnod.com (Vercel dashboard), api.spendnod.com (Railway backend/MCP), spendnod.com (Vercel landing page), spendnod.com/enterprise (enterprise landing page)
- [x] CORS updated with new domains
- [x] Supabase redirect URLs updated to app.spendnod.com
- [x] NEXT_PUBLIC_API_URL set to https://api.spendnod.com
- [x] Landing page deployed as separate Vercel project (spendnod-landing repo on GitHub)
- [x] Terms of Service page live at spendnod.com/terms
- [x] Privacy Policy page live at spendnod.com/privacy
- [x] Enterprise nav link added to consumer landing page; Business tier CTA links to /enterprise
- [x] RLS enabled on all 8 Supabase tables with per-user policies (migration 004)
- [x] Supabase Security Advisor: 0 errors
- [x] Stripe billing integration complete (migration 005 adds stripe_customer_id)
- [x] Stripe webhook at /webhooks/stripe — handles checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
- [x] POST /v1/billing/checkout and POST /v1/billing/portal endpoints live
- [x] Dashboard upgrade button (free plan) and manage billing link (paid plans) in sidebar
- [x] All old agentgate/Railway URLs replaced with spendnod.com URLs across codebase
- [x] Confirmation email HTML in Supabase
- [x] 117 backend tests passing
- [x] Rules page safety improvements: risk level badges (Full control/Balanced/Hands-off), Permissive warning, clearer confirm dialog, Undo toast (POST /v1/agents/{id}/rules/restore), Conservative daily cap note
- [x] migration 006_rule_backups.sql deployed — rule_backups table live in Supabase; restore endpoint deployed to Railway
- [x] Overview page: auto-retry stats fetch once after 2s before showing error banner
- [x] Rules page: empty state with "Create agent" CTA when user has no agents
- [x] New SpendNod Handoff mark logo (two offset squares, blue→teal gradient) deployed across all HTML pages and dashboard (login, sidebar desktop + mobile)
- [x] Full favicon set (svg, ico, png sizes, apple-touch-icon, webmanifest) on spendnod.com and app.spendnod.com
- [x] Activity export: Export button on activity page → modal with CSV/JSON format, date presets (7d/30d/90d/all/custom), agent/status/category filters, browser download trigger
- [x] Backend `GET /v1/activity/export` endpoint — user-scoped, rate limited 10/hr, 16 tests (146 total passing)

## Remaining TODOs

### Pre-Launch Blockers
- [ ] Test full Stripe checkout flow end-to-end (free → upgrade → verify → cancel → verify downgrade)
- [ ] Login page redesign to match dark theme of landing site
- [ ] Rotate credentials that were briefly exposed: DB password, JWT_SECRET, RESEND_API_KEY
- [ ] Reconnect Railway to gstack-ds/spendnod-backend for auto-deploys (currently manual redeploy required)

### Launch Actions
- [ ] Demo video #1 — SDK flow (storyboard ready)
- [ ] Demo video #2 — MCP flow (60 seconds)
- [ ] MCP marketplace listings (mcpmarket.com, PulseMCP, LobeHub)
- [ ] First public post (LinkedIn, Twitter/X)
- [ ] Call Andrew Bosin for ToS/Privacy Policy review (201-446-9643)

### QA / Verification
- [ ] Test MCP with Claude Desktop, Cursor, VS Code, OpenClaw
- [ ] Tier enforcement live test (bash script)

### Later (not launch blockers)
- [ ] Publish SDK to PyPI
- [ ] Webhook callbacks
- [ ] SMS notifications via Twilio
- [x] Analytics export (CSV download)
- [ ] Slack/Teams integration
- [ ] Push notifications
- [ ] Supabase Realtime (replace polling)
