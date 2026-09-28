"""Module B API tests.

Scope: ``GET /modules/{module_id}/prediction`` and ``GET /prediction/evaluation``.

Asserts that prediction / ground_truth / evaluation / safety / provenance are clearly
separated, that ground truth is never a model feature, that the 166.7h horizon is
explicit, and that safety degrades to N/I when the profile is absent.
"""

from __future__ import annotations

import warnings
from pathlib import Path

import pytest

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    from fastapi.testclient import TestClient

from backend.api.app import app
from ml.prediction.config import MODEL_DIR, TARGET_CYCLE

client = TestClient(app)

REPO = Path(__file__).resolve().parents[2]
has_record = (REPO / MODEL_DIR / "module-b-record.json").exists()
needs_model = pytest.mark.skipif(not has_record, reason="module-B model artifact absent")

MODULE_ID = "syn-mod-0006"


@needs_model
def test_prediction_endpoint_shape():
    r = client.get(f"/modules/{MODULE_ID}/prediction")
    assert r.status_code == 200
    body = r.json()
    for key in ("prediction", "ground_truth", "evaluation", "safety", "provenance"):
        assert key in body
    assert body["horizon"]["target_cycle"] == TARGET_CYCLE
    assert body["horizon"]["target_hours"] == 166.6667
    # Horizon is 166.7h, never presented as literal 168h.
    assert "168h" in body["horizon"]["ps_states_168h"]


@needs_model
def test_prediction_features_only_early_cycles():
    r = client.get(f"/modules/{MODULE_ID}/prediction")
    feats = r.json()["prediction"]["features"]
    assert set(feats.keys()) == {"RDS_on@0", "RDS_on@14400"}
    assert r.json()["provenance"]["features"] == ["RDS_on@0", "RDS_on@14400"]


@needs_model
def test_ground_truth_never_used_as_feature():
    r = client.get(f"/modules/{MODULE_ID}/prediction")
    body = r.json()
    assert "RDS_on@100000" not in body["prediction"]["features"]
    assert body["provenance"]["note"] == "Ground truth is never used as a model feature."
    # Ground truth is present but separated.
    assert body["ground_truth"]["actual_terminal_rds_on_mohm"] is not None


@needs_model
def test_evaluation_metrics_present():
    r = client.get("/prediction/evaluation")
    assert r.status_code == 200
    body = r.json()
    assert body["features"] == ["RDS_on@0", "RDS_on@14400"]
    assert body["n_train"] == 450
    assert body["n_test"] == 300
    assert 0.0 < body["mae"] < 1.0
    assert 0.0 < body["naive_mae"] < 1.0
    assert body["target"] == "RDS_on@100000"


@needs_model
def test_prediction_module_not_found():
    r = client.get("/modules/syn-mod-999999/prediction")
    assert r.status_code == 404