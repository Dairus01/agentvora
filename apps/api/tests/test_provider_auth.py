import httpx
import pytest
from agentvora.provider_auth import GroqKeyFailover


@pytest.mark.parametrize("status", [401, 403, 429, 503])
def test_primary_failure_retries_identical_request_with_backup(status):
    calls = []

    def handle(request):
        calls.append((request.headers["authorization"], request.content))
        return httpx.Response(status if len(calls) == 1 else 200, json={})

    with httpx.Client(
        transport=httpx.MockTransport(handle),
        auth=GroqKeyFailover("primary-test", "backup-test"),
    ) as client:
        assert (
            client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json={"messages": [{"content": "test"}]},
            ).status_code
            == 200
        )
    assert [c[0] for c in calls] == ["Bearer primary-test", "Bearer backup-test"]
    assert calls[0][1] == calls[1][1]


@pytest.mark.parametrize("status", [200, 400, 422])
def test_success_and_bad_requests_do_not_use_backup(status):
    calls = []

    def handle(request):
        calls.append(request.headers["authorization"])
        return httpx.Response(status, json={})

    with httpx.Client(
        transport=httpx.MockTransport(handle),
        auth=GroqKeyFailover("primary-test", "backup-test"),
    ) as client:
        client.get("https://api.groq.com/openai/v1/models")
    assert calls == ["Bearer primary-test"]


def test_credentials_are_not_attached_to_other_hosts():
    def handle(request):
        assert "authorization" not in request.headers
        return httpx.Response(200)

    with httpx.Client(
        transport=httpx.MockTransport(handle),
        auth=GroqKeyFailover("primary-test", "backup-test"),
    ) as client:
        client.get("https://example.com")
