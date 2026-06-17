"""overrides.py — Capa de override determinista del motor de triaje.

Cuando se activa, este módulo **reemplaza completamente** la respuesta
del LLM (Qwen) con un mensaje de crisis fijo y pre-escrito. Esto
garantiza que:

- El usuario siempre recibe recursos de ayuda verificados.
- La respuesta no depende del comportamiento impredecible del modelo.
- El tiempo de respuesta es mínimo (sin latencia de inferencia).

El override se activa cuando:
1. El clasificador pre-LLM detecta riesgo ``ROJO`` (literal o
   metafórico).
2. La escala de urgencia clasifica la situación como ``ROJO``.
3. El ítem 9 del PHQ-9 indica riesgo.
"""

from __future__ import annotations

from datetime import datetime

from constant import RiskLevel, OverrideSource, CRISIS_RESOURCES, URGENCY_STAGES
from models import RiskAssessment, OverrideSignal, TriageResult, UrgencyStage


# ------------------------------------------------------------------ #
# Evaluación del override
# ------------------------------------------------------------------ #


def evaluate_override(
    risk_assessment: RiskAssessment,
    urgency: UrgencyStage | None = None,
) -> OverrideSignal:
    """Evalúa si se debe activar el override de crisis.

    Lógica de decisión:

    1. Si ``risk_assessment.level`` es ``ROJO``, activa el override
       determinando la fuente según el campo ``source`` del assessment:
       - ``'literal'`` o ``'metaphoric'`` → ``CONVERSATIONAL_CLASSIFIER``
       - ``'phq9'`` → ``PHQ9_ITEM9``
       - Cualquier otro → ``CONVERSATIONAL_CLASSIFIER`` (por defecto
         seguro).
    2. Si hay una ``urgency`` y su ``stage`` es ``ROJO``, activa el
       override con fuente ``URGENCY_SCALE``.
    3. En cualquier otro caso, retorna un override inactivo.

    Args:
        risk_assessment: Resultado del clasificador pre-LLM.
        urgency: Etapa de urgencia evaluada (opcional).

    Returns:
        ``OverrideSignal`` indicando si el override debe activarse,
        con su fuente, razón y marca de tiempo.
    """
    now_iso = datetime.now().isoformat()

    # --- 1. Riesgo ROJO por clasificador ---
    if risk_assessment.level == RiskLevel.ROJO:
        source = _resolve_override_source(risk_assessment.source)
        # Usar términos o patrones según lo detectado.
        evidence = risk_assessment.matched_terms or risk_assessment.matched_patterns
        return OverrideSignal(
            active=True,
            source=source,
            reason=f"Detected: {evidence}",
            triggered_at=now_iso,
        )

    # --- 2. Urgencia ROJO ---
    if urgency is not None and urgency.stage == RiskLevel.ROJO:
        return OverrideSignal(
            active=True,
            source=OverrideSource.URGENCY_SCALE,
            reason=f"Urgency indicators: {urgency.indicators}",
            triggered_at=now_iso,
        )

    # --- 3. Sin override ---
    return OverrideSignal(active=False)


def _resolve_override_source(source_label: str) -> OverrideSource:
    """Mapea la etiqueta de fuente del clasificador a un ``OverrideSource``.

    Args:
        source_label: Cadena ``source`` del ``RiskAssessment``
            (e.g. ``'literal_match'``, ``'metaphoric_pattern'``).

    Returns:
        El ``OverrideSource`` correspondiente.
    """
    if "phq9" in source_label.lower():
        return OverrideSource.PHQ9_ITEM9
    # Tanto 'literal_match' como 'metaphoric_pattern' vienen del
    # clasificador conversacional.
    return OverrideSource.CONVERSATIONAL_CLASSIFIER


# ------------------------------------------------------------------ #
# Respuesta de crisis
# ------------------------------------------------------------------ #


def build_crisis_response(
    override: OverrideSignal,
    session_id: str = "",
) -> TriageResult:
    """Construye la respuesta de crisis fija (NO generada por LLM).

    Esta es la respuesta que se envía al usuario **en lugar de** la
    salida de Qwen cuando el override está activo.

    Args:
        override: Señal de override activa.
        session_id: Identificador de la sesión del usuario.

    Returns:
        ``TriageResult`` completo con nivel ROJO, recursos de crisis,
        y acción recomendada.
    """
    return TriageResult(
        risk_assessment=RiskAssessment(
            level=RiskLevel.ROJO,
            source=override.source.value if override.source else "override",
            matched_terms=[],
            matched_patterns=[],
            confidence_note=(
                "Override de crisis activado. Respuesta determinista "
                "fija — no generada por modelo de lenguaje."
            ),
        ),
        override=override,
        recommended_action=URGENCY_STAGES[RiskLevel.ROJO],
        crisis_resources=CRISIS_RESOURCES,
        session_id=session_id,
    )


# ------------------------------------------------------------------ #
# Mensaje de crisis pre-escrito
# ------------------------------------------------------------------ #


def get_crisis_message() -> str:
    """Devuelve el mensaje de crisis fijo en español.

    Este mensaje se muestra al usuario cuando el override está activo.
    Incluye los recursos de ``CRISIS_RESOURCES`` formateados y un
    recordatorio de contactar al 911 en caso de peligro inmediato.

    Returns:
        Cadena multi-línea con el mensaje de crisis completo.
    """
    header = (
        "Entiendo que estás pasando por un momento muy difícil. "
        "Tu seguridad es lo más importante.\n\n"
        "Por favor, contacta alguno de estos recursos de ayuda inmediata:\n\n"
    )

    # Formatear cada recurso como una línea legible.
    resource_lines: list[str] = []
    for resource in CRISIS_RESOURCES:
        name = resource.get("name", "Recurso de ayuda")
        phone = resource.get("phone", "N/D")
        resource_lines.append(f"• {name}: {phone}")

    resources_block = "\n".join(resource_lines)

    footer = (
        "\n\nSi estás en peligro inmediato, llama al 911.\n"
        "No estás solo/a. Hay personas capacitadas que pueden "
        "ayudarte ahora mismo."
    )

    return header + resources_block + footer
