import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import UserDep
from app.models.database import Agent, Rule
from app.models.schemas import RuleCreate, RuleResponse, RuleUpdate
from app.services import audit

router = APIRouter()


async def _get_agent_for_user(agent_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Agent:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == user_id)
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


async def _get_rule_for_user(rule_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Rule:
    result = await db.execute(
        select(Rule)
        .join(Agent, Rule.agent_id == Agent.id)
        .where(Rule.id == rule_id, Agent.user_id == user_id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return rule


@router.get(
    "/agents/{agent_id}/rules",
    response_model=List[RuleResponse],
    summary="List rules for an agent",
)
async def list_rules(
    agent_id: uuid.UUID,
    user: UserDep,
    db: AsyncSession = Depends(get_db),
) -> List[RuleResponse]:
    await _get_agent_for_user(agent_id, user.id, db)
    result = await db.execute(
        select(Rule).where(Rule.agent_id == agent_id).order_by(Rule.created_at)
    )
    rules = result.scalars().all()
    return [RuleResponse.model_validate(r) for r in rules]


@router.post(
    "/agents/{agent_id}/rules",
    response_model=RuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a rule to an agent",
)
async def create_rule(
    agent_id: uuid.UUID,
    body: RuleCreate,
    user: UserDep,
    db: AsyncSession = Depends(get_db),
) -> RuleResponse:
    agent = await _get_agent_for_user(agent_id, user.id, db)

    rule = Rule(
        id=uuid.uuid4(),
        agent_id=agent.id,
        rule_type=body.rule_type.value,
        value=body.value,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(rule)
    await audit.log_event(
        db,
        "rule_created",
        agent_id=agent.id,
        user_id=user.id,
        details={"rule_type": body.rule_type.value, "value": body.value},
    )
    await db.commit()
    await db.refresh(rule)
    return RuleResponse.model_validate(rule)


@router.patch(
    "/rules/{rule_id}",
    response_model=RuleResponse,
    summary="Update a rule",
)
async def update_rule(
    rule_id: uuid.UUID,
    body: RuleUpdate,
    user: UserDep,
    db: AsyncSession = Depends(get_db),
) -> RuleResponse:
    rule = await _get_rule_for_user(rule_id, user.id, db)

    if body.value is not None:
        rule.value = body.value
    if body.is_active is not None:
        rule.is_active = body.is_active

    await db.commit()
    await db.refresh(rule)
    return RuleResponse.model_validate(rule)


@router.delete(
    "/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a rule",
)
async def delete_rule(
    rule_id: uuid.UUID,
    user: UserDep,
    db: AsyncSession = Depends(get_db),
) -> None:
    rule = await _get_rule_for_user(rule_id, user.id, db)
    await audit.log_event(
        db,
        "rule_deleted",
        agent_id=rule.agent_id,
        user_id=user.id,
        details={"rule_type": rule.rule_type},
    )
    await db.delete(rule)
    await db.commit()
