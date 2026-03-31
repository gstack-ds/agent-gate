# SpendNod

A lightweight authorization gateway that sits between AI agents and financial transactions, giving humans control over what their AI agents can spend.

## Status
🟡 In Development — Phase 1

## Overview

AI agents are rapidly gaining the ability to make purchases, book services, and transfer money on behalf of humans. But most people aren't ready to hand their wallets to AI with zero oversight. SpendNod solves this by providing a simple authorization layer — three lines of code for the developer, one swipe to approve for the human.

SpendNod is framework-agnostic and payment-agnostic. It doesn't care if the agent uses LangChain, CrewAI, or a custom framework, and it doesn't care if the payment goes through Stripe, Visa, or crypto. It sits above all of them as the policy and approval layer. Agents call SpendNod first to get permission, then proceed to whatever commerce protocol the merchant supports.

The product is designed around configurable rules — humans set their own risk tolerance (auto-approve under $100, always block gambling, escalate anything over $500) and SpendNod enforces those rules in real-time with sub-second decisions.

## Tech Stack

- **Backend:** Python 3.11+ / FastAPI
- **Database:** Supabase (PostgreSQL) with SQLAlchemy 2.0 async
- **Auth:** SHA-256 API keys (agents) + Supabase JWT (humans)
- **Notifications:** Resend (email)
- **SDK:** Python (PyPI)
- **Hosting:** TBD (Railway, Fly.io, or AWS Lambda)

## Getting Started

### Prerequisites
- Python 3.11+
- A Supabase project (free tier works)
- Resend account for email notifications (optional for local dev)

### Installation
```bash
# Clone the repo
git clone https://github.com/yourusername/agent-gate.git
cd agent-gate

# Install backend dependencies
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your Supabase credentials
```

### Database Setup
```bash
# Run the migration against your Supabase project
# Option A: Via Supabase CLI
supabase db push

# Option B: Copy/paste supabase/migrations/001_initial_schema.sql
# into the Supabase SQL Editor and run it
```

### Running
```bash
cd backend
uvicorn app.main:app --reload
# API docs available at http://localhost:8000/docs
```

### Testing
```bash
cd backend
pytest tests/ -v
```

## How It Works

```python
from agentgate import AgentGate

gate = AgentGate(api_key="sk-ag-...")
approval = gate.authorize(
    action="purchase",
    amount=49.99,
    vendor="Amazon",
    description="Wireless headphones"
)
# Returns: approved, denied, or waits for human approval
```

1. **Agent calls `POST /v1/authorize`** with what it wants to do
2. **SpendNod evaluates rules** — checks blocked vendors, amount thresholds, daily/monthly limits, category restrictions
3. **Three possible outcomes:**
   - ✅ **Auto-approved** — within the human's configured rules, instant response
   - ⏳ **Pending** — escalated to human via push notification, agent waits
   - ❌ **Denied** — blocked category or velocity limit hit, instant response
4. **Human approves/denies** from the dashboard (if pending)
5. **Agent gets the decision** via polling or webhook callback

## Rule Evaluation (Priority Order)

1. Blocked vendors / blocked categories → **instant deny**
2. Auto-approve below threshold → **instant approve**
3. Require approval above threshold → **escalate to human**
4. Max per transaction → **escalate if exceeded**
5. Max per day (aggregate) → **escalate if would exceed**
6. Max per month (aggregate) → **escalate if would exceed**
7. Allowed vendors / allowed categories → **escalate if not in whitelist**
8. Default (no rules triggered) → **auto-approve**

## Project Structure

```
agentgate/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Settings and env vars
│   │   ├── database.py          # SQLAlchemy async engine
│   │   ├── models/
│   │   │   ├── database.py      # ORM models (5 tables)
│   │   │   └── schemas.py       # Pydantic request/response models
│   │   ├── api/
│   │   │   ├── agents.py        # Agent CRUD + API key generation
│   │   │   ├── authorize.py     # Core authorization endpoint
│   │   │   ├── rules.py         # Rule CRUD
│   │   │   ├── requests.py      # Human approve/deny
│   │   │   └── dashboard.py     # Stats and activity feed
│   │   ├── services/
│   │   │   ├── rule_engine.py   # 8-step rule evaluation logic
│   │   │   ├── token_service.py # JWT approval token generation
│   │   │   ├── notification.py  # Email dispatch (Resend)
│   │   │   └── audit.py         # Audit logging
│   │   └── middleware/
│   │       └── auth.py          # API key + JWT auth
│   └── tests/
├── dashboard/                    # React SPA (Phase 1)
├── sdk/
│   └── python/                   # PyPI package (Phase 2)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
└── docs/
    ├── research-brief.md
    └── agentgate_projections.docx
```

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Core API + rule engine + basic dashboard | 🟡 In Progress |
| 2 | Python/JS SDKs, LangChain/CrewAI integrations, SMS/push notifications | Not Started |
| 3 | Open protocol (ATAP), vendor token verification, tiered pricing | Not Started |
| 4 | Anomaly detection, smart rule suggestions, budget forecasting | Not Started |

## Why SpendNod?

The agentic commerce market is projected to reach $190B–$385B in the U.S. by 2030 (Morgan Stanley). Every player — Stripe ACP, Google AP2, Visa, Mastercard, Skyfire — is focused on enabling agents to transact. Nobody is focused on giving humans granular, real-time control over what their agents do. That's the gap.

The EU AI Act takes effect August 2, 2026, requiring auditable proof that AI systems operated within authorized parameters. SpendNod provides exactly that.

## Contributing

This is a personal project built by Gary Stack (Stack Industries LLC) with Claude Code. See `AgentGate_CLAUDE.md` for architecture details and coding standards.

## License

Proprietary — All rights reserved.
