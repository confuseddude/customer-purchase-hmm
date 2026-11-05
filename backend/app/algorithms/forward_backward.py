"""Forward-Backward algorithm (posterior / smoothing).

gamma_t(i)  = P(q_t = i | O, lambda) = alpha_t(i) * beta_t(i) / P(O | lambda)
xi_t(i, j)  = P(q_t = i, q_{t+1} = j | O, lambda)
            = alpha_t(i) * a_ij * b_j(O_{t+1}) * beta_{t+1}(j) / P(O | lambda)

Computed with the scaled variables so they never underflow:
gamma_t = alpha_hat_t * beta_hat_t and
xi_t(i, j) = alpha_hat_t(i) * a_ij * b_j(O_{t+1}) * beta_hat_{t+1}(j) / c_{t+1}.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.algorithms.backward import backward_pass, scaled_beta
from app.algorithms.forward import ForwardResult, forward_pass
from app.models.hmm import HMM


@dataclass
class PosteriorResult:
    fwd: ForwardResult
    beta_hat: np.ndarray
    gamma: np.ndarray  # (T, N)
    xi: np.ndarray  # (T-1, N, N)

    @property
    def log_likelihood(self) -> float:
        return self.fwd.log_likelihood


def posteriors(hmm: HMM, obs: np.ndarray) -> PosteriorResult:
    """E-step quantities. Raises ZeroProbabilitySequence for impossible sequences."""
    fwd = forward_pass(hmm, obs, strict=True)
    beta_hat = scaled_beta(hmm, obs, fwd)
    gamma = fwd.alpha_hat * beta_hat
    gamma /= gamma.sum(axis=1, keepdims=True)  # removes round-off only
    T, N = len(obs), hmm.n_states
    xi = np.zeros((max(T - 1, 0), N, N))
    for t in range(T - 1):
        x = fwd.alpha_hat[t][:, None] * hmm.A * (hmm.B[:, obs[t + 1]] * beta_hat[t + 1])[None, :] / fwd.scale[t + 1]
        xi[t] = x / x.sum()
    return PosteriorResult(fwd, beta_hat, gamma, xi)


def forward_backward(hmm: HMM, obs: np.ndarray) -> dict:
    post = posteriors(hmm, obs)
    alpha = post.fwd.alpha
    beta = backward_pass(hmm, obs).beta
    T = len(obs)
    timeline = []
    for t in range(T):
        best = int(np.argmax(post.gamma[t]))
        timeline.append(
            {
                "t": t + 1,
                "observation": int(obs[t]),
                "observation_name": hmm.observations[int(obs[t])],
                "posterior": post.gamma[t].tolist(),
                "filtered": post.fwd.alpha_hat[t].tolist(),
                "most_likely_state": best,
                "most_likely_state_name": hmm.states[best],
                "cells": [
                    {
                        "state": i,
                        "alpha": float(alpha[t, i]),
                        "beta": float(beta[t, i]),
                        "product": float(alpha[t, i] * beta[t, i]),
                        "gamma": float(post.gamma[t, i]),
                    }
                    for i in range(hmm.n_states)
                ],
            }
        )
    return {
        "alpha": alpha.tolist(),
        "beta": beta.tolist(),
        "gamma": post.gamma.tolist(),
        "filtered": post.fwd.alpha_hat.tolist(),
        "xi": post.xi.tolist(),
        "expected_transitions": post.xi.sum(axis=0).tolist() if T > 1 else np.zeros((hmm.n_states,) * 2).tolist(),
        "likelihood": post.fwd.likelihood,
        "log_likelihood": post.log_likelihood,
        "timeline": timeline,
        "posterior_path": [int(np.argmax(g)) for g in post.gamma],
    }
