# -*- coding: utf-8 -*-
"""models.py — Modelos de datos del motor determinista de triaje emocional.

Define las estructuras que fluyen por el motor:
mensajes de usuario, evaluaciones de riesgo, señales de override,
resultados de triaje y estado de sesión.

Solo usa la biblioteca estándar de Python (stdlib).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from constant import OverrideSource, RiskLevel


# ──────────────────────────────────────────────────────────────
# 1. Mensaje de usuario
# ──────────────────────────────────────────────────────────────


@dataclass
class UserMessage:
    """Representa un mensaje individual enviado por el usuario.

    Attributes:
        session_id: Identificador único de la sesión activa.
        text:       Contenido textual del mensaje.
        timestamp:  Marca temporal ISO-8601 (se genera automáticamente).
    """

    session_id: str
    text: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


# ──────────────────────────────────────────────────────────────
# 2. Evaluación de riesgo
# ──────────────────────────────────────────────────────────────


@dataclass
class RiskAssessment:
    """Resultado de la evaluación de riesgo sobre un mensaje.

    Attributes:
        level:            Nivel de riesgo determinado (:class:`RiskLevel`).
        source:           Componente que generó la evaluación (p.ej.
                          ``'keyword_scanner'``, ``'phq9'``).
        matched_terms:    Términos literales detectados en el texto.
        matched_patterns: Nombres de patrones metafóricos activados.
        confidence_note:  Nota libre sobre la confianza de la evaluación.
    """

    level: RiskLevel
    source: str
    matched_terms: list[str] = field(default_factory=list)
    matched_patterns: list[str] = field(default_factory=list)
    confidence_note: str = ""


# ──────────────────────────────────────────────────────────────
# 3. Etapa de urgencia
# ──────────────────────────────────────────────────────────────


@dataclass
class UrgencyStage:
    """Etapa de urgencia derivada del nivel de riesgo.

    Attributes:
        stage:       Nivel asociado a esta etapa (:class:`RiskLevel`).
        indicators:  Indicadores que motivaron la asignación.
        description: Descripción legible de la etapa.
    """

    stage: RiskLevel
    indicators: list[str] = field(default_factory=list)
    description: str = ""


# ──────────────────────────────────────────────────────────────
# 4. Señal de override
# ──────────────────────────────────────────────────────────────


@dataclass
class OverrideSignal:
    """Señal que fuerza una escalada de nivel de riesgo.

    Attributes:
        active:       ``True`` si el override está vigente.
        source:       Origen de la señal (:class:`OverrideSource` o ``None``).
        reason:       Explicación textual del motivo.
        triggered_at: Marca temporal ISO-8601 de la activación.
    """

    active: bool
    source: OverrideSource | None = None
    reason: str = ""
    triggered_at: str = ""


# ──────────────────────────────────────────────────────────────
# 5. Resultado de triaje
# ──────────────────────────────────────────────────────────────


@dataclass
class TriageResult:
    """Resultado completo que el motor devuelve tras evaluar un mensaje.

    Attributes:
        risk_assessment:    Evaluación de riesgo asociada.
        override:           Señal de override (puede estar inactiva).
        recommended_action: Acción recomendada (valor de
                            :data:`constant.URGENCY_STAGES`).
        crisis_resources:   Recursos de crisis incluidos cuando el nivel
                            es ROJO.
        session_id:         Identificador de sesión (para trazabilidad).
    """

    risk_assessment: RiskAssessment
    override: OverrideSignal
    recommended_action: str
    crisis_resources: list[dict[str, str]] = field(default_factory=list)
    session_id: str = ""


# ──────────────────────────────────────────────────────────────
# 6. Estado de sesión
# ──────────────────────────────────────────────────────────────


@dataclass
class SessionState:
    """Estado mutable de una sesión de conversación.

    Mantiene el historial de mensajes, el nivel de riesgo actual y
    las señales de override activadas durante la sesión.

    Attributes:
        session_id:        Identificador único de la sesión.
        messages:          Historial de mensajes del usuario.
        current_risk:      Nivel de riesgo vigente.
        override_history:  Historial de señales de override.
        is_override_active: ``True`` si hay un override activo.
    """

    session_id: str
    messages: list[UserMessage] = field(default_factory=list)
    current_risk: RiskLevel = RiskLevel.VERDE
    override_history: list[OverrideSignal] = field(default_factory=list)
    is_override_active: bool = False

    def add_message(self, msg: UserMessage) -> None:
        """Agrega un mensaje al historial de la sesión.

        Args:
            msg: Instancia de :class:`UserMessage` a registrar.
        """
        self.messages.append(msg)

    def update_risk(self, level: RiskLevel) -> None:
        """Actualiza el nivel de riesgo actual de la sesión.

        El nivel solo puede mantenerse o escalar; nunca desciende
        mientras un override esté activo.

        Args:
            level: Nuevo nivel de riesgo.
        """
        if self.is_override_active:
            # Bajo override, solo se permite escalar.
            risk_order = list(RiskLevel)
            if risk_order.index(level) > risk_order.index(self.current_risk):
                self.current_risk = level
        else:
            self.current_risk = level

    def activate_override(self, signal: OverrideSignal) -> None:
        """Activa un override y lo registra en el historial.

        Establece ``is_override_active`` en ``True``, fuerza el nivel
        de riesgo a ROJO y guarda la señal en ``override_history``.

        Args:
            signal: Instancia de :class:`OverrideSignal` a activar.
        """
        self.is_override_active = True
        self.current_risk = RiskLevel.ROJO
        self.override_history.append(signal)
