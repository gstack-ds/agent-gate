# SpendNod (formerly AgentGate)

Authorization gateway for AI agents and financial transactions.

## Documentation

- **Backend:** `backend/CLAUDE.md`
- **Dashboard:** `dashboard/CLAUDE.md`

## Completed

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

## Remaining TODOs

### Pre-Launch Blockers
- [ ] Test full Stripe checkout flow end-to-end (free → upgrade → verify → cancel → verify downgrade)
- [ ] Login page redesign to match dark theme of landing site
- [ ] Logo decision and replacement (current shield icon is placeholder)

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
- [ ] Analytics export (CSV download)
- [ ] Slack/Teams integration
- [ ] Push notifications
- [ ] Supabase Realtime (replace polling)
