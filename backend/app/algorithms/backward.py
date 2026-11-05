"""Backward algorithm.

beta_t(i) = P(O_{t+1} .. O_T | q_t = i, lambda)

Initialization:  beta_T(i) = 1
Recursion:       beta_t(i) = sum_j a_ij * b_j(O_{t+1}) * beta_{t+1}(j)
Termination:     P(O | lambda) = sum_i pi_i * b_i(O_1) * beta_1(i)

Raw values are computed in log space (no underflow). A scaled version
beta_hat_t = beta_t / prod_{s>t} c_s, using the forward scale factors c_s, is
also produced; with it the posterior is simply gamma_t = alpha_hat_t * beta_hat_t.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.algorithms.forward import ForwardResult
from app.algorithms.numerics import logsumexp, safe_exp, safe_log
from app.models.hmm import HMM


@dataclass
class BackwardResult:
    log_beta: np.ndarray  # (T, N)

    @property
    def beta(self) -> np.ndarray:
        return safe_exp(self.log_beta)


def backward_pass(hmm: HMM, obs: np.ndarray) -> BackwardResult:
    T, N = len(obs), hmm.n_states
    log_A, log_B = safe_log(hmm.A), safe_log(hmm.B)
    log_beta = np.zeros((T, N))
    for t in range(T - 2, -1, -1):
        # log_beta[t, i] = logsumexp_j( log a_ij + log b_j(O_{t+1}) + log_beta[t+1, j] )
        log_beta[t] = logsumexp(log_A + log_B[:, obs[t + 1]][None, :] + log_beta[t + 1][None, :], axis=1)
    return BackwardResult(log_beta)


def scaled_beta(hmm: HMM, obs: np.ndarray, fwd: ForwardResult) -> np.ndarray:
    """beta_hat using the forward scale factors (requires P(O) > 0)."""
    T, N = len(obs), hmm.n_states
    beta_hat = np.ones((T, N))
    for t in range(T - 2, -1, -1):
        beta_hat[t] = (hmm.A @ (hmm.B[:, obs[t + 1]] * beta_hat[t + 1])) / fwd.scale[t + 1]
    return beta_hat


def backward(hmm: HMM, obs: np.ndarray) -> dict:
    """Run the backward algorithm and return all intermediate values for display."""
    res = backward_pass(hmm, obs)
    beta = res.beta
    T, N = len(obs), hmm.n_states
    steps = []
    for t in range(T - 1, -1, -1):
        cells = []
        for i in range(N):
            if t == T - 1:
                terms: list[dict] = []
            else:
                o_next = int(obs[t + 1])
                terms = [
                    {
                        "to": j,
                        "a": float(hmm.A[i, j]),
                        "emission": float(hmm.B[j, o_next]),
                        "next": float(beta[t + 1, j]),
                        "product": float(hmm.A[i, j] * hmm.B[j, o_next] * beta[t + 1, j]),
                    }
                    for j in range(N)
                ]
            cells.append(
                {"state": i, "terms": terms, "value": float(beta[t, i]), "log_value": float(res.log_beta[t, i])}
            )
        steps.append(
            {
                "t": t + 1,
                "observation": int(obs[t]),
                "observation_name": hmm.observations[int(obs[t])],
                "next_observation": None if t == T - 1 else int(obs[t + 1]),
                "next_observation_name": None if t == T - 1 else hmm.observations[int(obs[t + 1])],
                "phase": "initialization" if t == T - 1 else "recursion",
                "cells": cells,
            }
        )

    o1 = int(obs[0])
    term_terms = [
        {
            "state": i,
            "pi": float(hmm.pi[i]),
            "emission": float(hmm.B[i, o1]),
            "beta": float(beta[0, i]),
            "product": float(hmm.pi[i] * hmm.B[i, o1] * beta[0, i]),
        }
        for i in range(N)
    ]
    log_lik = float(logsumexp(safe_log(hmm.pi) + safe_log(hmm.B[:, o1]) + res.log_beta[0]))
    impossible = not np.isfinite(log_lik)
    return {
        "beta": beta.tolist(),
        "log_beta": res.log_beta.tolist(),
        "steps": steps,  # ordered from t = T down to t = 1
        "termination": {"terms": term_terms, "likelihood": 0.0 if impossible else float(safe_exp(log_lik))},
        "likelihood": 0.0 if impossible else float(safe_exp(log_lik)),
        "log_likelihood": None if impossible else log_lik,
        "impossible": impossible,
    }
