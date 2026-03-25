"""Tests for the AgentGate Python SDK client."""

import uuid
from unittest.mock import MagicMock

import pytest

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agentgate import AgentGate, AuthorizationDenied, AuthorizationExpired
from agentgate.models import ApprovalResult, PendingRequest


def _mock_response(data: dict, status_code: int = 200) -> MagicMock:
    r = MagicMock()
    r.json.return_value = data
    r.status_code = status_code
    r.raise_for_status = MagicMock()
    return r


def _make_client(post_data=None, get_data=None) -> tuple:
    """Returns (AgentGate, mock_http_client)."""
    http = MagicMock()
    if post_data is not None:
        http.post.return_value = _mock_response(post_data)
    if get_data is not None:
        http.get.return_value = _mock_response(get_data)
    gate = AgentGate(api_key="sk-ag-test", _client=http)
    return gate, http


# ---------------------------------------------------------------------------
# authorize() — immediate responses
# ---------------------------------------------------------------------------

def test_authorize_auto_approved_returns_result():
    req_id = str(uuid.uuid4())
    gate, _ = _make_client(post_data={
        "id": req_id,
        "status": "auto_approved",
        "approval_token": "tok.abc",
        "resolved_by": "system",
    })

    result = gate.authorize("purchase", amount=25.0, vendor="AWS")
    assert isinstance(result, ApprovalResult)
    assert result.status == "auto_approved"
    assert result.token == "tok.abc"
    assert result.request_id == req_id


def test_authorize_denied_raises_authorization_denied():
    gate, _ = _make_client(post_data={
        "id": str(uuid.uuid4()),
        "status": "denied",
        "approval_token": None,
    })

    with pytest.raises(AuthorizationDenied):
        gate.authorize("purchase", amount=25.0, vendor="AWS")


# ---------------------------------------------------------------------------
# authorize() — polling
# ---------------------------------------------------------------------------

def test_authorize_pending_polls_until_approved():
    req_id = str(uuid.uuid4())
    http = MagicMock()
    http.post.return_value = _mock_response({
        "id": req_id, "status": "pending", "expires_at": "2026-01-01T00:00:00Z"
    })
    http.get.side_effect = [
        _mock_response({"id": req_id, "status": "pending"}),
        _mock_response({
            "id": req_id, "status": "approved",
            "approval_token": "tok.xyz", "resolved_by": "human",
        }),
    ]
    gate = AgentGate(api_key="sk-ag-test", poll_interval=0, _client=http)

    result = gate.authorize("purchase", amount=50.0)
    assert result.status == "approved"
    assert result.token == "tok.xyz"


def test_authorize_pending_raises_expired_on_timeout():
    req_id = str(uuid.uuid4())
    http = MagicMock()
    http.post.return_value = _mock_response({
        "id": req_id, "status": "pending", "expires_at": "2026-01-01T00:00:00Z"
    })
    # Always returns pending
    http.get.return_value = _mock_response({"id": req_id, "status": "pending"})
    gate = AgentGate(api_key="sk-ag-test", timeout=0.0, poll_interval=0, _client=http)

    with pytest.raises(AuthorizationExpired):
        gate.authorize("purchase", amount=50.0)


def test_authorize_denied_after_poll_raises():
    req_id = str(uuid.uuid4())
    http = MagicMock()
    http.post.return_value = _mock_response({"id": req_id, "status": "pending"})
    http.get.return_value = _mock_response({"id": req_id, "status": "denied"})
    gate = AgentGate(api_key="sk-ag-test", poll_interval=0, _client=http)

    with pytest.raises(AuthorizationDenied):
        gate.authorize("purchase", amount=50.0)


# ---------------------------------------------------------------------------
# authorize_async() and check()
# ---------------------------------------------------------------------------

def test_authorize_async_returns_pending_request():
    req_id = str(uuid.uuid4())
    gate, _ = _make_client(post_data={
        "id": req_id, "status": "pending", "expires_at": "2026-01-01T00:00:00Z"
    })

    result = gate.authorize_async("purchase", amount=50.0)
    assert isinstance(result, PendingRequest)
    assert result.id == req_id
    assert result.status == "pending"


def test_check_returns_current_status():
    req_id = str(uuid.uuid4())
    gate, http = _make_client(get_data={"id": req_id, "status": "approved"})

    data = gate.check(req_id)
    assert data["status"] == "approved"
    http.get.assert_called_once()
