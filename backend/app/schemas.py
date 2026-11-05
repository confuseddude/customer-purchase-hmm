"""Request schemas and shared helpers for the REST API."""

from __future__ import annotations

import math
from typing import Literal, Union

import numpy as np
from pydantic import BaseModel, Field

from app.database import db
from app.models.hmm import HMM, InvalidModelError, OBSERVATIONS, STATES, validate_parameters

Observation = Union[str, int]


class ModelParams(BaseModel):
    pi: list[float]
    A: list[list[float]]
    B: list[list[float]]


class NamedModelParams(ModelParams):
    name: str = "Custom configuration"


class SequenceRequest(BaseModel):
    observations: list[Observation] = Field(..., description="Observation names, e.g. ['View','Cart']")
    params: ModelParams | None = Field(None, description="Optional model override; defaults to the active model")


class PredictRequest(SequenceRequest):
    mode: Literal["forecast", "analyze"] = "forecast"
    record: bool = Field(True, description="Log this run to the experiments table")


class JointRequest(SequenceRequest):
    states: list[Union[str, int]] = Field(..., description="One hidden state per observation")


class Journey(BaseModel):
    name: str
    observations: list[Observation]


class CompareRequest(BaseModel):
    journeys: list[Journey] = Field(..., min_length=1, max_length=20)
    params: ModelParams | None = None


class LabelledSequence(BaseModel):
    observations: list[Observation]
    hidden_states: list[str]


class MLERequest(BaseModel):
    smoothing: float = Field(1.0, ge=0, le=100)
    limit: int | None = Field(None, ge=1, description="Use only the first N dataset sequences")
    sequences: list[LabelledSequence] | None = Field(None, description="Custom labelled sequences instead of the dataset")
    apply: bool = False


class BaumWelchRequest(BaseModel):
    max_iterations: int = Field(30, ge=1, le=500)
    tolerance: float = Field(1e-4, gt=0, le=10)
    pseudocount: float = Field(0.0, ge=0, le=10)
    init: Literal["current", "random"] = "current"
    seed: int = 7
    limit: int | None = Field(None, ge=1)
    sequences: list[list[Observation]] | None = None
    params: ModelParams | None = Field(None, description="Initial parameters (overrides init='current')")
    apply: bool = False


def resolve_model(params: ModelParams | None) -> HMM:
    if params is None:
        return db.get_active_model()
    errors = validate_parameters(params.pi, params.A, params.B, n_states=len(STATES), n_obs=len(OBSERVATIONS))
    if errors:
        raise InvalidModelError(errors)
    return HMM(params.pi, params.A, params.B)


def jsonable(obj):
    """Recursively convert numpy types and replace non-finite floats with None."""
    if isinstance(obj, dict):
        return {k: jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [jsonable(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return jsonable(obj.tolist())
    if isinstance(obj, (np.floating, float)):
        f = float(obj)
        return f if math.isfinite(f) else None
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, HMM):
        return jsonable(obj.to_dict())
    return obj


def model_payload(hmm: HMM) -> dict:
    return hmm.to_dict()
