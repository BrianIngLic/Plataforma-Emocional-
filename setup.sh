#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE INSTALACIÓN Y CONFIGURACIÓN (SETUP)
# ==============================================================================
# Configura el entorno virtual de Python, instala dependencias, configura variables
# de entorno y prepara los scripts auxiliares del ecosistema.
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "======================================================================"
echo -e "   Instalando Ecosistema de Asistencia Emocional - Configuración"
echo -e "======================================================================"

# 1. Comprobar Python
echo -n "Comprobando Python 3... "
if command -v python3 >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 -V | cut -d' ' -f2)
    echo -e "${GREEN}DETECTADO (${PYTHON_VERSION})${NC}"
else
    echo -e "${RED}ERROR: Python 3 no está instalado.${NC}" >&2
    exit 1
fi

# 2. Comprobar venv
echo -n "Comprobando soporte de entornos virtuales (venv)... "
if python3 -c "import venv" >/dev/null 2>&1; then
    echo -e "${GREEN}DISPONIBLE${NC}"
else
    echo -e "${RED}ERROR: El módulo 'venv' de Python no está instalado.${NC}" >&2
    echo "Instálelo en Debian/Ubuntu ejecutando: sudo apt install python3-venv" >&2
    exit 1
fi

# 3. Crear entorno virtual
echo "Creando entorno virtual '.venv'..."
python3 -m venv .venv
echo -e "${GREEN}Entorno virtual creado.${NC}"

# 4. Instalar dependencias
echo "Actualizando pip e instalando dependencias desde requirements.txt..."
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
echo -e "${GREEN}Dependencias instaladas correctamente.${NC}"

# 5. Configurar archivo .env
echo -n "Configurando archivo .env... "
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${GREEN}CREADO (copiado de .env.example)${NC}"
    echo "   * Modifique el archivo '.env' si necesita cambiar puertos o configurar la GPU."
else
    echo -e "${YELLOW}EXISTENTE (no modificado)${NC}"
fi

# 6. Hacer ejecutables los scripts
chmod +x scripts/*.sh 2>/dev/null || true

# 7. Ejecutar diagnóstico de hardware
echo -e "\nEjecutando diagnóstico de GPU..."
./scripts/check_gpu.sh

# 8. Ejecutar instalador de Systemd
echo -e "\nConfigurando servicio Systemd..."
./scripts/install_systemd.sh

echo -e "\n======================================================================"
echo -e "${GREEN}¡CONFIGURACIÓN COMPLETADA CON ÉXITO!${NC}"
echo -e "======================================================================"
echo -e "Para comenzar:"
echo -e "  1. Active el entorno virtual:  source .venv/bin/activate"
echo -e "  2. Ejecute la demostración:    make run"
echo -e "  3. Corra las pruebas:          make test"
echo -e "======================================================================"
