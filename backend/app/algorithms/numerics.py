"""Small numerical helpers for log-space computation."""

from __future__ import annotations

import numpy as np


def safe_log(x) -> np.ndarray:
    """log(x) with log(0) = -inf and no warnings."""
    with np.errstate(divide="ignore"):
        return np.log(np.asarray(x, dtype=float))


def logsumexp(x: np.ndarray, axis: int | None = None) -> np.ndarray:
    """Stable log(sum(exp(x))) that handles rows consisting entirely of -inf."""
    x = np.asarray(x, dtype=float)
    m = np.max(x, axis=axis, keepdims=True)
    m_safe = np.where(np.isfinite(m), m, 0.0)
    with np.errstate(under="ignore", divide="ignore"):
        s = np.log(np.sum(np.exp(x - m_safe), axis=axis, keepdims=True)) + m_safe
    if axis is None:
        return s.reshape(())
    return np.squeeze(s, axis=axis)


def safe_exp(x) -> np.ndarray:
    with np.errstate(under="ignore"):
        return np.exp(np.asarray(x, dtype=float))
