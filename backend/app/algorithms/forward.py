"""Forward algorithm with Rabiner scaling.

alpha_t(i) = P(O_1 .. O_t, q_t = i | lambda)

Initialization:  alpha_1(i)     = pi_i * b_i(O_1)
Recursion:       alpha_{t+1}(j) = [sum_i alpha_t(i) * a_ij] * b_j(O_{t+1})
Termination:     P(O | lambda)  = sum_i alpha_T(i)

Raw alpha values shrink geometrically with T and underflow for long
sequences. We therefore keep a scaled copy alpha_hat_t = alpha_t / prod_{s<=t} c_s
where c_t = sum_i (unnormalised alpha at t). Then

    log P(O | lambda) = sum_t log c_t

which is exact and numerically stable. alpha_hat_t is also the *filtered*
distribution P(q_t = i | O_1 .. O_t).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.models.hmm import HMM


class ZeroProbabilitySequence(ValueError):
    """The observation sequence is impossible (probability 0) under the model."""

    def __init__(self, t: int):
        super().__init__(
            f"The observation sequence has zero probability under this model "
            f"(it becomes impossible at step {t + 1}). Posterior quantities are undefined."
        )
        self.t = t


@dataclass
class ForwardResult:
    alpha_hat: np.ndarray  # (T, N) filtered distributions, each row sums to 1
    scale: np.ndarray  # (T,) c_t = P(O_t | O_1..O_{t-1})
    log_alpha: np.ndarray  # (T, N) log of the raw alpha values
    log_likelihood: float

    @property
    def alpha(self) -> np.ndarray:
        with np.errstate(under="ignore"):
            return np.exp(self.log_alpha)

    @property
    def likelihood(self) -> float:
        with np.errstate(under="ignore"):
            return float(np.exp(self.log_likelihood))


def forward_pass(hmm: HMM, obs: np.ndarray, strict: bool = True) -> ForwardResult:
    """Scaled forward pass. Raises ZeroProbabilitySequence if strict and P(O)=0."""
    T, N = len(obs), hmm.n_states
    alpha_hat = np.zeros((T, N))
    scale = np.zeros(T)

    a = hmm.pi * hmm.B[:, obs[0]]
    for t in range(T):
        if t > 0:
            a = (alpha_hat[t - 1] @ hmm.A) * hmm.B[:, obs[t]]
        c = a.sum()
        if c <= 0:
            if strict:
                raise ZeroProbabilitySequence(t)
            scale[t:] = 0.0
            break
        scale[t] = c
        alpha_hat[t] = a / c

    with np.errstate(divide="ignore"):
        log_c = np.log(scale)
        log_cum = np.cumsum(log_c)
        log_alpha = np.log(alpha_hat) + log_cum[:, None]
    log_likelihood = float(log_cum[-1]) if T else 0.0
    return ForwardResult(alpha_hat, scale, log_alpha, log_likelihood)


def forward(hmm: HMM, obs: np.ndarray) -> dict:
    """Run the forward algorithm and return every intermediate quantity for display."""
    res = forward_pass(hmm, obs, strict=False)
    alpha = res.alpha
    T, N = len(obs), hmm.n_states
    steps = []
    for t in range(T):
        o = int(obs[t])
        cells = []
        for j in range(N):
            emission = float(hmm.B[j, o])
            if t == 0:
                terms = [{"from": None, "prev": float(hmm.pi[j]), "a": None, "product": float(hmm.pi[j])}]
                total = float(hmm.pi[j])
            else:
                terms = [
                    {
                        "from": i,
                        "prev": float(alpha[t - 1, i]),
                        "a": float(hmm.A[i, j]),
                        "product": float(alpha[t - 1, i] * hmm.A[i, j]),
                    }
                    for i in range(N)
                ]
                total = float(sum(term["product"] for term in terms))
            cells.append(
                {
                    "state": j,
                    "terms": terms,
                    "sum": total,
                    "emission": emission,
                    "value": float(alpha[t, j]),
                    "log_value": float(res.log_alpha[t, j]),
                    "scaled": float(res.alpha_hat[t, j]),
                }
            )
        steps.append(
            {
                "t": t + 1,
                "observation": o,
                "observation_name": hmm.observations[o],
                "phase": "initialization" if t == 0 else "recursion",
                "cells": cells,
                "column_sum": float(alpha[t].sum()),
                "scale": float(res.scale[t]),
            }
        )

    impossible = bool(np.any(res.scale == 0))
    return {
        "alpha": alpha.tolist(),
        "log_alpha": res.log_alpha.tolist(),
        "alpha_hat": res.alpha_hat.tolist(),
        "scale_factors": res.scale.tolist(),
        "likelihood": 0.0 if impossible else res.likelihood,
        "log_likelihood": None if impossible else res.log_likelihood,
        "impossible": impossible,
        "steps": steps,
        "termination": {
            "terms": [float(v) for v in alpha[-1]],
            "likelihood": 0.0 if impossible else res.likelihood,
        },
    }
