"""Training endpoints: supervised MLE and unsupervised Baum-Welch."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.algorithms.baum_welch import baum_welch, random_model
from app.algorithms.forward_backward import posteriors
from app.algorithms.mle import complete_data_log_likelihood, observed_log_likelihood, supervised_mle
from app.database import db
from app.models.hmm import OBSERVATIONS, STATES, encode_observations, encode_states
from app.schemas import BaumWelchRequest, MLERequest, jsonable, resolve_model

router = APIRouter(prefix="/api/train", tags=["training"])


def _dataset_sequences(limit: int | None):
    rows = db.all_sequences()
    if limit:
        rows = rows[:limit]
    obs = [encode_observations(r["observations"]) for r in rows]
    states = [encode_states(r["hidden_states"]) for r in rows]
    return obs, states


@router.post("/mle")
def train_mle(req: MLERequest):
    if req.sequences:
        obs = [encode_observations(s.observations) for s in req.sequences]
        states = [encode_states(s.hidden_states) for s in req.sequences]
        source = "custom"
    else:
        obs, states = _dataset_sequences(req.limit)
        source = "synthetic dataset"

    before = db.get_active_model()
    result = supervised_mle(obs, states, len(STATES), len(OBSERVATIONS), req.smoothing)
    after = result["model"]
    payload = {
        "method": "supervised_mle",
        "source": source,
        "before": before.to_dict(),
        "after": after.to_dict(),
        "counts": result["counts"],
        "smoothing": req.smoothing,
        "n_sequences": result["n_sequences"],
        "n_observations": result["n_observations"],
        "n_transitions": result["n_transitions"],
        "log_likelihood_before": observed_log_likelihood(before, obs),
        "log_likelihood_after": observed_log_likelihood(after, obs),
        "complete_log_likelihood_before": complete_data_log_likelihood(before, obs, states),
        "complete_log_likelihood_after": complete_data_log_likelihood(after, obs, states),
        "applied": False,
    }
    if req.apply:
        db.save_model(after, f"Supervised MLE (s={req.smoothing})", "mle")
        payload["applied"] = True
    db.log_experiment(
        "train:mle",
        {"smoothing": req.smoothing, "limit": req.limit, "source": source},
        {"n_sequences": payload["n_sequences"], "log_likelihood_after": payload["log_likelihood_after"]},
    )
    return jsonable(payload)


@router.post("/baum-welch")
def train_baum_welch(req: BaumWelchRequest):
    if req.sequences:
        obs = [encode_observations(s) for s in req.sequences]
        source = "custom"
    else:
        obs, _ = _dataset_sequences(req.limit)
        source = "synthetic dataset"

    if req.params is not None:
        initial = resolve_model(req.params)
    elif req.init == "random":
        initial = random_model(len(STATES), len(OBSERVATIONS), req.seed)
    else:
        initial = db.get_active_model()

    initial_ll = observed_log_likelihood(initial, obs)
    if initial_ll is None:
        raise HTTPException(
            422,
            "At least one training sequence has zero probability under the initial parameters. "
            "Use random initialisation or remove zero probabilities from the model.",
        )

    result = baum_welch(initial, obs, req.max_iterations, req.tolerance, req.pseudocount)
    trained = result["model"]

    # A worked E-step example (gamma and xi) for the first training sequence under the initial model.
    example_obs = obs[0]
    ex = posteriors(initial, example_obs)

    payload = {
        "method": "baum_welch",
        "source": source,
        "init": "custom" if req.params is not None else req.init,
        "before": initial.to_dict(),
        "after": trained.to_dict(),
        "history": result["history"],
        "iterations": result["iterations"],
        "converged": result["converged"],
        "monotonic": result["monotonic"],
        "tolerance": req.tolerance,
        "max_iterations": req.max_iterations,
        "pseudocount": req.pseudocount,
        "initial_log_likelihood": result["initial_log_likelihood"],
        "final_log_likelihood": result["final_log_likelihood"],
        "n_sequences": result["n_sequences"],
        "n_observations": result["n_observations"],
        "example_estep": {
            "observations": [OBSERVATIONS[o] for o in example_obs],
            "gamma": ex.gamma.tolist(),
            "xi": ex.xi.tolist(),
            "log_likelihood": ex.log_likelihood,
        },
        "applied": False,
    }
    if req.apply:
        db.save_model(trained, f"Baum-Welch ({result['iterations']} it.)", "baum_welch")
        payload["applied"] = True
    db.log_experiment(
        "train:baum_welch",
        {"max_iterations": req.max_iterations, "tolerance": req.tolerance, "init": payload["init"],
         "limit": req.limit, "source": source},
        {"iterations": result["iterations"], "converged": result["converged"],
         "initial_ll": result["initial_log_likelihood"], "final_ll": result["final_log_likelihood"]},
    )
    return jsonable(payload)
