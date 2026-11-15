"""Motor de TRI em Python, idêntico ao do app (apps/web/src/lib/tri/engine.ts).

Serve para validar a configuração do modelo contra as notas oficiais dos microdados do Inep:
mesma probabilidade 3PL, mesma grade, mesma regra do trapézio e mesma log-posteriori. A versão
vetorizada estima muitos participantes de uma vez; `eap_one` é a tradução linha a linha do TS
e o teste confere que as duas dão o mesmo número.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class ModelConfig:
    D: float
    prior_mean: float
    prior_sd: float
    q_from: float
    q_to: float
    q_points: int
    slope: float | None = None
    intercept: float | None = None
    interval_z: float = 1.645

    def check(self) -> None:
        if not self.D > 0:
            raise ValueError("D precisa ser positivo")
        if not self.prior_sd > 0:
            raise ValueError("priori normal com desvio positivo")
        if not (self.q_to > self.q_from and self.q_points >= 11):
            raise ValueError("grade de integração inválida")
        if self.slope is not None and not self.slope > 0:
            raise ValueError("transformação precisa de inclinação positiva")

    def grid(self) -> np.ndarray:
        step = (self.q_to - self.q_from) / (self.q_points - 1)
        return self.q_from + step * np.arange(self.q_points)

    def to_score(self, theta):
        return theta if self.slope is None else self.intercept + self.slope * theta


def valid_parameters(a, b, c) -> bool:
    return all(v is not None and math.isfinite(v) for v in (a, b, c)) and a > 0 and 0 <= c < 1


def probability(theta, a, b, c, D):
    return c + (1 - c) / (1 + np.exp(-D * a * (theta - b)))


def eap_one(responses: list[tuple[float, float, float, bool]], cfg: ModelConfig) -> tuple[float, float]:
    """Tradução direta de eap() do TS para um vetor de respostas (a, b, c, acertou)."""
    cfg.check()
    xs = cfg.grid()
    logpost = []
    for t in xs:
        l = -0.5 * ((t - cfg.prior_mean) / cfg.prior_sd) ** 2
        for a, b, c, ok in responses:
            pr = c + (1 - c) / (1 + math.exp(-cfg.D * a * (t - b)))
            l += math.log(pr if ok else 1 - pr)
        logpost.append(l)
    mx = max(logpost)
    w = [math.exp(l - mx) for l in logpost]
    h = xs[1] - xs[0]

    def trap(f):
        return h * sum((0.5 if i in (0, len(xs) - 1) else 1) * f(i) for i in range(len(xs)))

    z = trap(lambda i: w[i])
    theta = trap(lambda i: xs[i] * w[i]) / z
    var = trap(lambda i: (xs[i] - theta) ** 2 * w[i]) / z
    return theta, math.sqrt(var)


def eap_many(correct: np.ndarray, a: np.ndarray, b: np.ndarray, c: np.ndarray, cfg: ModelConfig) -> tuple[np.ndarray, np.ndarray]:
    """EAP para uma matriz participantes × itens de acertos (bool), itens válidos apenas.

    Mesma conta de eap_one, feita em bloco: log P e log (1 − P) em cada ponto da grade.
    """
    cfg.check()
    xs = cfg.grid()
    p = probability(xs[:, None], a[None, :], b[None, :], c[None, :], cfg.D)  # pontos × itens
    with np.errstate(divide="ignore"):
        lp, lq = np.log(p), np.log(1 - p)
    # o TS só calcula o log do ramo que a resposta usa; aqui os dois ramos entram na soma, e 0 × (−∞) daria NaN.
    # −1e300 faz o papel de −∞ (o peso daquele ponto vira 0) sem produzir NaN.
    lp, lq = np.maximum(lp, -1e300), np.maximum(lq, -1e300)
    x = correct.astype(np.float64)
    loglik = x @ lp.T + (1 - x) @ lq.T  # participantes × pontos
    logpost = loglik - 0.5 * ((xs - cfg.prior_mean) / cfg.prior_sd) ** 2
    w = np.exp(logpost - logpost.max(axis=1, keepdims=True))
    tw = np.ones_like(xs)
    tw[0] = tw[-1] = 0.5
    h = xs[1] - xs[0]
    z = (w * tw).sum(axis=1) * h
    theta = (w * tw * xs).sum(axis=1) * h / z
    var = (w * tw * (xs[None, :] - theta[:, None]) ** 2).sum(axis=1) * h / z
    return theta, np.sqrt(var)
