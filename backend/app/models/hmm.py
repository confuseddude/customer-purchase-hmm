"""Hidden Markov Model parameter container, defaults and validation.

lambda = (A, B, pi)

* pi  -- initial state distribution, shape (N,)
* A   -- transition matrix, shape (N, N); A[i, j] = P(q_{t+1} = j | q_t = i)
* B   -- emission matrix, shape (N, M);   B[i, k] = P(O_t = k | q_t = i)

Internally B is stored with one ROW per hidden state, so every row of both A
and B is a probability distribution that must sum to 1. (The project
presentation draws B with observations as rows and states as columns; it is
the same matrix, transposed.)

All default numbers are ILLUSTRATIVE, SIMULATED parameters. They are not
estimated from real customer data.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Sequence

import numpy as np

STATES: list[str] = ["Browsing", "Interested", "Ready to Purchase"]
STATE_SHORT: list[str] = ["Browsing", "Interested", "Ready"]
OBSERVATIONS: list[str] = ["View", "Cart", "Checkout", "Purchase", "Exit"]

PURCHASE = OBSERVATIONS.index("Purchase")
EXIT = OBSERVATIONS.index("Exit")

DEFAULT_PI = np.array([0.70, 0.25, 0.05])

DEFAULT_A = np.array(
    [
        [0.60, 0.35, 0.05],  # from Browsing
        [0.15, 0.60, 0.25],  # from Interested
        [0.05, 0.20, 0.75],  # from Ready to Purchase
    ]
)

# rows = states, columns = View, Cart, Checkout, Purchase, Exit
DEFAULT_B = np.array(
    [
        [0.70, 0.20, 0.03, 0.01, 0.06],  # Browsing
        [0.20, 0.50, 0.15, 0.10, 0.05],  # Interested
        [0.05, 0.25, 0.04, 0.65, 0.01],  # Ready to Purchase
    ]
)

SUM_TOLERANCE = 1e-6


class InvalidModelError(ValueError):
    """Raised when (A, B, pi) do not form a valid HMM."""

    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


class InvalidObservationError(ValueError):
    """Raised when an observation sequence is empty or contains unknown symbols."""


def validate_parameters(pi, A, B, n_states: int | None = None, n_obs: int | None = None) -> list[str]:
    """Return a list of human-readable validation errors (empty list == valid)."""
    errors: list[str] = []
    try:
        pi = np.asarray(pi, dtype=float)
        A = np.asarray(A, dtype=float)
        B = np.asarray(B, dtype=float)
    except (TypeError, ValueError):
        return ["Parameters must be numeric arrays."]

    if pi.ndim != 1:
        errors.append("pi must be a 1-D vector.")
        return errors
    n = pi.shape[0] if n_states is None else n_states
    if pi.shape != (n,):
        errors.append(f"pi must have {n} entries (got {pi.shape[0]}).")
    if A.shape != (n, n):
        errors.append(f"A must be a {n}x{n} matrix (got shape {A.shape}).")
    if B.ndim != 2 or B.shape[0] != n:
        errors.append(f"B must have {n} rows, one per hidden state (got shape {B.shape}).")
    elif n_obs is not None and B.shape[1] != n_obs:
        errors.append(f"B must have {n_obs} columns, one per observation (got {B.shape[1]}).")
    if errors:
        return errors

    for name, arr in (("pi", pi), ("A", A), ("B", B)):
        if not np.all(np.isfinite(arr)):
            errors.append(f"{name} contains non-finite values.")
        if np.any(arr < 0):
            errors.append(f"{name} contains negative probabilities.")
        if np.any(arr > 1 + SUM_TOLERANCE):
            errors.append(f"{name} contains probabilities greater than 1.")
    if errors:
        return errors

    state_names = STATES if n == len(STATES) else [f"state {i}" for i in range(n)]
    if abs(pi.sum() - 1) > SUM_TOLERANCE:
        errors.append(f"Initial probabilities must sum to 1 (got {pi.sum():.6f}).")
    for i, row in enumerate(A):
        if abs(row.sum() - 1) > SUM_TOLERANCE:
            errors.append(f"Transition row '{state_names[i]}' must sum to 1 (got {row.sum():.6f}).")
    for i, row in enumerate(B):
        if abs(row.sum() - 1) > SUM_TOLERANCE:
            errors.append(f"Emission distribution of '{state_names[i]}' must sum to 1 (got {row.sum():.6f}).")
    return errors


@dataclass
class HMM:
    pi: np.ndarray
    A: np.ndarray
    B: np.ndarray
    states: list[str] = field(default_factory=lambda: list(STATES))
    observations: list[str] = field(default_factory=lambda: list(OBSERVATIONS))

    def __post_init__(self) -> None:
        self.pi = np.asarray(self.pi, dtype=float)
        self.A = np.asarray(self.A, dtype=float)
        self.B = np.asarray(self.B, dtype=float)
        n = self.pi.shape[0] if self.pi.ndim == 1 else 0
        if len(self.states) != n:
            self.states = [f"S{i}" for i in range(n)]
        if self.B.ndim == 2 and len(self.observations) != self.B.shape[1]:
            self.observations = [f"O{k}" for k in range(self.B.shape[1])]
        errors = validate_parameters(self.pi, self.A, self.B)
        if errors:
            raise InvalidModelError(errors)

    @property
    def n_states(self) -> int:
        return self.pi.shape[0]

    @property
    def n_obs(self) -> int:
        return self.B.shape[1]

    @classmethod
    def default(cls) -> "HMM":
        return cls(DEFAULT_PI.copy(), DEFAULT_A.copy(), DEFAULT_B.copy())

    def copy(self) -> "HMM":
        return HMM(self.pi.copy(), self.A.copy(), self.B.copy(), list(self.states), list(self.observations))

    def to_dict(self) -> dict:
        return {
            "states": list(self.states),
            "observations": list(self.observations),
            "pi": self.pi.tolist(),
            "A": self.A.tolist(),
            "B": self.B.tolist(),
        }

    def encode(self, sequence: Sequence) -> np.ndarray:
        """Convert observation names (case-insensitive) or integer indices to indices."""
        return encode_observations(sequence, self.observations)


def encode_observations(sequence: Iterable, vocabulary: Sequence[str] = OBSERVATIONS, allow_empty: bool = False) -> np.ndarray:
    lookup = {name.lower(): i for i, name in enumerate(vocabulary)}
    out: list[int] = []
    for pos, item in enumerate(sequence):
        if isinstance(item, (int, np.integer)) and not isinstance(item, bool):
            if not 0 <= int(item) < len(vocabulary):
                raise InvalidObservationError(f"Observation index {item} at position {pos + 1} is out of range.")
            out.append(int(item))
        elif isinstance(item, str) and item.strip().lower() in lookup:
            out.append(lookup[item.strip().lower()])
        else:
            raise InvalidObservationError(
                f"Unknown observation {item!r} at position {pos + 1}. Valid observations: {', '.join(vocabulary)}."
            )
    if not out and not allow_empty:
        raise InvalidObservationError("The observation sequence must contain at least one observation.")
    return np.array(out, dtype=int)


def encode_states(sequence: Iterable, names: Sequence[str] = STATES) -> np.ndarray:
    """Convert hidden-state names (full or short form, case-insensitive) or indices to indices."""
    lookup = {name.lower(): i for i, name in enumerate(names)}
    if list(names) == STATES:
        lookup.update({name.lower(): i for i, name in enumerate(STATE_SHORT)})
    out: list[int] = []
    for pos, item in enumerate(sequence):
        if isinstance(item, (int, np.integer)) and not isinstance(item, bool) and 0 <= int(item) < len(names):
            out.append(int(item))
        elif isinstance(item, str) and item.strip().lower() in lookup:
            out.append(lookup[item.strip().lower()])
        else:
            raise InvalidObservationError(f"Unknown hidden state {item!r} at position {pos + 1}.")
    return np.array(out, dtype=int)
