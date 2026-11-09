"""Testes do cruzamento de cadernos e das correções do extrator (F2-T10).
Rodar: .venv/bin/python -m unittest -v test_crossmatch"""
import unittest

from crossmatch import map_letters, norm_alt, parse_answer_text
from extract import Line, stack_fractions


def q(alts):
    return {"alternatives": alts}


class AnswerKeyTest(unittest.TestCase):
    def test_annulled_is_not_letter_a(self):
        k = parse_answer_text("121 Anulado 166 C\n122 B 167 ANULADO")
        self.assertEqual(k[(121, None)], "ANULADO")
        self.assertEqual(k[(167, None)], "ANULADO")
        self.assertEqual(k[(166, None)], "C")

    def test_language_columns(self):
        k = parse_answer_text("1 D B 46 A\n6 E 51 C")
        self.assertEqual((k[(1, "ingles")], k[(1, "espanhol")], k[(46, None)]), ("D", "B", "A"))
        self.assertEqual(k[(6, None)], "E")
        self.assertNotIn((6, "ingles"), k)


class LetterMapTest(unittest.TestCase):
    def test_signs_distinguish_alternatives(self):
        a = {"A": "y = −3x + 20", "B": "y = −3x − 20", "C": "y = 3x + 20", "D": "y = 3x − 20", "E": "y = 20"}
        self.assertEqual(len({norm_alt(v) for v in a.values()}), 5)
        self.assertEqual(map_letters(q(a), q(dict(a))), {k: k for k in a})

    def test_permuted_letters_are_followed(self):
        a = {"A": "um", "B": "dois", "C": "três", "D": "quatro", "E": "cinco"}
        b = {"A": "três", "B": "um", "C": "cinco", "D": "dois", "E": "quatro"}
        self.assertEqual(map_letters(q(a), q(b)), {"A": "B", "B": "D", "C": "A", "D": "E", "E": "C"})

    def test_repeated_or_empty_text_is_not_guessed(self):
        a = {"A": "90", "B": "100 40", "C": "100 40", "D": "", "E": "x"}
        m = map_letters(q(a), q(dict(a)))
        self.assertEqual((m["B"], m["C"], m["D"], m["A"]), (None, None, None, "A"))


class StackedFractionTest(unittest.TestCase):
    def line(self, top, bottom, x0, text, alt=None):
        return Line(16, 0, top, bottom, x0, x0 + 20, text, 9.0, alt)

    def test_numerator_letter_denominator(self):
        lines = [self.line(612, 622, 65, "a probabilidade é"),
                 self.line(630, 640, 80, "30"), self.line(636, 646, 65, "", "A"), self.line(644, 654, 80, "90"),
                 self.line(660, 670, 82, "36"), self.line(666, 676, 65, "", "B"), self.line(674, 684, 79, "100")]
        out, n = stack_fractions(lines)
        self.assertEqual(n, 2)
        self.assertEqual([(l.alt_letter, l.text) for l in out], [(None, "a probabilidade é"), ("A", "30/90"), ("B", "36/100")])

    def test_plain_alternatives_untouched(self):
        lines = [self.line(600, 610, 65, "comando"), self.line(620, 630, 65, "10⁸", "A"), self.line(640, 650, 65, "10⁰,⁵", "B")]
        out, n = stack_fractions(lines)
        self.assertEqual((n, out), (0, lines))


if __name__ == "__main__":
    unittest.main()
