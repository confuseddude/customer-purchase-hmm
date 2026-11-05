"""API tests using FastAPI's TestClient against a temporary SQLite database."""

import numpy as np
import pytest
from fastapi.testclient import TestClient


from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


SEQ = ["View", "Cart", "Checkout", "Purchase"]


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["dataset_size"] == 600


def test_get_parameters(client):
    body = client.get("/api/model/parameters").json()
    assert body["pi"] == [0.7, 0.25, 0.05]
    assert body["states"] == ["Browsing", "Interested", "Ready to Purchase"]
    assert np.allclose(body["sums"]["A"], 1) and np.allclose(body["sums"]["B"], 1)


def test_forward_endpoint(client):
    body = client.post("/api/forward", json={"observations": SEQ}).json()
    assert len(body["steps"]) == 4 and body["likelihood"] > 0
    assert np.isclose(sum(body["alpha"][-1]), body["likelihood"])


def test_backward_endpoint(client):
    body = client.post("/api/backward", json={"observations": SEQ}).json()
    fwd = client.post("/api/forward", json={"observations": SEQ}).json()
    assert np.isclose(body["likelihood"], fwd["likelihood"])
    assert body["steps"][0]["t"] == 4  # backward runs from T down to 1


def test_forward_backward_endpoint(client):
    body = client.post("/api/forward-backward", json={"observations": SEQ}).json()
    assert np.allclose(np.sum(body["gamma"], axis=1), 1)
    assert len(body["timeline"]) == 4 and len(body["xi"]) == 3


def test_viterbi_endpoint(client):
    body = client.post("/api/viterbi", json={"observations": SEQ}).json()
    assert len(body["path"]) == 4
    assert body["backpointers"][0] == [None, None, None]


def test_predict_forecast_and_leakage(client):
    r = client.post("/api/predict", json={"observations": ["View", "Cart", "Checkout"], "mode": "forecast"})
    assert r.status_code == 200
    body = r.json()
    assert 0 < body["purchase_probability"] < 1
    assert np.isclose(sum(body["next_observation_distribution"]), 1)
    leak = client.post("/api/predict", json={"observations": SEQ, "mode": "forecast"})
    assert leak.status_code == 422 and leak.json()["code"] == "target_leakage"
    analyzed = client.post("/api/predict", json={"observations": SEQ, "mode": "analyze"})
    assert analyzed.status_code == 200 and analyzed.json()["purchased"] is True


def test_predict_compare(client):
    body = client.post(
        "/api/predict/compare",
        json={"journeys": [{"name": "A", "observations": ["View", "View", "Exit"]},
                           {"name": "C", "observations": ["View", "Cart", "Purchase"]}]},
    ).json()
    assert body["journeys"][1]["truncated_before_purchase"] is True
    assert body["journeys"][1]["evaluated_prefix"] == ["View", "Cart"]


@pytest.mark.parametrize("payload", [{"observations": []}, {"observations": ["Fly"]}, {"observations": [9]}])
def test_invalid_observations(client, payload):
    r = client.post("/api/forward", json=payload)
    assert r.status_code == 422


def test_invalid_model_override(client):
    bad = {"pi": [0.5, 0.5, 0.5], "A": [[1, 0, 0]] * 3, "B": [[1, 0, 0, 0, 0]] * 3}
    r = client.post("/api/forward", json={"observations": ["View"], "params": bad})
    assert r.status_code == 422 and r.json()["code"] == "invalid_model"


def test_zero_probability_sequence(client):
    params = {"pi": [1, 0, 0], "A": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
              "B": [[1, 0, 0, 0, 0], [0, 1, 0, 0, 0], [0, 0, 1, 0, 0]]}
    r = client.post("/api/forward-backward", json={"observations": ["Cart"], "params": params})
    assert r.status_code == 422 and r.json()["code"] == "zero_probability"
    f = client.post("/api/forward", json={"observations": ["Cart"], "params": params}).json()
    assert f["impossible"] is True and f["log_likelihood"] is None


def test_put_and_reset_parameters(client):
    p = client.get("/api/model/parameters").json()
    p["pi"] = [0.5, 0.3, 0.2]
    r = client.put("/api/model/parameters", json={"pi": p["pi"], "A": p["A"], "B": p["B"], "name": "test"})
    assert r.status_code == 200 and r.json()["pi"] == [0.5, 0.3, 0.2]
    bad = client.put("/api/model/parameters", json={"pi": [0.9, 0.3, 0.2], "A": p["A"], "B": p["B"]})
    assert bad.status_code == 422
    assert client.post("/api/model/reset").json()["pi"] == [0.7, 0.25, 0.05]


def test_train_mle(client):
    body = client.post("/api/train/mle", json={"smoothing": 1.0}).json()
    assert body["n_sequences"] == 600
    assert np.allclose(np.sum(body["after"]["A"], axis=1), 1)
    assert body["complete_log_likelihood_after"] >= body["complete_log_likelihood_before"]


def test_train_baum_welch(client):
    body = client.post("/api/train/baum-welch", json={"max_iterations": 10, "tolerance": 1e-6, "limit": 100}).json()
    lls = [h["log_likelihood"] for h in body["history"]]
    assert body["monotonic"] and lls[-1] >= lls[0]
    assert len(body["history"]) == body["iterations"] + 1
    assert body["applied"] is False


def test_dataset_endpoints(client):
    page = client.get("/api/dataset?limit=5").json()
    assert page["total"] == 600 and len(page["items"]) == 5
    item = client.get(f"/api/dataset/{page['items'][0]['id']}").json()
    assert len(item["observations"]) == len(item["hidden_states"])
    summary = client.get("/api/dataset/summary").json()
    assert sum(b["count"] for b in summary["behaviours"]) == 600
    assert client.get("/api/dataset/99999").status_code == 404


def test_likelihood_curve(client):
    body = client.get("/api/learn/likelihood-curve?k=7&n=10").json()
    assert body["mle"] == 0.7
    best = max(body["curve"], key=lambda c: c["likelihood"])
    assert np.isclose(best["p"], 0.7)


def test_joint_probability(client):
    body = client.post("/api/joint", json={"observations": ["View", "Cart"], "states": ["Browsing", "Interested"]}).json()
    # pi_B * b_B(View) * a_BI * b_I(Cart) = 0.70 * 0.70 * 0.35 * 0.50
    assert np.isclose(body["probability"], 0.70 * 0.70 * 0.35 * 0.50)
    assert len(body["factors"]) == 4
    bad = client.post("/api/joint", json={"observations": ["View"], "states": ["Browsing", "Ready"]})
    assert bad.status_code == 422


def test_mle_custom_labels(client):
    body = client.post(
        "/api/train/mle",
        json={"smoothing": 0, "sequences": [{"observations": ["View", "Cart"], "hidden_states": ["Browsing", "Interested"]}]},
    ).json()
    assert body["counts"]["A"][0][1] == 1
    bad = client.post("/api/train/mle", json={"sequences": [{"observations": ["View"], "hidden_states": ["Sleepy"]}]})
    assert bad.status_code == 422


def test_predict_record_flag_skips_experiment_log(client):
    before = len(client.get("/api/experiments", params={"limit": 200}).json())
    silent = client.post("/api/predict", json={"observations": ["View"], "mode": "forecast", "record": False})
    assert silent.status_code == 200
    assert "experiment_id" not in silent.json()
    assert len(client.get("/api/experiments", params={"limit": 200}).json()) == before
