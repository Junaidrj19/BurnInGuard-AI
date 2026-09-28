from __future__ import annotations

from dataclasses import dataclass, field as dataclass_field
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ml.prediction.config import (
    FEATURE_NAMES,
    TARGET_NAME,
    RANDOM_SEED,
)


@dataclass
class ModelResult:
    model_id: str
    algorithm: str
    preprocessing: str
    model_version: str
    n_train: int
    n_test: int
    mae: float
    naive_mae: float
    train_mae: float
    features: List[str]
    target: str
    random_seed: int
    split: Dict[str, object]
    hyperparameters: Dict[str, object]
    model: object = dataclass_field(repr=False)
    scaler: Optional[object] = dataclass_field(repr=False, default=None)


def build_ridge(alpha: float = 1.0, random_seed: int = RANDOM_SEED) -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", Ridge(alpha=alpha, random_state=random_seed)),
    ])


def build_extra_trees(random_seed: int = RANDOM_SEED) -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", ExtraTreesRegressor(
            n_estimators=200, max_depth=8, random_state=random_seed,
            n_jobs=-1,
        )),
    ])


def build_random_forest(random_seed: int = RANDOM_SEED) -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", RandomForestRegressor(
            n_estimators=200, max_depth=8, random_state=random_seed, n_jobs=-1,
        )),
    ])


def fit_model(model: Pipeline, X_train: pd.DataFrame, y_train: pd.Series) -> Pipeline:
    return model.fit(X_train, y_train)


def predict(model: Pipeline, X: pd.DataFrame) -> np.ndarray:
    return model.predict(X)


def evaluate(
    model: Pipeline,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> tuple[float, float, float]:
    train_pred = predict(model, X_train)
    test_pred = predict(model, X_test)
    train_mae = mean_absolute_error(y_train, train_pred)
    test_mae = mean_absolute_error(y_test, test_pred)
    return train_mae, test_mae, None  # type: ignore[return-value]


def naive_baseline_mae(X_test: pd.DataFrame, y_test: pd.Series) -> float:
    """Naive baseline: reuse the cycle-14400 (last feature) value as the terminal value."""
    return mean_absolute_error(y_test, X_test["RDS_on@14400"])


def train_mean_mae(X_test, y_test, X_train, y_train) -> float:
    pred = np.full(len(X_test), float(np.mean(y_train)))
    return mean_absolute_error(y_test, pred)


def compare_models(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    split: Dict[str, object],
    random_seed: int = RANDOM_SEED,
) -> dict:
    candidates = {
        "ridge": (build_ridge(random_seed=random_seed), "Ridge"),
        "extra_trees": (build_extra_trees(random_seed=random_seed), "ExtraTrees"),
        "random_forest": (build_random_forest(random_seed=random_seed), "RandomForest"),
    }
    results = {}
    for key, (pipeline, algo) in candidates.items():
        fitted = fit_model(pipeline, X_train, y_train)
        train_mae, test_mae, _ = evaluate(fitted, X_train, y_train, X_test, y_test)
        results[key] = {
            "algorithm": algo,
            "train_mae": float(train_mae),
            "test_mae": float(test_mae),
        }
    return results


def train_best(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    split: Dict[str, object],
    algorithm: str = "ridge",
    random_seed: int = RANDOM_SEED,
) -> ModelResult:
    build = {
        "ridge": build_ridge,
        "extra_trees": build_extra_trees,
        "random_forest": build_random_forest,
    }[algorithm]
    pipeline = build(random_seed=random_seed)
    fitted = fit_model(pipeline, X_train, y_train)
    train_pred = predict(fitted, X_train)
    test_pred = predict(fitted, X_test)
    train_mae = float(mean_absolute_error(y_train, train_pred))
    test_mae = float(mean_absolute_error(y_test, test_pred))
    naive = naive_baseline_mae(X_test, y_test)

    return ModelResult(
        model_id=f"module-b-{algorithm}-{random_seed}",
        algorithm=algorithm,
        preprocessing="StandardScaler",
        model_version="v1",
        n_train=len(X_train),
        n_test=len(X_test),
        mae=test_mae,
        naive_mae=naive,
        train_mae=train_mae,
        features=list(FEATURE_NAMES),
        target=TARGET_NAME,
        random_seed=random_seed,
        split=split,
        hyperparameters={"alpha": 1.0} if algorithm == "ridge" else {
            "n_estimators": 200, "max_depth": 8,
        },
        model=fitted,
    )


def save_model(result: ModelResult, path) -> None:
    joblib.dump(
        {
            "model": result.model,
            "scaler": getattr(result.model, "named_steps", {}).get("scaler"),
            "meta": {
                "model_id": result.model_id,
                "algorithm": result.algorithm,
                "preprocessing": result.preprocessing,
                "model_version": result.model_version,
                "n_train": result.n_train,
                "n_test": result.n_test,
                "mae": result.mae,
                "naive_mae": result.naive_mae,
                "train_mae": result.train_mae,
                "features": result.features,
                "target": result.target,
                "random_seed": result.random_seed,
                "split": result.split,
                "hyperparameters": result.hyperparameters,
            },
        },
        path,
    )


def load_model(path) -> dict:
    return joblib.load(path)