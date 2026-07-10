#!/usr/bin/env bash
# ==============================================================================
# DIAGNÓSTICO DE ACELERACIÓN DE HARDWARE (GPU / VULKAN)
# ==============================================================================
# Verifica si la GPU NVIDIA y el NVIDIA Container Toolkit están instalados.
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # Sin color

echo -e "=== Diagnóstico de Aceleración de Hardware ==="

# 1. Verificar GPU NVIDIA local
echo -n "1. Detectando GPU NVIDIA... "
if command -v nvidia-smi >/dev/null 2>&1; then
    echo -e "${GREEN}DETECTADA${NC}"
    nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
else
    echo -e "${YELLOW}NO DETECTADA (nvidia-smi no disponible)${NC}"
    echo "   * Ollama se ejecutará en modo CPU nativo o dependerá de Vulkan/APUs si están disponibles."
fi

# 2. Verificar NVIDIA Container Toolkit (Para Docker)
echo -n "2. Detectando NVIDIA Container Toolkit... "
if command -v nvidia-ctk >/dev/null 2>&1; then
    echo -e "${GREEN}INSTALADO${NC}"
    nvidia-ctk --version | head -n 1
else
    echo -e "${YELLOW}NO INSTALADO${NC}"
    echo "   * Si planea usar Docker, el contenedor no podrá acceder a la GPU."
    echo "   * Instale 'nvidia-container-toolkit' para habilitar acceso en contenedores."
fi

# 3. Verificar configuración de GPU en Docker (opcional)
echo -n "3. Validando acceso a GPU desde Docker... "
if command -v docker >/dev/null 2>&1; then
    # Revisar si el daemon de Docker puede arrancar con gpu
    if docker run --help | grep -iq "gpus"; then
        echo -e "${GREEN}CONFIGURADO EN DOCKER${NC}"
    else
        echo -e "${YELLOW}NO CONFIGURADO O SIN SOPORTE DE GPUS EN DOCKER${NC}"
    fi
else
    echo -e "${NC}DOCKER NO INSTALADO${NC}"
fi

# 4. Verificar soporte de Vulkan (para APU/GPU alternativa)
echo -n "4. Detectando soporte de Vulkan... "
if command -v vulkaninfo >/dev/null 2>&1 || ldconfig -p | grep -qi vulkan; then
    echo -e "${GREEN}SOPORTE ENCONTRADO${NC}"
else
    echo -e "${YELLOW}SOPORTE NO ENCONTRADO EN SYSTEM PATH${NC}"
    echo "   * Nota: Ollama puede usar Vulkan para aceleración de gráficos en CPUs compatibles."
fi

echo -e "\n=== Diagnóstico Completado ==="
