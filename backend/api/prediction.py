"""Module B prediction routes.

Additive surface over the Module B trained artifact (``ml/prediction/models``) and the
frozen synthetic telemetry. It keeps ``prediction``, ``ground_truth``, ``evaluation``,
``safety`` and ``provenance`` as clearly separated blocks.

Leakage rule: the model is scored ONLY on ``RDS_on@0`` and ``RDS_on@14400``.
The ground-truth terminal value (``RDS_on@100000``) is NEVER passed into the
model; it is read after the prediction and used only for evaluation.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException

from backend.api import projections as proj
from ml.prediction.config import (
    FEATURE_CYCLES,
    TARGET_CYCLE,
    TARGET_HOURS,
    TELEMETRY_PATH,
    MODEL_DIR,
)
from ml.prediction.dataset import extract_features, extract_target
from ml.prediction.model import load_model
from ml.prediction.drift import compute_drift

router = APIRouter(tags=["module-b"])


class PredictionUnavailable(FileNotFoundError):
    pass


def _require(p: Path) -> Path:
    if not p.exists():
        raise PredictionUnavailable(str(p))
    return p


def _load_record() -> dict:
    try:
        record_path = _require(MODEL_DIR / "module-b-record.json")
        with open(record_path) as f:
            return json.load(f)
    except PredictionUnavailable as exc:
        raise HTTPException(status_code=503, detail=f"Module B not trained: {exc}") from exc


def _load_model():
    path = _require(MODEL_DIR / "module-b-ridge-v1.joblib")
    payload = load_model(str(path))
    return payload


def _module_features(module_id: str):
    try:
        telemetry = _load_telemetry()
        features = extract_features(telemetry)
        target = extract_target(telemetry)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    row = features[features["module_id"] == module_id]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"module {module_id} not found")
    feat = row.iloc[0]
    trow = target[target["module_id"] == module_id]
    actual = None
    if not trow.empty:
        actual = float(trow.iloc[0][f"RDS_on@{TARGET_CYCLE}"])
    return feat, actual


def _load_telemetry():
    return pd.read_parquet(_require(TELEMETRY_PATH))


@router.get("/modules/{module_id}/prediction")
def get_prediction(module_id: str):
    _load_record()
    payload = _load_model()
    model = payload["model"]
    meta = payload["meta"]

    feat, actual = _module_features(module_id)
    X = pd.DataFrame(
        [[feat["RDS_on@0"], feat["RDS_on@14400"]]],
        columns=["RDS_on@0", "RDS_on@14400"],
    )
    predicted = float(model.predict(X)[0])

    json_safe = proj.sanitize
    safety = compute_drift(predicted, float(feat["RDS_on@0"]))

    return {
        "module_id": module_id,
        "horizon": {
            "feature_cycles": list(FEATURE_CYCLES),
            "feature_hours": [0.0, 24.0],
            "target_cycle": TARGET_CYCLE,
            "target_hours": round(TARGET_HOURS, 4),
            "ps_states_168h": "PS specifies 168h; supplied dataset ends at 166.67h. No extrapolation performed.",
            "note": "Predicted terminal value is a cycle-100000 estimate, NOT a literal 168h measurement.",
        },
        "prediction": {
            "predicted_value_168h": round(predicted, 6),
            "predicted_terminal_rds_on_mohm": round(predicted, 6),
            "label": "Predicted terminal RDS_on @ 166.7h (cycle 100000)",
            "features": {
                "RDS_on@0": round(float(feat["RDS_on@0"]), 6),
                "RDS_on@14400": round(float(feat["RDS_on@14400"]), 6),
            },
        },
        "ground_truth": {
            "actual_terminal_rds_on_mohm": round(actual, 6) if actual is not None else None,
            "note": "Ground truth was unavailable to the model at prediction time. It is retrieved only after prediction, for evaluation.",
        },
        "evaluation": {
            "absolute_error": round(abs(predicted - actual), 6) if actual is not None else None,
            "population_mae": round(meta["mae"], 6),
            "naive_baseline_mae": round(meta["naive_mae"], 6),
            "improvement": (
                round((meta["naive_mae"] - meta["mae"]) / meta["naive_mae"] * 100.0, 4)
                if meta["naive_mae"] > 0
                else None
            ),
            "improvement_direction": "lower_MAE_is_better",
        },
        "safety": json_safe(safety),
        "provenance": {
            "model_id": meta["model_id"],
            "model_version": meta["model_version"],
            "algorithm": meta["algorithm"],
            "preprocessing": meta["preprocessing"],
            "features": meta["features"],
            "target": meta["target"],
            "target_cycle": TARGET_CYCLE,
            "split": meta["split"],
            "random_seed": meta["random_seed"],
            "n_train": meta["n_train"],
            "n_test": meta["n_test"],
            "note": "Ground truth is never used as a model feature.",
        },
    }


@router.get("/prediction/evaluation")
def get_prediction_evaluation():
    record = _load_record()
    mae = record["mae"]
    naive = record["naive_mae"]
    improvement = ((naive - mae) / naive * 100.0) if naive > 0 else None
    return proj.sanitize({
        "model_id": record["model_id"],
        "algorithm": record["algorithm"],
        "features": record["features"],
        "target": record["target"],
        "target_cycle": record["target_cycle"],
        "target_hours": round(record["target_hours"], 4),
        "n_train": record["n_train"],
        "n_test": record["n_test"],
        "mae": round(mae, 6),
        "naive_mae": round(naive, 6),
        "train_mae": round(record["train_mae"], 6),
        "improvement": round(improvement, 4) if improvement is not None else None,
        "improvement_direction": "lower_MAE_is_better",
        "model_comparison": record["model_comparison"],
        "model_selection_note": record["model_selection_note"],
        "split": record["split"],
        "random_seed": record["random_seed"],
        "preprocessing": record["preprocessing"],
        "model_version": record["model_version"],
        "dataset_id": record["dataset_id"],
        "training_timestamp": record["training_timestamp"],
        "safety": record["safety"],
        "horizon": record["horizon"],
    })