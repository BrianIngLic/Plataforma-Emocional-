# Especificación Maestra (Spec.md) - Plataforma Emocional

Este documento sirve como la fuente de verdad técnica para la construcción del ecosistema utilizando **Diana SDK** y **Angular**.

## Arquitectura General
El sistema está compuesto por un Frontend Angular, un Backend PostgREST (PostgreSQL), y un Núcleo de IA (FastAPI + LLM). 

### Comunicación Front <-> IA
- Angular enviará peticiones POST a `/api/v1/chat` en el núcleo FastAPI.
- El núcleo responderá con el texto generado y un `urgency_score` (0.0 a 1.0).

---

## Skills a Desarrollar (Orden Numérico Estricto)

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

### Skill 4: NutriMind (Módulo Alimentario)
- Dashboard con barras de progreso para proteínas, grasas y carbohidratos.
- Listado de comidas agrupadas por tiempo (desayuno, etc.).

### Skill 5: Command Center Clínico (Personal de la Salud: Psicólogos y Nutriólogos)
- **Arquitectura de Herencia (Base Health Professional):** Unificación del modelo operativo para especialistas clínicos. El rol `Personal de la Salud` sirve como clase/módulo base del cual emanan tanto el **Psicólogo** como el **Nutriólogo**.
- **Vistas Compartidas (Herencia Común):**
  - **Dashboard Principal (Triage):** Vista de alto nivel con estadísticas, lista de casos de emergencia (`urgency_score` alto), agenda del día y métricas (gráficas).
  - **Directorio de Pacientes:** Tabla filtrable y buscable con los pacientes asignados y su nivel de riesgo.
  - **Visor Clínico Integral (Perfil):** Pantalla de detalle del paciente con información clínica, gráficas de progreso y lectura del historial de chat de Amati IA.
  - **Agenda Clínica:** Pantalla dedicada con vista de calendario para organizar, agendar y cancelar citas de los pacientes.
  - **Ajustes Clínicos y Modalidad Híbrida (Virtual / Presencial):**
    - Switch interactivo para alternar entre atención `Virtual` (con enlace de reunión) y `Presencial`.
    - Configuración presencial con selector de Facultad base predeterminada, Edificio y Número de Oficina/Aula.
    - **Vinculación con Recorridos Virtuales BUAP:** Al confirmar o consultar una cita presencial, el estudiante visualiza un botón inmersivo para "📍 Abrir Recorrido Virtual" de su facultad, reduciendo la ansiedad espacial y facilitando la llegada al campus.
    - **Reserva Unificada (Psicólogo y Nutriólogo):** El estudiante puede consultar y reservar en un mismo calendario unificado utilizando un Combo Box selector para elegir qué atención necesita (Psicología o Nutrición). En caso de no tener un especialista asignado en la rama seleccionada, el sistema lanza una alerta modal emergente y despliega el directorio de su facultad.
    - **Notificaciones Híbridas de Emergencia (Web Push + WhatsApp API):**
      - Modal de cancelación de emergencia con despliegue de motivo de cancelación explícito.
      - **Difusión Simultánea Dual (*Dual Broadcast*):** El sistema dispara concurrentemente notificaciones vía Web Push (PWA) y WhatsApp Business Cloud API. Esto sortea la restricción estructural de planes de telefonía prepago en México que carecen de saldo para navegación web general pero conservan **Redes Sociales / WhatsApp Ilimitado**, asegurando una tasa de entrega del 100%.
- **Factor de Diferenciación (Nota Médica / Expediente):**
  - **Psicólogo:** Emite **Nota de Evolución Clínica (SOAP)** utilizando un editor enriquecido (Quill) para registrar aspectos Subjetivos, Objetivos, Análisis y Plan de psicoterapia.
  - **Nutriólogo:** Emite **Expediente Nutricional y Frecuencia Alimentaria**, gestionando métricas de sueño, agua, recordatorio de 24h y generando un reporte clínico formal en PDF.

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
- **Gestión de Activos Institucionales:** Carga protegida del logotipo oficial y marca de agua de la institución hacia el bucket de Supabase Storage `institutional_assets`.

### Skill 9: RoleGuard Security (Barrera de Roles)
- Implementación de seguridad transversal en Angular (Route Guards).
- Restricción de acceso basado en el `role` del usuario (Estudiante, Psicólogo, Admin).
- Redirección automática al módulo o dashboard correspondiente al rol real en caso de un intento de acceso no autorizado, protegiendo la confidencialidad de la clínica.

### Skill 10: Sistema de Logros y Gamificación (Estilo Duolingo)
- **Objetivo:** Incentivar la constancia del estudiante en el registro de emociones (Mi Diario), cumplimiento de planes nutricionales (NutriMind) y sesiones de bienestar con Amati IA mediante técnicas de gamificación de alto impacto.
- **Modelo de Datos (PostgreSQL):** Tablas `achievements`, `user_achievements` (control de estado desarmado/desbloqueado y fecha), y `achievement_categories`.
- **Gestión y Creación de Logros:**
  - **Administradores:** Tienen facultad de crear logros globales y sistémicos (ej. "Racha de 7 días", "Primer mes en el ecosistema", "Perfil 100% completado").
  - **Personal de la Salud (Psicólogos y Nutriólogos):** Tienen facultad de crear e inyectar **Logros Clínicos Personalizados** para sus pacientes asignados (ej. "Meta de hidratación cumplida", "Asistencia perfecta a terapia", "Diario de ansiedad completado").
- **Mecánicas Estilo Duolingo:**
  - **Motor de Rachas (*Streak Engine*):** Seguimiento en tiempo real de días consecutivos activos. Alerta visual de fuego/llama en la barra de navegación superior.
  - **Puntos de Experiencia (XP):** Acumulación de XP por interactuar con Amati, asistir a citas y completar el diario.
  - **Insignias y Medallas Visuales:** Tarjetas con diseño *Glassmorphism* y micro-animaciones vibrantes al desbloquear un logro.
  - **Notificaciones Motivacionales:** Alertas PWA y notificaciones de felicitación al alcanzar hitos clave.

### Skill 11: Chat Interno Conectado con Meta Cloud API (WhatsApp Bidireccional)
- **Objetivo:** Establecer un canal oficial, auditable y fluido de mensajería instantánea entre el personal clínico/administrativo y los estudiantes, operando directamente sobre WhatsApp sin comprometer los números personales del personal.
- **Interfaz Interna (Command Center Clínico y Administrativo):**
  - Módulo de mensajería incorporado en el dashboard de Administradores, Psicólogos y Nutriólogos.
  - Vista de conversaciones activas organizadas por estudiante, con filtrado de estatus y nivel de urgencia.
- **Orquestación Bidireccional (Meta Cloud API + Supabase):**
  - **Flujo Saliente (Outbound):** Cuando el médico o administrador escribe en el chat del dashboard, Angular envía el payload a Supabase, disparando un Webhook/Edge Function hacia Meta Cloud API para entregar el mensaje al WhatsApp del alumno.
  - **Flujo Entrante (Inbound):** Cuando el alumno responde desde su WhatsApp, Meta dispara un Webhook hacia Supabase Edge Functions. El mensaje se inserta en `internal_meta_chats` y, mediante **Supabase Realtime**, aparece instantáneamente en la pantalla del médico/administrador.
- **Seguridad y Cumplimiento (NOM-024 / HIPAA):** Aislamiento estricto de Información Personal de Salud (PHI). Encriptación en tránsito y almacenamiento de auditoría completo.

### Skill 12: Dossier Clínico Unificado, Marca de Agua y Meta Seal (Exportación Masiva PDF)
- **Objetivo:** Generar un documento clínico formal, exhaustivo, legalmente verificable y unificado que aglutine todo el historial de interacciones del paciente en el ecosistema para referencias médicas, auditorías o entrega al paciente.
- **Contenido del Dossier Unificado:**
  - **Resumen Ejecutivo y Triage:** Datos demográficos, nivel de riesgo actual (`urgency_score`), condiciones preexistentes.
  - **Notas Médicas y Psicológicas (SOAP):** Historial completo de evolución clínica redactado por psicólogos.
  - **Historial Nutricional:** Registros de frecuencia alimentaria, gráficas de composición corporal, metas de consumo.
  - **Evolución del Diario (Mood Tracker):** Gráficas de fluctuación del estado de ánimo a lo largo del tiempo.
  - **Análisis de IA (Amati):** Resumen de interacciones destacadas y métricas detectadas por el LLM.
- **Arquitectura Estricta de Código Abierto (Open Source):**
  - Todo el motor de renderizado y cálculo criptográfico empleará exclusivamente librerías y estándares de código abierto (`pdfmake`, `pdf-lib`, `Web Crypto API` / `SubtleCrypto`), sin depender de motores o servicios comerciales propietarios.
- **Marca de Agua Institucional Dinámica (Admin-Uploaded Watermark):**
  - El motor de exportación consulta dinámicamente el bucket `institutional_assets` de Supabase Storage para recuperar la imagen oficial cargada por el Administrador.
  - Renderiza la imagen como membrete superior y como marca de agua diagonal centellante (opacidad del 12%) a lo largo de todo el documento.
- **Meta Seal (Sello Criptográfico de Metadatos y No Repudio):**
  - **Incrustación Criptográfica:** Generación de un hash HMAC-SHA256 utilizando `Web Crypto API` que combina la matrícula del profesional tratante, el ID del paciente, el nivel de riesgo y la marca de tiempo UTC.
  - **Sello Visible e Invisible:** El hash se inyecta en los metadatos binarios del PDF (Document Info) y se despliega como un sello de verificación formal en el resumen ejecutivo, garantizando el principio de **No Repudio, Autenticidad e Integridad** bajo cumplimiento estricto de la **NOM-024** y **HIPAA**.

---

### Skill 13: Sistema de Evaluación Post-Sesión — FIT Gamificado (Spect Kit + Diana)

**Objetivo:** Construir un sistema de retroalimentación clínica post-sesión fundamentado en el marco de **Feedback-Informed Treatment (FIT)** y la **Session Rating Scale (SRS)** de Duncan et al., que permita al alumno/paciente evaluar cada sesión de manera lúdica e interactiva mediante gamificación, y proporcione al especialista (psicólogo/nutriólogo) y al administrador métricas accionables de alianza terapéutica con alertas tempranas de ruptura.

---

#### 13.1. Fundamentación Clínica (Instrumentos Base)

- **Session Rating Scale (SRS) — Duncan, Miller et al.:** Escala ultracorta (4 ítems) diseñada para uso clínico diario en el marco del Routine Outcome Monitoring (ROM). Detecta tempranamente rupturas de alianza y reduce el abandono terapéutico (*dropout*).
- **Working Alliance Inventory (WAI) — Horvath & Greenberg:** Estándar de oro para medir las tres dimensiones de la alianza terapéutica (Bordin, 1979): Vínculo Relacional, Acuerdo en Objetivos y Acuerdo en Tareas.
- **Session Impacts Scale (Elliott & Wexler) / Hope Theory (Snyder):** Mide el impacto inmediato percibido y la esperanza o empoderamiento al concluir la sesión, predictor de autoeficacia inter-sesión.

#### 13.2. Las 5 Preguntas del Cuestionario Post-Sesión

| N° | Pregunta (fraseo al paciente) | Dimensión Clínica | Instrumento Base |
|:---|:---|:---|:---|
| **Q1** | ¿Cómo calificas la sesión de hoy en general? | Evaluación Global | SRS (Overall) |
| **Q2** | ¿Cómo sentiste el apoyo, la escucha y la empatía de tu psicólogo hoy? | Vínculo Relacional | WAI/SRS (Bond) |
| **Q3** | ¿Hablamos y trabajamos en lo que tú querías y necesitabas tratar hoy? | Acuerdo en Objetivos y Tareas | WAI/SRS (Goals & Tasks) |
| **Q4** | Al terminar hoy, ¿te sientes con mayor claridad, esperanza o con herramientas para afrontar tus retos? | Impacto Inmediato y Autoeficacia | Session Impacts Scale / Hope Theory |
| **Q5** | ¿Hay algo más que te gustaría agregar, cambiar o comentar sobre la sesión de hoy? | Ajuste Cualitativo y Colaborativo | FIT/ROM (Abierta - texto libre) |

#### 13.3. Diseño Gamificado del Cuestionario (Lado del Paciente)

- **Formato de Tarjetas Secuenciales (Card-by-Card):** El paciente ve una sola pregunta a la vez. No hay formulario largo ni "survey fatigue".
- **Selector de Caritas Emocionales / Emojis:**
  - 😞 `1.0` — Rojo — *"Nada satisfecho"* (Alerta de ruptura)
  - 😐 `2.0` — Naranja — *"Poco satisfecho"*
  - 🙂 `3.0` — Amarillo — *"Neutral"*
  - 😊 `4.0` — Verde claro — *"Satisfecho"*
  - 🤩 `5.0` — Verde/Índigo — *"¡Muy satisfecho!"*
- **Micro-interacciones:**
  - Al seleccionar 4 o 5: el emoji anima con *bounce* y emite micro-confeti de partículas.
  - Al seleccionar 1 o 2: reacción empática y suave (sin alarmar al paciente).
  - Transición automática a la siguiente tarjeta con *smooth slide* (≤ 30 segundos en total).
- **Pantalla de Cierre Motivacional:** *"¡Gracias por ayudar a construir tu camino! Tu voz es fundamental para tu psicólogo."*
- **Integración con Gamificación (Skill 10):** Completar el cuestionario otorga +10 XP al paciente y contribuye a la racha (*streak*) activa del día.
- **Trigger de Activación:** El cuestionario se habilita automáticamente cuando el psicólogo marca la cita como `completed` en su agenda. Aparece en el panel del estudiante como una notificación/banner destacado.

#### 13.4. Modelo Matemático de Agregación (Panel del Especialista)

**Modelo Ponderado Clínico (Recomendado — basado en meta-análisis FIT):**

```
S_global = round(q1*0.20 + q2*0.30 + q3*0.25 + q4*0.25, 1)
```

Pesos clínicos (suma = 1.0):
- `w1` (Global) = **0.20** — Apreciación sumaria general.
- `w2` (Vínculo/Empatía) = **0.30** — Predictor aislado más robusto de la alianza terapéutica.
- `w3` (Objetivos/Tareas) = **0.25** — Asegura que la sesión respondió a la necesidad del paciente.
- `w4` (Impacto/Esperanza) = **0.25** — Motor del cambio inter-sesión.

**Manejo de omisiones:** Si el paciente omite un ítem `q_k`, los pesos restantes se redistribuyen proporcionalmente: `S_global = sum(w_i * q_i) / sum(w_i)` para `i ≠ k`.

**El `S_global` es el valor mostrado en la columna "Evaluación" (1.0–5.0) del panel de Personal Clínico del Administrador.**

#### 13.5. Sistema de Alertas de Ruptura de Alianza (Dashboard Especialista)

| Estado | Condición Lógica | Indicador Visual en Dashboard |
|:---|:---|:---|
| 🚨 **Ruptura Crítica** | `(∃ q_i ≤ 2.0) OR (S_global < 3.5)` | Tag rojo `⚠️ Atención Requerida / Riesgo de Ruptura` |
| 📉 **Caída en Alianza** | `S_global_actual < S_global_anterior - 0.7` | Tag ámbar `📉 Caída en la Alianza` |
| ✅ **Alianza Saludable** | `(S_global ≥ 4.0) AND (∀ q_i ≥ 3.0)` | Tag verde `✅ Alianza Sólida` |
| 💬 **Comentario Pendiente** | `q5 no está vacía` | Ícono de mensaje destacado junto al puntaje numérico |

#### 13.6. Modelo de Datos (PostgreSQL)

**Nueva tabla:** `session_evaluations`
- `id` UUID PK
- `appointment_id` UUID FK → `appointments.id`
- `patient_id` UUID FK → `users.id`
- `professional_id` UUID FK → `users.id`
- `q1_global` DECIMAL(2,1) — Evaluación general de la sesión
- `q2_bond` DECIMAL(2,1) — Vínculo/Empatía
- `q3_goals` DECIMAL(2,1) — Acuerdo en objetivos/temas
- `q4_impact` DECIMAL(2,1) — Impacto/Esperanza post-sesión
- `q5_comment` TEXT — Comentario cualitativo abierto (nullable)
- `score_global` DECIMAL(2,1) — Puntaje ponderado calculado (Model B)
- `rupture_flag` TEXT — `'critical'`, `'decline'`, `'healthy'`, `'pending'`
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `is_visible_to_professional` BOOLEAN DEFAULT TRUE — Control de privacidad

**RLS:** Solo el paciente puede INSERTAR su propia evaluación (una por `appointment_id`). El especialista solo puede LEER las evaluaciones de sus citas. El administrador puede leer el `score_global` y `rupture_flag` agregados por especialista.

#### 13.7. Arquitectura de Componentes Angular

- `features/student/session-feedback/` — Cuestionario gamificado (solo paciente)
  - `session-feedback.component.ts/html/scss`
  - `emoji-scale/emoji-scale.component.ts` — Selector de caritas reutilizable
- `core/services/session-evaluation.service.ts` — CRUD de evaluaciones
- `features/psychologist/` y `features/nutritionist/` — Nuevo badge de evaluación y alertas en perfil de paciente y agenda
- `features/admin/psychologists/` — Columna "Evaluación" ya existente conectada a datos reales
