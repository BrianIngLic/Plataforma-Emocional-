import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Núcleo y Backend Ecosistema de Asistencia Emocional",
    description="API Core"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "active",
        "infrastructure": "Hybrid (Fedora + eGPU local / Cloud Inference)",
        "groq_connected": bool(os.getenv("GROQ_API_KEY")),
        "openrouter_ready": bool(os.getenv("OPENROUTER_API_KEY")),
    }
