"""Supervised Maximum Likelihood Estimation by frequency counting.

When every observation comes with its hidden-state label, the complete-data
likelihood P(O, Q | lambda) factorises into independent multinomials, and the
MLE of each probability is simply a normalised count:

    pi_i   = C(q_1 = i)              / # sequences
    a_ij   = C(q_t = i, q_{t+1} = j) / C(q_t = i, t < T)
    b_i(k) = C(q_t = i, O_t = k)     / C(q_t = i)

Additive (Laplace) smoothing adds `smoothing` to every count so that events
not seen in the training data keep a small non-zero probability:

    a_ij = (C_ij + s) / (C_i + N s)
"""

from __future__ import annotations

import numpy as np

from app.algorithms.forward import forward_pass, ZeroProbabilitySequence
from app.models.hmm import HMM


def supervised_mle(
    observation_seqs: list[np.ndarray],
    state_seqs: list[np.ndarray],
    n_states: int,
    n_obs: int,
    smoothing: float = 1.0,
    states=None,
    observations=None,
) -> dict:
    if not observation_seqs:
        raise ValueError("Supervised MLE needs at least one labelled sequence.")
    if smoothing < 0:
        raise ValueError("Smoothing must be non-negative.")
    pi_c = np.zeros(n_states)
    a_c = np.zeros((n_states, n_states))
    b_c = np.zeros((n_states, n_obs))
    for obs, st in zip(observation_seqs, state_seqs):
        if len(obs) != len(st):
            raise ValueError("Each observation sequence needs exactly one hidden-state label per observation.")
        if len(obs) == 0:
            continue
        pi_c[st[0]] += 1
        for t in range(len(st) - 1):
            a_c[st[t], st[t + 1]] += 1
        for s, o in zip(st, obs):
            b_c[s, o] += 1

    def normalise(counts: np.ndarray, k: int) -> np.ndarray:
        num = counts + smoothing
        den = num.sum(axis=-1, keepdims=True)
        # a row with no data and no smoothing: fall back to uniform
        return np.where(den > 0, num / np.where(den > 0, den, 1), 1.0 / k)

    pi = normalise(pi_c, n_states)
    A = normalise(a_c, n_states)
    B = normalise(b_c, n_obs)
    kwargs = {}
    if states is not None:
        kwargs["states"] = list(states)
    if observations is not None:
        kwargs["observations"] = list(observations)
    model = HMM(pi, A, B, **kwargs)
    return {
        "model": model,
        "counts": {"pi": pi_c.tolist(), "A": a_c.tolist(), "B": b_c.tolist()},
        "smoothing": smoothing,
        "n_sequences": len(observation_seqs),
        "n_observations": int(sum(len(o) for o in observation_seqs)),
        "n_transitions": int(a_c.sum()),
    }


def complete_data_log_likelihood(hmm: HMM, observation_seqs, state_seqs) -> float:
    """log P(O, Q | lambda) summed over labelled sequences."""
    with np.errstate(divide="ignore"):
        lp, la, lb = np.log(hmm.pi), np.log(hmm.A), np.log(hmm.B)
    total = 0.0
    for obs, st in zip(observation_seqs, state_seqs):
        total += lp[st[0]] + lb[st[0], obs[0]]
        for t in range(1, len(st)):
            total += la[st[t - 1], st[t]] + lb[st[t], obs[t]]
    return float(total)


def observed_log_likelihood(hmm: HMM, observation_seqs) -> float | None:
    """sum log P(O | lambda); None if any sequence is impossible under hmm."""
    total = 0.0
    for obs in observation_seqs:
        try:
            total += forward_pass(hmm, obs, strict=True).log_likelihood
        except ZeroProbabilitySequence:
            return None
    return total
