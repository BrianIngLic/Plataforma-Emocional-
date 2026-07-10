#!/usr/bin/env bash
# ==============================================================================
# INSTALADOR DEL SERVICIO SYSTEMD (Triage Engine)
# ==============================================================================
# Genera y configura el archivo de servicio systemd.
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="triage-engine"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
LOCAL_SERVICE_FILE="${PROJECT_DIR}/systemd/${SERVICE_NAME}.service"

echo "=== Instalador del Servicio Systemd ==="

# Asegurar que existe la carpeta systemd local
mkdir -p "${PROJECT_DIR}/systemd"

# Generar archivo de servicio local
echo "Generando archivo de servicio local en: ${LOCAL_SERVICE_FILE}..."
cat <<EOF > "${LOCAL_SERVICE_FILE}"
[Unit]
Description=Ecosistema de Asistencia Emocional - Motor de Triage
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${PROJECT_DIR}
ExecStart=${PROJECT_DIR}/.venv/bin/python3 ${PROJECT_DIR}/engine.py
Restart=always
RestartSec=5
Environment=PYTHONPATH=${PROJECT_DIR}

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}Archivo local generado exitosamente.${NC}"

# Intentar instalar en el sistema
echo -e "\nIntentando copiar el archivo a ${SERVICE_FILE}..."
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}ADVERTENCIA: No se está ejecutando como ROOT (sudo).${NC}"
    echo "Para instalar el servicio de forma permanente en el sistema, ejecute:"
    echo "  sudo cp ${LOCAL_SERVICE_FILE} ${SERVICE_FILE}"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable ${SERVICE_NAME}.service"
    echo "  sudo systemctl start ${SERVICE_NAME}.service"
else
    cp "${LOCAL_SERVICE_FILE}" "${SERVICE_FILE}"
    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}.service"
    systemctl start "${SERVICE_NAME}.service"
    echo -e "${GREEN}Servicio de Systemd instalado, habilitado y arrancado exitosamente.${NC}"
fi

echo -e "\n=== Proceso de Systemd Completado ==="
