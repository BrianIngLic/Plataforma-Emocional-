"Motor determinista de triage para clasificación de riesgo en salud mental. Todas las decisiones de seguridad son deterministas e independientes del LLM."


from .constant import RiskLevel, OverrideSource, CRISIS_RESOURCES
from .models import (
    UserMessage,
    RiskAssessment,
    UrgencyStage,
    OverrideSignal,
    TriageResult,
    SessionState,
)
from .classifier import classify, normalize_text
from .scales import classify_urgency, should_override, get_recommended_action
from .overrides import evaluate_override, build_crisis_response, get_crisis_message
from .engine import TriageEngine, quick_triage

__all__ = [
    "RiskLevel",
    "OverrideSource",
    "CRISIS_RESOURCES",
    "UserMessage",
    "RiskAssessment",
    "UrgencyStage",
    "OverrideSignal",
    "TriageResult",
    "SessionState",
    "classify",
    "normalize_text",
    "classify_urgency",
    "should_override",
    "get_recommended_action",
    "evaluate_override",
    "build_crisis_response",
    "get_crisis_message",
    "TriageEngine",
    "quick_triage",
]

__version__ = "1.0.0"
