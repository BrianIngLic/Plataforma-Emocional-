"""Tests completos para el motor de triage determinista.

Cubre: normalización de texto, clasificación por niveles (VERDE, NARANJA, ROJO),
detección de patrones metafóricos, activación de overrides, respuesta de crisis,
flujo completo del motor y seguimiento de historial de sesión.
"""

import sys
import os
import unittest

# Permitir importaciones directas desde la raíz del proyecto
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from constant import RiskLevel
from classifier import classify, normalize_text
from overrides import evaluate_override, get_crisis_message
from engine import TriageEngine
from models import UserMessage


class TestNormalizeText(unittest.TestCase):
    """Verifica la normalización de texto: acentos, minúsculas, variantes."""

    def test_normalize_text(self) -> None:
        """Debe eliminar acentos, convertir a minúsculas y reemplazar
        variantes informales."""
        # Acentos y mayúsculas
        result = normalize_text("Quién está aquí")
        self.assertIn("quien", result)
        self.assertIn("esta", result)
        self.assertIn("aqui", result)

        # Todo en minúsculas
        result = normalize_text("HOLA MUNDO")
        self.assertEqual(result, "hola mundo")

        # Variantes informales: 'kiero' → 'quiero'
        result = normalize_text("kiero morir")
        self.assertIn("quiero", result)


class TestClassifyVerde(unittest.TestCase):
    """Verifica que mensajes benignos se clasifiquen como VERDE."""

    def test_classify_verde(self) -> None:
        """Un saludo simple debe producir nivel VERDE."""
        result = classify("Hola, ¿cómo estás?")
        self.assertEqual(result.level, RiskLevel.VERDE)


class TestClassifyRojoLiteral(unittest.TestCase):
    """Verifica detección literal de alto riesgo → ROJO."""

    def test_classify_rojo_literal(self) -> None:
        """Expresión literal de ideación suicida debe ser ROJO."""
        result = classify("me quiero matar")
        self.assertEqual(result.level, RiskLevel.ROJO)


class TestClassifyRojoInformal(unittest.TestCase):
    """Verifica detección de variantes informales → ROJO."""

    def test_classify_rojo_informal(self) -> None:
        """'kiero morir' (variante informal) debe ser ROJO."""
        result = classify("kiero morir")
        self.assertEqual(result.level, RiskLevel.ROJO)


class TestClassifyNaranja(unittest.TestCase):
    """Verifica que expresiones de malestar moderado → NARANJA."""

    def test_classify_naranja(self) -> None:
        """Expresión de desesperanza sin ideación suicida explícita
        debe ser NARANJA."""
        result = classify("no puedo más, estoy harto de todo")
        self.assertEqual(result.level, RiskLevel.NARANJA)


class TestClassifyMetaphoricOprobios(unittest.TestCase):
    """TEST CRÍTICO: Detección de patrones metafóricos complejos.

    Este test reproduce el caso documentado en los screenshots de Qwen
    donde un fragmento poético contiene lenguaje metafórico de riesgo
    que debe ser detectado a pesar de no usar expresiones literales.
    """

    def test_classify_metaphoric_oprobios(self) -> None:
        """Fragmento poético con co-ocurrencia de 'matar', 'abismo',
        'sangre' en ventana de 2 oraciones debe ser ROJO."""
        text = (
            "La quise matar. Tal vez si lo mataba, finalmente dejarías "
            "de pretender. Seguro que el abismo sabía más dulce, si con "
            "mi sangre, finalmente, robaba tu risa."
        )
        result = classify(text)
        self.assertEqual(
            result.level,
            RiskLevel.ROJO,
            f"Esperado ROJO para patrón metafórico, obtenido: {result.level.value}",
        )


class TestClassifyMetaphoricSacrifice(unittest.TestCase):
    """Detección de patrones metafóricos con temática de autosacrificio."""

    def test_classify_metaphoric_sacrifice(self) -> None:
        """Fragmento con 'abismo', 'matarlos', 'desaparecía', 'sacrificio'
        debe ser ROJO por co-ocurrencia metafórica."""
        text = (
            "En el fondo del abismo pensé en matarlos a los dos. "
            "Me convencí de que si desaparecía dejarías de tener que "
            "soportarme. Ese fue mi pecado más grande: querer "
            "lastimarte con mi propio sacrificio."
        )
        result = classify(text)
        self.assertEqual(
            result.level,
            RiskLevel.ROJO,
            f"Esperado ROJO para patrón de sacrificio, obtenido: {result.level.value}",
        )


class TestOverrideActivatesOnRojo(unittest.TestCase):
    """Verifica que el override se active cuando la clasificación es ROJO."""

    def test_override_activates_on_rojo(self) -> None:
        """Una clasificación ROJO debe producir un override activo."""
        risk = classify("me quiero matar")
        self.assertEqual(risk.level, RiskLevel.ROJO)

        override = evaluate_override(risk)
        self.assertTrue(
            override.active,
            "El override debe estar activo para clasificación ROJO",
        )


class TestOverrideInactiveOnVerde(unittest.TestCase):
    """Verifica que el override NO se active en nivel VERDE."""

    def test_override_inactive_on_verde(self) -> None:
        """Una clasificación VERDE no debe producir override."""
        risk = classify("Hola, ¿cómo estás?")
        self.assertEqual(risk.level, RiskLevel.VERDE)

        override = evaluate_override(risk)
        self.assertFalse(
            override.active,
            "El override NO debe estar activo para clasificación VERDE",
        )


class TestCrisisMessageContainsResources(unittest.TestCase):
    """Verifica que el mensaje de crisis incluya recursos verificados."""

    def test_crisis_message_contains_resources(self) -> None:
        """El mensaje de crisis debe incluir números de teléfono
        de los recursos verificados."""
        message = get_crisis_message()

        # Debe contener al menos los teléfonos principales
        self.assertIn("800 911 2000", message)
        self.assertIn("911", message)


class TestEngineFullFlow(unittest.TestCase):
    """Verifica el flujo completo del motor: sesión, transiciones de riesgo."""

    def test_engine_full_flow(self) -> None:
        """Enviar un mensaje VERDE y luego uno ROJO debe producir
        transición de estado correcta en la sesión."""
        engine = TriageEngine()
        session_id = "test-flow-001"

        # Paso 1: Mensaje VERDE
        msg_verde = UserMessage(session_id=session_id, text="Hola, ¿cómo estás?")
        result_verde = engine.triage(msg_verde)
        self.assertEqual(result_verde.risk_assessment.level, RiskLevel.VERDE)
        self.assertFalse(result_verde.override.active)

        # Verificar estado de sesión tras VERDE
        summary = engine.get_session_summary(session_id)
        self.assertEqual(summary["message_count"], 1)
        self.assertEqual(summary["current_risk"], RiskLevel.VERDE.value)
        self.assertFalse(summary["is_override_active"])

        # Paso 2: Mensaje ROJO
        msg_rojo = UserMessage(session_id=session_id, text="me quiero matar")
        result_rojo = engine.triage(msg_rojo)
        self.assertEqual(result_rojo.risk_assessment.level, RiskLevel.ROJO)
        self.assertTrue(result_rojo.override.active)

        # Verificar transición de estado
        summary = engine.get_session_summary(session_id)
        self.assertEqual(summary["message_count"], 2)
        self.assertEqual(summary["current_risk"], RiskLevel.ROJO.value)
        self.assertTrue(summary["is_override_active"])
        self.assertGreater(summary["override_count"], 0)


class TestSessionTracksHistory(unittest.TestCase):
    """Verifica que la sesión registre el historial de mensajes."""

    def test_session_tracks_history(self) -> None:
        """Los mensajes enviados deben acumularse en el historial
        de la sesión."""
        engine = TriageEngine()
        session_id = "test-history-001"

        messages = [
            "Hola",
            "¿Cómo funciona esto?",
            "Gracias por la información",
        ]

        for text in messages:
            msg = UserMessage(session_id=session_id, text=text)
            engine.triage(msg)

        session = engine.get_or_create_session(session_id)
        self.assertEqual(len(session.messages), len(messages))

        # Verificar que los textos se preservaron
        stored_texts = [m.text for m in session.messages]
        for text in messages:
            self.assertIn(text, stored_texts)


if __name__ == "__main__":
    unittest.main(verbosity=2)
