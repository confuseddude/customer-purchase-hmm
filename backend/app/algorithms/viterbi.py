"""Viterbi algorithm: the single most likely hidden-state path.

Initialization:  delta_1(i) = pi_i * b_i(O_1),                psi_1(i) = 0
Recursion:       delta_t(j) = max_i [delta_{t-1}(i) * a_ij] * b_j(O_t)
                 psi_t(j)   = argmax_i [delta_{t-1}(i) * a_ij]
Termination:     P* = max_i delta_T(i),   q*_T = argmax_i delta_T(i)
Backtracking:    q*_t = psi_{t+1}(q*_{t+1})

Computed in log space so long sequences never underflow. Ties are broken by
choosing the lowest state index (deterministic and reproducible).
"""

from __future__ import annotations

import numpy as np

from app.algorithms.numerics import safe_exp, safe_log
from app.models.hmm import HMM


def viterbi_path(hmm: HMM, obs: np.ndarray) -> tuple[list[int], float, np.ndarray, np.ndarray]:
    """Return (path, log P*, log_delta (T,N), backpointers (T,N))."""
    T, N = len(obs), hmm.n_states
    log_pi, log_A, log_B = safe_log(hmm.pi), safe_log(hmm.A), safe_log(hmm.B)
    log_delta = np.full((T, N), -np.inf)
    psi = np.zeros((T, N), dtype=int)
    log_delta[0] = log_pi + log_B[:, obs[0]]
    for t in range(1, T):
        cand = log_delta[t - 1][:, None] + log_A  # cand[i, j]
        psi[t] = np.argmax(cand, axis=0)
        log_delta[t] = cand[psi[t], np.arange(N)] + log_B[:, obs[t]]
    last = int(np.argmax(log_delta[-1]))
    best_log = float(log_delta[-1, last])
    path = [last]
    for t in range(T - 1, 0, -1):
        path.append(int(psi[t, path[-1]]))
    path.reverse()
    return path, best_log, log_delta, psi


def viterbi(hmm: HMM, obs: np.ndarray) -> dict:
    path, best_log, log_delta, psi = viterbi_path(hmm, obs)
    delta = safe_exp(log_delta)
    T, N = len(obs), hmm.n_states
    steps = []
    for t in range(T):
        o = int(obs[t])
        cells = []
        for j in range(N):
            if t == 0:
                candidates = [{"from": None, "prev": float(hmm.pi[j]), "a": None, "product": float(hmm.pi[j])}]
                best_from = None
                best_val = float(hmm.pi[j])
            else:
                candidates = [
                    {
                        "from": i,
                        "prev": float(delta[t - 1, i]),
                        "a": float(hmm.A[i, j]),
                        "product": float(delta[t - 1, i] * hmm.A[i, j]),
                    }
                    for i in range(N)
                ]
                best_from = int(psi[t, j])
                best_val = candidates[best_from]["product"]
            cells.append(
                {
                    "state": j,
                    "candidates": candidates,
                    "best_from": best_from,
                    "max": best_val,
                    "emission": float(hmm.B[j, o]),
                    "value": float(delta[t, j]),
                    "log_value": float(log_delta[t, j]),
                }
            )
        steps.append(
            {
                "t": t + 1,
                "observation": o,
                "observation_name": hmm.observations[o],
                "phase": "initialization" if t == 0 else "recursion",
                "cells": cells,
            }
        )

    backtrack = []
    for t in range(T - 1, -1, -1):
        backtrack.append(
            {
                "t": t + 1,
                "state": path[t],
                "state_name": hmm.states[path[t]],
                "via": "argmax of final delta" if t == T - 1 else f"psi_{t + 2}({hmm.states[path[t + 1]]})",
            }
        )

    impossible = not np.isfinite(best_log)
    return {
        "delta": delta.tolist(),
        "log_delta": log_delta.tolist(),
        "backpointers": [[None] * N] + psi[1:].tolist(),
        "steps": steps,
        "path": path,
        "path_names": [hmm.states[s] for s in path],
        "best_probability": 0.0 if impossible else float(safe_exp(best_log)),
        "best_log_probability": None if impossible else best_log,
        "impossible": impossible,
        "backtracking": backtrack,
        "termination": {"final_delta": delta[-1].tolist(), "best_last_state": path[-1]},
    }
