import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import AgentDep
from app.models.database import AuthorizationRequest, Rule
from app.models.schemas import AuthorizeRequest, AuthorizeResponse
from app.services import rule_engine, token_service

router = APIRouter()

_PENDING_EXPIRY_SECONDS = 300  # 5 minutes for human to respond


@router.post(
    "/authorize",
    response_model=AuthorizeResponse,
    summary="Submit an authorization request",
    description=(
        "Agent submits a transaction for authorization. "
        "Returns 200 with status=auto_approved or status=denied for immediate decisions. "
        "Returns 202 Accepted with status=pending if human review is required."
    ),
)
async def create_authorization_request(
    body: AuthorizeRequest,
    agent: AgentDep,
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> AuthorizeResponse:
    # Load the agent's active rules
    rules_result = await db.execute(
        select(Rule).where(Rule.agent_id == agent.id, Rule.is_active.is_(True))
    )
    rules = rules_result.scalars().all()

    # Evaluate against rules
    result = await rule_engine.evaluate(body, agent.id, rules, db)

    now = datetime.now(timezone.utc)
    req = AuthorizationRequest(
        id=uuid.uuid4(),
        agent_id=agent.id,
        action=body.action,
        amount=body.amount,
        currency=body.currency,
        vendor=body.vendor,
        category=body.category,
        description=body.description,
        status=result.decision,
        rule_evaluation={
            "decision": result.decision,
            "reason": result.reason,
            "matched_rule_type": result.matched_rule_type,
            "log": result.evaluation_log,
        },
        created_at=now,
    )

    if result.decision == "auto_approved":
        req.approval_token = token_service.generate_approval_token(req.id, agent.id, body.amount)
        req.resolved_by = "system"
        req.resolved_at = now
        if response is not None:
            response.status_code = status.HTTP_200_OK
    elif result.decision == "denied":
        req.resolved_by = "system"
        req.resolved_at = now
        if response is not None:
            response.status_code = status.HTTP_200_OK
    else:  # pending
        req.expires_at = now + timedelta(seconds=_PENDING_EXPIRY_SECONDS)
        if response is not None:
            response.status_code = status.HTTP_202_ACCEPTED

    db.add(req)
    await db.commit()
    await db.refresh(req)

    # TODO: notify human if pending (Phase 1 — Supabase Realtime + Resend)

    return AuthorizeResponse.model_validate(req)


@router.get(
    "/authorize/{request_id}",
    response_model=AuthorizeResponse,
    summary="Poll authorization request status",
    description="Agent polls for the current status of a pending authorization request.",
)
async def get_authorization_request(
    request_id: uuid.UUID,
    agent: AgentDep,
    db: AsyncSession = Depends(get_db),
) -> AuthorizeResponse:
    result = await db.execute(
        select(AuthorizationRequest).where(
            AuthorizationRequest.id == request_id,
            AuthorizationRequest.agent_id == agent.id,
        )
    )
    req = result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return AuthorizeResponse.model_validate(req)


@router.delete(
    "/authorize/{request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel a pending authorization request",
    description="Agent cancels a request it previously submitted that is still pending.",
)
async def cancel_authorization_request(
    request_id: uuid.UUID,
    agent: AgentDep,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(AuthorizationRequest).where(
            AuthorizationRequest.id == request_id,
            AuthorizationRequest.agent_id == agent.id,
        )
    )
    req = result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a request with status '{req.status}'",
        )
    req.status = "cancelled"
    req.resolved_at = datetime.now(timezone.utc)
    req.resolved_by = "agent"
    await db.commit()
