# Especificación Maestra (Spec.md) - Plataforma Emocional

Este documento sirve como la fuente de verdad técnica para la construcción del ecosistema utilizando **Diana SDK** y **Angular**.

## Arquitectura General
El sistema está compuesto por un Frontend Angular, un Backend PostgREST (PostgreSQL), y un Núcleo de IA (FastAPI + LLM). 

### Capa de Cifrado (Cifrado en Servidor - Caso B)
- **Cifrado Transparente en Base de Datos:** Las columnas sensibles de las tablas base (mensajes, diario, records clínicos, etc.) se cifran automáticamente en PostgreSQL utilizando la extensión `pgcrypto` (`pgp_sym_encrypt`).
- **Vistas y Triggers:** La base de datos expone vistas transparentes con `security_invoker = on` que descifran los datos en consultas `SELECT` (`pgp_sym_decrypt`) y disparadores `INSTEAD OF` que cifran la información al insertar o actualizar.
- **Almacén y Rotación de Llaves:** Las llaves de cifrado se administran en `public.encryption_keys` (protegida por RLS). La función `rotate_encryption_keys` permite al Administrador cambiar la llave de todo el historial y re-encriptar los datos existentes en lote.

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
- **Seguridad y Persistencia de Sesión (NOM-024 / HIPAA)**:
  - Cierre automático de sesión tras 15 minutos de inactividad del usuario (rastreado mediante interacción del DOM y validado con timestamp en `localStorage` ante suspensión del sistema).
  - Cierre forzado de sesión al cerrar pestaña o navegador (detectado al comprobar la pérdida de la llave simétrica E2EE `e2ee_session_key` de `sessionStorage`).
  - Registro de auditoría del evento `SESSION_TIMEOUT` en `audit_logs` ante cierres automáticos.

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
  - **Agenda Clínica:** Pantalla dedicada con vista de calendario para organizar, agendar y cancelar citas de los pacientes. Incluye:
    - **Agendamiento Clínico Directo desde el Expediente:** El especialista puede iniciar el proceso de reserva para un estudiante específico. El botón de agendado en el visor clínico redirige a la agenda pasando `studentId` como parámetro.
    - **Reutilización del Calendario y Horas Libres:** La agenda muestra el calendario de reserva y la botonera con todos los slots disponibles del especialista (obtenidos con la prioridad `alto_riesgo` para evadir restricciones de días ciegos).
    - **Advertencia de Proporcionalidad:** Muestra un aviso sugerente si se programa en una fecha reservada para urgencias según el riesgo del paciente (menos de 7 días para Bajo, menos de 2 días para Moderado), sin bloquear la reserva.
    - **Banner de Triage:** La agenda incorpora un banner superior descriptivo que computa y muestra la composición y cantidad total de pacientes asignados por nivel de riesgo de triaje IA (🔴 Alto, 🟡 Moderado, 🟢 Bajo).
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
- **Directorio General Unificado:** Consolidación de alumnos y especialistas (psicólogos y nutriólogos) en una sola vista dinámica (`/admin/directory`).
  - **Buscador y Selector Dinámico:** Filtro de alumnos por búsqueda de texto y selector de especialista en la cabecera superior. Al elegir un especialista, se despliega su vista detallada (perfil, calendario, gráficos, pacientes asignados).
  - **Filtros Notion-like:** Barra de filtros interactivos mediante checkboxes para filtrar alumnos por asignación ("Sin Psicólogo", "Sin Nutriólogo"), por división de facultad y por estado clínico ("Activo", "Baja", "Alta Médica").
  - **Reasignación Inline:** Selectores combobox embebidos directamente en la tabla para asignar o cambiar en tiempo real los especialistas asignados a cada alumno.
- Panel de control para gestionar altas, bajas y modificaciones del personal clínico (Psicólogos y Nutriólogos) mediante modal de registro seguro.
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
- **Meta Seal (Sello Criptográfico de Metadatos, No Repudio y Trazabilidad):**
  - **Incrustación Criptográfica:** Generación de un hash HMAC-SHA256 utilizando `Web Crypto API` que combina la matrícula/ID y correo del profesional exportador (`ExporterId`, `ExporterEmail`), el ID del paciente, las fechas y contenidos de citas/diario, y la marca de tiempo UTC.
  - **Sello Visible e Invisible:** El hash se inyecta en los metadatos binarios del PDF (Document Info - Subject/Keywords) y se despliega en el resumen ejecutivo, garantizando el principio de **No Repudio, Autenticidad e Integridad** bajo cumplimiento estricto de la **NOM-024** y **HIPAA**.
  - **Trazabilidad de Filtración Forense Digital:** El Sello vincula al médico firmante con la exportación, permitiendo determinar con certeza matemática quién descargó el archivo si este es compartido ilegalmente.
- **Medidas DLP y Esteganografía Forense Física (Anti-Foto/Anti-Impresión):**
  - **Espaciado Dinámico de Texto:** Especificación para modular microscópicamente el tracking y espaciado (entre `0.01 mm` y `0.03 mm`) de ciertos caracteres en los párrafos del reporte PDF, codificando binariamente el ID del especialista.
  - **Validación:** Ante capturas de pantalla, fotos con celular o páginas impresas físicamente, un análisis de proporciones de distancia en la imagen permite reconstruir el ID y auditar la procedencia del leak.
- **Imagen Institucional y Logotipo BUAP:**
  - El encabezado superior del PDF incluye una franja azul marino de **30 mm de alto** que presenta el logo oficial de la universidad aumentado a **2 cm (20 mm)**, con su color convertido dinámicamente a blanco puro sobre fondo azul, seguido del nombre oficial de la institución centrado abajo. Este encabezado se repite en cada página nueva.
  - Se dibuja una marca de agua central del logo con opacidad del 5% y el pie de página `"Powered by Amati"`.

### Skill 13: Sistema de Evaluación Post-Sesión — FIT Gamificado (Spect Kit + Diana)

**Objetivo:** Construir un sistema de retroalimentación clínica post-sesión fundamentado en el marco de **Feedback-Informed Treatment (FIT)** y la **Session Rating Scale (SRS)** de Duncan et al., que permita al alumno/paciente evaluar cada sesión de manera lúdica e interactiva mediante gamificación, y proporcione al especialista (psicólogo/nutriólogo) y al administrador métricas accionables de alianza terapéutica con alertas tempranas de ruptura.

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

### Skill 14: Responsividad Móvil y Optimización de Layouts
- **Sidebar Drawer (Overlay):** En pantallas con un ancho inferior a 768px (móviles), los sidebars de estudiantes y psicólogos deben transformarse en paneles desplegables (drawers) que se muestren encima del contenido principal. Se agregará un fondo semi-transparente (backdrop overlay) y un gatillo flotante (hamburger menu) para abrirlo y cerrarlo de forma amigable.
- **Simplificación del Chat:** Eliminar o esconder el encabezado (`.chat-header`) en móviles para dar prioridad al historial de mensajes.
- **Botón Unificado "+":** En la barra de entrada del chat para dispositivos móviles, unificar los botones de acciones de adjuntos/imágenes/emojis en un único botón "+" ubicado a la izquierda y pegado directamente al input sin separación. Este botón desplegará un menú flotante para las acciones secundarias.
- **Prevención de Rupturas por Teclado:** Evitar que el teclado virtual en navegadores móviles rompa el layout visual fijando el contenedor `:host` con `position: fixed; inset: 0` y utilizando `100dvh` (Dynamic Viewport Height).
- **Alineación Vertical:** Apilar las columnas y grillas de componentes complejos (como el Diario Emocional y las secciones del Psicólogo) para que queden legibles en pantallas estrechas.

### Skill 16: Cifrado en Servidor y Rotación de Llaves
- **Cifrado Transparente:** Columnas sensibles cifradas con `pgcrypto` (`pgp_sym_encrypt`) en PostgreSQL.
- **Vistas y Triggers:** Vistas con `security_invoker = on` que descifran en SELECT e insertan vía triggers `INSTEAD OF`.
- **Almacén de Llaves:** `public.encryption_keys` protegida por RLS. Función `rotate_encryption_keys` para rotación y re-encriptación.

### Skill 17: Autenticación por Passkeys para Administradores — Ruta Secreta

**Objetivo:** Hacer obligatorio el uso de Passkeys (WebAuthn/FIDO2 vía Supabase) como único método de autenticación para `role_id = 1` (Admin). El flujo de email+contraseña queda intacto para los demás roles. El punto de entrada del Admin es **completamente invisible** para el resto del sistema. Soporte para **múltiples administradores** con ciclo de vida gestionado exclusivamente por TI.

#### 17.1. Estrategia: Ruta secreta fuera del prefijo `/auth/`
- **`/auth/login`** — sin ningún cambio. Sin enlace, sin referencia, sin comentario sobre acceso admin.
- **`/sistema/acceso`** — ruta de primer nivel, fuera del prefijo `/auth/`, con nombre no revelador. No vinculada desde ningún componente público de la app.
- La URL solo se comparte con administradores por **canal seguro fuera de la aplicación** (correo institucional, mensaje cifrado).
- Cualquier persona que la encuentre por error ve una pantalla de login genérica que simplemente falla.

#### 17.2. Sistema de diseño — Interfaz Administrativa
Pantalla **formal y elegante**, sin glassmorphism ni gamificación:

| Token | Color | Uso |
|-------|-------|-----|
| `--admin-bg` | `#0A0A0A` | Fondo (negro profundo) |
| `--admin-surface` | `#111111` | Superficie de la card |
| `--admin-gold` | `#C9A84C` | Acentos primarios, CTA, bordes activos |
| `--admin-gold-light` | `#E2C07A` | Hover del CTA |
| `--admin-text` | `#F5F0E8` | Texto principal (crema cálido) |
| `--admin-muted` | `#6B6560` | Placeholders, labels |
| `--role-purple` | `#7C3AED` | Banda decorativa Psicólogo |
| `--role-green` | `#059669` | Banda decorativa Nutricionista |
| `--role-blue` | `#2563EB` | Banda decorativa Estudiante |

Tipografía: `Playfair Display` (título) + `Inter` (body). Título: **"Acceso al Sistema"** — sin mencionar "Admin" en el HTML. Banda inferior: 3 franjas de color de rol, 4px, solo decorativas. Entrada: `opacity 0→1 + translateY(12px→0)`, 400ms `ease-out`. Logo amati con texto lateral.

#### 17.3. Ciclo de Vida del Administrador — Gestión por TI

El ciclo de vida del administrador es gestionado **exclusivamente desde el área de TI**, fuera del ecosistema. No existe UI de creación de Admin dentro de la aplicación. Se soportan **múltiples administradores** simultáneos, cada uno con ciclo independiente.

**Fases:**
```
CREAR ──► ENROLAR ──► OPERAR ──► REVOCAR ──► RE-ENROLAR
  ▲                                              │
  └──────────────────────────────────────────────┘
```

**17.3.1. Script de Gestión TI (`scripts/admin-manager.js`)**

Script Node.js que utiliza la `service_role_key` de Supabase para operaciones administrativas. Vive fuera del directorio `src/` (no se despliega al navegador).

| Comando | Descripción |
|---------|-------------|
| `create <email>` | Crear usuario Admin + fila en `public.users` + enviar Magic Link |
| `revoke <email>` | Eliminar credenciales WebAuthn + invalidar sesiones |
| `reenroll <email>` | Revocar passkey actual + enviar nuevo Magic Link |
| `disable <email>` | Desactivar cuenta temporalmente (sin borrar credenciales) |
| `enable <email>` | Reactivar cuenta desactivada |
| `update-email <viejo> <nuevo>` | Cambiar correo institucional + revocar + re-enrolar |
| `status <email>` | Consultar estado actual del admin |
| `list` | Listar todos los admins y su estado |

Cada operación registra una entrada en `admin_audit_log`.

**17.3.2. Flujo de Creación**
1. TI ejecuta `node admin-manager.js create admin@institucion.mx`
2. Script crea usuario en Supabase Auth (sin contraseña de acceso)
3. Inserta fila en `public.users` con `role_id=1`, `passkey_only=false`
4. Supabase envía Magic Link al correo vía SMTP propio
5. Admin abre Magic Link → sesión temporal
6. Admin redirigido a `/sistema/acceso?mode=register`
7. Admin registra Passkey (hardware-bound, biometría)
8. `passkey_only=true` se activa
9. Accesos posteriores solo por Passkey

**17.3.3. Escenarios de Recuperación/Revocación**

| Escenario | Acción TI | Resultado |
|-----------|-----------|-----------|
| Pierde dispositivo | `reenroll <email>` | Nueva passkey en nuevo dispositivo |
| Cambio de personal | `revoke` + `disable` viejo, `create` nuevo | Baja anterior, alta nuevo |
| Dispositivo dañado | `reenroll <email>` | Misma persona, nuevo dispositivo |
| Baja temporal (licencia) | `disable <email>` | Sin acceso, credenciales preservadas |
| Regreso de baja | `enable` + `reenroll <email>` | Reactivación + nueva passkey |
| Sospecha de compromiso | `revoke <email>` inmediato | Bloqueo preventivo |
| Cambio de correo | `update-email <viejo> <nuevo>` | Nuevo correo + nueva passkey |

**17.3.4. Verificación de identidad pre-recuperación:** Antes de ejecutar `reenroll`, `enable` o `update-email`, TI verifica identidad del solicitante por canal independiente (presencial, llamada verificada, protocolo interno).

#### 17.4. Passkeys Vinculadas al Hardware (Device-Bound)

Las passkeys de administradores **no se sincronizan** entre dispositivos (no Apple iCloud Keychain, no Google Password Manager):

```typescript
authenticatorSelection: {
  authenticatorAttachment: 'platform',
  residentKey: 'required',
  requireResidentKey: true,
  userVerification: 'required'
}
attestation: 'direct'
```

**Implicación:** Si el admin pierde el dispositivo, la passkey se pierde con él. TI es el único camino de recuperación.

#### 17.5. Tabla de Auditoría (`admin_audit_log`)

```sql
CREATE TABLE admin_audit_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_email  TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN (
    'create','revoke','reenroll','disable','enable','update_email','login_success','login_failure'
  )),
  performed_by TEXT NOT NULL,
  details      JSONB DEFAULT '{}',
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

RLS: Solo lectura vía `service_role_key` (TI). Ningún rol del ecosistema puede leer ni escribir.

#### 17.6. Detección de Soporte WebAuthn

Antes de mostrar el formulario, el componente verifica:
```typescript
const isSupported = window.PublicKeyCredential !== undefined;
const isPlatformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
```
Si no hay soporte: mensaje claro indicando incompatibilidad del navegador/dispositivo.

#### 17.7. Soporte Multi-Admin
- Múltiples administradores simultáneos con ciclo de vida independiente.
- Revocar un admin **no afecta** a los demás.
- Todos los admins son iguales (sin jerarquía super-admin dentro del ecosistema).
- `admin_audit_log` registra operaciones por admin.

#### 17.8. Correo — SMTP Propio
- Servicio de correo vía SMTP propio configurado en Supabase (igual que invitaciones a especialistas).
- Sin límite de 4 emails/hora del plan gratuito.
- Templates personalizados con branding amati.
- Magic Links enviados desde dominio institucional verificado.

#### 17.9. Casos de Borde

| Caso | Mitigación |
|------|------------|
| Magic Link expirado | TI re-ejecuta `reenroll` |
| Sesión expira antes de registrar Passkey | UI temporizador + mensaje inmediato |
| Email no llega | TI verifica logs Supabase → re-envía |
| Navegador no soporta WebAuthn | Detección previa, error claro |
| Múltiples Magic Links enviados | Solo el último válido (Supabase invalida anteriores) |
| `service_role_key` comprometida | Rotar clave, solo en variables de entorno seguras |
| Supabase Auth caído | Modo offline bloqueado para admin, mostrar mantenimiento |

#### 17.10. Componentes Angular
- **`features/admin-access/`** — Standalone, dos modos, paleta negro+dorado, logo amati, Turnstile captcha, detección WebAuthn.
- **`app.routes.ts`** — ruta `sistema > acceso` con children, lazy load.
- **`auth.service.ts`** — `loginWithPasskey(email, captchaToken?)`, `registerPasskey()`, `sendMagicLink(email)`. Bloqueo Admin en `activateMockSession()`.
- **`auth.guard.ts`** — verifica `session.amr` WebAuthn en `/admin/**`.

#### 17.11. Seguridad y Modo Offline
- `activateMockSession()` **no puede asignar rol `Admin`**.
- No hay traza de la ruta secreta en el código del login público.
- Modo offline para todos los roles se depreca en sprint futuro.

### Skill 15: Animaciones Premium y Micro-Interacciones
- **Transición de Entrada de Páginas (Page Transitions):** Todas las vistas principales del sistema (diario, chat, triage, agenda, etc.) se deslizarán suavemente hacia arriba y se desvanecerán al cargarse usando una curva `cubic-bezier(0.16, 1, 0.3, 1)` para un efecto fluido y premium.
- **Entrada Dinámica de Mensajes:** Las burbujas del chat no aparecerán bruscamente; en su lugar, se animarán con una escala sutil y elevación hacia arriba cuando se agreguen al flujo.
- **Micro-interacciones en Botones y Tarjetas:**
  - Los botones de estado de ánimo (`.mood-btn`) y botones de envío escalarán ligeramente hacia arriba (`scale(1.03)`) al pasar el ratón por encima, y se comprimirán (`scale(0.97)`) al ser presionados.
  - Las tarjetas de estadísticas y calendario se elevarán sutilmente y generarán una sombra profunda (`transform: translateY(-4px)`) en hover.
  - Los ítems de navegación lateral (`.nav-item`) se desplazarán lateralmente hacia la derecha (`transform: translateX(4px)`) al pasar el cursor para guiar el foco visual.

### Skill 18: Políticas de Consulta, Límites de Sesiones y Reagendas
- **Persistencia de Control:** Se crea la tabla relacional `student_policy_tracking` indexada por `student_id` y `academic_period` para registrar de manera estructurada las cancelaciones tardías, los cambios de especialista y el bypass del límite.
- **Límite de Sesiones:** Máximo 10 sesiones con el especialista por ventana académica.
  - **Excepción:** El especialista puede activar un bypass (`bypass_session_limit = true` en `student_policy_tracking`) para omitir el límite.
  - **UI del Estudiante:** Mostrar contador de sesiones restantes (ej. "Sesiones restantes: X / 10").
- **Baja por Inasistencia:** Si el estudiante acumula 3 inasistencias (`status = 'no_show'`) en la ventana actual, se actualiza su estado en `patient_settings` a `'dropout'` (baja).
- **Baja por Reagendas Tardías:** Cancelaciones de citas realizadas con menos de 72 horas de anticipación se consideran tardías. Si acumula 3 cancelaciones tardías en la ventana actual, se actualiza a `'dropout'` (baja).
- **Baja por Inactividad:** Si transcurren más de 30 días tras su última consulta completada sin que el estudiante tenga una nueva sesión agendada, se le considera `'dropout'` (baja).
- **Tratamiento del Alta:** Si el especialista da de alta al estudiante (`mode = 'discharge'`), su estatus en `patient_settings` cambia a `'discharged'` (alta), permitiéndole volver a solicitar atención inmediatamente sin esperar la ventana del siguiente periodo.
- **Cambio de Especialista:** Se limita a un máximo de 2 cambios de especialista por ventana (psicólogos y nutriólogos). Si se intenta un tercer cambio, se bloquea y se le instruye realizar una solicitud formal a la administración.
  - **Nota de Cierre de Tratamiento (`mode = 'closure'`):** En reasignaciones automáticas, se notifica al especialista anterior que debe redactar y firmar una Nota de Cierre de Tratamiento para transferir adecuadamente el caso antes de que el nuevo profesional continúe el tratamiento.

### Skill 19: Cuestionario PHQ-9 en el Diario y Expediente Clínico

**Objetivo:** Integrar la escala PHQ-9 (Cuestionario sobre la Salud del Paciente) de 9 ítems de depresión en la vista del Diario Estudiantil mediante un chatbot gamificado interactivo, restringir el agendamiento de citas si no ha sido respondido por primera vez, permitir la configuración de frecuencia por parte del psicólogo (semanas, meses, previo a consulta o manual/nunca) y otorgar logros en la plataforma.

#### 19.1. Lógica de Negocio y Base de Datos (PostgreSQL)
- **Capa de Almacenamiento:**
  - `public.student_clinical_records` -> Añadir `phq9_config` JSONB NOT NULL DEFAULT `'{"mode": "weeks", "value": 4}'::jsonb`.
  - `public.diary_entries` -> Añadir columnas:
    - `entry_type` VARCHAR(50) DEFAULT 'diary' NOT NULL (valores: `'diary'`, `'phq9'`).
    - `phq9_score` INTEGER NULL (rango 0 a 27).
    - `survey_data` JSONB NULL (respuestas a preguntas individuales).
- **Gamificación e Integración de Logros:**
  - Agregar logro global con `requirement_type = 'phq9'` para la primera completación del test, otorgando 50 XP y la insignia "Primer Diagnóstico PHQ-9".
  - Actualizar la función `update_user_activity_streak` para contar registros con `entry_type = 'phq9'` al procesar la categoría `'phq9'`.

#### 19.2. Lógica de Re-aplicación del Cuestionario
Al ingresar al diario (`diary-dashboard`):
- Si el estudiante **no tiene asignado un psicólogo** (`primary_psychologist_id` es NULL en `student_clinical_records`), se aplica la regla de fallback por defecto: **cada 4 semanas (28 días)**.
- Si el estudiante **tiene psicólogo asignado**, se consulta su `phq9_config` y se aplica el test si:
  - No existe ninguna entrada previa de tipo `phq9`.
  - `mode = 'weeks'` y han transcurrido `value * 7` días desde la última aplicación.
  - `mode = 'months'` y han transcurrido `value * 30` días desde la última aplicación.
  - `mode = 'before_session'` y existe una cita programada (`status = 'scheduled'`) en los siguientes días, y no se ha respondido un test en los últimos 3 días.
  - `mode = 'manual'` -> El test no se reactiva automáticamente, solo se aplica cuando el psicólogo lo active manualmente.

#### 19.3. Chatbot Estudiantil (Diario - Columna Derecha)
- Cuando el test está pendiente, el editor estándar Quill de la columna derecha del diario se sustituye por la ventana de **Amati Clínico** (chatbot).
- El chatbot realiza las 9 preguntas secuencialmente utilizando el estilo gamificado con barra de agua progresiva y el delfín saltarín.
- **Flujo condicional (Pregunta 10):** Si el estudiante marcó molestia en cualquiera de las 9 preguntas (puntaje > 0), se realiza la pregunta 10 sobre dificultad en actividades diarias. Si no, se salta directamente al cierre.
- **Validación de Riesgo Clínico:** Si la pregunta 9 (ideación/pensamientos de daño) recibe una respuesta diferente de "Ningún día" (puntaje > 0), la entrada se marcará automáticamente con `high_risk = true` y se alertará al psicólogo asignado.
- Al terminar, se formatea un resumen legible de los resultados en `content` (el cual es encriptado en Supabase) para mantener retrocompatibilidad con las exportaciones de PDF del expediente.

#### 19.4. Restricción de Agenda Estudiantil
- En el componente de agenda del estudiante (`student-agenda.component.ts`), si no se encuentra ningún registro en `diary_entries` con `entry_type = 'phq9'`, se bloquea la vista del calendario.
- En su lugar, se despliega una tarjeta informativa centrada y estilizada con fondo glassmorphic indicando que por seguridad del paciente debe completar su evaluación PHQ-9 en el diario antes de poder agendar su primera sesión.

#### 19.5. Panel de Control y Configuración Clínica (Psicólogo)
- **Configuración Dinámica:** En el perfil del paciente en el Command Center del Psicólogo, se añade un control de periodicidad dinámico.
  - El psicólogo selecciona la modalidad ("Semanas", "Meses", "Previo a consulta", "Manual/Nunca") y el valor numérico para actualizar en vivo el objeto `phq9_config`.
- **Evolución Histórica:** La gráfica de evolución PHQ-9 se conecta a la base de datos real consultando el historial de `diary_entries` del paciente de tipo `phq9`, ordenados de forma ascendente.
- **Tarjeta de Resultados:** Se dibuja una tarjeta similar a la de EAT-26 detallando la última puntuación, su severidad (Leve, Moderada, Severa) y la sugerencia de acción clínica basada en protocolos.
- **Nutriólogo:** El nutriólogo visualiza la evolución real en su perfil de paciente mediante la gráfica pero no tiene acceso al control de configuración de re-aplicación.

### Skill 20: Recordatorio de Citas de 24 Horas por Correo

**Objetivo:** Enviar automáticamente un correo recordatorio premium con diseño Amati y logotipo institucional al paciente 24 horas antes de su cita agendada.

#### 20.1. Modelo de Datos (PostgreSQL)
- **Columna Adicional:** Añadir `reminder_24h_sent` BOOLEAN DEFAULT FALSE a `public.appointments` para registrar el estado de envío y evitar duplicación.
- **Índice de Optimización:** Crear índice compuesto en `(status, scheduled_date, reminder_24h_sent)` en la tabla `public.appointments`.

#### 20.2. Edge Function de Supabase (`send-appointment-reminder`)
- **Consulta de Citas:** Obtener citas en estado `'scheduled'` que inicien en un rango de 23 a 25 horas a partir del momento de ejecución, donde `reminder_24h_sent = false`.
- **Recuperación de Datos:** Obtener el correo y nombre del paciente (`profiles` + `auth.users`), nombre del especialista, y los detalles del consultorio (modalidad, facultad, edificio, consultorio, enlace de recorrido virtual o enlace de reunión virtual).
- **Envío de Correo:** Usar SMTP configurado en variables de entorno (`SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`) mediante `nodemailer` en Deno.
- **Diseño Premium HTML (Amati style):**
  - Encabezado con degradado de marca (violeta/índigo: `#6366f1` a `#8b5cf6`), logo de Amati en SVG blanco, tipografía Inter/sans-serif.
  - Sección estructurada con los detalles de la cita en caja clara con borde de color de acento.
  - Botón CTA de acceso directo a la plataforma.
  - Mensaje aclaratorio sobre la política de reagendas tardías y cancelación (72h) y cumplimiento NOM-024 / HIPAA.
- **Actualización de Estado:** Marcar `reminder_24h_sent = true` para evitar reenvíos.

#### 20.3. Programación Periódica (Cron)
- **Frecuencia:** Cada hora (ej. `0 * * * *`).
- **Orquestación:** Usar `pg_cron` en Supabase para invocar la Edge Function mediante petición HTTP POST segura autenticada con la clave `service_role`.


### Skill 21: Visor del Historial de Chat de Amati (Psicólogo)

**Objetivo:** Permitir al psicólogo y al administrador consultar de manera segura el historial exacto de conversaciones que el estudiante ha sostenido con la Inteligencia Artificial Amati, facilitando el análisis clínico longitudinal.

#### 21.1. Seguridad y RLS en Base de Datos
- Las políticas de seguridad RLS en `public.chats` y `public.messages` se modifican para habilitar el acceso en consulta (`SELECT`) a psicólogos (`role_id = 3`) y administradores (`role_id = 1`), manteniendo bloqueada la escritura.

#### 21.2. Reutilización de Interfaz en Modo Solo Lectura
- El componente `DashboardComponent` de chat se adapta para aceptar los inputs `@Input() studentId` y `@Input() readOnly`.
- En modo `readOnly = true`, se deshabilita y oculta por completo el área de entrada de texto, los micrófonos, y las sugerencias de chat.
- El header muestra un selector de sesiones que permite al profesional cambiar dinámicamente entre chats históricos recuperados de Supabase.

#### 21.3. Integración en el Expediente Clínico
- Se coloca un botón de consulta en el bloque de "Análisis de Amati" del expediente del paciente.
- Al hacer clic, se oculta el expediente y se despliega la interfaz del chat en pantalla completa, incorporando un botón destacado para regresar al expediente principal.

---

### Skill 22: Elección de Especialista por el Estudiante + Modelo Geo Multi-Campus BUAP

**Objetivo:** Redefinir el modelo de asignación de especialistas — el estudiante elige libremente a su psicólogo y/o nutriólogo desde **Configuración**, nunca en el registro. La selección muestra la calificación promedio del especialista (evaluaciones post-sesión del Skill 13) y ordena la lista por proximidad geográfica real al estudiante, usando un modelo de datos geoespacial multi-campus compatible con GeoJSON estándar.

---

#### 22.1. Reglas de Negocio

| Regla | Detalle |
|---|---|
| Asignación en registro | **Eliminada.** El registro solo crea el expediente clínico vacío (sin especialistas). |
| Punto de asignación | Exclusivamente desde **Configuración del Estudiante** → sección "Mi Especialista" |
| Elección libre | El estudiante puede elegir cualquier especialista activo, no solo el más cercano |
| Especialista sin facultad | No permitido. Admin obligado a asignar `faculty_id` al registrar un especialista |
| Cambio de especialista | Máximo 2 cambios por período académico (`specialist_changes_*` en `student_policy_tracking`) |
| Sin especialista en facultad propia | Se muestran especialistas de otras facultades/campus con mensaje informativo |
| Referimiento automático | El sistema ordena los externos por distancia; el estudiante decide si acepta o no |

---

#### 22.2. Modelo de Datos Geoespacial Multi-Campus

**Jerarquía:**
```
campuses  (CU / CCU / CU2 / Regionales)
  └── faculties  [lat/lng centroide WGS-84]
        └── buildings  [lat/lng exacto — catálogo Fase 2]
              └── health_professional_settings.office_room  [texto libre]
```

##### Tabla `campuses` — campos nuevos

| Columna | Tipo | Descripción |
|---|---|---|
| `campus_code` | TEXT UNIQUE | `'CU'`, `'CCU'`, `'CU2'`, `'REG_SUR'`… |
| `latitude` | DECIMAL(10,7) | Centroide WGS-84 del campus |
| `longitude` | DECIMAL(10,7) | Centroide WGS-84 del campus |
| `map_type` | TEXT | `'buap_virtual'` \| `'google_maps'` \| `'none'` |
| `map_config` | JSONB | Config del visor: `{"tile_url":…, "center":…, "zoom":…}` |

##### Tabla `faculties` — campos nuevos

| Columna | Tipo | Descripción |
|---|---|---|
| `faculty_code` | TEXT | `'FCC'`, `'MED'`, `'DER'`… |
| `latitude` | DECIMAL(10,7) | Centroide WGS-84 (auto-poblado por script Fase 1) |
| `longitude` | DECIMAL(10,7) | Centroide WGS-84 |
| `has_service` | BOOLEAN DEFAULT FALSE | `TRUE` si ≥1 especialista activo tiene esta facultad |

##### Tabla `buildings` — NUEVA

```sql
CREATE TABLE public.buildings (
  id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  faculty_id  BIGINT NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,      -- 'Edificio de Aulas 1', 'Edificio Arronte'
  code        TEXT,               -- 'EMA1', 'ARR', 'CB1'
  latitude    DECIMAL(10,7),      -- WGS-84 (Fase 2: catálogo manual)
  longitude   DECIMAL(10,7),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: SELECT autenticados. INSERT/UPDATE/DELETE solo Admin (role_id = 1).
```

Mientras `building_id IS NULL` en `health_professional_settings`: se usa `building TEXT` libre y coordenadas de `faculties` como fallback. Sin bloqueo funcional.

##### Tabla `health_professional_settings` — campo nuevo

| Columna | Tipo | Descripción |
|---|---|---|
| `building_id` | BIGINT FK NULLABLE | Referencia al catálogo `buildings`. NULL = usa texto libre |

**Prioridad de ubicación del especialista:**
1. `building_id` → `buildings.latitude/longitude`
2. `faculty_id`  → `faculties.latitude/longitude`
3. `building TEXT` + `office_room TEXT` siempre visible al estudiante

---

#### 22.3. Estrategia de Datos Geográficos (2 Fases)

##### Fase 1 — Automática (script `scripts/extract-buap-geo.js`)

El script de Node.js:
1. Descarga y parsea `markers.js` del mapa virtual BUAP
2. Extrae nombre, `virtual_tour_url`, `buap_info_url` por Feature
3. Resuelve cada short URL `maps.app.goo.gl/...` → lat/lng WGS-84 real
4. Genera `public/assets/geo/cu-campus.geojson` y `db/seeds/faculties-geo.sql`

> **Nota técnica:** Las coordenadas en `markers.js` son píxeles de CRS local (tiles propios), NO WGS-84. La única fuente de coordenadas reales son los links de Google Maps (`ruta`) de cada Feature.

##### Fase 2 — Manual (sin fecha comprometida)

Catálogo de `buildings` llenado desde panel Admin cuando haya disponibilidad. El modelo ya está preparado.

---

#### 22.4. RPC `get_specialists_for_student`

```sql
CREATE OR REPLACE FUNCTION public.get_specialists_for_student(
  p_student_id UUID,
  p_role_id    INTEGER  -- 3 = psicólogo, 4 = nutriólogo
)
RETURNS TABLE (
  id                  UUID,
  first_name          TEXT,
  last_name           TEXT,
  faculty_name        TEXT,
  faculty_code        TEXT,
  campus_name         TEXT,
  campus_code         TEXT,
  modality            TEXT,
  building_name       TEXT,        -- buildings.name o hps.building (fallback)
  office_room         TEXT,
  rating_avg          DECIMAL(3,2),
  total_evaluaciones  BIGINT,
  specialist_lat      DECIMAL(10,7),  -- buildings.lat o faculties.lat
  specialist_lng      DECIMAL(10,7),
  student_lat         DECIMAL(10,7),  -- lat de la facultad del estudiante
  student_lng         DECIMAL(10,7),
  current_load        BIGINT,
  capacity            INTEGER
) LANGUAGE plpgsql SECURITY DEFINER;
```

- Solo retorna especialistas activos (`is_active = TRUE`) con `faculty_id NOT NULL`
- `rating_avg` = AVG(`score_global`) de `session_evaluations` por `professional_id`
- El cálculo de `distancia_km` lo realiza el cliente con fórmula Haversine

---

#### 22.5. Ordenamiento en Cliente Angular

```
1° Misma facultad del estudiante
2° Mismo campus    → distancia_km ASC
3° Otro campus     → distancia_km ASC
Dentro de cada grupo: rating_avg DESC, luego (capacity - current_load) DESC
```

---

#### 22.6. UI — Sección "Mi Especialista" en Configuración del Estudiante

Sin pestaña nueva. Se integra como sección dentro de `student-settings.component`.

**Para cada tipo (Psicólogo / Nutriólogo):**
- Si hay especialista asignado: card compacta del actual + botón "Cambiar" (con badge de cambios restantes; deshabilitado si `remainingChanges === 0`)
- Lista de especialistas:
  - Iniciales / avatar
  - Badge: `🏫 Tu facultad` / `🏛️ Mismo campus · X.X km` / `📍 Otro campus · X.X km`
  - Edificio y consultorio si disponibles
  - Calificación: ★★★★☆ 4.2 (23 evaluaciones) o "Sin evaluaciones aún"
  - Chip modalidad: Virtual / Presencial
  - Barra de capacidad: X/Y pacientes
  - Botón "Elegir" / "Tu especialista actual" (readonly)
- Mensaje informativo si no hay especialistas en la facultad propia

**Interface TypeScript `SpecialistOption`:**
```typescript
interface SpecialistOption {
  id: string;
  first_name: string;
  last_name: string;
  faculty_name: string;
  faculty_code: string;
  campus_name: string;
  campus_code: string;
  modality: 'virtual' | 'presencial';
  building_name: string | null;
  office_room: string | null;
  rating_avg: number | null;
  total_evaluaciones: number;
  distancia_km: number | null;
  proximity_tier: 'same_faculty' | 'same_campus' | 'other_campus';
  current_load: number;
  capacity: number;
}
```

---

#### 22.7. GeoJSON Assets — Formato Estándar RFC 7946

```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": { "type": "Point", "coordinates": [-98.2019, 19.0477] },
    "properties": {
      "name": "Facultad de Ciencias de la Computación",
      "code": "FCC",
      "campus_code": "CU",
      "area": "Ingeniería y Ciencias Exactas",
      "buap_info_url": "https://plantafisica.buap.mx/...",
      "virtual_tour_url": "https://recorridosvirtuales.buap.mx/computacion/",
      "google_maps_url": "https://maps.app.goo.gl/..."
    }
  }]
}
```

Archivos: `public/assets/geo/cu-campus.geojson`, `ccu-campus.geojson`, `cu2-campus.geojson`, `regionales.geojson`.

---

#### 22.8. Admin — Validaciones Nuevas para Registro de Especialista

- `faculty_id`: campo **requerido** en formulario (no nullable)
- Dropdown `building_id`: carga dinámica al seleccionar facultad
- Si no hay edificios en la facultad: campo `building TEXT` libre + nota "Puedes agregar edificios al catálogo"
- Botón "Agregar edificio" para crear entradas en `buildings` desde el panel

---

#### 22.9. Archivos Involucrados

| Archivo | Acción |
|---|---|
| `scripts/extract-buap-geo.js` | NUEVO — ejecutar una sola vez |
| `public/assets/geo/cu-campus.geojson` | GENERADO por script |
| `db/seeds/faculties-geo.sql` | GENERADO por script |
| `db/migration_specialist_choice.sql` | NUEVO |
| `src/app/core/services/clinical.service.ts` | MODIFICAR |
| `src/app/core/services/faculty.service.ts` | MODIFICAR |
| `src/app/features/auth/register/register.component.ts` | MODIFICAR |
| `src/app/features/auth/register/register.component.html` | MODIFICAR |
| `src/app/features/student/settings/student-settings.component.ts` | MODIFICAR |
| `src/app/features/student/settings/student-settings.component.html` | MODIFICAR |
| Admin: componente registro de profesionales | MODIFICAR |
