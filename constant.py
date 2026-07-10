# -*- coding: utf-8 -*-
"""constant.py — Constantes del motor determinista de triaje emocional.

Contiene todos los valores fijos que el motor de triaje utiliza:
niveles de riesgo, términos de alerta, patrones metafóricos,
recursos de crisis y mapeo de etapas de urgencia.

Solo usa la biblioteca estándar de Python (stdlib).
"""

from __future__ import annotations

from enum import Enum

# ──────────────────────────────────────────────────────────────
# 1. Enumeraciones
# ──────────────────────────────────────────────────────────────


class RiskLevel(Enum):
    """Nivel de riesgo del usuario según el triaje.

    Sigue un esquema semáforo de cuatro colores:
    - VERDE:    sin riesgo detectado.
    - AMARILLO: señales de malestar moderado.
    - NARANJA:  riesgo elevado, requiere atención clínica.
    - ROJO:     crisis activa, respuesta inmediata.
    """

    VERDE = "verde"
    AMARILLO = "amarillo"
    NARANJA = "naranja"
    ROJO = "rojo"


class OverrideSource(Enum):
    """Origen que puede activar un override de nivel de riesgo.

    - PHQ9_ITEM9:                 Ítem 9 del PHQ‑9 (ideación suicida).
    - CONVERSATIONAL_CLASSIFIER:  Clasificador conversacional del motor.
    - MANUAL:                     Activado manualmente por un operador.
    - URGENCY_SCALE:              Escala de urgencia complementaria.
    """

    PHQ9_ITEM9 = "phq9_item9"
    CONVERSATIONAL_CLASSIFIER = "conversational_classifier"
    MANUAL = "manual"
    URGENCY_SCALE = "urgency_scale"


# ──────────────────────────────────────────────────────────────
# 2. Términos de riesgo alto (ideación suicida / autolesión)
# ──────────────────────────────────────────────────────────────

HIGH_RISK_TERMS: frozenset[str] = frozenset(
    {
        # Declaraciones directas de ideación suicida
        "quiero morir",
        "me quiero matar",
        "quiero suicidarme",
        "acabar con todo",
        "no quiero seguir viviendo",
        "me voy a matar",
        "quiero quitarme la vida",
        "ya no quiero estar aquí",
        "mejor me muero",
        "no vale la pena vivir",
        "deseo morir",
        "pienso en la muerte",
        "sería mejor estar muerto",
        # Autolesión
        "me quiero cortar",
        "me quiero hacer daño",
        "quiero lastimarme",
        "me estoy cortando",
        "me hago daño",
        "me corto a propósito",
        # Variantes informales / chat
        "kiero morir",
        "ya no kiero vivir",
        "me kiero matar",
        "qiero morirme",
        "ya no kiero estar aquí",
        # Daño a terceros + suicidio
        "matar y luego matarme",
        "matarlos a los dos",
        "los mato y me mato",
    }
)

# ──────────────────────────────────────────────────────────────
# 3. Términos de riesgo medio (desesperanza, aislamiento)
# ──────────────────────────────────────────────────────────────

MEDIUM_RISK_TERMS: frozenset[str] = frozenset(
    {
        "no tiene sentido",
        "nadie me quiere",
        "estoy solo",
        "no puedo más",
        "estoy harto de todo",
        "ya no aguanto",
        "soy una carga",
        "estarían mejor sin mí",
        "no sirvo para nada",
        "todo es mi culpa",
        "me siento vacío",
        "no hay salida",
        "estoy atrapado",
        "nadie me entiende",
        "no me importa nada",
    }
)

# ──────────────────────────────────────────────────────────────
# 4. Patrones metafóricos
# ──────────────────────────────────────────────────────────────

METAPHORIC_PATTERNS: list[dict[str, object]] = [
    {
        "name": "kill_self_reference",
        "primary_terms": ["matar", "asesinar", "eliminar", "destruir"],
        "context_terms": [
            "yo",
            "mi",
            "me",
            "conmigo",
            "sacrificio",
            "culpa",
            "propio",
        ],
        "description": (
            "Detecta expresiones donde verbos de violencia letal coexisten "
            "con referencias a uno mismo (p.ej. 'la quise matar… mi propio "
            "sacrificio')."
        ),
    },
    {
        "name": "disappear_others_better_off",
        "primary_terms": ["desaparecer", "irme", "desvanecerme", "esfumarme"],
        "context_terms": [
            "mejor",
            "favor",
            "sin mí",
            "estarían",
            "carga",
            "estorbo",
        ],
        "description": (
            "Detecta fantasías de desaparición ligadas a la creencia de que "
            "otros estarían mejor sin la persona (p.ej. 'si desapareciera… "
            "te haría un favor')."
        ),
    },
    {
        "name": "abyss_void_sacrifice",
        "primary_terms": ["abismo", "vacío", "fondo", "oscuridad", "pozo"],
        "context_terms": [
            "sacrificio",
            "matarme",
            "matarlos",
            "acabar",
            "culpa",
            "caer",
        ],
        "description": (
            "Detecta metáforas de caída o vacío combinadas con ideación "
            "violenta o de sacrificio (p.ej. 'fondo del abismo… pensé en "
            "matarlos')."
        ),
    },
    {
        "name": "blood_cut_emotional_relief",
        "primary_terms": ["sangre", "cortar", "herida", "navaja", "cuchillo"],
        "context_terms": [
            "alivio",
            "paz",
            "calma",
            "sentir",
            "dolor",
            "risa",
            "mi",
        ],
        "description": (
            "Detecta menciones de sangre o corte asociadas a búsqueda de "
            "alivio emocional (p.ej. 'si con mi sangre… robaba tu risa')."
        ),
    },
    {
        "name": "bury_end_self_erasure",
        "primary_terms": [
            "enterrar",
            "sepultar",
            "borrar",
            "desdibujar",
            "desaparecer",
        ],
        "context_terms": [
            "yo",
            "quien era",
            "mi nombre",
            "mi vida",
            "existencia",
            "recuerdo",
            "me",
        ],
        "description": (
            "Detecta deseos de auto‑borrado o eliminación simbólica de la "
            "propia identidad (p.ej. 'enterré a quien era… desdibujar')."
        ),
    },
]

# ──────────────────────────────────────────────────────────────
# 5. Reemplazos de escritura informal en español
# ──────────────────────────────────────────────────────────────

INFORMAL_REPLACEMENTS: dict[str, str] = {
    "kiero": "quiero",
    "qiero": "quiero",
    "xq": "porque",
    "xk": "porque",
    "tmb": "también",
    "bn": "bien",
    "noc": "no sé",
    "x": "por",
    "q": "que",
    "k": "que",
    "pq": "porque",
    "d": "de",
}

# ──────────────────────────────────────────────────────────────
# 6. Recursos de crisis (datos verificados del proyecto)
# ──────────────────────────────────────────────────────────────

CRISIS_RESOURCES: list[dict[str, str]] = [
    {
        "name": "Línea de la Vida (Secretaría de Salud)",
        "phone": "800 911 2000",
        "hours": "24 horas, 365 días",
        "cost": "Gratuito",
        "service": (
            "Prevención de adicciones, depresión, ansiedad, riesgo suicida"
        ),
    },
    {
        "name": "Emergencias (número universal)",
        "phone": "911",
        "hours": "24 horas, 365 días",
        "cost": "Gratuito",
        "service": (
            "Emergencias que representen peligro inmediato para la vida"
        ),
    },
    {
        "name": "Línea de Atención a Crisis Emocional BUAP",
        "phone": "222 344 8905",
        "hours": "Lunes a domingo, 9:00 a 21:00 horas",
        "cost": "Gratuito (requiere matrícula activa)",
        "service": (
            "Contención psicológica vía telefónica para estudiantes BUAP"
        ),
    },
    {
        "name": "Instituto de la Juventud del Municipio de Puebla (IJMP)",
        "phone": "222 213 0002",
        "hours": "Lunes a viernes, 9:00 a 15:00 horas",
        "cost": "Gratuito (jóvenes 15-29 años)",
        "service": "Atención psicológica presencial",
    },
]

# ──────────────────────────────────────────────────────────────
# 7. Etapas de urgencia por nivel de riesgo
# ──────────────────────────────────────────────────────────────

URGENCY_STAGES: dict[RiskLevel, str] = {
    RiskLevel.VERDE: "conversacion_libre",
    RiskLevel.AMARILLO: "monitoreo_aumentado",
    RiskLevel.NARANJA: "rag_clinico_obligatorio",
    RiskLevel.ROJO: "crisis_response_fija",
}
