import os
import sys
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Permitir que importe del directorio padre (donde está el motor de triage)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine import TriageEngine
from models import UserMessage

app = FastAPI(
    title="Ecosistema de Asistencia Emocional - Backend API",
    description="API para clasificar y enrutar mensajes a través del Motor Determinista de Triage.",
    version="1.0.0"
)

# Inicializar motor global de triage
engine = TriageEngine()

class MessageRequest(BaseModel):
    session_id: str
    text: str

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "triage-backend"}

@app.post("/triage")
def post_triage(request: MessageRequest):
    try:
        msg = UserMessage(session_id=request.session_id, text=request.text)
        result = engine.triage(msg)
        
        # Convertir resultado a estructura serializable
        return {
            "session_id": result.session_id,
            "risk_level": result.risk_assessment.level.value,
            "source": result.risk_assessment.source,
            "matched_terms": list(result.risk_assessment.matched_terms),
            "matched_patterns": list(result.risk_assessment.matched_patterns),
            "override_active": result.override.active,
            "override_source": result.override.source.value if result.override.source else None,
            "override_reason": result.override.reason,
            "recommended_action": result.recommended_action,
            "crisis_resources": result.crisis_resources
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
