from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from backend.agents.investigation.tools.models import ToolError, ToolResult
from ml.prediction.config import TELEMETRY_PATH, MODEL_DIR, TARGET_CYCLE
from ml.prediction.dataset import extract_features, extract_target
from ml.prediction.model import load_model
from ml.prediction.drift import compute_drift

TOOL_NAME = "predict_drift_horizon"
TOOL_VERSION = "1.0.0"


def _require(p: Path) -> Path:
    if not p.exists():
        raise ToolError(TOOL_NAME, f"artifact missing: {p}")
    return p


def predict_drift_horizon(module_id: str, **_: Any) -> ToolResult:
    """Deterministic Module B forward prediction.

    The LLM never calculates the prediction. This tool returns the recorded result of
    the trained ridge model scored on RDS_on@0 and RDS_on@14400. It reads the
    ground-truth terminal value only afterwards, for evaluation; the model does not see it.
    """
    try:
        model_payload = load_model(str(_require(MODEL_DIR / "module-b-ridge-v1.joblib")))
        model = model_payload["model"]
        telemetry = pd.read_parquet(_require(TELEMETRY_PATH))
        features = extract_features(telemetry)
        target = extract_target(telemetry)

        row = features[features["module_id"] == module_id]
        if row.empty:
            raise ToolError(TOOL_NAME, f"module {module_id} not found")
        feat = row.iloc[0]
        X = pd.DataFrame(
            [[feat["RDS_on@0"], feat["RDS_on@14400"]]],
            columns=["RDS_on@0", "RDS_on@14400"],
        )
        predicted = float(model.predict(X)[0])

        trow = target[target["module_id"] == module_id]
        actual = float(trow.iloc[0][f"RDS_on@{TARGET_CYCLE}"]) if not trow.empty else None

        drift = compute_drift(predicted, float(feat["RDS_on@0"]))

        return ToolResult(
            tool_name=TOOL_NAME,
            tool_version=TOOL_VERSION,
            input_summary={
                "module_id": module_id,
                "features": ["RDS_on@0", "RDS_on@14400"],
                "target_cycle": TARGET_CYCLE,
            },
            output={
                "predicted_terminal_rds_on_mohm": round(predicted, 6),
                "actual_terminal_rds_on_mohm": round(actual, 6) if actual is not None else None,
                "absolute_error": round(abs(predicted - actual), 6) if actual is not None else None,
                "safety_slope_pct_per_hour": drift.get("safety_slope_pct_per_hour"),
                "predicted_drift_rate_pct_per_hour": drift.get("predicted_drift_rate_pct_per_hour"),
                "predicted_total_relative_change_pct": drift.get("predicted_total_relative_change_pct"),
                "early_reject": drift.get("early_reject"),
                "horizon": "166.7h (cycle 100000); PS specifies 168h; no extrapolation",
            },
            provenance={
                "method": "trained module-b ridge model scored on RDS_on@0 and RDS_on@14400",
                "model_id": model_payload["meta"]["model_id"],
                "ground_truth_read_after_prediction": True,
                "source": "ml/prediction + module profile acceptance criteria",
            },
        )
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(TOOL_NAME, f"prediction failed: {exc}") from exc