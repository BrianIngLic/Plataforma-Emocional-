# Guía de Operación y Desarrollo

Esta guía describe cómo configurar, ejecutar, probar y administrar el **Ecosistema de Asistencia Emocional** utilizando el `Makefile` y los scripts incluidos en el repositorio.

---

## 1. Requisitos del Sistema

* **Sistema Operativo**: Linux (Debian, Ubuntu, Rocky Linux, Rocky/RHEL o Fedora)
* **Lenguaje**: Python 3.10 o superior
* **Motor de Contenedores**: Docker y Docker Compose (Opcional, para ruta de producción contenerizada)
* **Hardware Mínimo**:
  * Para desarrollo (sin Ollama local): 4 GB RAM, CPU de 2 núcleos.
  * Para producción/local con Qwen 2.5 14B: 16 GB RAM mínimo, GPU dedicada NVIDIA con soporte Vulkan (ej. 8GB+ VRAM) altamente recomendado.

---

## 2. Automatización con Makefile

El proyecto incluye un `Makefile` en la raíz para estandarizar y simplificar las tareas de desarrollo y operaciones. A continuación se detallan los comandos disponibles:

### Comandos de Configuración e Instalación
* **`make install`**: Ejecuta el instalador interactivo `./setup.sh`, configurando el entorno virtual de Python, las dependencias y el archivo `.env`.

### Comandos de Ejecución y Diagnóstico
* **`make run`**: Ejecuta la demostración interactiva en terminal del motor de triage (`python3 engine.py`).
* **`make test`**: Ejecuta la suite de pruebas unitarias (`unittest`) para verificar la integridad del motor determinista.
* **`make check-gpu`**: Ejecuta la auditoría de hardware para verificar el estado de la GPU NVIDIA, drivers y soporte de contenedores.
* **`make smoke-test`**: Valida de forma rápida la salud y conectividad de los componentes del sistema (Ollama y ChromaDB si están encendidos).

### Comandos de Contenedores (Docker)
* **`make docker-up`**: Levanta toda la infraestructura contenerizada (Ollama, Backend FastAPI y base de datos ChromaDB) en segundo plano usando Docker Compose.
* **`make docker-down`**: Detiene y remueve los contenedores y redes del ecosistema.
* **`make docker-logs`**: Muestra los logs en tiempo real de todos los contenedores activos.

---

## 3. Estructura de Scripts (`scripts/`)

El sistema cuenta con scripts automatizados en Bash para realizar operaciones críticas:
* **`scripts/check_gpu.sh`**: Evalúa si el host tiene instalado el `nvidia-container-toolkit` y si la tarjeta de video está disponible tanto nativa como para Docker.
* **`scripts/smoke_test.sh`**: Realiza peticiones `curl` y validaciones para asegurar que los servicios de RAG y el LLM local respondan adecuadamente en los puertos asignados.
* **`scripts/install_systemd.sh`**: Encapsula la instalación del motor de triage como un servicio del sistema que se auto-inicia ante reinicios del servidor físico.

---

## 4. Estructura del Repositorio

```
.
├── constant.py          # Términos, patrones de riesgo y recursos oficiales
├── models.py            # Dataclasses de la sesión y triage
├── classifier.py        # Clasificador conversacional determinista (Pre-LLM)
├── scales.py            # Etapas de urgencia y escalas
├── overrides.py         # Respuestas fijas de crisis y bypass
├── engine.py            # Orquestador del motor de triage (TriageEngine)
├── contract.json        # Parámetros y reglas del comportamiento del LLM
├── setup.sh             # Script global de instalación y configuración
├── Makefile             # Comandos unificados
├── PROJECT_CONTEXT.md   # Justificación clínica y flujo arquitectónico
├── README_OPERATIVO.md  # Esta guía
├── PRODUCCION.md        # Guía detallada de despliegue en servidores reales
├── systemd/             # Definiciones de servicio de sistema
└── tests/               # Pruebas unitarias de integración
```
