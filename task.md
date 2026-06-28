# Tareas de Implementación (Spec-Driven Development)

- [x] Crear el archivo `.constitution.md` en el repositorio base.
- [x] Redactar la especificación formal en `spec.md` dividida por Skills.
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
*(Skill 4 continúa pausada en el backlog)*

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

## Backlog Pendiente
**Skill 8: Módulo de Administración (Core System)**
- `[ ]` Dashboard de Administrador (`admin-layout.component`).
- `[ ]` Formulario seguro de Alta de Personal Clínico (Psicólogos).
- `[ ]` Panel de gestión de usuarios (suspensión, reactivación).

**Skill 9: RoleGuard Security (Fase actual: Ejecutada)**
- `[x]` Crear funcional `roleGuard` (`core/guards/role.guard.ts`) que evalúe `expectedRole`.
- `[x]` Lógica de redirección inteligente al panel base correspondiente (`/dashboard`, `/psychologist`, `/admin`).
- `[x]` Inyectar `roleGuard` y metadatos `data: { expectedRole }` en `app.routes.ts`.

---

## Fase de Integración (Backend: PostgreSQL / PostgREST)

**9.1. Configuración del Entorno**
- `[x]` Configurar `environments/environment.ts` con credenciales de la API y llave de cifrado E2EE.
- `[x]` Instalar cliente (Supabase JS o HttpClient) y librería criptográfica (`crypto-js`).
- `[x]` Crear servicio base de conexión (`supabase.service.ts` y `crypto.service.ts`).

**9.2. Refactorización de Autenticación**
- `[x]` Conectar `auth.service.ts` con la base de datos para login real y manejo de sesión JWT.
- `[x]` Conectar el stepper de registro (`register.component.ts`) para guardar datos en las tablas `users`, `profiles` y `student_clinical_records`.

**9.3. Refactorización de Skills**
- `[x]` Conectar `chat.service.ts` con la tabla `messages`.
- `[x]` Conectar `diary.service.ts` (si existe la tabla, pendiente de crear en schema) o simular.
- `[x]` Conectar listado de pacientes del psicólogo con las tablas reales.

---

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




