from __future__ import annotations

import json
import os
import time
from typing import Dict

from ml.prediction.config import (
    DATASET_ID,
    TARGET_CYCLE,
    TARGET_HOURS,
    TRAIN_LOTS,
    TEST_LOTS,
    PredictionConfig,
)
from ml.prediction.dataset import (
    extract_features,
    extract_target,
    train_test_split_by_lot,
    load_telemetry,
)
from ml.prediction.model import (
    compare_models,
    train_best,
    save_model,
)
from ml.prediction.drift import load_profile, get_acceptance_criteria


def train(config: PredictionConfig | None = None) -> Dict:
    cfg = config or PredictionConfig()
    os.makedirs(cfg.model_dir, exist_ok=True)

    telemetry = load_telemetry()
    features = extract_features(telemetry)
    target = extract_target(telemetry)

    X_train, X_test, y_train, y_test = train_test_split_by_lot(features, target)

    split = {
        "type": "lot_holdout",
        "train_lots": list(TRAIN_LOTS),
        "test_lots": list(TEST_LOTS),
        "n_train_modules": int(len(X_train)),
        "n_test_modules": int(len(X_test)),
    }

    comparison = compare_models(X_train, y_train, X_test, y_test, split, random_seed=cfg.random_seed)

    ridge_test_mae = comparison["ridge"]["test_mae"]
    extra_trees_test_mae = comparison["extra_trees"]["test_mae"]
    random_forest_test_mae = comparison["random_forest"]["test_mae"]

    improvement_ratio = min(
        (ridge_test_mae / max(extra_trees_test_mae, 1e-12)),
        (ridge_test_mae / max(random_forest_test_mae, 1e-12)),
    )

    if (extra_trees_test_mae < ridge_test_mae and random_forest_test_mae < ridge_test_mae
            and improvement_ratio < 0.90):
        selected = "extra_trees"
    else:
        # Per module guidance, prefer Ridge unless a tree model materially improves.
        selected = "ridge"

    result = train_best(
        X_train, y_train, X_test, y_test, split,
        algorithm=selected, random_seed=cfg.random_seed,
    )

    model_path = f"{cfg.model_dir}/module-b-ridge-v1.joblib"
    save_model(result, model_path)

    profile = load_profile(cfg.profile_path)
    criteria = get_acceptance_criteria(profile) if profile else None
    safety = {
        "safety_slope_pct_per_hour": (criteria[0] / TARGET_HOURS) if criteria else None,
        "max_relative_change_percent": criteria[0] if criteria else None,
        "max_absolute_mohm": criteria[1] if criteria else None,
    }

    record = {
        "model_id": result.model_id,
        "algorithm": selected,
        "features": result.features,
        "target": result.target,
        "target_cycle": TARGET_CYCLE,
        "target_hours": TARGET_HOURS,
        "n_train": int(result.n_train),
        "n_test": int(result.n_test),
        "mae": float(result.mae),
        "naive_mae": float(result.naive_mae),
        "train_mae": float(result.train_mae),
        "model_comparison": comparison,
        "model_selection_note": (
            "Ridge is the default. A tree model is selected only if BOTH "
            "ExtraTrees and RandomForest beat Ridge and the best improvement is "
            ">10%. Otherwise Ridge is kept, per the approved module guidance."
        ),
        "split": split,
        "random_seed": cfg.random_seed,
        "preprocessing": "StandardScaler",
        "model_version": "v1",
        "dataset_id": DATASET_ID,
        "training_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "safety": safety,
        "horizon": {
            "feature_cycles": list(cfg.feature_cycles),
            "feature_hours": [0.0, 24.0],
            "target_cycle": TARGET_CYCLE,
            "target_hours": round(TARGET_HOURS, 4),
            "ps_states_168h": "PS specifies 168h; supplied dataset ends at 166.67h. "
                               "No extrapolation performed.",
        },
    }

    record_path = f"{cfg.model_dir}/module-b-record.json"
    with open(record_path, "w") as f:
        json.dump(record, f, indent=2)

    return record


if __name__ == "__main__":
    import sys

    record = train()
    print(json.dumps(record, indent=2))
    sys.stdout.write(
        f"\nMAE={record['mae']:.5f} naive={record['naive_mae']:.5f} "
        f"algorithm={record['algorithm']}\n"
    )