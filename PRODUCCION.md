# Manual de Despliegue en Producción y Políticas de Seguridad

Este documento detalla los procedimientos recomendados para desplegar, operar y asegurar el **Ecosistema de Asistencia Emocional** en entornos de producción y servidores institucionales.

---

## 1. Planificación de Infraestructura

El sistema requiere desplegar tres servicios principales (Motor de Triage/FastAPI, base de datos ChromaDB y Ollama con Qwen 2.5).

### Requisitos de Hardware para Producción

| Componente | Requisito Recomendado | Rol |
| :--- | :--- | :--- |
| **CPU** | 8 núcleos (Xeon / Epyc / Ryzen) | Procesamiento general y base de datos vectorial |
| **GPU** | NVIDIA RTX 3090 / 4090 / A4000 (16GB - 24GB VRAM) | Inferencia local acelerada para Qwen 2.5 14B |
| **RAM** | 32 GB DDR4/DDR5 | Almacenamiento en caché de vectores y concurrencia |
| **Disco** | 100 GB SSD NVMe | Sistema operativo, dependencias, modelos e índices vectoriales |

---

## 2. Rutas de Despliegue

### Ruta A: Servidor Nativo (Systemd + Script de Configuración)
Esta ruta instala la aplicación directamente sobre el sistema operativo del host, ideal para servidores dedicados con configuraciones personalizadas de GPU y Vulkan.

1. **Clonar e Inicializar**:
   ```bash
   make install
   ```
2. **Configurar Systemd**:
   El instalador invocará a `scripts/install_systemd.sh` para crear, habilitar e iniciar el servicio del motor.
3. **Administración del Servicio**:
   * **Ver estado**: `systemctl status triage-engine.service`
   * **Reiniciar**: `systemctl restart triage-engine.service`
   * **Ver logs**: `journalctl -u triage-engine.service -f`

### Ruta B: Contenedores (Docker Compose)
Ideal para entornos escalables, Kubernetes o servidores virtuales con soporte de GPU compartida a través de NVIDIA Container Toolkit.

1. **Instalar Dependencias**:
   Instale Docker Engine y el NVIDIA Container Toolkit en el host.
2. **Desplegar**:
   ```bash
   make docker-up
   ```
3. **Persistencia de Datos**:
   Los volúmenes nombrados `ollama_models` y `chroma_data` garantizan que los modelos descargados y las bases de datos vectoriales no se pierdan al actualizar o reiniciar los contenedores.

---

## 3. Seguridad Clínica y Auditoría de Logs

Dado que el ecosistema maneja datos sensibles de salud mental y situaciones críticas de riesgo (nivel ROJO), se definen políticas de seguridad muy estrictas:

### Auditoría de Crisis (Overrides)
Cada vez que un mensaje active un override determinista:
1. El motor generará un registro con nivel `WARNING` en la salida estándar de logs.
2. El registro incluirá el identificador de sesión (`session_id`), la fuente del override (`OverrideSource`) y el motivo de la activación.
3. **Política de Privacidad**: En producción, el texto explícito del usuario no debe guardarse en logs persistentes de texto plano para proteger la privacidad de datos clínicos de acuerdo a normativas de protección de datos personales. Únicamente se registrará el ID de la sesión y el código del disparador.

### Reglas Clínicas Invariables (en `contract.json`)
El modelo conversacional Qwen **jamás** debe:
* Emitir diagnósticos médicos o psicológicos (ej. "Tienes depresión mayor").
* Prescribir o recomendar medicamentos o tratamientos farmacológicos.
* Sustituir el juicio o tratamiento de un profesional de la salud humana.
* Proporcionar recursos de crisis fuera de la lista oficialmente verificada en `constant.py`.

---

## 4. Respaldos y Recuperación ante Desastres

* **Base Vectorial ChromaDB**: Realice respaldos periódicos de la carpeta asociada al volumen persistente de Chroma. El directorio físico mapeado se detalla en el archivo `.env`.
* **Bitácora de Sesiones**: Si se implementa un backend de persistencia (ej. base de datos externa), este debe contar con políticas de respaldo de transacciones diarias.
