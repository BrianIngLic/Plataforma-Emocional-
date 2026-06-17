"""Motor principal de triage determinista para clasificación de riesgo.

Orquesta las capas de seguridad: clasificación conversacional,
evaluación de overrides y enrutamiento de acciones. Todas las decisiones
de seguridad son deterministas e independientes del LLM.
"""

import logging
from datetime import datetime

from constant import RiskLevel, URGENCY_STAGES
from models import UserMessage, TriageResult, SessionState, OverrideSignal
from classifier import classify
from scales import classify_urgency, should_override, get_recommended_action
from overrides import evaluate_override, build_crisis_response

logger = logging.getLogger(__name__)


class TriageEngine:
    """Motor de triage que procesa mensajes a través de capas de seguridad.

    El flujo principal es:
        1. Clasificación conversacional (pre-LLM) → RiskAssessment
        2. Evaluación de override → OverrideSignal
        3. Si override activo → respuesta de crisis fija
        4. Si no → acción recomendada según nivel de riesgo

    Attributes:
        sessions: Diccionario de sesiones activas indexado por session_id.
    """

    def __init__(self) -> None:
        self.sessions: dict[str, SessionState] = {}

    def get_or_create_session(self, session_id: str) -> SessionState:
        """Obtiene una sesión existente o crea una nueva.

        Args:
            session_id: Identificador único de la sesión.

        Returns:
            Estado de la sesión correspondiente.
        """
        if session_id not in self.sessions:
            self.sessions[session_id] = SessionState(session_id=session_id)
            logger.info(f"Nueva sesión creada: {session_id}")
        return self.sessions[session_id]

    def triage(self, message: UserMessage) -> TriageResult:
        """Pipeline principal de triage. Procesa un mensaje a través de
        todas las capas de seguridad.

        Args:
            message: Mensaje del usuario a evaluar.

        Returns:
            Resultado del triage con clasificación, override y acción.
        """
        session = self.get_or_create_session(message.session_id)
        session.add_message(message)

        # Capa 1: Clasificador conversacional (pre-LLM)
        risk_assessment = classify(message.text)
        logger.info(
            f"[{message.session_id}] Clasificación: "
            f"{risk_assessment.level.value} "
            f"(fuente: {risk_assessment.source})"
        )

        # Capa 2: Evaluar override
        override = evaluate_override(risk_assessment)

        # Capa 3: Si override activo, devolver respuesta de crisis inmediata
        if override.active:
            session.activate_override(override)
            session.update_risk(RiskLevel.ROJO)
            result = build_crisis_response(override, message.session_id)
            logger.warning(
                f"[{message.session_id}] OVERRIDE ACTIVADO — "
                f"fuente: {override.source}, razón: {override.reason}"
            )
            return result

        # Capa 4: Flujo normal — determinar acción según nivel de riesgo
        session.update_risk(risk_assessment.level)
        action = URGENCY_STAGES.get(risk_assessment.level, "conversacion_libre")

        result = TriageResult(
            risk_assessment=risk_assessment,
            override=OverrideSignal(active=False),
            recommended_action=action,
            crisis_resources=[],
            session_id=message.session_id,
        )

        logger.info(f"[{message.session_id}] Acción recomendada: {action}")
        return result

    def get_session_summary(self, session_id: str) -> dict:
        """Devuelve un resumen del estado de la sesión para depuración/auditoría.

        Args:
            session_id: Identificador único de la sesión.

        Returns:
            Diccionario con métricas clave de la sesión.
        """
        session = self.get_or_create_session(session_id)
        return {
            "session_id": session.session_id,
            "message_count": len(session.messages),
            "current_risk": session.current_risk.value,
            "is_override_active": session.is_override_active,
            "override_count": len(session.override_history),
        }


def quick_triage(text: str, session_id: str = "anonymous") -> TriageResult:
    """Evaluación rápida de un mensaje individual.

    Crea un motor de triage efímero para evaluar un solo mensaje.
    Útil para pruebas y evaluaciones puntuales.

    Args:
        text: Texto del mensaje a evaluar.
        session_id: Identificador de sesión (default: 'anonymous').

    Returns:
        Resultado del triage.
    """
    engine = TriageEngine()
    msg = UserMessage(session_id=session_id, text=text)
    return engine.triage(msg)


if __name__ == "__main__":
    # Configurar logging para demo
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    engine = TriageEngine()

    # Mensajes de prueba con diferentes niveles de riesgo
    test_messages = [
        ("sesion-demo", "Hola, ¿cómo funciona esto?"),
        ("sesion-demo", "No puedo más, estoy harto de todo"),
        ("sesion-demo", "me quiero matar"),
    ]

    print("=" * 70)
    print("  DEMO: Motor de Triage Determinista")
    print("=" * 70)

    for session_id, text in test_messages:
        print(f"\n{'─' * 70}")
        print(f"  Mensaje: \"{text}\"")
        print(f"{'─' * 70}")

        msg = UserMessage(session_id=session_id, text=text)
        result = engine.triage(msg)

        print(f"  Nivel de riesgo : {result.risk_assessment.level.value}")
        print(f"  Fuente          : {result.risk_assessment.source}")
        print(f"  Acción          : {result.recommended_action}")
        print(f"  Override activo : {result.override.active}")

        if result.crisis_resources:
            print("  Recursos de crisis:")
            for resource in result.crisis_resources:
                print(f"    • {resource['name']}: {resource['phone']}")

    # Resumen final de la sesión
    print(f"\n{'=' * 70}")
    print("  RESUMEN DE SESIÓN")
    print(f"{'=' * 70}")
    summary = engine.get_session_summary("sesion-demo")
    for key, value in summary.items():
        print(f"  {key}: {value}")
    print(f"{'=' * 70}")
