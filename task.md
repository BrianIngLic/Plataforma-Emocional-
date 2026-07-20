# Tareas de Implementación (Spec-Driven Development)

- [x] Crear el archivo `.constitution.md` en el repositorio base.
- [x] Redactar la especificación formal en `spec.md` dividida por Skills en orden numérico estricto.
- [x] Configurar los perfiles de agentes en `.diana/agents.yaml`.

## Skill 1: Capa de Datos (PostgreSQL + PostgREST)
- `[x]` Crear directorio `db` y archivo `schema.sql`.
- `[x]` Modelo actualizado a Matrícula universal y tabla relacional de `messages`.

## Skill 2: Autenticación y Onboarding Clínico (Fase actual: Ejecutada)
**2.1. Configuración Core e Interceptores**
- `[x]` Instalar Angular Material (`@angular/material`) y configurar tema oscuro personalizado en `styles.scss`.
- `[x]` Configurar variables de entorno (`environments/environment.ts`) para las URLs de API.
- `[x]` Crear `AuthInterceptor` para inyectar el Bearer Token (JWT) en todas las peticiones salientes.
- `[x]` Crear `AuthGuard` funcional basado en `inject(AuthService)` para proteger el dashboard clínico.

**2.2. Capa de Servicios (`core/services`)**
- `[x]` Desarrollar `AuthService` (Signals / RxJS) con métodos genéricos: `login()`, `register()`, `logout()`.
- `[x]` Desarrollar `ClinicalService` para manejar el envío del cuestionario clínico inicial.

**2.3. Feature: Login (`features/auth/login`)**
- `[x]` UI: Formulario minimalista Glassmorphism.
- `[x]` Inputs: Matrícula y Contraseña (con validadores de campos obligatorios).
- `[x]` Lógica: Mostrar alertas de "Credenciales incorrectas" visualmente integradas.

**2.4. Feature: Registro / Onboarding Stepper (`features/auth/register`)**
- `[x]` **Paso 1 (Credenciales):** Input de Matrícula, Contraseña y Confirmar Contraseña (validador cruzado).
- `[x]` **Paso 2 (Perfil):** Nombre y Apellido.
- `[x]` **Paso 3 (Expediente Estudiantil):** Checkboxes de condiciones clínicas preexistentes de selección múltiple y campo de "Notas Adicionales".
- `[x]` **Paso 4 (Consentimiento):** Aceptación de términos médicos y disclaimer obligatorio ("La IA no sustituye terapia").
- `[x]` Lógica: Empaquetar todo el payload del stepper y enviarlo a los servicios de PostgREST en una transacción lógica.

**2.5. Ruteo Global (`app.routes.ts`)**
- `[x]` Configurar Lazy Loading (`loadComponent` o `loadChildren`) para la ruta `/auth`.
- `[x]` Redirección por defecto: Si no hay token, redirigir a `/auth/login`.

**2.6. Feature: Recuperación de Contraseña (`features/auth/forgot-password`)**
- `[x]` Añadir métodos `requestPasswordReset` y `updatePassword` en `AuthService`.
- `[x]` Crear vista de `forgot-password` para solicitar el link con el correo.
- `[x]` Crear vista de `reset-password` para capturar el token e ingresar la nueva contraseña.
- `[x]` Integrar SweetAlert / UI Kit ("spect kit") para notificaciones visuales del estado del correo.

---

## Skill 3: Amati Chat Estudiantil (Fase actual: Ejecución)
**3.1. Arquitectura y Servicios (`core/services/chat.service.ts`)**
- `[x]` Desarrollar `ChatService` utilizando *Signals* para manejar el estado reactivo de los mensajes en memoria.
- `[x]` Implementar métodos simulados (`sendMessageMock()`) que reciban texto y devuelvan una respuesta falsa de la IA con un ligero retraso de tiempo, preparándolo para la conexión real.

**3.2. Layout Base (`features/chat/dashboard`)**
- `[x]` Maquetar un layout principal de 2 columnas usando CSS Grid.
- `[x]` Columna Izquierda (Sidebar): Historial de conversaciones previas y botón "Nuevo Chat".
- `[x]` Columna Derecha: Área principal de mensajería activa.

**3.3. Interfaz de Conversación (`features/chat/components`)**
- `[x]` Desarrollar el componente de la ventana de mensajes (`MessageList`).
- `[x]` Diseñar burbujas de chat diferenciadas (Usuario a la derecha, IA a la izquierda).
- `[x]` Aplicar auto-scroll hacia abajo cuando entra un nuevo mensaje.

**3.4. Componente de Entrada (`features/chat/input-bar`)**
- `[x]` Diseñar la barra inferior con input de texto responsivo y botón de envío integrado.
- `[x]` Añadir lógica para evitar envíos vacíos y permitir usar la tecla `Enter` para disparar la acción.

**3.5. Ruteo y Protección (`app.routes.ts`)**
- `[x]` Configurar el ruteo Lazy-Loaded hacia el módulo de chat en la ruta principal (ej. `/dashboard`).
- `[x]` Proteger la ruta asegurando que deba pasar por el `AuthGuard`.

---

## Skill 4: NutriMind (Módulo Alimentario)
**4.1. Dashboard y Progresos**
- `[ ]` Desarrollar el panel con barras de progreso para proteínas, grasas y carbohidratos.
- `[ ]` Listado de comidas agrupadas por tiempo (desayuno, comida, cena, colaciones).
*(Skill 4 se mantendrá sincronizada en el backlog)*

---

## Skill 5: Command Center Clínico (Fase actual: Ejecución)

**5.1. Enrutamiento y Layout del Psicólogo (`features/psychologist`)**
- `[x]` Configurar `psychologist.routes.ts` (`/psychologist/dashboard`, `/psychologist/patients`).
- `[x]` Crear un Layout dedicado para el rol clínico (con un sidebar distinto al del estudiante).

**5.2. Dashboard Principal de Triage (`dashboard.component`)**
- `[x]` Migrar y adaptar el `Dashboard.tsx` de React a Angular.
- `[x]` Integrar tarjetas estadísticas, lista de emergencias (`urgency_score`), y agenda diaria simulada.
- `[x]` Integrar gráficas (`Recharts` equivalente en Angular, como `ngx-charts` o Chart.js).

**5.3. Directorio de Pacientes (`patients-list.component`)**
- `[x]` Migrar `Patients.tsx` a Angular.
- `[x]` Implementar la tabla con filtros por nombre y niveles de riesgo.

**5.4. Visor Clínico Integral (`patient-profile.component`)**
- `[x]` Migrar `PatientProfile.tsx` a Angular (Gráficas de progreso, historial de sesiones).
- `[x]` Integrar la visualización del análisis de Amati (Chat Inteligente) desde la perspectiva clínica.
- `[x]` Integrar la visualización del "Mi Diario" (Skill 6) en el perfil del paciente.

**5.5. Agenda Clínica (`agenda.component`)**
- `[x]` Desarrollar la interfaz visual del calendario (CSS Grid mensual/semanal).
- `[x]` Lógica de gestión de citas (ver detalles de la cita, marcar completada, agendar nueva cita).
- `[x]` Integrar ruta `/psychologist/agenda` y enlazar con el botón en el layout.

**5.6. Configuración Híbrida y Recorridos Virtuales (`settings.component` & `student-agenda.component`)**
- `[x]` Base de Datos y Backend: Extender `psychologist_settings` en `agenda.service.ts` para persistir `modality`, `faculty_id`, `building` y `office_room`.
- `[x]` Servicios: Actualizar `AgendaService.getSettings` y `getStudentAvailableSlots` para realizar un join con `faculties(id, name, virtual_tour_url)`.
- `[x]` Interfaz del Psicólogo (`settings.component`): Añadir selector de modalidad (`Virtual` vs `Presencial`), con preselección de la facultad base del especialista, campo de edificio y número de oficina/aula.
- `[x]` Interfaz del Estudiante (`student-agenda.component` y `appointment-modal.component`): Recuperar y mostrar el lugar de atención detallado y habilitar el botón "📍 Abrir Recorrido Virtual" apuntando a la URL inmersiva de la BUAP al agendar y en el banner de cita confirmada.
- `[x]` Reserva Unificada Estudiantil: Modificar `student-agenda.component` y `appointment-modal.component` con un Combo Box de selección en el mismo calendario unificado y alertas emergentes si no se cuenta con especialista asignado.

**5.7. Refactorización Arquitectónica: Herencia de Personal de la Salud**
- `[x]` Base y Modelos (`core/models` o `core/base`): Crear clase/estructura base `HealthProfessionalBase` que encapsule la lógica común de dashboard, agenda, directorio de pacientes y ajustes.
- `[x]` Refactor de Componentes Compartidos: Unificar las vistas y lógica redundante entre `features/psychologist` y `features/nutritionist`.
- `[x]` Lógica de Factor de Diferenciación (Notas Médicas): Mantener e inyectar dinámicamente `ClinicalNoteComponent` (Quill SOAP) para Psicólogos y `PerfilPaciente` (Gestión Nutricional + PDF) para Nutriólogos.
- `[x]` Ruteo y Guards: Adaptar las rutas para consumir la base común de Personal de la Salud manteniendo las URLs limpias (`/psychologist/...` y `/nutritionist/...`).

**5.8. Sistema Híbrido de Difusión Simultánea (Web Push + WhatsApp API)**
- `[x]` Arquitectura y Spec: Diseñar el modelo de Emisión Simultánea (*Dual Broadcast*) en `spect.md` local y global para mitigar restricciones de planes móviles prepago con redes sociales ilimitadas.
- `[ ]` Base de Datos: Crear tabla `web_push_subscriptions` y añadir `mobile_phone`, `whatsapp_opt_in` y `dual_notification_status` a `users` y `appointments`.
- `[ ]` Backend Webhook: Programar Orquestador Híbrido Simultáneo en Supabase Edge Functions (`Promise.allSettled` para Web Push y WhatsApp API).
- `[ ]` Interfaz del Especialista: Refactorizar modal de cancelación de emergencia en `agenda.component.ts` de especialistas para incorporar motivo explícito y selección de emisión dual.

---

## Skill 6: Mi Diario Personal (Fase actual: Ejecución)

**6.0. Refactorización de Layout Central (`features/dashboard`)**
- `[x]` Extraer el Sidebar de Chat hacia un componente global `DashboardLayoutComponent`.
- `[x]` Configurar `<router-outlet>` y redirigir `/dashboard` a `/dashboard/chat`.

**6.1. Servicio de Datos (`core/services/diary.service.ts`)**
- `[x]` Desarrollar `DiaryService` para manejar el estado reactivo de las entradas del diario (CRUD simulado).

**6.2. Interfaz de Usuario (`features/diary`)**
- `[x]` Componente Principal: Vista dividida (Calendario interactivo a la izquierda, editor a la derecha).
- `[x]` Editor: Campo de texto libre y selector Múltiple de Estado de Ánimo (Mood Tracker con iconos).
- `[x]` Historial: Lógica del calendario para mostrar iconos en días con entradas guardadas.

**6.3. Integración en el Dashboard**
- `[x]` Crear `diary.routes.ts` y conectarlo como ruta hija bajo `/dashboard/diary`.
- `[x]` Hacer que el botón "Mi Diario" del menú de navegación navegue dinámicamente a la ruta.

---

## Skill 7: Gestión de Perfil y Avatares (Fase actual: Planeación SDD)

**7.1. Configuración de Base de Datos y Storage**
- `[x]` Crear un nuevo Bucket en Supabase Storage llamado `avatars`.
- `[x]` Configurar Políticas de Seguridad (RLS) en el bucket (Lectura pública, Escritura solo para usuarios autenticados propios).
- `[x]` Añadir la columna `avatar_url` (tipo TEXT) a la tabla `profiles` en la base de datos.

**7.2. Capa de Servicios (`core/services/profile.service.ts`)**
- `[x]` Crear servicio dedicado a perfiles (`ProfileService`).
- `[x]` Implementar método `uploadAvatar(file: File)` para subir la imagen al Supabase Storage.
- `[x]` Implementar método `updateAvatarUrl(url: string)` para guardar la ruta en `public.profiles`.
- `[x]` Actualizar `AuthService.loadUserProfile()` para recuperar y guardar el `avatar_url` en el estado global (Signals).

**7.3. Interfaz de Configuración de Perfil (`features/settings/profile`)**
- `[x]` Crear vista unificada de configuración de perfil aplicable a todos los roles.
- `[x]` Componente visual de carga: Drag & Drop para subir imagen, o selector para armar un Avatar predefinido.
- `[x]` Lógica de visualización previa (Preview) de la imagen recortada en formato circular antes de guardar.
- `[x]` Botones de "Guardar Cambios" conectados con el UI Kit (notificaciones de éxito).

**7.4. Integración Transversal (Layouts)**
- `[x]` Modificar `DashboardLayoutComponent` (Estudiante) para consumir y mostrar el `avatar_url` en el menú.
- `[x]` Modificar `PsychologistLayoutComponent` para mostrar el avatar.
- `[x]` Modificar Navbar / Top Menu general para que reaccione dinámicamente si el `currentUser` cambia su foto.

---

## Skill 8: Módulo de Administración (Core System)
- `[ ]` Dashboard de Administrador (`admin-layout.component`).
- `[x]` **Directorio General Unificado:** Consolidar alumnos y especialistas en `/admin/directory`.
- `[x]` **Buscador y Selector Dinámico:** Filtro dinámico en cabecera de alumnos y selección de especialista para cargar su perfil de detalle.
- `[x]` **Filtros Notion-like:** Implementar filtros laterales de checkboxes para asignación, facultades y estados clínicos.
- `[x]` **Reasignación Inline:** Selectores combobox para reasignar especialistas en tiempo real desde la tabla.
- `[x]` Formulario seguro de Alta de Personal Clínico (Psicólogos y Nutriólogos) mediante Edge Function.
- `[ ]` Panel de gestión de usuarios (suspensión, reactivación).
- `[ ]` **Configuración de Marca de Agua Institucional:** Crear módulo en `features/admin/settings` para subir el logotipo/marca de agua oficial al bucket de Supabase Storage `institutional_assets`.

---

## Skill 9: RoleGuard Security (Fase actual: Ejecutada)
- `[x]` Crear funcional `roleGuard` (`core/guards/role.guard.ts`) que evalúe `expectedRole`.
- `[x]` Lógica de redirección inteligente al panel base correspondiente (`/dashboard`, `/psychologist`, `/admin`).
- `[x]` Inyectar `roleGuard` y metadatos `data: { expectedRole }` en `app.routes.ts`.

---

## Skill 10: Sistema de Logros y Gamificación (Estilo Duolingo)
- `[x]` Base de Datos: Crear tablas `achievements`, `user_achievements`, `achievement_categories` y `user_streaks` con RLS y políticas de seguridad.
- `[x]` Capa de Servicios (`core/services/gamification.service.ts`): Desarrollar lógica reactiva (Signals) para calcular rachas (*streaks*), acumular XP, y ruteo a RPC del Streak Engine en Supabase.
- `[x]` Interfaz de Gestión (Admin y Clínicos): Crear panel e inyección en `patient-profile.component.ts` para que especialistas (psicólogos y nutriólogos) puedan asignar metas y logros personalizados en vivo.
- `[x]` Interfaz Estudiantil (`features/gamification`): Diseñar la galería de logros con medallas Glassmorphic, barra de XP reactiva y widget de racha (`app-streak-badge`) en el menú lateral.
- `[x]` Animaciones y Alertas: Implementar animaciones CSS de pulso de llama y rebotes al completar metas, integrando con diario emocional y Amati IA.

---

## Skill 11: Chat Interno Conectado con Meta Cloud API (WhatsApp Bidireccional)
- `[x]` Base de Datos: Crear tablas `internal_meta_chats` y `webhook_logs` en `schema.sql` con indexación para búsquedas rápidas.
- `[x]` Backend y Webhooks (`supabase/functions/meta-whatsapp`): Programar la Edge Function en Deno para enviar mensajes a la API de Meta y recibir respuestas entrantes de WhatsApp.
- `[x]` Capa de Servicios (`core/services/internal-chat.service.ts`): Conectar con Supabase Realtime para transmitir y recibir los mensajes en vivo sin recargar la página.
- `[x]` Interfaz de Command Center (`features/health-professional/command-center-chat`): Desarrollar el módulo de mensajería interna para Administradores y Médicos (lista de chats, panel central, burbujas de estado de entrega).
- `[x]` Ciberseguridad: Auditar el enmascaramiento de números y desinfección de Información Personal de Salud (PHI).

---

## Skill 12: Dossier Clínico Unificado, Marca de Agua y Meta Seal (Exportación Masiva PDF)
- `[x]` Arquitectura Estricta de Código Abierto: Instalar y configurar `jsPDF` (sin dependencias comerciales o cerradas, respetando el ecosistema existente).
- `[x]` Capa de Servicios (`core/services/dossier-export.service.ts`): Desarrollar orquestador de datos que unifique consultas de perfil, notas SOAP, registros nutricionales, diario personal y test de Amati IA.
- `[x]` Marca de Agua Institucional: Aplicar marca de agua diagonal transparente (como membrete y fondo del PDF).
- `[x]` Implementación de Meta Seal: Generar hash HMAC-SHA256 mediante `Web Crypto API` (`SubtleCrypto`), integrándolo como sello visible en el resumen ejecutivo y en los metadatos del PDF para garantizar el principio legal de No Repudio (NOM-024 / HIPAA).
- `[x]` Interfaz de Usuario: Insertar botones de "📥 Exportar Dossier Completo" en el perfil del paciente dentro del Command Center clínico y administrativo.

---

## Fase 13: Fase de Integración Backend (PostgreSQL / PostgREST)

**13.1. Configuración del Entorno**
- `[x]` Configurar `environments/environment.ts` con credenciales de la API y llave de cifrado E2EE.
- `[x]` Instalar cliente (Supabase JS o HttpClient) y librería criptográfica (`crypto-js`).
- `[x]` Crear servicio base de conexión (`supabase.service.ts` y `crypto.service.ts`).

**13.2. Refactorización de Autenticación**
- `[x]` Conectar `auth.service.ts` con la base de datos para login real y manejo de sesión JWT.
- `[x]` Conectar el stepper de registro (`register.component.ts`) para guardar datos en las tablas `users`, `profiles` y `student_clinical_records`.

**13.3. Refactorización de Skills**
- `[x]` Conectar `chat.service.ts` con la tabla `messages`.
- `[x]` Conectar `diary.service.ts` (si existe la tabla, pendiente de crear en schema) o simular.
- `[x]` Conectar listado de pacientes del psicólogo con las tablas reales.

---

## Skill 13: Sistema de Evaluación Post-Sesión — FIT Gamificado (Fase actual: Planeación)

> **Base clínica:** Session Rating Scale (SRS, Duncan et al.), Working Alliance Inventory (WAI, Horvath & Greenberg), Session Impacts Scale (Elliott & Wexler), Hope Theory (Snyder).
> **Metodología:** Feedback-Informed Treatment (FIT) + Routine Outcome Monitoring (ROM).
> **Enfoque UX:** Gamificación con caritas emocionales (emoji-scale), tarjetas secuenciales y micro-animaciones.

---

**13.1. Base de Datos (`db/schema.sql` / migración)**
- `[x]` Crear tabla `session_evaluations` con columnas: `id`, `appointment_id` (FK), `patient_id` (FK), `professional_id` (FK), `q1_global`, `q2_bond`, `q3_goals`, `q4_impact` (DECIMAL 2,1 cada una), `q5_comment` (TEXT nullable), `score_global` (DECIMAL 2,1 calculado), `rupture_flag` (TEXT: `critical`/`decline`/`healthy`/`pending`), `is_visible_to_professional` (BOOLEAN), `created_at`.
- `[x]` Restricción UNIQUE en `appointment_id` (una sola evaluación por cita).
- `[x]` Aplicar RLS: paciente solo puede INSERT en su propia fila; especialista solo SELECT sobre sus citas; admin SELECT sobre `score_global` y `rupture_flag` agregados por profesional.

**13.2. Capa de Servicios (`core/services/session-evaluation.service.ts`)**
- `[x]` Método `submitEvaluation(payload)`: INSERT + calcula `score_global` (q1×0.20 + q2×0.30 + q3×0.25 + q4×0.25) + determina `rupture_flag`.
- `[x]` Método `getEvaluationByAppointment(appointmentId)`: bloquear doble envío.
- `[x]` Método `getEvaluationsByProfessional(professionalId)`: agrega para panel del especialista y admin.
- `[x]` Integrar con `appointments`: detectar citas recién marcadas como `completed` para habilitar el trigger en panel del estudiante.

**13.3. Componente Emoji-Scale (Reutilizable) (`features/student/session-feedback/emoji-scale/`)**
- `[x]` Crear `emoji-scale.component.ts/html/scss` con Input `@Input() question: string` y Output `@Output() scored: EventEmitter<number>`.
- `[x]` 5 emojis pulsables (😞😐🙂😊🤩) con código de color progresivo (rojo → índigo).
- `[x]` Micro-animación *bounce* al seleccionar 4–5; reacción empática suave al seleccionar 1–2.
- `[x]` Auto-avance a siguiente tarjeta con *smooth slide* al pulsar un emoji.

**13.4. Cuestionario Gamificado del Paciente (`features/student/session-feedback/`)**
- `[x]` Crear `session-feedback.component.ts/html/scss`.
- `[x]` Flujo de tarjetas secuenciales: Q1 → Q2 → Q3 → Q4 → Q5 (textarea libre) → Pantalla de cierre.
- `[x]` Pantalla de cierre con mensaje motivacional y animación de confeti o partículas.
- `[x]` Lógica: bloquear el cuestionario si ya fue respondido para esa `appointment_id`.
- `[x]` Otorgar +10 XP al paciente al completar (integración con Skill 10 - `AchievementsService`).
- `[x]` Integrar con la racha (*streak*) del día del paciente.

**13.5. Trigger y Notificación en Panel del Estudiante**
- `[x]` Consultar al cargar el dashboard del estudiante si existe alguna cita con `status = 'completed'` sin evaluación enviada → mostrar banner/card destacada: *"¡Evalúa tu sesión de hoy!"*.
- `[x]` Ruteo: `/dashboard/session-feedback/:appointmentId` protegido por `AuthGuard`.
- `[x]` Añadir ruta lazy-loaded en `dashboard.routes.ts`.

**13.6. Panel del Especialista — Evaluaciones y Alertas**
- `[x]` En el perfil de cada paciente del especialista: mostrar historial de evaluaciones post-sesión (`score_global` por fecha) en mini gráfica de línea.
- `[x]` Badge de `rupture_flag` visible en la agenda junto a cada cita: `⚠️` `📉` `✅` `💬`.
- `[x]` Mostrar el comentario cualitativo (`q5_comment`) en la vista de detalle de la cita cuando exista.
- `[x]` Alerta longitudinal: detectar caída ≥ 0.7 puntos respecto a la sesión anterior del mismo paciente.

**13.7. Panel Administrativo — Evaluación del Especialista**
- `[x]` Conectar la columna "Evaluación" del panel de Personal Clínico (`admin/psychologists`) a datos reales: promedio de `score_global` de todas las evaluaciones del profesional.
- `[x]` Reemplazar el valor MOCK (`4.0 + Math.random()`) en `admin-stats.service.ts` por consulta real a `session_evaluations`.
- `[x]` Mostrar el `rupture_flag` agregado en la vista de detalle del especialista.

## Skill 10: Responsividad Móvil (Fase actual: Ejecutada)

**10.1. Ajuste General y Viewport**
- `[x]` Configurar meta tag viewport en `index.html` con `maximum-scale=1.0, user-scalable=no, viewport-fit=cover`.

**10.2. Drawer/Sidebar tipo Overlay**
- `[x]` Implementar Drawer/Sidebar tipo overlay en `DashboardLayoutComponent` (Estudiante).
- `[x]` Implementar Drawer/Sidebar tipo overlay en `PsychologistLayoutComponent` (Psicólogo).
- `[x]` Agregar fondo semi-transparente (backdrop overlay) al abrir el sidebar en móviles.
- `[x]` Crear gatillo flotante (hamburger menu) visible solo en móviles para abrir el sidebar.
- `[x]` Configurar cierre automático del sidebar al cambiar de ruta.

**10.3. Interfaz del Chat Optimizado**
- `[x]` Ocultar el encabezado (`.chat-header`) en móviles para dar prioridad al historial de mensajes.
- `[x]` Unificar botones de entrada en un solo botón `+` pegado directamente al input.
- `[x]` Desarrollar menú flotante móvil para desplegar el resto de acciones (adjuntos, imágenes, emojis) al presionar `+`.

**10.4. Prevención de Rupturas por Teclado y Spacing**
- `[x]` Ajustar contenedores `:host` con `position: fixed; inset: 0` y `100dvh` para evitar deformaciones por el teclado virtual.
- `[x]` Optimizar el Diario Emocional y vistas del Psicólogo apilándolos de forma vertical y ajustando márgenes.
- `[x]` Adaptar el Módulo Alimentario (`AlimentaryDashboardComponent`) para dispositivos móviles.
- `[x]` Adaptar el Registro de Expediente con Stepper (`RegisterComponent`) para pantallas móviles.
- `[x]` Adaptar la Agenda Estudiantil (`StudentAgendaComponent`) para pantallas móviles.
- `[x]` Adaptar las Configuraciones del Estudiante (`StudentSettingsComponent`) para pantallas móviles.
- `[x]` Corregir bloqueos de desplazamiento vertical en Ajustes del Estudiante y Módulo Alimentario.

---

## Skill 11: Animaciones Premium (Fase actual: Ejecutada)

**11.1. Configuración de Animaciones Globales**
- `[x]` Definir variables y animaciones de keyframes (`fadeIn`, `fadeInUp`, `slideIn`) en `styles.scss`.
- `[x]` Crear clases de animación reutilizables (`.animate-fade-in-up`, etc.).
- `[x]` Aplicar animaciones de entrada suave a los contenedores principales de las páginas en `styles.scss` (diario, chat, triage, pacientes, etc.).

**11.2. Micro-interacciones de Botones y Tarjetas**
- `[x]` Añadir transiciones fluidas de escala y rotación a los botones de estado de ánimo en `diary-dashboard`.
- `[x]` Aplicar efectos de flotación y sombras en hover a las tarjetas estadísticas del psicólogo (`.stat-card`).
- `[x]` Aplicar efectos de desplazamiento lateral en hover a los ítems del sidebar (`.nav-item`).
- `[x]` Aplicar micro-animación en hover para los días del calendario emocional.

**11.3. Animación de Entrada del Chat**
- `[x]` Diseñar e implementar animación de escala y deslizamiento ascendente (`messageFadeIn`) para las burbujas de conversación (`.message-wrapper`).
- `[x]` Aplicar transiciones y micro-escalado al botón de enviar y sugerencias chips.

## Corrección de Regresiones de Responsividad y Conflictos (Rama Nutricionista)
- `[x]` Limpieza y resolución de marcadores de conflicto en el Chatbot (`dashboard.component.ts` y `dashboard.component.scss`).
- `[x]` Corrección de selectores rotos (`-minimal`) en el media query del chatbot para asegurar la responsividad en móviles.
- `[x]` Adición del botón flotante móvil "+" (`mobile-add-btn`) y el menú de acciones secundario (`mobile-actions-menu`) en `dashboard.component.html`.
- `[x]` Eliminación de bloques `@media (max-width: 767px)` duplicados en `student-agenda.component.scss` y `diary-dashboard.component.scss`.
- `[x]` Resolución de marcadores de conflicto y unificación de transiciones en botones de ánimo/sueño y celdas de calendario en `diary-dashboard.component.scss`.
- `[x]` Rediseño responsivo de la agenda del estudiante (desbloqueo de ancho del banner unificado, apilamiento de columnas, y adaptación del combo box selector de especialidad).
- `[x]` Adaptación del modal de confirmación y cancelación de citas (`cdk-overlay-pane`) para que no exceda las dimensiones de la pantalla móvil (`max-width: 95vw`).
- `[x]` Rediseño responsivo del diario emocional (enlace correcto a `.diary-therapeutic-layout` en lugar de `.diary-layout`, pestañas deslizables horizontalmente y ajuste de paddings en móviles).
- `[x]` Rediseño responsivo de la configuración del estudiante (apilamiento vertical de botones de avatar en `profile-avatar.component.scss` y centrado/ancho completo para el botón de guardar cambios en `student-settings.component.scss`).
- `[x]` Verificación de compilación exitosa (`npm run build`) post-merge.

## Responsividad de la Interfaz del Psicólogo
- `[x]` Agenda (`agenda.component.scss`): apilar verticalmente, ancho del 100% para sidebar, y padding superior seguro en móviles.
- `[x]` Notas Clínicas (`clinical-note.component.scss`): padding superior en contenedor, reducción de padding en hoja clínica, apilado de cabecera/pie de página, y conversión de `.info-table` a bloques verticales.
- `[x]` Expediente del Paciente (`patient-profile.component.scss`): padding superior seguro, alineación centrada del avatar y estadísticas rápidas, colapso de `.info-grid` a una sola columna, y ajuste proporcional de celdas del calendario.
- `[x]` Configuración y Horarios (`settings.component.scss`): padding superior seguro, colapso de `.settings-grid` a una sola columna, pestañas principales deslizables horizontalmente, apilamiento de `.day-item` y rango de horas verticalmente, y apilamiento de `.exception-item`.
- `[x]` Directorio de Pacientes (`patients.component.scss`): padding superior seguro y límite de `90vw` en el ancho de `.modal-content`.
- `[x]` Verificación de compilación exitosa (`npm run build`).

---

## Skill 16: Cifrado en Servidor y Rotación de Llaves (Fase actual: Ejecutada)
- `[x]` Configurar pgcrypto y crear tabla `encryption_keys` en Supabase.
- `[x]` Crear funciones de cifrado y descifrado seguro en PostgreSQL.
- `[x]` Implementar vistas transparentes de base de datos con `security_invoker = on`.
- `[x]` Crear triggers `INSTEAD OF` para re-enrutar e interceptar operaciones de escritura.
- `[x]` Desplegar y ejecutar Edge Function `sync-secrets` para sincronizar la llave secreta `Primary`.
- `[x]` Simplificar `CryptoService` de Angular a no-ops sin afectar la compilación.
- `[x]` Remover `encryptionKey` expuesta en los archivos de configuración de entornos (`environment.ts`).
- `[x]` Actualizar la Especificación Maestra (`spec.md`) de ambos proyectos.
- `[x]` Registrar procedimientos y logs de auditoría para rotación de llaves.

---

## Skill 17: Passkeys para Administradores — Ruta Secreta + Ciclo de Vida Multi-Admin

> **Estrategia:** Ruta secreta `/sistema/acceso` fuera del prefijo `/auth/` — no vinculada desde ningún lugar público.
> **Diseño:** Formal y elegante — negro `#0A0A0A` + dorado `#C9A84C` + logo amati + Turnstile captcha.
> **Provisioning:** Externo (Script TI `admin-manager.js`). URL compartida solo por canal seguro fuera de la app.
> **Passkeys:** Vinculadas al hardware (device-bound, no sincronizables).
> **Multi-admin:** Múltiples administradores con ciclo de vida independiente.
> **Login general:** `/auth/login` **sin ningún cambio**.

**17.1. Base de Datos (Migración SQL)**
- `[x]` Añadir columna `passkey_only BOOLEAN NOT NULL DEFAULT FALSE` a `public.users`.
- `[x]` `UPDATE public.users SET passkey_only = TRUE WHERE role_id = 1` para el admin existente.
- `[ ]` Crear tabla `admin_audit_log` (id, admin_email, action, performed_by, details JSONB, ip_address, created_at).
- `[ ]` RLS en `admin_audit_log`: solo accesible vía `service_role_key` (TI). Ningún rol del ecosistema puede leer ni escribir.

**17.2. Supabase — Configuración**
- `[ ]` Habilitar Passkeys (WebAuthn) en Authentication > Sign-In Methods del proyecto.
- `[x]` Confirmar `@supabase/supabase-js` ≥ 2.43 en `package.json`.
- `[x]` Habilitar flag experimental `passkey: true` en `SupabaseService` (`createClient` options).

**17.3. Core — Auth Service (`auth.service.ts`)**
- `[x]` Añadir `loginWithPasskey(email: string, captchaToken?: string): Promise<boolean>` — challenge WebAuthn + validación `role_id = 1` + captcha Turnstile.
- `[x]` Añadir `registerPasskey(): Promise<void>` — enrollment WebAuthn + UPDATE `passkey_only = TRUE`.
- `[ ]` Forzar attestation hardware-bound en `registerPasskey()`: `authenticatorAttachment: 'platform'`, `residentKey: 'required'`, `userVerification: 'required'`, `attestation: 'direct'`.
- `[x]` Añadir `sendMagicLink(email: string): Promise<boolean>` — para flujo de enrolamiento inicial.
- `[x]` Eliminar rama de rol `Admin` en `activateMockSession()` — caer al default `Estudiante` + `console.error`.

**17.4. Core — Auth Guard (`auth.guard.ts`)**
- `[x]` Para rutas `/admin/**`: verificar `session.amr` contiene WebAuthn. Si no → `signOut()` + redirect `/sistema/acceso`.

**17.5. App Routes (`app.routes.ts`)**
- `[x]` Registrar ruta de primer nivel `sistema > acceso` con children + lazy load hacia `AdminAccessComponent`.

**17.6. Feature — Componente de Acceso Administrativo**
- `[x]` Crear directorio `src/app/features/admin-access/` (fuera de `features/auth/`).
- `[x]` `admin-access.component.ts` — standalone, dos modos: `login` (default) y `register` (`?mode=register`). Turnstile captcha integrado.
- `[x]` `admin-access.component.html` — título "Acceso al Sistema", campo email, Turnstile container, botón "Verificar identidad", meta tag `noindex nofollow`, logo amati.
- `[x]` `admin-access.component.scss` — paleta negro+dorado, `Playfair Display`, banda decorativa, captcha-group.
- `[ ]` Detección de soporte WebAuthn: verificar `PublicKeyCredential` y `isUserVerifyingPlatformAuthenticatorAvailable()` antes de mostrar formulario. Mensaje de error claro si no soportado.

**17.7. Feature — Panel Admin (Seguridad)**
- `[x]` Añadir card "Seguridad" en panel Admin con botón "Registrar nuevo dispositivo" → `authService.registerPasskey()`.

**17.8. Script TI — Gestión de Ciclo de Vida (`scripts/admin-manager.js`)**
- `[ ]` Crear directorio `scripts/` en raíz del proyecto (fuera de `src/`).
- `[ ]` Implementar comando `create <email>` — crear usuario en Supabase Auth + insertar en `public.users` (role_id=1) + enviar Magic Link.
- `[ ]` Implementar comando `revoke <email>` — eliminar credenciales WebAuthn + invalidar todas las sesiones activas.
- `[ ]` Implementar comando `reenroll <email>` — revocar passkey actual + enviar nuevo Magic Link para re-enrolamiento.
- `[ ]` Implementar comando `disable <email>` — desactivar cuenta temporalmente (`is_active=false`) + invalidar sesiones.
- `[ ]` Implementar comando `enable <email>` — reactivar cuenta desactivada (`is_active=true`).
- `[ ]` Implementar comando `update-email <viejo> <nuevo>` — cambiar correo en Supabase Auth + revocar + re-enrolar.
- `[ ]` Implementar comando `status <email>` — mostrar estado actual (activo, passkey registrada, última sesión).
- `[ ]` Implementar comando `list` — listar todos los admins con estado, fecha de creación y última actividad.
- `[ ]` Registrar cada operación en `admin_audit_log` con `performed_by`, `details` y `ip_address`.
- `[ ]` Documentar uso del script en `README` o `scripts/README.md`.

**17.9. Spec y Documentación**
- `[x]` Actualizar `spec.md` con Skill 17 completo (ciclo de vida, multi-admin, hardware-bound, audit log).
- `[x]` Actualizar `task.md` con tareas extendidas de Skill 17.

**17.10. Sincronización entre Repositorios**
- `[ ]` Sincronizar `spec.md` actualizado a `Ecosistema-de-Asistencia-Emocional-con-IA-Generativa`.
- `[ ]` Sincronizar `task.md` actualizado a `Ecosistema-de-Asistencia-Emocional-con-IA-Generativa`.
- `[ ]` Sincronizar todos los archivos modificados de `src/` entre ambos repositorios.

## Skill 18: Políticas de Consulta, Límites de Sesiones y Reagendas
- `[x]` Desarrollar lógica de persistencia en la tabla `student_policy_tracking` (creación de tabla y políticas RLS).
- `[x]` Implementar verificación de inasistencias en la ventana académica actual (3 no-show = baja).
- `[x]` Registrar y evaluar cancelaciones tardías en `executeCancellation()` (cancelaciones < 72h).
- `[x]` Implementar verificación de inactividad mayor a 30 días tras última sesión completada.
- `[x]` Limitar cambios de especialista a un máximo de 2 por ventana.
- `[x]` Agregar controles de especialista para `bypass_session_limit`, actualización de alta médica (`'discharged'`) y Nota de Cierre de Tratamiento (`mode === 'closure'`).
- `[x]` Disparar alerta/notificación al especialista anterior al reasignar automáticamente, requiriendo redacción de nota de cierre.
- `[x]` Mostrar contadores y estados de políticas en el dashboard del estudiante y del psicólogo.
- `[x]` Diseñar panel no intrusivo en el selector de citas mostrando sesiones restantes, políticas activas y placeholder de requisitos previos para asistir.

---

## Skill 19: Cuestionario PHQ-9 en el Diario y Expediente Clínico (Fase actual: Ejecución)

**19.1. Base de Datos (Migración SQL)**
- `[x]` Crear script de migración `db/migration_phq9.sql` con las columnas `phq9_config`, `entry_type`, `phq9_score` y `survey_data`.
- `[x]` Insertar logro "Primer Diagnóstico PHQ-9" en `public.achievements` con `xp_value = 50` y `requirement_type = 'phq9'`.
- `[x]` Modificar la función `update_user_activity_streak` en PostgreSQL para soportar la categoría `'phq9'`.
- `[x]` Ejecutar la migración SQL (Ejecutada con éxito vía Supabase CLI).

**19.2. Capa de Servicios (`core/services`)**
- `[x]` En `diary.service.ts`:
  - `[x]` Actualizar la interfaz `DiaryEntry` y el mapeo en `loadEntries()` para incluir las nuevas columnas del PHQ-9.
  - `[x]` Actualizar `saveEntry()` para aceptar y guardar datos de PHQ-9.
  - `[x]` Implementar el método `getPhq9Config()` que retorne la configuración, fecha de última aplicación del test y si hay citas programadas.
- `[x]` En `gamification.service.ts`:
  - `[x]` Actualizar el tipo de categoría en `registerActivity` para soportar `'phq9'`.

**19.3. Diario Estudiantil - Chatbot de PHQ-9 (`features/diary/dashboard`)**
- `[x]` En `diary-dashboard.component.ts`:
  - `[x]` Definir las preguntas del PHQ-9, opciones de puntuación y mapeo de severidad clínicamente exacto.
  - `[x]` Implementar lógica de re-aplicación: evaluar fallback por defecto (4 semanas sin psicólogo) y las configuraciones del psicólogo (semanas, meses, pre-consulta).
  - `[x]` Desarrollar el chatbot interactivo manteniendo la barra de progreso fluida y el delfín saltarín.
  - `[x]` Implementar el flujo condicional para la pregunta 10 (solo si la puntuación Q1-Q9 > 0).
  - `[x]` Integrar validación de riesgo clínico (Q9 > 0 activa `high_risk = true`).
  - `[x]` Formatear el resumen plano cifrado para el campo `content` e invocar el guardado de la entrada de diario y el registro de la actividad gamificada con `registerActivity('phq9')`.
- `[x]` En `diary-dashboard.component.html`:
  - `[x]` Si `showPhq9` es verdadero, renderizar el chatbot interactivo con el delfín animado en la columna derecha (reemplazando el editor Quill).
- `[x]` En `diary-dashboard.component.scss`:
  - `[x]` Adaptar y pulir los estilos del chatbot y sus animaciones.

**19.4. Restricción de Agenda Estudiantil (`features/dashboard-layout/student-agenda`)**
- `[x]` En `student-agenda.component.ts`:
  - `[x]` Comprobar al iniciar si el alumno ha completado al menos un PHQ-9.
  - `[x]` Si no se ha completado, establecer `phq9Pending = true` y bloquear la carga de disponibilidad.
- `[x]` En `student-agenda.component.html`:
  - `[x]` Si `phq9Pending` es verdadero, mostrar una tarjeta de advertencia estilizada (glassmorphic) con enlace al diario para obligar a realizar el test clínico inicial.

**19.5. Command Center Clínico (Psicólogo y Nutriólogo)**
- `[x]` En `patient-profile.component.ts` (Psicólogo):
  - `[x]` Leer la configuración `phq9_config` y el historial real de PHQ-9 en `loadPatientData()`.
  - `[x]` Poblar dinámicamente la gráfica de línea con los puntajes reales en orden cronológico.
  - `[x]` Crear `updatePhq9Config(mode: string, value: number)` para actualizar en Supabase.
- `[x]` En `patient-profile.component.html` (Psicólogo):
  - `[x]` Mostrar la tarjeta de resultados del último test PHQ-9 con puntaje, severidad e interpretación.
  - `[x]` Renderizar el panel de control dinámico (selector de modalidad y valor numérico) exclusivo para psicólogos.
- `[x]` En `perfil-paciente.component.ts` (Nutriólogo):
  - `[x]` Sincronizar para leer y graficar los datos reales de PHQ-9 en su propia gráfica de evolución.






