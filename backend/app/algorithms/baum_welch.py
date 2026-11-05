"""Baum-Welch: Expectation-Maximization for HMMs (unsupervised MLE).

The hidden states are never observed, so the likelihood
    L(lambda) = prod_sequences P(O | lambda) = prod sum_{all paths} P(O, Q | lambda)
cannot be maximised in closed form. EM alternates:

E-step: with the current lambda, run Forward-Backward on every sequence and
        compute gamma_t(i) (expected state occupancy) and xi_t(i, j)
        (expected transitions).
M-step: re-estimate lambda from these expected counts
        pi_i   = E[# sequences starting in i] / # sequences
        a_ij   = E[# transitions i -> j]      / E[# transitions out of i]
        b_i(k) = E[# times in i emitting k]   / E[# times in i]

Each iteration is guaranteed not to decrease log P(O | lambda) (without
smoothing), so the log-likelihood history is monotone non-decreasing.
"""

from __future__ import annotations

import numpy as np

from app.algorithms.forward_backward import posteriors
from app.models.hmm import HMM


def _e_step(hmm: HMM, sequences: list[np.ndarray]):
    N, M = hmm.n_states, hmm.n_obs
    pi_num = np.zeros(N)
    a_num = np.zeros((N, N))
    a_den = np.zeros(N)
    b_num = np.zeros((N, M))
    b_den = np.zeros(N)
    total_ll = 0.0
    for obs in sequences:
        post = posteriors(hmm, obs)
        total_ll += post.log_likelihood
        pi_num += post.gamma[0]
        if len(obs) > 1:
            a_num += post.xi.sum(axis=0)
            a_den += post.gamma[:-1].sum(axis=0)
        for t, o in enumerate(obs):
            b_num[:, o] += post.gamma[t]
        b_den += post.gamma.sum(axis=0)
    return (pi_num, a_num, a_den, b_num, b_den), total_ll


def _m_step(hmm: HMM, stats, n_sequences: int, pseudocount: float) -> HMM:
    pi_num, a_num, a_den, b_num, b_den = stats
    N, M = hmm.n_states, hmm.n_obs
    pi = (pi_num + pseudocount) / (n_sequences + N * pseudocount)

    A = hmm.A.copy()
    for i in range(N):
        den = a_den[i] + N * pseudocount
        if den > 0:  # a state never visited keeps its previous row
            A[i] = (a_num[i] + pseudocount) / den
    B = hmm.B.copy()
    for i in range(N):
        den = b_den[i] + M * pseudocount
        if den > 0:
            B[i] = (b_num[i] + pseudocount) / den
    # remove floating round-off so rows sum to exactly 1 within tolerance
    pi /= pi.sum()
    A /= A.sum(axis=1, keepdims=True)
    B /= B.sum(axis=1, keepdims=True)
    return HMM(pi, A, B, list(hmm.states), list(hmm.observations))


def random_model(n_states: int, n_obs: int, seed: int, states=None, observations=None) -> HMM:
    rng = np.random.default_rng(seed)
    pi = rng.dirichlet(np.ones(n_states) * 2)
    A = rng.dirichlet(np.ones(n_states) * 2, size=n_states)
    B = rng.dirichlet(np.ones(n_obs) * 2, size=n_states)
    kwargs = {}
    if states is not None:
        kwargs["states"] = list(states)
    if observations is not None:
        kwargs["observations"] = list(observations)
    return HMM(pi, A, B, **kwargs)


def baum_welch(
    initial: HMM,
    sequences: list[np.ndarray],
    max_iterations: int = 100,
    tolerance: float = 1e-6,
    pseudocount: float = 0.0,
) -> dict:
    """Fit lambda by EM. Returns trained model, history and convergence info."""
    if not sequences:
        raise ValueError("Baum-Welch needs at least one training sequence.")
    hmm = initial.copy()
    stats, ll = _e_step(hmm, sequences)
    history = [{"iteration": 0, "log_likelihood": ll, "improvement": None, "params": hmm.to_dict()}]
    converged = False
    iterations = 0
    for k in range(1, max_iterations + 1):
        hmm = _m_step(hmm, stats, len(sequences), pseudocount)
        stats, new_ll = _e_step(hmm, sequences)
        iterations = k
        improvement = new_ll - ll
        history.append({"iteration": k, "log_likelihood": new_ll, "improvement": improvement, "params": hmm.to_dict()})
        if abs(improvement) < tolerance:
            converged = True
            ll = new_ll
            break
        ll = new_ll

    n_obs_total = int(sum(len(s) for s in sequences))
    return {
        "model": hmm,
        "history": history,
        "iterations": iterations,
        "converged": converged,
        "initial_log_likelihood": history[0]["log_likelihood"],
        "final_log_likelihood": ll,
        "n_sequences": len(sequences),
        "n_observations": n_obs_total,
        "monotonic": all(
            h["improvement"] is None or h["improvement"] >= -1e-8 for h in history
        ),
    }
