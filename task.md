# Tareas de Implementación (Spec-Driven Development)

- [x] Crear el archivo `.constitution.md` en el repositorio base.
- [x] Redactar la especificación formal en `spec.md` dividida por Skills.
- [x] Configurar los perfiles de agentes en `.diana/agents.yaml`.

---

## Skill 1: Capa de Datos (PostgreSQL + PostgREST)
- `[x]` Crear directorio `db` y archivo `schema.sql`.
- `[x]` Modelo actualizado a Matrícula universal y tabla relacional de `messages`.

---

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
- `[x]` **Paso 3 (Expediente Estudiantil):** Checkboxes de condiciones clínicas preexistentes y campo de "Notas Adicionales".
- `[x]` **Paso 4 (Consentimiento):** Aceptación de términos médicos y disclaimer obligatorio.
- `[x]` Lógica: Empaquetar payload del stepper y enviarlo a los servicios en una transacción lógica.

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
- `[x]` Implementar métodos simulados (`sendMessageMock()`) preparados para la conexión real.

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
- `[x]` Añadir lógica para evitar envíos vacíos y permitir usar la tecla `Enter`.

**3.5. Ruteo y Protección (`app.routes.ts`)**
- `[x]` Configurar el ruteo Lazy-Loaded hacia el módulo de chat en la ruta principal (`/dashboard`).
- `[x]` Proteger la ruta asegurando que deba pasar por el `AuthGuard`.

---

## Skill 4: NutriMind — Módulo Alimentario (Backlog)
- `[ ]` Desarrollar el panel con barras de progreso para proteínas, grasas y carbohidratos.
- `[ ]` Listado de comidas agrupadas por tiempo (desayuno, comida, cena, colaciones).

---

## Skill 5: Command Center Clínico (Fase actual: Ejecución)

**5.1. Enrutamiento y Layout del Psicólogo (`features/psychologist`)**
- `[x]` Configurar `psychologist.routes.ts` (`/psychologist/dashboard`, `/psychologist/patients`).
- `[x]` Crear un Layout dedicado para el rol clínico (con un sidebar distinto al del estudiante).

**5.2. Dashboard Principal de Triage (`dashboard.component`)**
- `[x]` Migrar y adaptar el `Dashboard.tsx` de React a Angular.
- `[x]` Integrar tarjetas estadísticas, lista de emergencias (`urgency_score`), y agenda diaria simulada.
- `[x]` Integrar gráficas (`ngx-charts` o Chart.js).

**5.3. Directorio de Pacientes (`patients-list.component`)**
- `[x]` Migrar `Patients.tsx` a Angular.
- `[x]` Implementar la tabla con filtros por nombre y niveles de riesgo.

**5.4. Visor Clínico Integral (`patient-profile.component`)**
- `[x]` Migrar `PatientProfile.tsx` a Angular (Gráficas de progreso, historial de sesiones).
- `[x]` Integrar la visualización del análisis de Amati desde la perspectiva clínica.
- `[x]` Integrar la visualización del "Mi Diario" (Skill 6) en el perfil del paciente.

**5.5. Agenda Clínica (`agenda.component`)**
- `[x]` Desarrollar la interfaz visual del calendario (CSS Grid mensual/semanal).
- `[x]` Lógica de gestión de citas (ver detalles, marcar completada, agendar nueva cita).
- `[x]` Integrar ruta `/psychologist/agenda` y enlazar con el botón en el layout.

**5.6. Configuración Híbrida y Recorridos Virtuales**
- `[x]` Extender `psychologist_settings` para persistir `modality`, `faculty_id`, `building` y `office_room`.
- `[x]` Actualizar `AgendaService.getSettings` con join en `faculties(id, name, virtual_tour_url)`.
- `[x]` Selector de modalidad Virtual/Presencial con preselección de facultad, edificio y oficina.
- `[x]` Habilitar botón "📍 Abrir Recorrido Virtual" en citas presenciales del estudiante.

**5.7. Refactorización Arquitectónica: Herencia de Personal de la Salud**
- `[ ]` Crear clase/estructura base `HealthProfessionalBase` con lógica común de dashboard, agenda y ajustes.
- `[ ]` Unificar vistas redundantes entre `features/psychologist` y `features/nutritionist`.
- `[ ]` Mantener `ClinicalNoteComponent` (SOAP) para Psicólogos y `PerfilPaciente` (Nutricional + PDF) para Nutriólogos.
- `[ ]` Adaptar rutas para consumir la base común manteniendo URLs limpias.

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

## Skill 7: Gestión de Perfil y Avatares (Fase actual: Ejecutada)

**7.1. Configuración de Base de Datos y Storage**
- `[x]` Crear Bucket en Supabase Storage llamado `avatars`.
- `[x]` Configurar RLS en el bucket (Lectura pública, Escritura solo para usuarios autenticados propios).
- `[x]` Añadir columna `avatar_url` (TEXT) a la tabla `profiles`.

**7.2. Capa de Servicios (`core/services/profile.service.ts`)**
- `[x]` Crear `ProfileService` con método `uploadAvatar(file: File)` y `updateAvatarUrl(url: string)`.
- `[x]` Actualizar `AuthService.loadUserProfile()` para recuperar el `avatar_url` en el estado global (Signals).

**7.3. Interfaz de Configuración de Perfil (`features/settings/profile`)**
- `[x]` Vista unificada de configuración de perfil aplicable a todos los roles.
- `[x]` Drag & Drop para subir imagen o selector de Avatar predefinido con preview circular.
- `[x]` Botones de "Guardar Cambios" conectados con el UI Kit (notificaciones de éxito).

**7.4. Integración Transversal (Layouts)**
- `[x]` Modificar `DashboardLayoutComponent` (Estudiante) para mostrar el `avatar_url` en el menú.
- `[x]` Modificar `PsychologistLayoutComponent` para mostrar el avatar.
- `[x]` Navbar / Top Menu reactivo al cambio de foto del `currentUser`.

---

## Skill 8: Módulo de Administración (Backlog)
- `[ ]` Dashboard de Administrador (`admin-layout.component`).
- `[ ]` Formulario seguro de Alta de Personal Clínico (Psicólogos y Nutriólogos).
- `[ ]` Panel de gestión de usuarios (suspensión, reactivación).

---

## Skill 9: RoleGuard Security (Fase actual: Ejecutada)
- `[x]` Crear `roleGuard` (`core/guards/role.guard.ts`) que evalúe `expectedRole`.
- `[x]` Lógica de redirección inteligente al panel base (`/dashboard`, `/psychologist`, `/admin`).
- `[x]` Inyectar `roleGuard` y metadatos `data: { expectedRole }` en `app.routes.ts`.

---

## Fase de Integración (Backend: PostgreSQL / PostgREST)

**Integración.1. Configuración del Entorno**
- `[x]` Configurar `environments/environment.ts` con credenciales de la API y llave de cifrado E2EE.
- `[x]` Instalar cliente (Supabase JS o HttpClient) y librería criptográfica (`crypto-js`).
- `[x]` Crear servicio base de conexión (`supabase.service.ts` y `crypto.service.ts`).

**Integración.2. Refactorización de Autenticación**
- `[x]` Conectar `auth.service.ts` con la base de datos para login real y manejo de sesión JWT.
- `[x]` Conectar el stepper de registro para guardar datos en `users`, `profiles` y `student_clinical_records`.

**Integración.3. Refactorización de Skills**
- `[x]` Conectar `chat.service.ts` con la tabla `messages`.
- `[x]` Conectar `diary.service.ts` (si existe la tabla, pendiente de crear en schema) o simular.
- `[x]` Conectar listado de pacientes del psicólogo con las tablas reales.

---

## Skill 10: Sistema de Evaluación Post-Sesión — FIT Gamificado (Fase actual: Planeación)

> **Base clínica:** SRS (Duncan et al.), WAI (Horvath & Greenberg), Session Impacts Scale, Hope Theory (Snyder).
> **Metodología:** Feedback-Informed Treatment (FIT) + Routine Outcome Monitoring (ROM).
> **UX:** Gamificación con caritas emocionales, tarjetas secuenciales y micro-animaciones.

**10.1. Base de Datos**
- `[x]` Crear tabla `session_evaluations` con columnas: `id`, `appointment_id` (FK, UNIQUE), `patient_id` (FK), `professional_id` (FK), `q1_global`, `q2_bond`, `q3_goals`, `q4_impact` (DECIMAL 2,1), `q5_comment` (TEXT nullable), `score_global` (DECIMAL 2,1), `rupture_flag` (TEXT: `critical`/`decline`/`healthy`/`pending`), `is_visible_to_professional` (BOOLEAN), `created_at`.
- `[x]` Aplicar RLS: paciente INSERT propio; especialista SELECT sus citas; admin SELECT agregados.

**10.2. Capa de Servicios (`core/services/session-evaluation.service.ts`)**
- `[x]` Método `submitEvaluation(payload)`: INSERT + calcula `score_global` (q1×0.20 + q2×0.30 + q3×0.25 + q4×0.25) + determina `rupture_flag`.
- `[x]` Método `getEvaluationByAppointment(appointmentId)`: bloquear doble envío.
- `[x]` Método `getEvaluationsByProfessional(professionalId)`: agrega para panel del especialista y admin.

**10.3. Componente Emoji-Scale Reutilizable**
- `[x]` Crear `emoji-scale.component.ts/html/scss`: `@Input() question: string`, `@Output() scored: EventEmitter<number>`.
- `[x]` 5 emojis pulsables (😞😐🙂😊🤩) con código de color progresivo rojo→índigo.
- `[x]` Micro-animación bounce al puntuar 4–5; reacción empática al 1–2. Auto-avance smooth slide.

**10.4. Cuestionario Gamificado del Paciente (`features/student/session-feedback/`)**
- `[x]` Crear `session-feedback.component.ts/html/scss`.
- `[x]` Flujo de tarjetas: Q1 → Q2 → Q3 → Q4 → Q5 (textarea libre) → Pantalla de cierre motivacional.
- `[x]` Bloquear reenvío si ya existe evaluación para la `appointment_id`.
- `[x]` Otorgar +10 XP al completar + contribuye al streak diario (Skill 10/Gamificación).

**10.5. Trigger y Notificación Panel Estudiante**
- `[x]` Banner destacado: *"¡Evalúa tu sesión de hoy!"* cuando hay cita `completed` sin evaluación enviada.
- `[x]` Ruta lazy-loaded `/dashboard/session-feedback/:appointmentId` con AuthGuard.

**10.6. Panel Especialista — Evaluaciones y Alertas**
- `[x]` Historial de `score_global` por fecha en perfil del paciente (mini gráfica de línea).
- `[x]` Badge de `rupture_flag` en agenda junto a cada cita completada: `⚠️` `📉` `✅` `💬`.
- `[x]` Mostrar `q5_comment` en la vista de detalle de la cita cuando exista.

**10.7. Panel Administrativo**
- `[x]` Conectar columna "Evaluación" del panel de Personal Clínico al promedio real de `score_global`.
- `[x]` Reemplazar valor MOCK (`4.0 + Math.random()`) en `admin-stats.service.ts` por consulta real a `session_evaluations`.

---

## Skill 12: Dossier Clínico Unificado, Marca de Agua y Meta Seal (Exportación Masiva PDF)
- `[x]` Arquitectura Estricta de Código Abierto: Utilizar `jsPDF` ya integrado en el proyecto para evitar redundancia de dependencias.
- `[x]` Capa de Servicios (`core/services/dossier-export.service.ts`): Desarrollar orquestador de datos que unifique consultas de perfil, notas SOAP, registros nutricionales, diario personal y test de Amati IA.
- `[x]` Marca de Agua Institucional: Aplicar marca de agua diagonal transparente (como membrete y fondo del PDF).
- `[x]` Implementación de Meta Seal: Generar hash HMAC-SHA256 mediante `Web Crypto API` (`SubtleCrypto`), integrándolo como sello visible en el resumen ejecutivo y en los metadatos del PDF para garantizar el principio legal de No Repudio (NOM-024 / HIPAA).
- `[x]` Interfaz de Usuario: Insertar botones de "📥 Exportar Dossier Completo" en el perfil del paciente dentro del Command Center clínico y administrativo.
