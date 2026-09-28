# BurnInGuard AI

**AI-Driven Anomaly Detection in Component Burn-In & Screening**

- Smart India Hackathon 2026
- Problem Statement: SIH26170
- Organization: ISRO
- Theme: Smart Automation
- Category: Software

> BurnInGuard AI is a predictive screening and engineering investigation platform designed to identify abnormal component behaviour during burn-in and support evidence-backed engineering analysis.

---

## Demo

Watch the working demonstration:

https://youtu.be/fNEgefGGj7k

## Repository

GitHub:

https://github.com/Junaidrj19/BurnInGuard-AI

---

## Problem Statement — SIH26170

**AI-Driven Anomaly Detection in Component Burn-In & Screening**

Traditional burn-in screening commonly relies heavily on predefined specification limits. A component can remain within nominal limits while exhibiting abnormal behaviour relative to its manufacturing lot or developing a concerning temporal drift.

The system therefore aims to move beyond:

**Measurement → Static limit check → Pass/Fail**

towards:

**Measurement → Behavioural analysis → Anomaly detection → Drift/risk assessment → Engineering investigation → Evidence-backed report**

The target use case is high-reliability electronic components subjected to burn-in and screening. This repository does **not** contain real ISRO production telemetry.

---

## BurnInGuard AI Solution

BurnInGuard AI implements the SIH26170 screening architecture and extends it with an engineering investigation layer. The solution is organized around four major capabilities:

1. **Lot-aware anomaly detection (Module A)** — scores a component against its manufacturing-lot distribution to identify statistically abnormal behaviour.
2. **Early-life drift prediction (Module B)** — uses early-life measurements to estimate end-of-burn-in trajectory.
3. **Risk Engine** — combines anomaly evidence, predicted drift, and applicable safety/acceptance criteria to derive screening risk.
4. **Explainability** — provides human-readable engineering reasons for why a component was flagged.

Beyond screening, the repository adds deterministic engineering calculations, evidence retrieval, competing hypotheses, validation, and evidence-backed report generation.

The system is designed to help engineers identify components that may be abnormal even when simple specification checks alone would not expose the issue.

> The investigation layer assists engineering analysis; it does not replace qualification, failure analysis, or the final engineering acceptance/rejection decision.

---

## SIH26170 Proposed Architecture

The SIH26170 solution defines the following screening pipeline:

```text
Burn-In Data
        ↓
Data Validation
        ↓
Module A: Lot-Relative Anomaly Detection
        ↓
Module B: Early-Life Drift Prediction
        ↓
Risk Engine
        ↓
QA Output
        ↓
PASS / MONITOR / FLAG
```

### Module A — Dynamic Outlier Detection

Scores a component against its manufacturing-lot distribution to identify statistically abnormal behaviour.

**Current implementation:** Module A is realized through the M6/M7 screening pipeline — feature engineering (`ml/features/`), Isolation Forest anomaly detection (`ml/anomaly/`), statistical baseline comparison, and module-level anomaly aggregation. Lot-level holdout is used during training and evaluation.

### Module B — 168h Drift Predictor

Uses early-life measurements to estimate the component's end-of-burn-in trajectory.

**Module B — 168h Drift Predictor (SIH concept):** The SIH solution defines Module B as an early-life drift predictor for end-of-burn-in behaviour. In the current prototype, this concept is demonstrated through the implemented **Component Projection**, which uses early `RDS_on` observations and a Ridge model to estimate the terminal value. The current demonstration is based on synthetic power-cycling reliability data and is not claimed to be validated burn-in/HTOL prediction.

Prototype implementation details:

- Ridge regression with `StandardScaler` on `RDS_on@0` and `RDS_on@14400`
- Target: `RDS_on@100000` (166.7 h equivalent in the demonstration dataset's cycle-time mapping)
- Lot holdout evaluation on the synthetic dataset
- API: `GET /modules/{module_id}/prediction`, `GET /prediction/evaluation`
- Deterministic investigation tool: `predict_drift_horizon`

### Risk Engine

Combines anomaly evidence, predicted drift, and applicable safety/acceptance criteria to derive screening risk.

**Current implementation:** The Risk Engine concept is partially realized in the screening disposition layer. `PASS` / `MONITOR` / `FLAG` are derived from Module A anomaly status (`module_anomaly_status`). Predicted drift is compared against module-profile acceptance criteria (relative change and absolute limits) to produce `early_reject` signals. `EARLY REJECT` disposition is gated on a recorded `check_acceptance_limits` violation during investigation — not on anomaly status alone.

### Explainability

Provides human-readable engineering reasons for why a component was flagged.

**Current implementation:** Deterministic explainability panels surface frozen M7 detector evidence — anomaly scores, anomaly rate, statistical baseline deviation, and signal groups — without attributing the decision to a single responsible signal (the Isolation Forest operates over the full feature matrix). See `frontend/components/ModuleAExplainability.tsx`.

---

## SIH Terminology vs BurnInGuard Product Terminology

The SIH presentation uses Module A / Module B / Risk Engine as technical architecture terms. The BurnInGuard product UI deliberately uses product-neutral labels for engineers. Both refer to the same system at different levels of abstraction:

| SIH / technical term | BurnInGuard product term | What it is |
| --- | --- | --- |
| Module A | Observed Anomaly | Lot-relative anomaly detection from the M6/M7 screening pipeline |
| Module B | Component Projection | Early-life drift / terminal-value estimation (Ridge prototype) |
| Risk Engine | Screening disposition | PASS / MONITOR / FLAG / EARLY REJECT derivation |
| Explainability | Why flagged panel | Deterministic detector evidence, not LLM prose |
| (extended layer) | Engineering Investigation | Calculations, evidence, hypotheses, report, provenance |

The SIH terms describe the proposed screening architecture. The BurnInGuard terms describe the same capabilities in the engineer-facing UI without implying a specific SIH slide-deck naming convention in every screen.

---

## Extended Architecture — Engineering Investigation

The current repository extends the SIH screening architecture with an engineering investigation layer:

```text
Screening (Module A + Module B + Risk Engine)
        ↓
Engineering Calculations
        ↓
Evidence Retrieval
        ↓
Competing Hypotheses
        ↓
Hypothesis Validation
        ↓
Engineering Report
        ↓
Human Engineering Decision
```

---

## What is implemented

### Module A — Screening / Detection

- Feature-based telemetry processing (M6)
- Isolation Forest anomaly detection (M7)
- Statistical baseline comparison
- Module/component-level anomaly aggregation
- Anomaly status classification (`clean`, `sporadic`, `persistent`)
- Deterministic explainability from frozen M7 artifacts

### Module B — Component Projection

The current demonstration includes a component projection capability that estimates a terminal `RDS_on` value from early observations. This is demonstrated on the available synthetic dataset. See **Module B — 168h Drift Predictor** above for the SIH concept vs prototype distinction.

### Risk Engine — Screening Disposition

- `PASS` / `MONITOR` / `FLAG` derived from `module_anomaly_status`
- Predicted drift vs acceptance-criteria comparison (`early_reject` signal)
- `EARLY REJECT` gated on recorded `check_acceptance_limits` violation

### Evaluation

- Detector evaluation against the available synthetic evaluation artifacts
- Evaluation metrics and provenance
- Separation between inference-time values and post-hoc evaluation values

### Engineering Investigation

The repository contains:

- Deterministic engineering calculations (10 registered tools)
- Evidence retrieval from the engineering knowledge base
- Engineering knowledge-base retrieval (ChromaDB + embeddings)
- Hypothesis generation (bounded LLM stage)
- Hypothesis validation
- Engineering report generation
- Report validation
- Provenance / pipeline trace

### Agentic Investigation

Investigation architecture:

**Data / engineering calculations → evidence retrieval → hypothesis generation → hypothesis validation → engineering report → report validation**

Implemented agents (LangGraph orchestration):

| Agent | Role |
| --- | --- |
| `InvestigationAgent` | Loads frozen ML artifacts; runs deterministic engineering tools |
| `EvidenceAgent` | Retrieves supporting evidence from ChromaDB |
| `HypothesisAgent` | Generates candidate failure-mechanism hypotheses with citations |
| `ReportAgent` | Synthesizes a structured engineering report |

Validation gates reject unresolved citations, unsupported mechanisms, and unwarranted certainty. The system is a prototype engineering-support platform, not a fully autonomous production-grade failure diagnosis system.

---

## Demonstration Dataset

> The current demonstration uses a synthetic SiC power-module reliability dataset based on power-cycling data.

> This dataset is used as a concrete engineering demonstration case because SIH26170 describes the problem at the component burn-in/screening level rather than prescribing a single component family or requiring a specific proprietary dataset.

> The demonstration dataset is **NOT** claimed to be ISRO production burn-in telemetry, and power-cycling data should not be interpreted as an actual burn-in/HTOL test.

Default dataset: `syn-sic-pc-dev-001` (750 modules, 5 lots, synthetic telemetry with separate ground truth for evaluation only).

---

## Engineering Knowledge Base

**Engineering Reliability Knowledge Base**

Curated engineering and reliability material used for evidence retrieval and hypothesis support. Located at `knowledge_base/`.

Current corpus coverage includes areas such as:

- Power cycling
- Gate-oxide degradation
- Die-attach degradation
- Bond-wire degradation
- Semiconductor reliability mechanisms

Current state (verified corpus ingest): 19 production (`VERIFIED`) documents, 360 ChromaDB chunks, embedding model `sentence-transformers/all-MiniLM-L6-v2`.

> The current corpus is a reliability-focused engineering knowledge base rather than a complete burn-in/HTOL standards repository. Dedicated standards and proprietary qualification documents are not represented unless legally and technically available.

Retrieved evidence must resolve to identifiable engineering sources (`document_id`, `chunk_id`, citation, URL, page range). Fabricated citations are rejected at validation gates.

---

## Investigation Pipeline

The investigation layer runs after screening (Module A, Module B, Risk Engine):

```text
Screening (Module A + Module B + Risk Engine)
        ↓
Engineering Calculations
        ↓
Evidence Retrieval
        ↓
Competing Hypotheses
        ↓
Hypothesis Validation
        ↓
Engineering Report
        ↓
Report Validation
        ↓
Human Engineering Review
```

> The language model is used for bounded hypothesis generation and report synthesis. Deterministic tools perform engineering calculations, and validation gates constrain unsupported claims.

---

## Screening Disposition

The Risk Engine derives screening labels from existing backend signals:

| Disposition | Source |
| --- | --- |
| **PASS** | `module_anomaly_status = clean` |
| **MONITOR** | `module_anomaly_status = sporadic` |
| **FLAG** | `module_anomaly_status = persistent` |
| **EARLY REJECT** | Recorded `check_acceptance_limits` violation only |

**EARLY REJECT** is not derived from anomaly status alone. It appears only when an investigation records a real acceptance-limit violation against the module profile.

> The engineering investigation layer does not override the screening decision.

> Final engineering acceptance/rejection remains a human engineering decision.

The LLM does not decide PASS, MONITOR, FLAG, or EARLY REJECT.

---

## System Architecture

### Layer 1 — SIH Screening (Module A + Module B + Risk Engine)

- Telemetry ingestion and data validation (M3–M5)
- **Module A:** Feature engineering (M6) + anomaly detection (M7, Isolation Forest + statistical baseline)
- **Module B:** Component projection (Ridge on early `RDS_on` → terminal estimate)
- **Risk Engine:** Screening disposition — PASS / MONITOR / FLAG / EARLY REJECT
- **Explainability:** Deterministic detector evidence panels
- Offline evaluation (M8)

### Layer 2 — Agentic Engineering Investigation

- Engineering calculations
- Evidence retrieval
- Hypothesis generation
- Hypothesis validation
- Report generation
- Report validation

### Layer 3 — Human Engineering Decision

The engineer reviews:

- Observed data
- Anomaly evidence
- Calculations
- Retrieved evidence
- Hypotheses
- Report
- Provenance

The system does not certify or independently release/reject a physical component.

---

## Technology Stack

Technologies present in the current implementation:

**Frontend**

- Next.js
- React
- TypeScript
- Tailwind CSS
- Recharts (scientific charts)

**Backend**

- Python (>= 3.11)
- FastAPI
- Pydantic
- scikit-learn

**ML**

- Isolation Forest (anomaly detection)
- Ridge regression (component projection on the demonstration dataset)
- NumPy, pandas, PyArrow

**Investigation**

- LangGraph orchestration
- LLM provider through configured API (OpenRouter-compatible; mock path when unconfigured)
- ChromaDB
- Sentence Transformers (`all-MiniLM-L6-v2`)

**Testing**

- pytest

---

## Repository Structure

```text
BurnInGuard AI/
├── backend/
│   ├── domain/                 # Component, test, and telemetry contracts
│   ├── agents/investigation/   # Investigation agents, orchestrator, tools
│   ├── knowledge/                # Corpus validation, ingestion, retrieval
│   ├── llm/                      # LLM abstraction and providers
│   ├── api/                      # FastAPI application and routes
│   └── tests/                    # Backend test suite
├── frontend/                     # Next.js engineer-facing UI
├── ml/
│   ├── generators/synthetic/     # Synthetic dataset generator
│   ├── validators/synthetic/     # Dataset validation
│   ├── features/                 # Feature engineering
│   ├── anomaly/                  # Anomaly detection
│   ├── evaluation/               # Offline evaluation
│   ├── prediction/               # Component projection (Ridge model)
│   └── datasets/                 # Generated artifacts and investigations
├── knowledge_base/
│   ├── corpus/                   # Source documents
│   ├── metadata/corpus.json      # Versioned manifest
│   └── chroma/                   # ChromaDB persist directory (local)
├── scripts/                      # Operational CLIs
├── schemas/                      # JSON Schemas
├── examples/                     # Reference profiles
└── docs/                         # Implementation documentation
```

---

## Verification

Known verified checks:

| Check | Result |
| --- | --- |
| Frontend build (`npm run build`) | Passed |
| Backend prediction tests (`test_prediction_api.py`, `test_prediction_module.py`) | 19 passed |

> A complete live end-to-end investigation run was not part of the final documentation verification pass.

---

## Current Limitations

- Demonstration dataset is synthetic.
- Demonstration data represents power-cycling/reliability behaviour rather than actual production burn-in telemetry.
- Knowledge-base coverage is not exhaustive.
- The system is a prototype engineering-support platform.
- Final engineering decisions remain human-controlled.
- The current implementation should not be interpreted as a production qualification system.
- No hardware / ESP32 telemetry integration is implemented in this repository.
- No universal semiconductor or component-family validation is claimed.

---

## Future Work

Proposed capabilities not yet implemented:

- Validated burn-in / HTOL datasets
- Broader component-family support
- Hardware telemetry integration
- Richer burn-in trajectory modelling
- Larger reliability knowledge corpus
- Additional failure mechanisms
- Production deployment hardening
- Expanded validation across independent datasets

---

## Alignment with SIH26170

| SIH component | BurnInGuard implementation |
| --- | --- |
| Module A — Dynamic Outlier Detection | M6/M7 screening pipeline (Isolation Forest + statistical baseline, lot-relative) |
| Module B — 168h Drift Predictor | Component Projection prototype (Ridge on early `RDS_on`; synthetic dataset only) |
| Risk Engine | Screening disposition (PASS / MONITOR / FLAG / EARLY REJECT) |
| Explainability | Deterministic M7 evidence panels (`ModuleAExplainability`) |
| Engineering investigation (extended) | LangGraph agents, deterministic tools, RAG, validation gates, report |

| SIH problem | BurnInGuard response |
| --- | --- |
| Detect abnormal behaviour during component burn-in and screening | Module A: lot-relative behavioural analysis and ML anomaly detection |
| Move beyond static limit checks | Module B: early-life drift prediction; Risk Engine: acceptance-criteria comparison |
| Support engineering investigation | Deterministic calculations, evidence retrieval, failure-mechanism hypotheses |
| Produce actionable engineering output | Evidence-backed engineering reports with human-reviewable provenance |

> The SIH problem defines the target engineering use case. The current repository is a working prototype demonstrating the SIH screening architecture (Module A, Module B, Risk Engine, Explainability) and the extended engineering investigation layer, using a synthetic reliability dataset.

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js (for frontend)

### Backend

```bash
python3 -m pip install -e ".[dev]"
cp .env.example .env
# Set LLM_API_KEY for live hypothesis generation (optional; mock path available)
python3 -m pytest -W error
```

### Frontend

```bash
cd frontend
npm install
npm run build
```

### Run investigation (example)

```bash
python3 scripts/investigate.py \
  --module-id syn-mod-0042 \
  --model-id iforest-v1-syn-sic-pc-dev-001-s20260922
```

### Start API

```bash
uvicorn backend.api.app:app --reload
```

Key endpoints: `/health`, `/investigations`, `/modules`, `/readiness`, `/corpus`, `/modules/{id}/prediction`.

---

## Authoritative Documents

| Document | Description |
| --- | --- |
| [`PRD.md`](PRD.md) | Product requirements |
| [`architecture.md`](architecture.md) | System architecture |
| [`agent-rules.md`](agent-rules.md) | Agent safety and evidence rules |
| [`docs/implementation-status.md`](docs/implementation-status.md) | Detailed milestone status |
| [`knowledge_base/README.md`](knowledge_base/README.md) | Knowledge base rules and ingestion |
