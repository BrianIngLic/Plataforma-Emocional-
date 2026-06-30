# Especificación Maestra (Spec.md) - Plataforma Emocional

Este documento sirve como la fuente de verdad técnica para la construcción del ecosistema utilizando **Diana SDK** y **Angular**.

## Arquitectura General
El sistema está compuesto por un Frontend Angular, un Backend PostgREST (PostgreSQL), y un Núcleo de IA (FastAPI + LLM). 

### Comunicación Front <-> IA
- Angular enviará peticiones POST a `/api/v1/chat` en el núcleo FastAPI.
- El núcleo responderá con el texto generado y un `urgency_score` (0.0 a 1.0).

---

## Skills a Desarrollar

### Skill 1: Capa de Datos (PostgreSQL + PostgREST)
- **Tablas:** `roles`, `users`, `profiles`, `student_clinical_records` (array de enfermedades conocidas), `chats`, `messages`, `appointments`.
- **Seguridad:** Aplicar RLS estricto para asegurar que la lectura de expedientes sea solo por roles autorizados.

### Skill 2: Autenticación y Onboarding Clínico
- Crear módulos Angular de login y registro.
- Módulo de Recuperación de Contraseña (Forgot / Reset Password).
- En el registro del estudiante, incluir el paso para contestar el cuestionario de afecciones conocidas (Depresión, Ansiedad, etc.) que se enlazará con la IA.

### Skill 3: Amati Chat (Estudiante)
- Vista en modo oscuro.
- Conexión HTTPS segura con el núcleo IA (FastAPI).
- Interfaz de historial de chats a la izquierda, área principal de chat a la derecha.

### Skill 4: NutriMind (  Módulo Alimentario)
- Dashboard con barras de progreso para proteínas, grasas y carbohidratos.
- Listado de comidas agrupadas por tiempo (desayuno, etc.).

### Skill 5: Command Center Clínico (Personal de la Salud: Psicólogos y Nutriólogos)
- **Arquitectura de Herencia (Base Health Professional):** Unificación del modelo operativo para especialistas clínicos. El rol `Personal de la Salud` sirve como clase/módulo base del cual emanan tanto el **Psicólogo** como el **Nutriólogo**.
- **Vistas Compartidas (Herencia Común):**
  - **Dashboard Principal (Triage):** Vista de alto nivel con estadísticas, lista de casos de emergencia (`urgency_score` alto), agenda del día y métricas (gráficas).
  - **Directorio de Pacientes:** Tabla filtrable y buscable con los pacientes asignados y su nivel de riesgo.
  - **Visor Clínico Integral (Perfil):** Pantalla de detalle del paciente con información clínica, gráficas de progreso y lectura del historial de chat de Amati IA.
  - **Agenda Clínica:** Pantalla dedicada con vista de calendario para organizar, agendar y cancelar citas de los pacientes.
  - **Ajustes Clínicos:** Configuración de horarios y modalidad híbrida (Virtual / Presencial con Recorridos Virtuales BUAP).
- **Factor de Diferenciación (Nota Médica / Expediente):**
  - **Psicólogo:** Emite **Nota de Evolución Clínica (SOAP)** utilizando un editor enriquecido (Quill) para registrar aspectos Subjetivos, Objetivos, Análisis y Plan de psicoterapia.
  - **Nutriólogo:** Emite **Expediente Nutricional y Frecuencia Alimentaria**, gestionando métricas de sueño, agua, recordatorio de 24h y generando un reporte clínico formal en PDF.
- **Ajustes Clínicos y Modalidad Híbrida (Virtual / Presencial):**
  - Switch interactivo para alternar entre atención `Virtual` (con enlace de reunión) y `Presencial`.
  - Configuración presencial con selector de Facultad base predeterminada, Edificio y Número de Oficina/Aula.
  - **Vinculación con Recorridos Virtuales BUAP:** Al confirmar o consultar una cita presencial, el estudiante visualiza un botón inmersivo para "📍 Abrir Recorrido Virtual" de su facultad, reduciendo la ansiedad espacial y facilitando la llegada al campus.

### Skill 6: Mi Diario (Personal)
- Interfaz privada para que el estudiante registre sus pensamientos y estado de ánimo diario.
- Integración visual alineada al ecosistema (Glassmorphism / Modo Dinámico).
- Componente de "Mood Tracker" (Registro de Emociones).

### Skill 7: Gestión de Perfil y Avatares (Cross-Role)
- Módulo transversal disponible para Estudiantes, Psicólogos y Administradores.
- Capacidad de subir una fotografía local (Profile Picture) o seleccionar un Avatar predeterminado.
- Integración con **Supabase Storage** para el alojamiento seguro de las imágenes y actualización del registro en la tabla `profiles`.
- Reemplazo global de los avatares genéricos de texto por las imágenes cargadas en el sidebar y menús de navegación superior.

### Skill 8: Módulo de Administración (Core System)
- Interfaz exclusiva para el rol 'Admin'.
- Panel de control para gestionar altas, bajas y modificaciones del personal clínico (Psicólogos).
- Asignación manual de pacientes (Estudiantes) a psicólogos específicos (opcional, dependiendo de la política de la clínica).

### Skill 9: RoleGuard Security (Barrera de Roles)
- Implementación de seguridad transversal en Angular (Route Guards).
- Restricción de acceso basado en el `role` del usuario (Estudiante, Psicólogo, Admin).
- Redirección automática al módulo o dashboard correspondiente al rol real en caso de un intento de acceso no autorizado, protegiendo la confidencialidad de la clínica.

---

### Skill 10: Sistema de Evaluación Post-Sesión — FIT Gamificado (Spect Kit + Diana)

**Objetivo:** Construir un sistema de retroalimentación clínica post-sesión fundamentado en el marco de **Feedback-Informed Treatment (FIT)** y la **Session Rating Scale (SRS)** de Duncan et al., que permita al alumno/paciente evaluar cada sesión de manera lúdica e interactiva mediante gamificación, y proporcione al especialista y al administrador métricas accionables de alianza terapéutica con alertas tempranas de ruptura.

#### 13.1. Fundamentación Clínica (Instrumentos Base)
- **Session Rating Scale (SRS) — Duncan, Miller et al.:** Escala ultracorta para uso clínico diario (Routine Outcome Monitoring). Detecta tempranamente rupturas de alianza y reduce el dropout.
- **Working Alliance Inventory (WAI) — Horvath & Greenberg:** Mide las tres dimensiones de la alianza (Bordin, 1979): Vínculo Relacional, Acuerdo en Objetivos y Acuerdo en Tareas.
- **Session Impacts Scale / Hope Theory (Snyder):** Mide el impacto inmediato y el empoderamiento al concluir la sesión, predictor de autoeficacia inter-sesión.

#### 13.2. Las 5 Preguntas del Cuestionario Post-Sesión

| N° | Pregunta al Paciente | Dimensión Clínica | Base |
|:---|:---|:---|:---|
| **Q1** | ¿Cómo calificas la sesión de hoy en general? | Evaluación Global | SRS (Overall) |
| **Q2** | ¿Cómo sentiste el apoyo, la escucha y la empatía de tu psicólogo hoy? | Vínculo Relacional | WAI/SRS (Bond) |
| **Q3** | ¿Hablamos y trabajamos en lo que tú querías y necesitabas tratar hoy? | Acuerdo en Objetivos/Tareas | WAI/SRS (Goals & Tasks) |
| **Q4** | Al terminar hoy, ¿te sientes con mayor claridad, esperanza o herramientas para afrontar tus retos? | Impacto / Autoeficacia | Session Impacts Scale |
| **Q5** | ¿Hay algo más que te gustaría agregar, cambiar o comentar sobre la sesión de hoy? | Ajuste Cualitativo | FIT/ROM (Texto libre) |

#### 13.3. Diseño Gamificado (Lado del Paciente)
- **Tarjetas Secuenciales (Card-by-Card):** Una pregunta a la vez, sin survey fatigue.
- **Emoji-Scale:** 😞(1.0)😐(2.0)🙂(3.0)😊(4.0)🤩(5.0) con código de color progresivo rojo→índigo.
- **Micro-interacciones:** Bounce + micro-confeti al puntuar 4–5; reacción empática al puntuar 1–2.
- **Auto-avance** con smooth slide (≤ 30 seg total). Pantalla de cierre motivacional.
- **Integración Skill 10:** +10 XP al completar + contribuye a la racha (*streak*) diaria.
- **Trigger:** Se activa cuando el especialista marca la cita como `completed`.

#### 13.4. Modelo Matemático de Agregación
```
S_global = round(q1*0.20 + q2*0.30 + q3*0.25 + q4*0.25, 1)
```
Pesos clínicos: w1=0.20, w2=0.30 (predictor más robusto de alianza), w3=0.25, w4=0.25.

#### 13.5. Alertas de Ruptura de Alianza (Dashboard Especialista)
| Estado | Condición | Indicador |
|:---|:---|:---|
| 🚨 Ruptura Crítica | `∃ q_i ≤ 2.0` o `S_global < 3.5` | `⚠️ Atención Requerida` |
| 📉 Caída en Alianza | `S_global_actual < S_global_anterior - 0.7` | `📉 Caída en la Alianza` |
| ✅ Alianza Saludable | `S_global ≥ 4.0` y `∀ q_i ≥ 3.0` | `✅ Alianza Sólida` |
| 💬 Comentario | `q5 no vacía` | Ícono mensaje junto al puntaje |

#### 13.6. Modelo de Datos
**Tabla `session_evaluations`:** `id`, `appointment_id` (FK, UNIQUE), `patient_id` (FK), `professional_id` (FK), `q1_global`, `q2_bond`, `q3_goals`, `q4_impact` (DECIMAL 2,1), `q5_comment` (TEXT nullable), `score_global` (DECIMAL 2,1), `rupture_flag` (TEXT), `is_visible_to_professional` (BOOLEAN), `created_at`.
**RLS:** Paciente INSERT propio; Especialista SELECT sus citas; Admin SELECT agregados.

---

### Skill 12: Dossier Clínico Unificado, Marca de Agua y Sello Digital (Exportación Masiva PDF)

**Objetivo:** Consolidar en un único documento de formato abierto e inmutable toda la información confidencial del paciente (datos generales, notas SOAP, bitácoras de nutrición, diario emocional y evaluaciones FIT) aplicando marcas de agua institucionales y sellos criptográficos HMAC-SHA256 (Meta Seal) bajo el principio de No Repudio (NOM-024-SSA3-2012 / HIPAA).

#### 1. Capa de Servicios (`core/services/dossier-export.service.ts`)
- Utiliza la librería de renderizado vectorial de PDFs nativa `jsPDF` integrada en el proyecto.
- Ejecuta una sola consulta agregada para recopilar la información clínica del paciente (perfil, notas de evolución de las citas completadas, bitácora nutricional, diario personal y resultados de evaluaciones de sesión).

#### 2. Implementación de Meta Seal (Criptografía)
- Generación de un hash HMAC-SHA256 mediante `Web Crypto API` (`SubtleCrypto`) sobre la concatenación serializada de la información clínica del paciente.
- Inyección del hash en los metadatos oficiales del PDF (Title, Author, Subject, Keywords) y en el cuerpo visible del documento en el resumen ejecutivo.

#### 3. Marca de Agua
- Renderizado de una marca de agua institucional en fondo diagonal transparente para garantizar la oficialidad del documento expedido por la institución.


