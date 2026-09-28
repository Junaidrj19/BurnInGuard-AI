"""Module B prediction tests.

Covers exact feature extraction, target extraction, leakage boundary, feature-list
assertion, model training, prediction, MAE, drift, safety slope and early reject.

Tests that need the trained module-B artifact (``ml/prediction/models``) skip
cleanly when it is absent, matching the rest of the suite.
"""

from __future__ import annotations

import warnings
from pathlib import Path

import pandas as pd
import pytest

from ml.prediction.config import (
    FEATURE_NAMES,
    FEATURE_CYCLES,
    TARGET_CYCLE,
    TARGET_HOURS,
    MAX_FEATURE_CYCLE,
    MODEL_DIR,
    TELEMETRY_PATH,
)
from ml.prediction.dataset import (
    LeakageError,
    assert_allowed_feature_cycles,
    extract_features,
    extract_target,
    load_telemetry,
    train_test_split_by_lot,
)
from ml.prediction.drift import compute_drift, load_profile, get_acceptance_criteria
from ml.prediction.model import (
    train_best,
    naive_baseline_mae,
    compare_models,
)

REPO = Path(__file__).resolve().parents[2]

has_record = (REPO / MODEL_DIR / "module-b-record.json").exists()
needs_model = pytest.mark.skipif(not has_record, reason="module-B model artifact absent")


def _telemetry():
    return pd.read_parquet(REPO / TELEMETRY_PATH)


# ------------------------------------------------------------- features


@needs_model
def test_feature_extraction_exact_columns():
    feats = extract_features(_telemetry())
    assert list(feats.columns) == ["module_id", "RDS_on@0", "RDS_on@14400"]
    assert len(feats) == feats["module_id"].nunique()


@needs_model
def test_target_extraction_exact_column():
    target = extract_target(_telemetry())
    assert list(target.columns) == ["module_id", f"RDS_on@{TARGET_CYCLE}"]


# ----------------------------------------------------------- leakage


def test_leakage_boundary_rejects_future_cycles():
    assert_allowed_feature_cycles([0, 14400])
    with pytest.raises(LeakageError):
        assert_allowed_feature_cycles([14401])
    with pytest.raises(LeakageError):
        assert_allowed_feature_cycles([TARGET_CYCLE])


@needs_model
def test_no_future_cycle_in_feature_columns():
    feats = extract_features(_telemetry())
    assert not any(int(c.split("@")[1]) > MAX_FEATURE_CYCLE for c in feats.columns if c != "module_id")


# ------------------------------------------------------ split & train


@needs_model
def test_lot_holdout_split_counts():
    X_train, X_test, y_train, y_test = train_test_split_by_lot(
        extract_features(_telemetry()), extract_target(_telemetry())
    )
    assert list(X_train.columns) == list(FEATURE_NAMES)
    assert len(X_train) == 450
    assert len(X_test) == 300


@needs_model
def test_feature_list_assertion_exact():
    X_train, X_test, y_train, y_test = train_test_split_by_lot(
        extract_features(_telemetry()), extract_target(_telemetry())
    )
    assert list(X_train.columns) == ["RDS_on@0", "RDS_on@14400"]


@needs_model
def test_model_training_predicts():
    X_train, X_test, y_train, y_test = train_test_split_by_lot(
        extract_features(_telemetry()), extract_target(_telemetry())
    )
    split = {"type": "lot_holdout", "train_lots": ["lot-02", "lot-03", "lot-05"], "test_lots": ["lot-01", "lot-04"]}
    result = train_best(X_train, y_train, X_test, y_test, split, algorithm="ridge")
    preds = result.model.predict(X_test)
    assert preds.shape == (len(X_test),)
    assert result.n_train == 450
    assert result.n_test == 300


# -------------------------------------------------------------------


@needs_model
def test_mae_computed():
    X_train, X_test, y_train, y_test = train_test_split_by_lot(
        extract_features(_telemetry()), extract_target(_telemetry())
    )
    naive = naive_baseline_mae(X_test, y_test)
    assert 0.0 < naive < 1.0
    result = train_best(X_train, y_train, X_test, y_test, {}, algorithm="ridge")
    assert 0.0 < result.mae < 1.0
    assert 0.0 < result.naive_mae < 1.0


# -------------------------------------------------------------- drift


def test_safety_slope_from_profile():
    drift = compute_drift(predicted_target=9.0, v0=5.0)
    assert drift["early_reject"] is True
    assert drift["safety_slope_pct_per_hour"] == pytest.approx(20.0 / TARGET_HOURS, rel=1e-3)
    pct = (9.0 - 5.0) / 5.0 * 100.0
    assert drift["predicted_total_relative_change_pct"] == pytest.approx(pct, rel=1e-3)


def test_early_reject_max_absolute():
    drift = compute_drift(predicted_target=8.5, v0=6.0)
    assert drift["early_reject"] is True


def test_early_reject_false_within_limits():
    drift = compute_drift(predicted_target=6.5, v0=6.0)
    assert drift["early_reject"] is False


def test_profile_load_and_criteria():
    profile = load_profile()
    assert profile is not None
    criteria = get_acceptance_criteria(profile)
    assert criteria == (20.0, 8.0)


def test_profile_unavailable_ni(tmp_path):
    missing = tmp_path / "missing.json"
    drift = compute_drift(predicted_target=9.0, v0=5.0, profile_path=str(missing))
    assert drift["safety_slope_pct_per_hour"] is None
    assert drift["early_reject"] is None
    assert "N/I" in drift["note"]


def test_horizon_values():
    assert round(TARGET_HOURS, 4) == 166.6667