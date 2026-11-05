"""FastAPI application entry point.

Run from the backend folder:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.algorithms.forward import ZeroProbabilitySequence
from app.algorithms.prediction import TargetLeakageError
from app.database import db
from app.models.hmm import InvalidModelError, InvalidObservationError
from app.routes import configuration, prediction, training


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(
    title="Customer Purchase Likelihood Prediction using Hidden Markov Models",
    description="Educational HMM API: Forward, Backward, Forward-Backward, Viterbi, MLE and Baum-Welch "
    "implemented from scratch with NumPy. All parameters and data are simulated.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error(status: int, code: str, message: str, errors: list[str] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": message, "code": code, "errors": errors or [message]})


@app.exception_handler(InvalidModelError)
async def invalid_model(_: Request, exc: InvalidModelError):
    return _error(422, "invalid_model", "Invalid model parameters.", exc.errors)


@app.exception_handler(InvalidObservationError)
async def invalid_observation(_: Request, exc: InvalidObservationError):
    return _error(422, "invalid_observation", str(exc))


@app.exception_handler(ZeroProbabilitySequence)
async def zero_probability(_: Request, exc: ZeroProbabilitySequence):
    return _error(422, "zero_probability", str(exc))


@app.exception_handler(TargetLeakageError)
async def leakage(_: Request, exc: TargetLeakageError):
    return _error(422, "target_leakage", str(exc))


app.include_router(configuration.router)
app.include_router(prediction.router)
app.include_router(training.router)
