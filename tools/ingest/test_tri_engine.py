"""Confere a versão em Python do motor contra os mesmos casos do teste do app (engine.test.ts).

Parâmetros sintéticos; nenhum representa item do Enem.
"""
import math
import unittest

import numpy as np

from tri_engine import ModelConfig, eap_many, eap_one, probability

CFG = ModelConfig(D=1, prior_mean=0, prior_sd=1, q_from=-6, q_to=6, q_points=121)
ITEMS = [(1.1, -1.2, 0.18), (0.8, 0.3, 0.22), (2.0, 1.1, 0.15), (1.4, 0.0, 0.2), (0.6, 2.2, 0.25)]
ANSWERS = [True, True, False, True, False]


def brute_force(resp, D):
    z = m1 = m2 = 0.0
    t = -8.0
    while t <= 8:
        like = math.exp(-0.5 * t * t)
        for a, b, c, ok in resp:
            pr = c + (1 - c) / (1 + math.exp(-D * a * (t - b)))
            like *= pr if ok else 1 - pr
        z += like; m1 += t * like; m2 += t * t * like
        t += 0.002
    mean = m1 / z
    return mean, math.sqrt(m2 / z - mean * mean)


class EngineTest(unittest.TestCase):
    def test_probability(self):
        self.assertAlmostEqual(float(probability(0.5, 1.2, 0.5, 0.2, 1)), 0.6, places=12)

    def test_prior_without_responses(self):
        t, s = eap_one([], CFG)
        self.assertAlmostEqual(t, 0, places=6)
        self.assertAlmostEqual(s, 1, places=3)

    def test_matches_fine_integration(self):
        resp = [(*p, ok) for p, ok in zip(ITEMS, ANSWERS)]
        for D in (1, 1.7):
            cfg = ModelConfig(**{**CFG.__dict__, "D": D})
            t, s = eap_one(resp, cfg)
            rt, rs = brute_force(resp, D)
            self.assertLess(abs(t - rt), 1e-3)
            self.assertLess(abs(s - rs), 1e-3)

    def test_vectorized_equals_line_by_line(self):
        rng = np.random.default_rng(7)
        a, b, c = (np.array(v) for v in zip(*ITEMS))
        correct = rng.random((40, len(ITEMS))) < 0.55
        th, sd = eap_many(correct, a, b, c, CFG)
        for i in range(len(correct)):
            t, s = eap_one([(*ITEMS[j], bool(correct[i, j])) for j in range(len(ITEMS))], CFG)
            self.assertAlmostEqual(th[i], t, places=10)
            self.assertAlmostEqual(sd[i], s, places=10)

    def test_invalid_config_refused(self):
        with self.assertRaises(ValueError):
            eap_one([], ModelConfig(**{**CFG.__dict__, "prior_sd": 0}))


if __name__ == "__main__":
    unittest.main()
