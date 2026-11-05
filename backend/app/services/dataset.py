"""Synthetic customer-journey dataset.

EVERY SEQUENCE IN THIS DATASET IS SIMULATED. Nothing here comes from real
customers.

Generation process (fully reproducible, seed = 42):

1. Pick a customer archetype (casual browser, comparison shopper, cart
   abandoner, typical shopper, decisive buyer). Each archetype has its own
   initial distribution and transition matrix over the three hidden states.
2. Sample a hidden-state path from that Markov chain, and at every step emit
   an observable action from the shared emission matrix B.
3. The session ends as soon as Purchase or Exit is emitted, or when the
   archetype's maximum session length is reached.
4. A behaviour label is assigned afterwards from the *observed* actions
   (e.g. "Cart abandonment" = reached Cart but never Checkout or Purchase).

Because the hidden states are recorded, the dataset supports supervised MLE;
the same sequences without labels are used for unsupervised Baum-Welch.

Run `python -m app.services.dataset` from the backend folder to regenerate.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from app.models.hmm import DEFAULT_B, OBSERVATIONS, STATE_SHORT

DATASET_PATH = Path(__file__).resolve().parents[3] / "dataset" / "synthetic_customers.csv"
SEED = 42
N_CUSTOMERS = 600

ARCHETYPES = {
    "casual_browser": {
        "weight": 0.25,
        "pi": [0.95, 0.05, 0.00],
        "A": [[0.85, 0.13, 0.02], [0.50, 0.45, 0.05], [0.30, 0.40, 0.30]],
        "length": (2, 6),
    },
    "comparison_shopper": {
        "weight": 0.20,
        "pi": [0.90, 0.10, 0.00],
        "A": [[0.80, 0.18, 0.02], [0.35, 0.55, 0.10], [0.10, 0.40, 0.50]],
        "length": (5, 12),
    },
    "cart_abandoner": {
        "weight": 0.15,
        "pi": [0.60, 0.40, 0.00],
        "A": [[0.50, 0.48, 0.02], [0.25, 0.70, 0.05], [0.20, 0.60, 0.20]],
        "length": (3, 9),
    },
    "typical_shopper": {
        "weight": 0.20,
        "pi": [0.70, 0.25, 0.05],
        "A": [[0.60, 0.35, 0.05], [0.15, 0.60, 0.25], [0.05, 0.20, 0.75]],
        "length": (3, 10),
    },
    "decisive_buyer": {
        "weight": 0.20,
        "pi": [0.40, 0.45, 0.15],
        "A": [[0.40, 0.50, 0.10], [0.05, 0.55, 0.40], [0.02, 0.08, 0.90]],
        "length": (2, 8),
    },
}

BEHAVIOURS = [
    "Casual browsing",
    "Repeated product viewing",
    "Cart abandonment",
    "Checkout abandonment",
    "Successful purchase",
    "High purchase intent",
]


def label_behaviour(obs: list[str]) -> str:
    if "Purchase" in obs:
        return "High purchase intent" if obs.index("Purchase") <= 3 else "Successful purchase"
    if "Checkout" in obs:
        return "Checkout abandonment"
    if "Cart" in obs:
        return "Cart abandonment"
    if obs.count("View") >= 4:
        return "Repeated product viewing"
    return "Casual browsing"


def generate(n: int = N_CUSTOMERS, seed: int = SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    names = list(ARCHETYPES)
    weights = np.array([ARCHETYPES[k]["weight"] for k in names])
    terminal = {OBSERVATIONS.index("Purchase"), OBSERVATIONS.index("Exit")}
    rows = []
    for idx in range(n):
        arch = names[rng.choice(len(names), p=weights / weights.sum())]
        spec = ARCHETYPES[arch]
        pi, A = np.array(spec["pi"]), np.array(spec["A"])
        max_len = int(rng.integers(spec["length"][0], spec["length"][1] + 1))
        states, obs = [], []
        s = int(rng.choice(3, p=pi))
        for t in range(max_len):
            if t > 0:
                s = int(rng.choice(3, p=A[s]))
            o = int(rng.choice(len(OBSERVATIONS), p=DEFAULT_B[s]))
            states.append(s)
            obs.append(o)
            if o in terminal:
                break
        obs_names = [OBSERVATIONS[o] for o in obs]
        rows.append(
            {
                "sequence_id": idx + 1,
                "customer_id": f"SIM-{idx + 1:04d}",
                "archetype": arch,
                "behaviour": label_behaviour(obs_names),
                "observations": "|".join(obs_names),
                "hidden_states": "|".join(STATE_SHORT[s] for s in states),
                "length": len(obs),
                "purchased": int("Purchase" in obs_names),
                "ended_with": obs_names[-1] if obs[-1] in terminal else "Session timeout",
            }
        )
    return pd.DataFrame(rows)


def ensure_csv(path: Path = DATASET_PATH) -> Path:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        generate().to_csv(path, index=False)
    return path


def load_csv(path: Path = DATASET_PATH) -> pd.DataFrame:
    return pd.read_csv(ensure_csv(path))


if __name__ == "__main__":
    df = generate()
    DATASET_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(DATASET_PATH, index=False)
    print(f"Wrote {len(df)} simulated sequences to {DATASET_PATH}")
    print(df["behaviour"].value_counts().to_string())
