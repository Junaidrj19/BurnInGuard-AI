from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

_REPO = Path(__file__).resolve().parents[2]

CYCLES_PER_HOUR = 600
TARGET_CYCLE = 100_000
TARGET_HOURS = TARGET_CYCLE / CYCLES_PER_HOUR  # 166.6667
FEATURE_CYCLES = (0, 14_400)
FEATURE_HOURS = (0.0, 24.0)
MAX_FEATURE_CYCLE = 14_400

TRAIN_LOTS = ("lot-02", "lot-03", "lot-05")
TEST_LOTS = ("lot-01", "lot-04")

DATASET_ID = "syn-sic-pc-dev-001"
TELEMETRY_PATH = _REPO / "ml/datasets/synthetic/syn-sic-pc-dev-001/telemetry/telemetry.parquet"
GROUND_TRUTH_PATH = _REPO / "ml/datasets/synthetic/syn-sic-pc-dev-001/ground_truth/ground-truth.parquet"
MODEL_DIR = _REPO / "ml/prediction/models"
PROFILE_PATH = _REPO / "examples/module-profiles/sic-reference-module.json"

FEATURE_NAMES = ("RDS_on@0", "RDS_on@14400")
TARGET_NAME = "RDS_on@100000"

RDS_ON_MAX_ABSOLUTE_MOHM = 8.0
RDS_ON_MAX_RELATIVE_CHANGE_PCT = 20.0

RANDOM_SEED = 20260922


@dataclass
class PredictionConfig:
    train_lots: tuple[str, ...] = field(default_factory=lambda: TRAIN_LOTS)
    test_lots: tuple[str, ...] = field(default_factory=lambda: TEST_LOTS)
    feature_cycles: tuple[int, ...] = field(default_factory=lambda: FEATURE_CYCLES)
    target_cycle: int = TARGET_CYCLE
    random_seed: int = RANDOM_SEED
    model_dir: str = str(MODEL_DIR)
    telemetry_path: str = str(TELEMETRY_PATH)
    ground_truth_path: str = str(GROUND_TRUTH_PATH)
    profile_path: str = str(PROFILE_PATH)