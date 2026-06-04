import copy
import pytest

from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def client_and_reset():
    # Import app inside fixture so tests pick up module state
    from src import app as app_module

    # Snapshot activities and provide TestClient
    original = copy.deepcopy(app_module.activities)
    client = TestClient(app_module.app)
    yield client

    # Restore original state to avoid test coupling
    app_module.activities = original


def test_get_activities(client_and_reset):
    client = client_and_reset
    res = client.get("/activities")
    assert res.status_code == 200
    data = res.json()
    # Basic sanity checks
    assert "Chess Club" in data
    assert isinstance(data["Chess Club"]["participants"], list)


def test_signup_and_remove_participant(client_and_reset):
    client = client_and_reset
    activity = "Chess Club"
    email = "teststudent@example.com"

    # Sign up
    res = client.post(f"/activities/{activity}/signup?email={email}")
    assert res.status_code == 200
    assert "Signed up" in res.json().get("message", "")

    # Verify participant present
    res = client.get("/activities")
    assert res.status_code == 200
    data = res.json()
    assert email in data[activity]["participants"]

    # Remove participant
    res = client.delete(f"/activities/{activity}/participants?email={email}")
    assert res.status_code == 200
    assert "Removed" in res.json().get("message", "")

    # Verify removal
    res = client.get("/activities")
    data = res.json()
    assert email not in data[activity]["participants"]
