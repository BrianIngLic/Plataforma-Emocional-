"""scales.py — Etapas de urgencia del motor de triaje de salud mental.

Define las etapas de urgencia específicas del proyecto (NO son escalas
clínicas estándar como PHQ-9/GAD-7). Cada nivel de riesgo tiene un
conjunto de indicadores conductuales derivados de la investigación del
equipo y una acción recomendada para el sistema.

El principio rector es **escalamiento conservador**: si *cualquier*
indicador de un nivel alto está presente, se clasifica en ese nivel
independientemente de los demás indicadores detectados.
"""

from __future__ import annotations

from constant import RiskLevel, URGENCY_STAGES
from models import UrgencyStage

# ------------------------------------------------------------------ #
# Catálogo de indicadores por nivel de riesgo
# ------------------------------------------------------------------ #

_INDICATORS_BY_LEVEL: dict[RiskLevel, list[str]] = {
    RiskLevel.VERDE: [
        "conversacion_normal",
        "sin_indicadores_malestar",
        "consulta_informativa",
    ],
    RiskLevel.AMARILLO: [
        "estres_academico",
        "ansiedad_situacional",
        "tristeza_pasajera",
        "problemas_sueno_leve",
        "frustracion_temporal",
        "preocupacion_moderada",
    ],
    RiskLevel.NARANJA: [
        "desesperanza_persistente",
        "aislamiento_social",
        "deterioro_funcional",
        "llanto_frecuente",
        "perdida_interes",
        "alteracion_sueno_grave",
        "ideacion_pasiva",
    ],
    RiskLevel.ROJO: [
        "ideacion_suicida_activa",
        "autolesion",
        "plan_suicida",
        "intento_previo",
        "peligro_inmediato",
        "dano_a_otros",
    ],
}

# Índice invertido: indicador → nivel de riesgo (se construye una sola
# vez al importar el módulo para búsquedas O(1)).
_LEVEL_BY_INDICATOR: dict[str, RiskLevel] = {
    indicator: level
    for level, indicators in _INDICATORS_BY_LEVEL.items()
    for indicator in indicators
}

# Descripciones legibles en español de cada etapa.
_STAGE_DESCRIPTIONS: dict[RiskLevel, str] = {
    RiskLevel.VERDE: (
        "Sin riesgo identificado. La conversación es normal o informativa. "
        "No se detectan indicadores de malestar emocional significativo."
    ),
    RiskLevel.AMARILLO: (
        "Malestar leve a moderado. Se detectan indicadores de estrés "
        "situacional, ansiedad pasajera o tristeza temporal que no "
        "representan riesgo inmediato pero requieren seguimiento."
    ),
    RiskLevel.NARANJA: (
        "Malestar significativo y persistente. Se identifican indicadores "
        "como desesperanza, aislamiento social o deterioro funcional que "
        "sugieren la necesidad de intervención profesional."
    ),
    RiskLevel.ROJO: (
        "Riesgo alto o inminente. Se detectan indicadores de ideación "
        "suicida activa, autolesión, plan suicida o peligro inmediato. "
        "Requiere activación del protocolo de crisis y derivación "
        "inmediata a servicios de emergencia."
    ),
}

# Orden de prioridad para la comparación (mayor valor → mayor riesgo).
_RISK_PRIORITY: dict[RiskLevel, int] = {
    RiskLevel.VERDE: 0,
    RiskLevel.AMARILLO: 1,
    RiskLevel.NARANJA: 2,
    RiskLevel.ROJO: 3,
}


# ------------------------------------------------------------------ #
# Funciones públicas
# ------------------------------------------------------------------ #


def classify_urgency(indicators: list[str]) -> UrgencyStage:
    """Clasifica una lista de indicadores en la etapa de urgencia más alta.

    Recorre cada indicador detectado, resuelve su nivel de riesgo y
    devuelve la ``UrgencyStage`` correspondiente al nivel **más alto**
    encontrado.  Si algún indicador pertenece a ``ROJO``, el resultado
    es ``ROJO`` sin importar los demás.

    Args:
        indicators: Lista de cadenas con nombres de indicadores
            detectados (e.g. ``['estres_academico', 'autolesion']``).

    Returns:
        ``UrgencyStage`` con el nivel más alto, los indicadores que
        coincidieron con ese nivel, y su descripción.
    """
    if not indicators:
        return UrgencyStage(
            stage=RiskLevel.VERDE,
            indicators=_INDICATORS_BY_LEVEL[RiskLevel.VERDE],
            description=_STAGE_DESCRIPTIONS[RiskLevel.VERDE],
        )

    highest_level = RiskLevel.VERDE
    matched_by_level: dict[RiskLevel, list[str]] = {}

    for indicator in indicators:
        level = _LEVEL_BY_INDICATOR.get(indicator)
        if level is None:
            # Indicador desconocido: se ignora de forma segura.
            continue

        matched_by_level.setdefault(level, []).append(indicator)

        if _RISK_PRIORITY[level] > _RISK_PRIORITY[highest_level]:
            highest_level = level

    # Los indicadores reportados son los que pertenecen al nivel más alto.
    matched_indicators = matched_by_level.get(highest_level, [])

    return UrgencyStage(
        stage=highest_level,
        indicators=matched_indicators,
        description=_STAGE_DESCRIPTIONS[highest_level],
    )


def should_override(stage: UrgencyStage) -> bool:
    """Determina si la etapa de urgencia requiere activar un override.

    Un override fuerza al sistema a devolver una respuesta de crisis
    fija, **sin pasar por el LLM**, cuando el riesgo es máximo.

    Args:
        stage: La etapa de urgencia evaluada.

    Returns:
        ``True`` si la etapa es ``ROJO``; ``False`` en caso contrario.
    """
    return stage.stage == RiskLevel.ROJO


def get_recommended_action(stage: UrgencyStage) -> str:
    """Devuelve la acción recomendada para la etapa de urgencia dada.

    Las acciones provienen de ``URGENCY_STAGES`` definido en
    ``constant.py``.

    Args:
        stage: La etapa de urgencia evaluada.

    Returns:
        Cadena con la acción recomendada para el nivel de riesgo.
    """
    return URGENCY_STAGES.get(stage.stage, URGENCY_STAGES[RiskLevel.VERDE])


def get_stage_description(level: RiskLevel) -> str:
    """Devuelve una descripción legible en español del nivel de riesgo.

    Args:
        level: El nivel de riesgo a describir.

    Returns:
        Cadena descriptiva del nivel.  Si el nivel no está mapeado,
        devuelve una descripción genérica.
    """
    return _STAGE_DESCRIPTIONS.get(
        level,
        "Nivel de riesgo no reconocido. Consulte con un profesional.",
    )
