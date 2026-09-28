from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Optional, Tuple

from ml.prediction.config import PROFILE_PATH, TARGET_HOURS


def _no_result():
    return {
        "safety_slope_pct_per_hour": None,
        "predicted_drift_rate_pct_per_hour": None,
        "predicted_total_relative_change_pct": None,
        "early_reject": None,
        "note": "N/I — module profile could not be loaded",
    }


def load_profile(path: str = str(PROFILE_PATH)) -> Optional[Dict]:
    try:
        p = Path(path)
        if not p.exists():
            return None
        with open(p) as f:
            return json.load(f)
    except Exception:
        return None


def get_acceptance_criteria(profile: Dict) -> Optional[Tuple[float, float]]:
    criteria = profile.get("acceptance_criteria", [])
    for c in criteria:
        if c.get("parameter") == "RDS_on":
            max_abs = None
            max_abs_entry = c.get("maximum_absolute", {})
            if isinstance(max_abs_entry, dict):
                max_abs = max_abs_entry.get("value")
            max_rel = c.get("maximum_relative_change_percent")
            if max_rel is not None and max_abs is not None:
                return float(max_rel), float(max_abs)
    return None


def compute_drift(
    predicted_target: float,
    v0: float,
    profile_path: str = str(PROFILE_PATH),
) -> Dict:
    profile = load_profile(profile_path)
    if profile is None:
        return _no_result()

    criteria = get_acceptance_criteria(profile)
    if criteria is None:
        return _no_result()

    max_rel_pct, max_abs_mohm = criteria

    predicted_total_relative_change_pct = (predicted_target - v0) / v0 * 100.0
    predicted_drift_rate_pct_per_hour = predicted_total_relative_change_pct / TARGET_HOURS
    safety_slope_pct_per_hour = max_rel_pct / TARGET_HOURS

    early_reject = (
        predicted_total_relative_change_pct > max_rel_pct
        or predicted_target > max_abs_mohm
    )

    return {
        "safety_slope_pct_per_hour": round(safety_slope_pct_per_hour, 6),
        "predicted_drift_rate_pct_per_hour": round(predicted_drift_rate_pct_per_hour, 6),
        "predicted_total_relative_change_pct": round(predicted_total_relative_change_pct, 4),
        "early_reject": bool(early_reject),
        "provenance": {
            "profile_path": profile_path,
            "maximum_relative_change_percent": max_rel_pct,
            "maximum_absolute_mohm": max_abs_mohm,
            "source": "sic-reference-module.json §acceptance_criteria[0]",
        },
    }