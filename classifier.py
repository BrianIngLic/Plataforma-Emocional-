"""classifier.py — Clasificador determinista de riesgo pre-LLM.

Este módulo es la **capa crítica de seguridad** que se ejecuta ANTES de
que cualquier mensaje del usuario llegue al modelo generativo (Qwen).
Debe ser **determinista y rápido**: no depende de modelos estadísticos
ni de llamadas a APIs externas.

Flujo de clasificación
----------------------
1. **Normalización** — Minúsculas, eliminación de acentos, reemplazo
   de expresiones informales (``q`` → ``que``, etc.) con fronteras de
   palabra para evitar falsos positivos.
2. **Términos literales** — Búsqueda directa de ``HIGH_RISK_TERMS`` y
   ``MEDIUM_RISK_TERMS`` en el texto normalizado.
3. **Patrones metafóricos** — Detección de co-ocurrencia de términos
   primarios + contextuales en ventanas de 2 oraciones consecutivas.
4. **Clasificación final** — Se devuelve el nivel más alto detectado.
"""

from __future__ import annotations

import re
import unicodedata

from constant import (
    RiskLevel,
    HIGH_RISK_TERMS,
    MEDIUM_RISK_TERMS,
    METAPHORIC_PATTERNS,
    INFORMAL_REPLACEMENTS,
)
from models import RiskAssessment

# Precompilamos los patrones de reemplazo informal una sola vez.
# Cada clave se envuelve en ``\b…\b`` para respetar fronteras de
# palabra (e.g. 'k' solo coincide con la palabra aislada "k", no con
# la letra "k" dentro de "kilo").
_INFORMAL_RE: list[tuple[re.Pattern[str], str]] = [
    (re.compile(rf"\b{re.escape(src)}\b", re.IGNORECASE), dst)
    for src, dst in INFORMAL_REPLACEMENTS.items()
]

# Patrón para dividir el texto en oraciones.
_SENTENCE_SPLIT_RE: re.Pattern[str] = re.compile(
    r"[.!?\n]|\.{2,}"
)


# ------------------------------------------------------------------ #
# Normalización de texto
# ------------------------------------------------------------------ #


def normalize_text(text: str) -> str:
    """Normaliza el texto del usuario para la clasificación.

    Pasos:
    1. Convierte a minúsculas.
    2. Elimina marcas diacríticas (acentos) via descomposición NFD.
    3. Aplica reemplazos informales con fronteras de palabra.
    4. Colapsa espacios en blanco múltiples.

    Args:
        text: Texto crudo del usuario.

    Returns:
        Texto limpio y normalizado, listo para las etapas de detección.

    Examples:
        >>> normalize_text("Estoy MUY triste y no sé qué hacer")
        'estoy muy triste y no se que hacer'
    """
    # 1. Minúsculas
    text = text.lower()

    # 2. Eliminar acentos (NFD → filtrar categoría Mn → recomponer)
    nfkd = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in nfkd if unicodedata.category(ch) != "Mn")

    # 3. Reemplazos informales (con word boundaries)
    for pattern, replacement in _INFORMAL_RE:
        text = pattern.sub(replacement, text)

    # 4. Colapsar espacios
    text = re.sub(r"\s+", " ", text).strip()

    return text


# ------------------------------------------------------------------ #
# Detección de términos literales
# ------------------------------------------------------------------ #


def check_literal_terms(
    normalized_text: str,
) -> tuple[RiskLevel, list[str]]:
    """Busca términos de riesgo alto y medio en el texto normalizado.

    Primero revisa ``HIGH_RISK_TERMS`` (nivel ROJO).  Si encuentra al
    menos uno, retorna inmediatamente sin revisar los de riesgo medio.
    Si no encuentra ninguno de riesgo alto, revisa ``MEDIUM_RISK_TERMS``
    (nivel NARANJA).

    Args:
        normalized_text: Texto ya normalizado por ``normalize_text``.

    Returns:
        Tupla ``(RiskLevel, matched_terms)`` donde *matched_terms* es
        la lista de cadenas encontradas en el texto.
    """
    # --- Riesgo alto (ROJO) ---
    high_matches: list[str] = [
        term for term in HIGH_RISK_TERMS if term in normalized_text
    ]
    if high_matches:
        return RiskLevel.ROJO, high_matches

    # --- Riesgo medio (NARANJA) ---
    medium_matches: list[str] = [
        term for term in MEDIUM_RISK_TERMS if term in normalized_text
    ]
    if medium_matches:
        return RiskLevel.NARANJA, medium_matches

    return RiskLevel.VERDE, []


# ------------------------------------------------------------------ #
# Detección de patrones metafóricos
# ------------------------------------------------------------------ #


def check_metaphoric_patterns(
    normalized_text: str,
) -> tuple[RiskLevel, list[str]]:
    """Detecta patrones metafóricos de riesgo en el texto.

    Para cada patrón en ``METAPHORIC_PATTERNS``:
    1. Divide el texto en oraciones.
    2. Examina cada par de oraciones consecutivas (ventana de 2).
    3. Si dentro de la ventana co-ocurren al menos un *primary_term*
       y al menos un *context_term*, el patrón se considera detectado.

    Si cualquier patrón coincide, el resultado es ``ROJO``.

    Args:
        normalized_text: Texto ya normalizado.

    Returns:
        Tupla ``(RiskLevel, matched_pattern_names)``.
    """
    # Dividir en oraciones; filtrar vacías.
    sentences: list[str] = [
        s.strip()
        for s in _SENTENCE_SPLIT_RE.split(normalized_text)
        if s.strip()
    ]

    matched_patterns: list[str] = []

    for pattern in METAPHORIC_PATTERNS:
        pattern_name: str = pattern["name"]
        primary_terms: list[str] = pattern["primary_terms"]
        context_terms: list[str] = pattern["context_terms"]

        if _pattern_found_in_sentences(sentences, primary_terms, context_terms):
            matched_patterns.append(pattern_name)

    if matched_patterns:
        return RiskLevel.ROJO, matched_patterns

    return RiskLevel.VERDE, []


def _pattern_found_in_sentences(
    sentences: list[str],
    primary_terms: list[str],
    context_terms: list[str],
) -> bool:
    """Comprueba co-ocurrencia en ventanas de 2 oraciones consecutivas.

    Si solo hay una oración, esa oración se evalúa sola como ventana.

    Args:
        sentences: Lista de oraciones del texto.
        primary_terms: Términos primarios del patrón.
        context_terms: Términos contextuales del patrón.

    Returns:
        ``True`` si se detecta co-ocurrencia en alguna ventana.
    """
    if not sentences:
        return False

    # Si solo hay una oración, evaluar esa sola.
    if len(sentences) == 1:
        window = sentences[0]
        return _has_cooccurrence(window, primary_terms, context_terms)

    # Ventana deslizante de 2 oraciones.
    for i in range(len(sentences) - 1):
        window = sentences[i] + " " + sentences[i + 1]
        if _has_cooccurrence(window, primary_terms, context_terms):
            return True

    return False


def _has_cooccurrence(
    window: str,
    primary_terms: list[str],
    context_terms: list[str],
) -> bool:
    """Verifica si la ventana contiene al menos un término primario y uno contextual."""
    has_primary = any(term in window for term in primary_terms)
    has_context = any(term in window for term in context_terms)
    return has_primary and has_context


# ------------------------------------------------------------------ #
# Clasificación principal
# ------------------------------------------------------------------ #


def classify(text: str) -> RiskAssessment:
    """Clasifica el riesgo de un mensaje de texto del usuario.

    Ejecuta la cadena completa de detección en orden de prioridad:

    1. Normaliza el texto.
    2. Busca términos literales de riesgo alto → retorna ``ROJO``.
    3. Busca patrones metafóricos → retorna ``ROJO``.
    4. Si la búsqueda literal arrojó ``NARANJA``, retorna ``NARANJA``.
    5. Si nada fue detectado, retorna ``VERDE``.

    Args:
        text: Texto crudo del usuario (sin normalizar).

    Returns:
        ``RiskAssessment`` con el nivel, fuente, términos y patrones
        detectados, y una nota de confianza.
    """
    normalized = normalize_text(text)

    # --- 1. Términos literales ---
    literal_level, literal_terms = check_literal_terms(normalized)

    if literal_level == RiskLevel.ROJO:
        return RiskAssessment(
            level=RiskLevel.ROJO,
            source="literal_match",
            matched_terms=literal_terms,
            matched_patterns=[],
            confidence_note=(
                "Coincidencia directa con términos de riesgo alto. "
                "Clasificación determinista de máxima prioridad."
            ),
        )

    # --- 2. Patrones metafóricos ---
    metaphoric_level, matched_patterns = check_metaphoric_patterns(normalized)

    if metaphoric_level == RiskLevel.ROJO:
        return RiskAssessment(
            level=RiskLevel.ROJO,
            source="metaphoric_pattern",
            matched_terms=[],
            matched_patterns=matched_patterns,
            confidence_note=(
                "Co-ocurrencia de términos primarios y contextuales "
                "detectada en ventana de oraciones consecutivas."
            ),
        )

    # --- 3. Riesgo medio ---
    if literal_level == RiskLevel.NARANJA:
        return RiskAssessment(
            level=RiskLevel.NARANJA,
            source="medium_risk_match",
            matched_terms=literal_terms,
            matched_patterns=[],
            confidence_note=(
                "Coincidencia con términos de riesgo medio. "
                "Se recomienda seguimiento profesional."
            ),
        )

    # --- 4. Sin riesgo ---
    return RiskAssessment(
        level=RiskLevel.VERDE,
        source="no_risk_detected",
        matched_terms=[],
        matched_patterns=[],
        confidence_note=(
            "No se detectaron indicadores de riesgo en el texto. "
            "El mensaje puede continuar al modelo generativo."
        ),
    )
