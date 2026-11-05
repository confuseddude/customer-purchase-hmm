# Customer Purchase Likelihood Prediction using Hidden Markov Models

An interactive machine-learning lab that infers a shopper's **hidden intention** (Browsing, Interested, Ready to Purchase) from their **observed actions** (View, Cart, Checkout, Purchase, Exit) and estimates the probability that their next action is a purchase.

Every HMM algorithm is implemented from scratch in NumPy. The React frontend only visualises the intermediate values the backend returns. It never computes model results itself.

```
Customer actions → Observations → Hidden-state inference → Probability calculation → Purchase likelihood → Prediction
```

> **Simulated data and illustrative parameters.** The model parameters are illustrative and the dataset is synthetic (generated with seed 42). Nothing here was learned from real customers, and the purchase probability is a model output, not a calibrated conversion rate.

---

## Features

| Area | What it does |
| --- | --- |
| **Overview** | Project summary, pipeline, current λ = (A, B, π), current journey, latest prediction, recent experiments |
| **Customer Simulator** | Build a journey click by click or load examples A–D. *Forecast* mode gives P(next = Purchase \| history). *Analyze* mode explains a completed journey. Purchase inside a forecast is blocked to prevent target leakage |
| **HMM Visualization** | Interactive state diagram (transitions, emissions, π). Click a state for its details. Step-by-step animation of filtered and smoothed beliefs |
| **Algorithm Lab** | Forward, Backward, Forward-Backward, Viterbi and MLE / Baum-Welch tabs. Each has the formula, symbol glossary, *Next Step* walkthrough, *Show calculation* substitutions, tables, final result and interpretation |
| **Prediction Analysis** | Posterior and filtered timelines, Viterbi path, expected-transition heat-map, next-action probabilities, leakage-free purchase trajectory, comparison across journeys |
| **Model Training** | Supervised frequency MLE (with Laplace smoothing) and unsupervised Baum-Welch (max iterations, tolerance, pseudo-count, current or random init). Log-likelihood chart, before/after/change matrices, apply as active model |
| **Dataset Explorer** | Browse and filter the 600 simulated sequences and their true hidden states, and load any one into the simulator or Viterbi |
| **Model Configuration** | Edit every probability with live validation, backend re-validation, save history and reset to defaults |
| **Learn the Project** | 12 chapters from “the problem” to “limitations and future scope”, with live demos that call the backend |

---

## Tech stack

- **Backend:** Python 3.10+, FastAPI, NumPy, Pandas, SQLite (standard-library `sqlite3`), pytest
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, Recharts, Lucide icons, KaTeX for formulas
- No black-box HMM library is used. scikit-learn is not needed.

---

## Setup

### Prerequisites

- Python **3.10 or newer**
- Node.js **20.19+ or 22.12+** (required by Vite 8) and npm

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows (PowerShell):  .venv\Scripts\Activate.ps1
# Windows (cmd):         .venv\Scripts\activate.bat
# macOS / Linux:         source .venv/bin/activate
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

On first start the backend creates `backend/data/hmm.sqlite3`. It loads the default model and imports `dataset/synthetic_customers.csv`, generating the CSV first if it is missing.

- Interactive API docs: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/api/health>

### 2. Frontend (in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to `http://127.0.0.1:8000`, so both servers must be running.

### Production build (optional)

```bash
cd frontend
npm run build      # type-checks, then builds to frontend/dist
npm run preview    # serves the build on http://localhost:4173 (also proxies /api)
```

---

## Tests

```bash
cd backend
python -m pytest -q
```

There are 63 tests:

- **Algorithms vs brute force:** Forward likelihood, every α_t(i) and β_t(i), the posteriors γ and the Viterbi path are compared with exhaustive enumeration over all hidden paths on a small HMM. Viterbi is also checked on the 3-state default model.
- **Consistency:** Σ α_t·β_t = P(O) for every t, ξ marginals equal γ, and posteriors sum to 1.
- **Learning:** Baum-Welch log-likelihood never decreases and converges within tolerance. Supervised MLE counts are checked by hand, and smoothed MLE recovers the true parameters from 2,000 sampled sequences.
- **Prediction:** P(Purchase next) equals the brute-force conditional P(O₁..O_T, Purchase) / P(O₁..O_T). The empty-history prior, target-leakage rejection and leakage-free analysis are covered.
- **Edge cases:** empty sequences, single observations, invalid observations, zero probabilities and impossible sequences, a 5,000-step sequence (no underflow), and invalid matrices (negative values, values > 1, rows not summing to 1, wrong shapes).
- **API:** every endpoint, including validation errors (422), leakage errors, saving and resetting parameters, and training. Tests use a temporary SQLite database.

---

## The model

λ = (A, B, π), with N = 3 hidden states and M = 5 observations. **Illustrative values:**

**π (initial):** Browsing 0.70 · Interested 0.25 · Ready 0.05

**A (transitions, row = from):**

| | Browsing | Interested | Ready |
|---|---|---|---|
| Browsing | 0.60 | 0.35 | 0.05 |
| Interested | 0.15 | 0.60 | 0.25 |
| Ready | 0.05 | 0.20 | 0.75 |

**B (emissions, shown as in the presentation: rows = observation, columns = state; each column sums to 1):**

| | Browsing | Interested | Ready |
|---|---|---|---|
| View | 0.70 | 0.20 | 0.05 |
| Cart | 0.20 | 0.50 | 0.25 |
| Checkout | 0.03 | 0.15 | 0.04 |
| Purchase | 0.01 | 0.10 | 0.65 |
| Exit | 0.06 | 0.05 | 0.01 |

View, Cart and Purchase follow the project presentation. Checkout and Exit are added synthetic values that complete each distribution. Internally (and in the UI) B is stored **transposed**, one row per hidden state, so every row of A and B is a distribution.

### Purchase prediction

For an unfinished journey O₁…O_t (which must not contain Purchase):

```
filtered_i         = α_t(i) / Σ_k α_t(k)                    = P(q_t = i | O₁..O_t)
P(Purchase next)   = Σ_i Σ_j filtered_i · a_ij · b_j(Purchase)
```

With an empty history the model uses P(O₁ = Purchase) = Σ_j π_j b_j(Purchase). The UI also reports the range this probability can take under the current model (certain Browsing → certain Ready) and where the journey falls in that range.

### Numerical stability

- Forward and Backward use Rabiner scaling, with log P(O | λ) = Σ_t log c_t. Raw α and β are also returned (computed in log space) for display.
- Viterbi runs in log space. Ties go to the lowest state index, so results are reproducible.
- Non-finite values (for example log 0) are sent as `null` in JSON. Impossible sequences return `impossible: true` or a 422 error with `code: "zero_probability"`.

---

## REST API

All endpoints accept an optional `params: {pi, A, B}` override. Without it they use the active model stored in SQLite.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Status, active model name, dataset size |
| GET / PUT | `/api/model/parameters` | Read or save (and activate) λ; PUT validates |
| POST | `/api/model/validate` | Validate parameters without saving |
| POST | `/api/model/reset` | Restore the illustrative defaults |
| GET | `/api/model/defaults`, `/api/model/history` | Default λ and saved configurations |
| POST | `/api/forward` | α table, per-cell terms, scaling factors, P(O \| λ) |
| POST | `/api/backward` | β table (T → 1), per-cell terms, termination check |
| POST | `/api/forward-backward` | γ, ξ, expected transitions, timeline |
| POST | `/api/viterbi` | δ, ψ, candidates, backtracking, best path |
| POST | `/api/predict` | `mode: "forecast"` (next-action probabilities) or `"analyze"` (completed journey). `record: false` skips the experiment log |
| POST | `/api/predict/compare` | Leakage-free P(Purchase next) for several journeys |
| POST | `/api/joint` | P(O, Q \| λ) for a chosen hidden path, factor by factor |
| POST | `/api/train/mle` | Supervised MLE from labelled sequences (dataset or custom) |
| POST | `/api/train/baum-welch` | EM training with per-iteration log-likelihood and parameters |
| GET | `/api/dataset`, `/api/dataset/summary`, `/api/dataset/{id}` | Dataset explorer |
| GET | `/api/experiments` | Recent predictions and training runs |
| GET | `/api/examples`, `/api/learn/likelihood-curve` | Example journeys, Bernoulli likelihood curve for the MLE chapter |

Example:

```bash
curl -X POST http://127.0.0.1:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"observations": ["View", "Cart", "Checkout"], "mode": "forecast"}'
```

---

## Synthetic dataset

`backend/app/services/dataset.py` (run `python -m app.services.dataset` from `backend/` to regenerate) creates 600 sequences:

1. It picks an archetype: casual browser, comparison shopper, cart abandoner, typical shopper or decisive buyer. Each archetype has its own π and A.
2. It samples a hidden-state path and emits actions from B.
3. The session stops at Purchase, at Exit, or at the archetype's maximum length (recorded as "Session timeout").
4. It labels the behaviour from the *observed* actions: Casual browsing, Repeated product viewing, Cart abandonment, Checkout abandonment, Successful purchase, High purchase intent.

The true hidden states are stored, which supports supervised MLE and lets you compare them with what Viterbi infers. Baum-Welch ignores them.

---

## Project structure

```
customer-purchase-hmm/
├── backend/
│   ├── app/
│   │   ├── main.py                 FastAPI app, error handlers
│   │   ├── schemas.py              request models, JSON sanitising
│   │   ├── models/hmm.py           HMM container, defaults, validation, encoding
│   │   ├── algorithms/
│   │   │   ├── forward.py          scaled forward pass
│   │   │   ├── backward.py         log-space + scaled backward pass
│   │   │   ├── forward_backward.py γ and ξ
│   │   │   ├── viterbi.py          log-space Viterbi with backpointers
│   │   │   ├── baum_welch.py       EM training
│   │   │   ├── mle.py              supervised counting MLE
│   │   │   ├── prediction.py       forecast / analyze / interpretation
│   │   │   └── numerics.py         logsumexp helpers
│   │   ├── routes/                 prediction.py, training.py, configuration.py
│   │   ├── services/dataset.py     synthetic data generator
│   │   └── database/db.py          SQLite persistence
│   ├── tests/                      test_algorithms.py, test_api.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/                  one file per page; lab/ tabs; learn/ chapters
│       ├── components/             UI primitives, diagram, tables, journey widgets
│       ├── charts/                 Recharts wrappers
│       ├── hooks/                  app state, async helpers, hash router
│       ├── services/api.ts         typed REST client
│       └── lib/                    constants, formatting, TeX builders
├── dataset/synthetic_customers.csv
└── README.md
```

---

## Limitations

- Synthetic data and assumed hidden states: the results describe the simulator, not real shoppers.
- First-order Markov dynamics, five action types, and the same parameters for every customer.
- Exit is not treated as the end of a session in the forecast. The UI warns when a journey contains Exit.
- Baum-Welch finds local optima, and learned states can swap meaning (label switching).
- The purchase probability is not calibrated and has not been validated against real outcomes.

See *Learn the Project → Chapter 12* for future work and questions to prepare for a viva.
