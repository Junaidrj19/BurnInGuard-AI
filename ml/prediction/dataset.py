from __future__ import annotations

from typing import Tuple

import pandas as pd

from ml.prediction.config import (
    MAX_FEATURE_CYCLE,
    TRAIN_LOTS,
    TEST_LOTS,
    TARGET_CYCLE,
    FEATURE_CYCLES,
    TELEMETRY_PATH,
    GROUND_TRUTH_PATH,
)


class LeakageError(ValueError):
    pass


def assert_allowed_feature_cycles(cycles) -> None:
    """Hard leakage boundary.

    The predictor may use ONLY RDS_on at cycles 0 and 14,400. Any request for
    a feature cycle beyond MAX_FEATURE_CYCLE is a future-data leak and must
    fail, never silently fall back.
    """
    for c in cycles:
        if int(c) > MAX_FEATURE_CYCLE:
            raise LeakageError(
                f"Feature cycle {c} > MAX_FEATURE_CYCLE {MAX_FEATURE_CYCLE} "
                "is a future-data leak and is not permitted."
            )


def load_telemetry() -> pd.DataFrame:
    return pd.read_parquet(TELEMETRY_PATH)


def load_ground_truth() -> pd.DataFrame:
    return pd.read_parquet(GROUND_TRUTH_PATH)


def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    cycles = list(df["cycle_number"].unique())
    assert_allowed_feature_cycles(FEATURE_CYCLES)
    for c in FEATURE_CYCLES:
        if c not in cycles:
            raise LeakageError(f"Feature cycle {c} not found in data")

    pieces = []
    for cycle in FEATURE_CYCLES:
        sub = df[df["cycle_number"] == cycle][["module_id", "RDS_on"]].copy()
        sub = sub.rename(columns={"RDS_on": f"RDS_on@{cycle}"})
        pieces.append(sub)

    result = pieces[0]
    for p in pieces[1:]:
        result = result.merge(p, on="module_id", how="inner")
    return result


def extract_target(df: pd.DataFrame) -> pd.DataFrame:
    if TARGET_CYCLE not in list(df["cycle_number"].unique()):
        raise LeakageError(f"Target cycle {TARGET_CYCLE} not found in data")

    sub = df[df["cycle_number"] == TARGET_CYCLE][["module_id", "RDS_on"]].copy()
    sub = sub.rename(columns={"RDS_on": f"RDS_on@{TARGET_CYCLE}"})
    return sub


def train_test_split_by_lot(
    features: pd.DataFrame,
    target: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    merged = features.merge(target, on="module_id", how="inner")

    gt = load_ground_truth()
    lot_map = gt[["module_id", "lot_id"]].drop_duplicates().set_index("module_id")
    merged["lot_id"] = merged["module_id"].map(lot_map["lot_id"])

    train_mask = merged["lot_id"].isin(TRAIN_LOTS)
    test_mask = merged["lot_id"].isin(TEST_LOTS)

    feature_cols = [f"RDS_on@{c}" for c in FEATURE_CYCLES]
    target_col = f"RDS_on@{TARGET_CYCLE}"

    X_train = merged.loc[train_mask, feature_cols].copy()
    y_train = merged.loc[train_mask, target_col].copy()
    X_test = merged.loc[test_mask, feature_cols].copy()
    y_test = merged.loc[test_mask, target_col].copy()

    return X_train, X_test, y_train, y_test