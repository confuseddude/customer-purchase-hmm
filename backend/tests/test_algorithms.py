"""Unit tests for the HMM algorithms, verified against brute-force enumeration."""

import itertools

import numpy as np
import pytest

from app.algorithms.backward import backward, backward_pass
from app.algorithms.baum_welch import baum_welch, random_model
from app.algorithms.forward import ZeroProbabilitySequence, forward, forward_pass
from app.algorithms.forward_backward import forward_backward, posteriors
from app.algorithms.mle import supervised_mle
from app.algorithms.prediction import TargetLeakageError, analyze, forecast
from app.algorithms.viterbi import viterbi, viterbi_path
from app.models.hmm import (
    HMM, InvalidModelError, InvalidObservationError, OBSERVATIONS, PURCHASE, encode_observations,
    validate_parameters,
)

TINY = HMM(
    np.array([0.6, 0.4]),
    np.array([[0.7, 0.3], [0.4, 0.6]]),
    np.array([[0.5, 0.4, 0.1], [0.1, 0.3, 0.6]]),
)


def joint(hmm: HMM, obs, path) -> float:
    p = hmm.pi[path[0]] * hmm.B[path[0], obs[0]]
    for t in range(1, len(obs)):
        p *= hmm.A[path[t - 1], path[t]] * hmm.B[path[t], obs[t]]
    return p


def all_paths(hmm, T):
    return itertools.product(range(hmm.n_states), repeat=T)


def brute_likelihood(hmm, obs):
    return sum(joint(hmm, obs, q) for q in all_paths(hmm, len(obs)))


def brute_posterior(hmm, obs):
    T, N = len(obs), hmm.n_states
    g = np.zeros((T, N))
    for q in all_paths(hmm, T):
        p = joint(hmm, obs, q)
        for t, s in enumerate(q):
            g[t, s] += p
    return g / g.sum(axis=1, keepdims=True)


SEQS = [[0], [0, 1], [2, 2, 0, 1], [0, 1, 2, 2, 1, 0]]


# ---------- parameter validation ----------

def test_default_model_is_normalised():
    h = HMM.default()
    assert np.isclose(h.pi.sum(), 1)
    assert np.allclose(h.A.sum(axis=1), 1)
    assert np.allclose(h.B.sum(axis=1), 1)


@pytest.mark.parametrize(
    "pi,A,B,fragment",
    [
        ([0.5, 0.6], [[1, 0], [0, 1]], [[1, 0], [0, 1]], "Initial probabilities"),
        ([0.5, 0.5], [[0.5, 0.6], [0, 1]], [[1, 0], [0, 1]], "Transition row"),
        ([0.5, 0.5], [[1, 0], [0, 1]], [[0.5, 0.4], [0, 1]], "Emission distribution"),
        ([1.2, -0.2], [[1, 0], [0, 1]], [[1, 0], [0, 1]], "negative"),
        ([0.5, 0.5], [[1, 0]], [[1, 0], [0, 1]], "A must be"),
        ([0.5, 0.5], [[1, 0], [0, 1]], [[1.5, -0.5], [0, 1]], "negative"),
    ],
)
def test_invalid_matrices_rejected(pi, A, B, fragment):
    errors = validate_parameters(pi, A, B)
    assert errors and any(fragment in e for e in errors)
    with pytest.raises(InvalidModelError):
        HMM(pi, A, B)


def test_probability_above_one_rejected():
    errors = validate_parameters([1.0, 0.0], [[1, 0], [0, 1]], [[1.0, 0.0], [2.0, -1.0]])
    assert any("greater than 1" in e or "negative" in e for e in errors)


def test_encode_observations():
    assert encode_observations(["view", " Cart ", "PURCHASE", 4]).tolist() == [0, 1, 3, 4]
    with pytest.raises(InvalidObservationError):
        encode_observations([])
    with pytest.raises(InvalidObservationError):
        encode_observations(["View", "Teleport"])
    with pytest.raises(InvalidObservationError):
        encode_observations([7])


# ---------- forward / backward ----------

@pytest.mark.parametrize("obs", SEQS)
def test_forward_matches_brute_force(obs):
    obs = np.array(obs)
    res = forward(TINY, obs)
    assert np.isclose(res["likelihood"], brute_likelihood(TINY, obs))
    # raw alpha_T sums to P(O)
    assert np.isclose(np.sum(res["alpha"][-1]), res["likelihood"])
    # scaled alpha rows are distributions
    assert np.allclose(np.sum(res["alpha_hat"], axis=1), 1)


def test_forward_definition_alpha():
    obs = np.array([0, 2, 1])
    alpha = np.array(forward(TINY, obs)["alpha"])
    for t in range(len(obs)):
        for i in range(2):
            brute = sum(joint(TINY, obs[: t + 1], q) for q in all_paths(TINY, t + 1) if q[-1] == i)
            assert np.isclose(alpha[t, i], brute)


@pytest.mark.parametrize("obs", SEQS)
def test_backward_matches_forward(obs):
    obs = np.array(obs)
    b = backward(TINY, obs)
    assert np.isclose(b["likelihood"], brute_likelihood(TINY, obs))
    assert np.allclose(b["beta"][-1], 1.0)
    # alpha_t . beta_t = P(O) for every t
    alpha = np.array(forward(TINY, obs)["alpha"])
    beta = np.array(b["beta"])
    assert np.allclose((alpha * beta).sum(axis=1), b["likelihood"])


def test_backward_definition_beta():
    obs = np.array([1, 0, 2, 2])
    beta = backward_pass(TINY, obs).beta
    T = len(obs)
    for t in range(T - 1):
        for i in range(2):
            brute = 0.0
            for q in all_paths(TINY, T - t - 1):
                p, prev = 1.0, i
                for k, s in enumerate(q):
                    p *= TINY.A[prev, s] * TINY.B[s, obs[t + 1 + k]]
                    prev = s
                brute += p
            assert np.isclose(beta[t, i], brute)


# ---------- forward-backward ----------

@pytest.mark.parametrize("obs", SEQS)
def test_posterior_matches_brute_force(obs):
    obs = np.array(obs)
    res = forward_backward(TINY, obs)
    gamma = np.array(res["gamma"])
    assert np.allclose(gamma.sum(axis=1), 1)
    assert np.allclose(gamma, brute_posterior(TINY, obs))


def test_xi_consistent_with_gamma():
    obs = np.array([0, 1, 2, 2, 0])
    post = posteriors(TINY, obs)
    assert np.allclose(post.xi.sum(axis=(1, 2)), 1)
    assert np.allclose(post.xi.sum(axis=2), post.gamma[:-1])
    assert np.allclose(post.xi.sum(axis=1), post.gamma[1:])


# ---------- viterbi ----------

@pytest.mark.parametrize("obs", SEQS)
def test_viterbi_matches_brute_force(obs):
    obs = np.array(obs)
    best = max(all_paths(TINY, len(obs)), key=lambda q: joint(TINY, obs, q))
    res = viterbi(TINY, obs)
    assert np.isclose(res["best_probability"], joint(TINY, obs, best))
    assert np.isclose(joint(TINY, obs, res["path"]), joint(TINY, obs, best))


def test_viterbi_on_default_model_three_states():
    h = HMM.default()
    obs = encode_observations(["View", "Cart", "Checkout", "Purchase"])
    best = max(all_paths(h, 4), key=lambda q: joint(h, obs, q))
    path, log_p, _, _ = viterbi_path(h, obs)
    assert tuple(path) == best
    assert np.isclose(np.exp(log_p), joint(h, obs, best))


# ---------- edge cases ----------

def test_single_observation():
    obs = np.array([2])
    assert np.isclose(forward(TINY, obs)["likelihood"], TINY.pi @ TINY.B[:, 2])
    assert np.allclose(backward(TINY, obs)["beta"], [[1, 1]])
    g = np.array(forward_backward(TINY, obs)["gamma"])[0]
    expected = TINY.pi * TINY.B[:, 2]
    assert np.allclose(g, expected / expected.sum())
    assert viterbi(TINY, obs)["path"] == [int(np.argmax(expected))]


def test_zero_probabilities_handled():
    h = HMM([1.0, 0.0], [[1.0, 0.0], [0.0, 1.0]], [[1.0, 0.0], [0.0, 1.0]])
    possible = np.array([0, 0, 0])
    assert np.isclose(forward(h, possible)["likelihood"], 1.0)
    assert viterbi(h, possible)["path"] == [0, 0, 0]
    impossible = np.array([0, 1])
    f = forward(h, impossible)
    assert f["impossible"] and f["likelihood"] == 0.0
    assert viterbi(h, impossible)["impossible"]
    with pytest.raises(ZeroProbabilitySequence):
        posteriors(h, impossible)


def test_very_long_sequence_is_stable():
    rng = np.random.default_rng(0)
    h = HMM.default()
    obs = rng.integers(0, 5, size=5000)
    fwd = forward_pass(h, obs)
    assert np.isfinite(fwd.log_likelihood) and fwd.log_likelihood < -1000
    post = posteriors(h, obs)
    assert np.all(np.isfinite(post.gamma)) and np.allclose(post.gamma.sum(axis=1), 1)
    path, log_p, _, _ = viterbi_path(h, obs)
    assert len(path) == 5000 and np.isfinite(log_p) and log_p <= fwd.log_likelihood


# ---------- learning ----------

def sample(hmm: HMM, n: int, T: int, seed: int):
    rng = np.random.default_rng(seed)
    seqs, states = [], []
    for _ in range(n):
        s = rng.choice(hmm.n_states, p=hmm.pi)
        o_seq, s_seq = [], []
        for t in range(T):
            if t:
                s = rng.choice(hmm.n_states, p=hmm.A[s])
            o_seq.append(rng.choice(hmm.n_obs, p=hmm.B[s]))
            s_seq.append(s)
        seqs.append(np.array(o_seq))
        states.append(np.array(s_seq))
    return seqs, states


def test_baum_welch_likelihood_never_decreases():
    seqs, _ = sample(TINY, 60, 8, seed=1)
    init = random_model(2, 3, seed=3)
    res = baum_welch(init, seqs, max_iterations=40, tolerance=1e-9)
    lls = [h["log_likelihood"] for h in res["history"]]
    assert all(b >= a - 1e-8 for a, b in zip(lls, lls[1:]))
    assert lls[-1] > lls[0]
    m = res["model"]
    assert np.allclose(m.A.sum(axis=1), 1) and np.allclose(m.B.sum(axis=1), 1) and np.isclose(m.pi.sum(), 1)


def test_baum_welch_converges_with_tolerance():
    seqs, _ = sample(TINY, 30, 6, seed=2)
    res = baum_welch(TINY, seqs, max_iterations=500, tolerance=1e-3)
    assert res["converged"] and res["iterations"] < 500


def test_supervised_mle_counts():
    obs = [np.array([0, 1]), np.array([1, 1, 2])]
    st = [np.array([0, 1]), np.array([1, 1, 0])]
    res = supervised_mle(obs, st, 2, 3, smoothing=0)
    m = res["model"]
    assert np.allclose(m.pi, [0.5, 0.5])
    # transitions: 0->1, 1->1, 1->0  => row0 = [0,1], row1 = [0.5,0.5]
    assert np.allclose(m.A, [[0, 1], [0.5, 0.5]])
    # emissions: state0 emits 0 and 2; state1 emits 1,1,1
    assert np.allclose(m.B, [[0.5, 0, 0.5], [0, 1, 0]])


def test_supervised_mle_smoothing_and_recovery():
    seqs, states = sample(TINY, 2000, 10, seed=5)
    m = supervised_mle(seqs, states, 2, 3, smoothing=1.0)["model"]
    assert np.all(m.A > 0) and np.all(m.B > 0)
    assert np.allclose(m.A, TINY.A, atol=0.03)
    assert np.allclose(m.B, TINY.B, atol=0.03)


# ---------- prediction ----------

def test_next_purchase_probability_matches_definition():
    h = HMM.default()
    obs = encode_observations(["View", "Cart", "Checkout"])
    res = forecast(h, obs)
    T = len(obs)
    # brute force: P(O_1..T, O_{T+1}=Purchase) / P(O_1..T)
    num = 0.0
    for q in all_paths(h, T + 1):
        num += joint(h, np.append(obs, PURCHASE), q)
    den = brute_likelihood(h, obs)
    assert np.isclose(res["purchase_probability"], num / den)
    assert np.isclose(sum(res["next_observation_distribution"]), 1)
    assert np.isclose(sum(t["product"] for t in res["purchase_terms"]), res["purchase_probability"])


def test_forecast_empty_history_uses_prior():
    h = HMM.default()
    res = forecast(h, np.array([], dtype=int))
    assert np.isclose(res["purchase_probability"], h.pi @ h.B[:, PURCHASE])


def test_forecast_rejects_target_leakage():
    with pytest.raises(TargetLeakageError):
        forecast(HMM.default(), encode_observations(["View", "Purchase"]))


def test_analyze_completed_journey_is_leakage_free():
    h = HMM.default()
    obs = encode_observations(["View", "Cart", "Purchase"])
    res = analyze(h, obs)
    assert res["purchased"] and res["first_purchase_step"] == 3
    pre = forecast(h, obs[:2])["purchase_probability"]
    assert np.isclose(res["pre_purchase_probability"], pre)
    assert len(res["prefix_trajectory"]) == 3  # t = 0, 1, 2


def test_more_engaged_journeys_score_higher():
    h = HMM.default()
    p_bounce = forecast(h, encode_observations(["View", "View", "Exit"]))["purchase_probability"]
    p_checkout = forecast(h, encode_observations(["View", "Cart", "Checkout"]))["purchase_probability"]
    assert p_checkout > p_bounce


def test_observation_vocabulary():
    assert OBSERVATIONS == ["View", "Cart", "Checkout", "Purchase", "Exit"]
