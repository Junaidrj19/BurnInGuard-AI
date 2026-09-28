# Module B — Predicted Trajectory (Forward Drift Prediction)

## Scope

Module B is a **forward prediction** of the terminal `RDS_on` value of a module,
scored only on early-life observed data. It is deliberately separate from Module A
(observed anomaly detection): Module A flags what was *observed*; Module B projects a
*future* trajectory. **Module B does not cause a Module A anomaly flag.**

## Data conventions (audited fact, not assumption)

One cycle = 6 s. Therefore:

| Quantity | Value |
| --- | --- |
| cycles per hour | 600 |
| cycle 0 | 0 h |
| cycle 14,400 | 24 h |
| cycle 57,600 | 96 h |
| cycle 100,000 | 166.6667 h |
| cycle 100,800 / 168 h | **does not exist** in the dataset |

The dataset ends at cycle 100,000 = **166.67 h**. PS specifies **168 h**; the supplied
dataset does not contain a 168 h measurement, so **no extrapolation is performed**. The
predicted terminal value is a cycle-100,000 (166.7 h) estimate and is **never presented
as if it were literally a 168 h measurement**.

## Target

- Target signal: `RDS_on`
- Feature cycles: `0` and `14,400` (0 h and 24 h)
- Target cycle: `100,000` (166.7 h)

## Lot holdout

| Split | Lots | Modules |
| --- | --- | --- |
| train | lot-02, lot-03, lot-05 | 450 |
| test | lot-01, lot-04 | 300 |

`syn-mod-0006` is in held-out **lot-01** (test).

## Leakage control (hard assertion)

The predictor may use **only** `RDS_on@0` and `RDS_on@14400`. It must not use
cycle 57,600, cycle 100,000, any future cycle, the actual target, or anomaly labels
derived from future observations as features.

`ml/prediction/dataset.py::assert_allowed_feature_cycles` raises `LeakageError` for any
feature cycle `> 14,400`. A regression test (`test_leakage_boundary_rejects_future_cycles`)
proves requesting any feature cycle > 14,400 fails.

The persisted feature list is exactly:

```
RDS_on@0
RDS_on@14400
```

Ground truth (`RDS_on@100000`) is read **only after prediction**, for evaluation, and is
never passed into the model (`backend/api/prediction.py` provenance note).

## Model selection

Default pipeline: `StandardScaler → Ridge`. `ExtraTrees` and `RandomForest` are evaluated
for comparison. Per the approved module guidance, a tree model is selected **only if
both** tree models beat Ridge **and** the best improvement is > 10%. Otherwise Ridge is kept.

Held-out (lot-holdout) results:

| Model | Train MAE | Test MAE |
| --- | --- | --- |
| Ridge | 0.18578 | **0.17994** |
| ExtraTrees | 0.13587 | 0.19453 |
| RandomForest | 0.12062 | 0.20658 |

The tree models overfit (large train→test gap). Ridge has the **best held-out test MAE**,
so **Ridge is shipped**. It also beats the naive baseline MAE (0.18605).

| Metric | Value (mOhm) |
| --- | --- |
| Ridge test MAE | 0.17994 |
| Naive baseline MAE (reuse RDS_on@14400) | 0.18605 |

## Safety slope / early reject

Using the only real profile `examples/module-profiles/sic-reference-module.json`,
`RDS_on`: `maximum_relative_change_percent = 20`, `maximum_absolute = 8.0 mOhm`.

```
predicted_total_relative_change_pct = (pred_target - V0) / V0 * 100
predicted_drift_rate_pct_per_hour  = predicted_total_relative_change_pct / 166.6667
safety_slope_pct_per_hour          = 20 / 166.6667 = 0.12
```

Early reject when `predicted_total_relative_change_pct > 20` **or** `predicted_target >
8.0 mOhm`. Both carry provenance pointing at the profile. If the profile cannot be loaded,
`safety_slope = null` and `early_reject = null`; the frontend displays **N/I**.

`FLAG` and `EARLY REJECT` are separate decisions and are never conflated.

## M9 tool

`predict_drift_horizon` is a deterministic tool in the M9 registry
(`backend/agents/investigation/tools/drift_horizon.py`). The LLM never calculates the
prediction; the tool returns the recorded deterministic ridge-model result for a module.
Ground truth is read only after prediction for evaluation.

## API

- `GET /modules/{module_id}/prediction` — prediction, ground truth, evaluation, safety, provenance.
- `GET /prediction/evaluation` — held-out model evaluation record.

## Frontend

- Route: `/components/{moduleId}/prediction`
- Component: `frontend/components/ModuleBPanel.tsx`
- Shows Data, Calculation, Ground Truth, Evaluation, Safety & Drift, Horizon.
- Every user-visible location makes the 166.7 h horizon explicit and the PS 168 h limitation
  explicit.
