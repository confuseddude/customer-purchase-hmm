"""Inference endpoints: forward, backward, forward-backward, viterbi, predict."""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter

from app.algorithms import prediction as pred
from app.algorithms.backward import backward
from app.algorithms.forward import ZeroProbabilitySequence, forward
from app.algorithms.forward_backward import forward_backward
from app.algorithms.numerics import safe_exp, safe_log
from app.algorithms.viterbi import viterbi, viterbi_path
from app.database import db
from app.models.hmm import InvalidObservationError, encode_observations, encode_states
from app.schemas import CompareRequest, JointRequest, PredictRequest, SequenceRequest, jsonable, resolve_model

router = APIRouter(prefix="/api", tags=["inference"])


def _prepare(req: SequenceRequest, allow_empty: bool = False):
    hmm = resolve_model(req.params)
    obs = encode_observations(req.observations, hmm.observations, allow_empty=allow_empty)
    return hmm, obs


def _envelope(hmm, obs, result: dict) -> dict:
    return jsonable(
        {
            "observations": [hmm.observations[o] for o in obs],
            "observation_indices": obs.tolist(),
            "model": hmm.to_dict(),
            **result,
        }
    )


@router.post("/forward")
def run_forward(req: SequenceRequest):
    hmm, obs = _prepare(req)
    return _envelope(hmm, obs, forward(hmm, obs))


@router.post("/backward")
def run_backward(req: SequenceRequest):
    hmm, obs = _prepare(req)
    return _envelope(hmm, obs, backward(hmm, obs))


@router.post("/forward-backward")
def run_forward_backward(req: SequenceRequest):
    hmm, obs = _prepare(req)
    return _envelope(hmm, obs, forward_backward(hmm, obs))


@router.post("/viterbi")
def run_viterbi(req: SequenceRequest):
    hmm, obs = _prepare(req)
    return _envelope(hmm, obs, viterbi(hmm, obs))


@router.post("/predict")
def run_predict(req: PredictRequest):
    hmm, obs = _prepare(req, allow_empty=req.mode == "forecast")
    result = pred.forecast(hmm, obs) if req.mode == "forecast" else pred.analyze(hmm, obs)
    payload = _envelope(hmm, obs, result)
    summary = (
        {"purchase_probability": payload["purchase_probability"],
         "most_likely_next_action": payload["most_likely_next_action_name"],
         "current_state": payload["most_likely_current_state_name"]}
        if req.mode == "forecast"
        else {"log_likelihood": payload["log_likelihood"], "viterbi_path": payload["viterbi_path_names"],
              "purchased": payload["purchased"]}
    )
    if req.record:
        payload["experiment_id"] = db.log_experiment(f"predict:{req.mode}", {"observations": payload["observations"]}, summary)
    return payload


@router.post("/joint")
def joint_probability(req: JointRequest):
    """P(O, Q | lambda) for one user-chosen hidden path, factor by factor."""
    hmm, obs = _prepare(req)
    states = encode_states(req.states, hmm.states)
    if len(states) != len(obs):
        raise InvalidObservationError("Provide exactly one hidden state per observation.")
    factors = []
    for t, (s, o) in enumerate(zip(states, obs)):
        if t == 0:
            factors.append({"t": 1, "kind": "initial", "symbol": f"pi({hmm.states[s]})", "value": float(hmm.pi[s])})
        else:
            p = states[t - 1]
            factors.append({"t": t + 1, "kind": "transition", "symbol": f"a({hmm.states[p]} -> {hmm.states[s]})",
                            "value": float(hmm.A[p, s])})
        factors.append({"t": t + 1, "kind": "emission", "symbol": f"b_{hmm.states[s]}({hmm.observations[o]})",
                        "value": float(hmm.B[s, o])})
    values = np.array([f["value"] for f in factors])
    log_p = float(np.sum(safe_log(values)))
    path, best_log, _, _ = viterbi_path(hmm, obs)
    return _envelope(hmm, obs, {
        "states": states.tolist(),
        "factors": factors,
        "probability": float(np.prod(values)),
        "log_probability": log_p,
        "viterbi_path": path,
        "viterbi_probability": float(safe_exp(best_log)),
        "is_viterbi_path": path == states.tolist(),
    })


@router.post("/predict/compare")
def compare_journeys(req: CompareRequest):
    """Leakage-free P(Purchase next) for several journeys.

    Journeys that contain Purchase are evaluated on the prefix *before* the first Purchase.
    """
    hmm = resolve_model(req.params)
    rows = []
    for j in req.journeys:
        obs = encode_observations(j.observations, hmm.observations, allow_empty=True)
        names = [hmm.observations[o] for o in obs]
        truncated = "Purchase" in names
        prefix = obs[: names.index("Purchase")] if truncated else obs
        try:
            f = pred.forecast(hmm, prefix)
        except ZeroProbabilitySequence as exc:  # impossible journeys are reported, not fatal
            rows.append({"name": j.name, "observations": names, "error": str(exc)})
            continue
        rows.append(
            {
                "name": j.name,
                "observations": names,
                "evaluated_prefix": [hmm.observations[o] for o in prefix],
                "truncated_before_purchase": truncated,
                "purchase_probability": f["purchase_probability"],
                "most_likely_current_state_name": f["most_likely_current_state_name"],
                "most_likely_next_action_name": f["most_likely_next_action_name"],
                "next_observation_distribution": f["next_observation_distribution"],
                "filtered_distribution": f["filtered_distribution"],
                "readiness_index": f["interpretation"]["readiness_index"],
            }
        )
    return jsonable({"model": hmm.to_dict(), "journeys": rows})
