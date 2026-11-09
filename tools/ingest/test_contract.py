"""Testes do contrato de estruturação (F2-T09). Rodar: .venv/bin/python -m unittest -v test_contract"""
import copy
import unittest

from contract import from_extraction, validate

BOOKLET = {"file": "2025_PV_impresso_D2_CD7.pdf", "sha256": "a" * 64, "day": "2", "booklet": "7"}
Q = {
    "number": 140,
    "foreign_language": None,
    "pages": [18],
    "bbox_by_page": {"18": [50, 100, 300, 400]},
    "stimulus_blocks": [{"id": "s1", "type": "paragraph", "text": "Em um laboratório, S₁ e S₂."}],
    "command": "Qual é a quantidade de S₁, em litro, que será retirada?",
    "alternatives": {"A": "0,0050", "B": "0,0100", "C": "0,5000", "D": "4,9775", "E": "5,0000"},
    "warnings": [],
}


def proposal(**changes):
    q = copy.deepcopy(Q)
    q.update(changes)
    return from_extraction(q, BOOKLET)


class ContractTest(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(validate(proposal())["status"], "valida")

    def test_script_tag_rejected(self):
        p = proposal()
        p["alternatives"]["A"][0]["text"] = "0,0050<script>alert(1)</script>"
        v = validate(p)
        self.assertEqual(v["status"], "rejeitada")
        self.assertTrue(any("HTML" in e for e in v["errors"]))

    def test_img_onerror_rejected(self):
        p = proposal()
        p["stimulus_blocks"][0]["text"] = 'texto <img src=x onerror="fetch(1)">'
        self.assertEqual(validate(p)["status"], "rejeitada")

    def test_javascript_url_rejected(self):
        p = proposal()
        p["command_blocks"][0]["text"] = "veja javascript:alert(1)"
        self.assertEqual(validate(p)["status"], "rejeitada")

    def test_encoded_lt_rejected(self):
        p = proposal()
        p["command_blocks"][0]["text"] = "&lt;script&gt;x"
        self.assertEqual(validate(p)["status"], "rejeitada")

    def test_bidi_override_rejected(self):
        p = proposal()
        p["alternatives"]["B"][0]["text"] = "0,0‮0010"
        self.assertEqual(validate(p)["status"], "rejeitada")

    def test_control_char_rejected(self):
        p = proposal()
        p["alternatives"]["C"][0]["text"] = "0,5\x07000"
        self.assertEqual(validate(p)["status"], "rejeitada")

    def test_less_than_in_math_is_fine(self):
        p = proposal(command="Para x < 3 e y > 2, qual é o valor?")
        self.assertEqual(validate(p)["status"], "valida")

    def test_inequality_with_letters_is_fine(self):
        self.assertEqual(validate(proposal(command="Se 2 < x e x > 1, então"))["status"], "valida")
        self.assertEqual(validate(proposal(command="Vale a < b < c para todo n > 0?"))["status"], "valida")

    def test_html_comment_rejected(self):
        self.assertEqual(validate(proposal(command="texto <!-- oculto -->"))["status"], "rejeitada")

    def test_missing_alternative_is_doubt(self):
        alts = dict(Q["alternatives"], D="")
        v = validate(proposal(alternatives=alts))
        self.assertEqual(v["status"], "duvida")
        self.assertIn("alternativa D sem conteúdo", v["doubts"])

    def test_missing_letter_violates_contract(self):
        p = proposal()
        del p["alternatives"]["E"]
        self.assertEqual(validate(p)["status"], "rejeitada")

    def test_extractor_warning_becomes_doubt(self):
        v = validate(proposal(warnings=["alternativas encontradas: ABC"]))
        self.assertEqual(v["status"], "duvida")

    def test_wrong_area_rejected(self):
        p = proposal()
        p["area"] = "LC"
        self.assertEqual(validate(p)["status"], "rejeitada")

    def test_model_output_needs_provenance(self):
        p = proposal()
        p["producer"] = {"kind": "modelo", "tool": "estruturador", "version": "1"}
        self.assertEqual(validate(p)["status"], "rejeitada")
        p["producer"].update(provider="anthropic", model="claude", prompt_version="p1")
        self.assertEqual(validate(p)["status"], "valida")

    def test_language_rules(self):
        q1 = from_extraction(dict(copy.deepcopy(Q), number=1), dict(BOOKLET, day="1", booklet="1"))
        q1["area"] = "LC"
        self.assertEqual(validate(q1)["status"], "rejeitada")  # 1–5 do dia 1 sem língua
        q1["foreign_language"] = "ingles"
        self.assertEqual(validate(q1)["status"], "valida")

    def test_image_alternative_links_figure(self):
        figs = [{"question": 140, "foreign_language": None, "role": "alternativa D", "kind": "imagem", "page": 18,
                 "bbox_pt": [1, 2, 3, 4], "sha256": "b" * 64}]
        p = from_extraction(dict(copy.deepcopy(Q), alternatives=dict(Q["alternatives"], D="")), BOOKLET, figs)
        self.assertEqual(validate(p)["status"], "valida")
        p["alternatives"]["D"][0]["asset_ref"] = "fig9"
        self.assertEqual(validate(p)["status"], "rejeitada")


if __name__ == "__main__":
    unittest.main()
