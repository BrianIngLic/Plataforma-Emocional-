#!/usr/bin/env bash
# ==============================================================================
# TEST DE HUMO (SMOKE TEST)
# ==============================================================================
# Valida la disponibilidad de los servicios externos (Ollama y ChromaDB)
# ==============================================================================

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # Sin color

# Cargar variables de entorno del archivo .env si existe
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
    echo -e "Cargando configuración desde $ENV_FILE"
    # Exportar variables sin comentarios
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

OLLAMA_URL=${OLLAMA_HOST:-"http://localhost:11434"}
CHROMA_URL=${CHROMA_HOST:-"http://localhost:8000"}

echo -e "\n=== Iniciando Test de Humo ==="

# 1. Verificar Ollama
echo -n "1. Conectando con Ollama ($OLLAMA_URL)... "
if curl -s --connect-timeout 3 "$OLLAMA_URL/api/tags" >/dev/null; then
    echo -e "${GREEN}CONECTADO (Ollama Activo)${NC}"
    # Imprimir modelos instalados
    echo "   Modelos disponibles:"
    curl -s "$OLLAMA_URL/api/tags" | grep -o '"name":"[^"]*"' | sed 's/"name":/      - /g' || echo "      - Ninguno"
else
    echo -e "${YELLOW}NO SE LOGRÓ CONECTAR${NC}"
    echo "   * Verifique que Ollama esté corriendo: 'ollama serve' o el contenedor Docker."
fi

# 2. Verificar ChromaDB
echo -n "2. Conectando con ChromaDB ($CHROMA_URL)... "
# Intentar endpoint heartbeat o version
if curl -s --connect-timeout 3 "$CHROMA_URL/api/v1/heartbeat" >/dev/null; then
    echo -e "${GREEN}CONECTADO (ChromaDB Activo)${NC}"
else
    echo -e "${YELLOW}NO SE LOGRÓ CONECTAR${NC}"
    echo "   * Verifique que el servicio de ChromaDB esté encendido."
fi

# 3. Verificar motor de triage
echo -n "3. Validando ejecución del Motor de Triage local... "
if python3 -c "import engine; print('OK')" >/dev/null 2>&1; then
    echo -e "${GREEN}COMPILACIÓN OK (Importación exitosa)${NC}"
else
    echo -e "${RED}ERROR DE IMPORTACIÓN${NC}"
    echo "   * Verifique que tiene las dependencias instaladas y está dentro del entorno virtual."
fi

echo -e "\n=== Test de Humo Completado ==="
