from dataclasses import dataclass
from typing import Optional


@dataclass
class ApprovalResult:
    request_id: str
    status: str  # "auto_approved" | "approved"
    token: Optional[str]
    resolved_by: Optional[str]


@dataclass
class PendingRequest:
    id: str
    status: str  # "pending" | any immediate status
    expires_at: Optional[str]
