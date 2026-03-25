import time
from decimal import Decimal
from typing import Optional

import httpx

from .exceptions import AuthorizationDenied, AuthorizationExpired
from .models import ApprovalResult, PendingRequest


class AgentGate:
    """AgentGate authorization client.

    Usage::

        gate = AgentGate(api_key="sk-ag-...")
        result = gate.authorize(action="purchase", amount=99.99, vendor="AWS")
        # blocks until approved/denied/expired
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.agentgate.dev",
        timeout: float = 300.0,
        poll_interval: float = 2.0,
        _client: Optional[httpx.Client] = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.poll_interval = poll_interval
        self._client = _client or httpx.Client(
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30.0,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def authorize(
        self,
        action: str,
        amount: Optional[float] = None,
        vendor: Optional[str] = None,
        category: Optional[str] = None,
        description: Optional[str] = None,
    ) -> ApprovalResult:
        """Submit a request and block until it is resolved.

        Returns ApprovalResult on success.
        Raises AuthorizationDenied if denied.
        Raises AuthorizationExpired if the timeout passes before resolution.
        """
        payload = {"action": action}
        if amount is not None:
            payload["amount"] = amount
        if vendor is not None:
            payload["vendor"] = vendor
        if category is not None:
            payload["category"] = category
        if description is not None:
            payload["description"] = description

        data = self._post("/v1/authorize", payload)

        if data["status"] == "auto_approved":
            return ApprovalResult(
                request_id=data["id"],
                status=data["status"],
                token=data.get("approval_token"),
                resolved_by=data.get("resolved_by"),
            )
        if data["status"] == "denied":
            raise AuthorizationDenied()
        # pending → poll
        return self._poll(data["id"])

    def authorize_async(
        self,
        action: str,
        amount: Optional[float] = None,
        vendor: Optional[str] = None,
        category: Optional[str] = None,
        description: Optional[str] = None,
    ) -> PendingRequest:
        """Submit a request and return immediately without waiting."""
        payload = {"action": action}
        if amount is not None:
            payload["amount"] = amount
        if vendor is not None:
            payload["vendor"] = vendor
        if category is not None:
            payload["category"] = category
        if description is not None:
            payload["description"] = description

        data = self._post("/v1/authorize", payload)
        return PendingRequest(
            id=data["id"],
            status=data["status"],
            expires_at=data.get("expires_at"),
        )

    def check(self, request_id: str) -> dict:
        """Fetch the current status of a request (single poll, no blocking)."""
        return self._get(f"/v1/authorize/{request_id}")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _poll(self, request_id: str) -> ApprovalResult:
        deadline = time.monotonic() + self.timeout
        while time.monotonic() < deadline:
            time.sleep(self.poll_interval)
            data = self._get(f"/v1/authorize/{request_id}")
            if data["status"] == "approved":
                return ApprovalResult(
                    request_id=data["id"],
                    status=data["status"],
                    token=data.get("approval_token"),
                    resolved_by=data.get("resolved_by"),
                )
            if data["status"] in ("denied", "cancelled"):
                raise AuthorizationDenied()
            if data["status"] == "expired":
                raise AuthorizationExpired("Request expired before approval")
        raise AuthorizationExpired("Timed out waiting for approval")

    def _post(self, path: str, payload: dict) -> dict:
        r = self._client.post(
            f"{self.base_url}{path}",
            json=payload,
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        r.raise_for_status()
        return r.json()

    def _get(self, path: str) -> dict:
        r = self._client.get(
            f"{self.base_url}{path}",
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        r.raise_for_status()
        return r.json()
