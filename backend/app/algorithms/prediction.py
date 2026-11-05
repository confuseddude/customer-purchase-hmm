"""Next-action forecasting and completed-journey analysis.

Forecast (unfinished journey O_1..O_t):

    filtered   P(q_t = i | O_1..t)       = alpha_t(i) / sum_k alpha_t(k)
    next state P(q_{t+1} = j | O_1..t)   = sum_i filtered_i * a_ij
    next obs   P(O_{t+1} = k | O_1..t)   = sum_j next_state_j * b_j(k)

so in particular

    P(O_{t+1} = Purchase | O_1..t) = sum_i sum_j alpha_t(i) a_ij b_j(Purchase) / sum_i alpha_t(i)

For an empty history the next state is the first state, distributed as pi.

A history that already contains Purchase is rejected for forecasting: asking
"will they purchase next?" after observing the purchase would leak the target.
"""

from __future__ import annotations

import numpy as np

from app.algorithms.forward import forward_pass
from app.algorithms.forward_backward import posteriors
from app.algorithms.viterbi import viterbi_path
from app.models.hmm import HMM, PURCHASE, EXIT


class TargetLeakageError(ValueError):
    pass


def purchase_ceiling(hmm: HMM) -> dict:
    """Largest/smallest achievable P(Purchase next): attained when certain of one current state."""
    per_state = hmm.A @ hmm.B[:, PURCHASE]
    return {
        "per_current_state": per_state.tolist(),
        "max": float(per_state.max()),
        "min": float(per_state.min()),
        "first_action": float(hmm.pi @ hmm.B[:, PURCHASE]),
    }


def interpret(prob: float, hmm: HMM, current_state: int | None, filtered: np.ndarray | None, exited: bool) -> dict:
    ceiling = purchase_ceiling(hmm)
    lo, hi = ceiling["min"], ceiling["max"]
    readiness = 0.0 if hi - lo < 1e-12 else (prob - lo) / (hi - lo)
    readiness = float(min(max(readiness, 0.0), 1.0))
    if readiness < 0.2:
        level = "low"
        headline = "Low purchase readiness"
        action = "Customer looks like an early-stage browser. Recommendations or content are more useful than a hard sell."
    elif readiness < 0.5:
        level = "moderate"
        headline = "Moderate purchase readiness"
        action = "Customer shows some interest. A reminder, review highlights or a saved-cart nudge could help."
    elif readiness < 0.8:
        level = "high"
        headline = "High purchase readiness"
        action = "Customer is likely close to buying. Remove friction: fast checkout, shipping clarity, support."
    else:
        level = "very_high"
        headline = "Very high purchase readiness"
        action = "Customer behaves like someone ready to buy. Avoid distractions and keep the path to purchase short."
    parts = [
        f"Under the current model, the probability that the next action is Purchase is {prob:.1%}.",
        f"For this model that value can range from {lo:.1%} (certainly {hmm.states[int(np.argmin(ceiling['per_current_state']))]}) "
        f"to {hi:.1%} (certainly {hmm.states[int(np.argmax(ceiling['per_current_state']))]}), "
        f"so this journey sits at {readiness:.0%} of that range.",
    ]
    if current_state is not None and filtered is not None:
        parts.append(
            f"The most likely current intention is '{hmm.states[current_state]}' "
            f"with probability {filtered[current_state]:.1%}."
        )
    if exited:
        parts.append(
            "Note: the journey contains Exit. This model does not treat Exit as the end of a session, "
            "so the forecast assumes the customer comes back and continues."
        )
    parts.append("This is a simulated next-action probability from illustrative parameters, not a calibrated conversion rate.")
    return {"level": level, "headline": headline, "readiness_index": readiness, "summary": " ".join(parts), "suggested_action": action}


def forecast(hmm: HMM, obs: np.ndarray) -> dict:
    if np.any(obs == PURCHASE):
        raise TargetLeakageError(
            "Forecast mode cannot be used on a journey that already contains Purchase: the target would be leaked. "
            "Remove the Purchase action, or use 'analyze' mode for completed journeys."
        )
    N = hmm.n_states
    if len(obs) == 0:
        filtered = None
        next_state = hmm.pi.copy()
        log_likelihood = 0.0
        prefix_traj: list[dict] = []
    else:
        fwd = forward_pass(hmm, obs, strict=True)
        filtered = fwd.alpha_hat[-1]
        next_state = filtered @ hmm.A
        log_likelihood = fwd.log_likelihood
        prefix_traj = prefix_trajectory(hmm, obs, fwd.alpha_hat)

    next_obs = next_state @ hmm.B
    prob = float(next_obs[PURCHASE])

    if filtered is None:
        terms = [
            {"from": None, "to": j, "filtered": None, "a": None, "next_state": float(hmm.pi[j]),
             "emission": float(hmm.B[j, PURCHASE]), "product": float(hmm.pi[j] * hmm.B[j, PURCHASE])}
            for j in range(N)
        ]
    else:
        terms = [
            {"from": i, "to": j, "filtered": float(filtered[i]), "a": float(hmm.A[i, j]), "next_state": None,
             "emission": float(hmm.B[j, PURCHASE]), "product": float(filtered[i] * hmm.A[i, j] * hmm.B[j, PURCHASE])}
            for i in range(N) for j in range(N)
        ]

    current = None if filtered is None else int(np.argmax(filtered))
    next_action = int(np.argmax(next_obs))
    return {
        "mode": "forecast",
        "history_length": int(len(obs)),
        "filtered_distribution": None if filtered is None else filtered.tolist(),
        "most_likely_current_state": current,
        "most_likely_current_state_name": None if current is None else hmm.states[current],
        "next_state_distribution": next_state.tolist(),
        "next_observation_distribution": next_obs.tolist(),
        "most_likely_next_action": next_action,
        "most_likely_next_action_name": hmm.observations[next_action],
        "purchase_probability": prob,
        "purchase_terms": terms,
        "log_likelihood": log_likelihood,
        "prefix_trajectory": prefix_traj,
        "ceiling": purchase_ceiling(hmm),
        "interpretation": interpret(prob, hmm, current, filtered, bool(np.any(obs == EXIT))),
    }


def prefix_trajectory(hmm: HMM, obs: np.ndarray, alpha_hat: np.ndarray) -> list[dict]:
    """P(Purchase next | O_1..t) for t = 0..T, each using only the prefix (no leakage)."""
    out = [{"t": 0, "after": None, "purchase_probability": float(hmm.pi @ hmm.B[:, PURCHASE]), "filtered": None}]
    for t in range(len(obs)):
        p = float((alpha_hat[t] @ hmm.A) @ hmm.B[:, PURCHASE])
        out.append({"t": t + 1, "after": hmm.observations[int(obs[t])], "purchase_probability": p,
                    "filtered": alpha_hat[t].tolist()})
    return out


def analyze(hmm: HMM, obs: np.ndarray) -> dict:
    """Retrospective analysis of a completed journey (Purchase allowed)."""
    post = posteriors(hmm, obs)
    path, best_log, _, _ = viterbi_path(hmm, obs)
    purchase_positions = [int(t) for t in np.where(obs == PURCHASE)[0]]
    first_purchase = purchase_positions[0] if purchase_positions else None

    # Leakage-free readiness: forecasts made only from prefixes BEFORE the first purchase.
    limit = first_purchase if first_purchase is not None else len(obs)
    trajectory = prefix_trajectory(hmm, obs[:limit], post.fwd.alpha_hat[:limit]) if limit > 0 else [
        {"t": 0, "after": None, "purchase_probability": float(hmm.pi @ hmm.B[:, PURCHASE]), "filtered": None}
    ]
    pre_purchase = trajectory[-1]["purchase_probability"] if first_purchase is not None else None

    ready = hmm.states.index("Ready to Purchase") if "Ready to Purchase" in hmm.states else hmm.n_states - 1
    peak_t = int(np.argmax(post.gamma[:, ready]))
    summary = [
        f"P(O | λ) = {post.fwd.likelihood:.3e} (log = {post.log_likelihood:.3f}).",
        "Viterbi path: " + " → ".join(hmm.states[s] for s in path) + ".",
        f"Posterior probability of '{hmm.states[ready]}' peaks at step {peak_t + 1} "
        f"({hmm.observations[int(obs[peak_t])]}) with {post.gamma[peak_t, ready]:.1%}.",
    ]
    if first_purchase is not None:
        summary.append(
            f"Just before the first Purchase (after step {first_purchase}), the leakage-free forecast "
            f"P(Purchase next) was {pre_purchase:.1%}."
        )
    else:
        summary.append("The journey ends without a purchase.")
    return {
        "mode": "analyze",
        "length": int(len(obs)),
        "purchased": first_purchase is not None,
        "first_purchase_step": None if first_purchase is None else first_purchase + 1,
        "posterior": post.gamma.tolist(),
        "filtered": post.fwd.alpha_hat.tolist(),
        "posterior_path": [int(np.argmax(g)) for g in post.gamma],
        "viterbi_path": path,
        "viterbi_path_names": [hmm.states[s] for s in path],
        "viterbi_log_probability": best_log,
        "log_likelihood": post.log_likelihood,
        "likelihood": post.fwd.likelihood,
        "expected_transitions": post.xi.sum(axis=0).tolist() if len(obs) > 1 else np.zeros((hmm.n_states,) * 2).tolist(),
        "prefix_trajectory": trajectory,
        "pre_purchase_probability": pre_purchase,
        "ready_peak_step": peak_t + 1,
        "summary": " ".join(summary),
        "paths_agree": path == [int(np.argmax(g)) for g in post.gamma],
    }
