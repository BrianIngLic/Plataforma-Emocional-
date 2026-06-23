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

## Skill 3: EmolA Chat Estudiantil (Fase actual: Ejecución)
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
- `[x]` Integrar la visualización del análisis de EmolA (Chat Inteligente) desde la perspectiva clínica.
- `[x]` Integrar la visualización del "Mi Diario" (Skill 6) en el perfil del paciente.

**5.5. Agenda Clínica (`agenda.component`)**
- `[x]` Desarrollar la interfaz visual del calendario (CSS Grid mensual/semanal).
- `[x]` Lógica de gestión de citas (ver detalles de la cita, marcar completada, agendar nueva cita).
- `[x]` Integrar ruta `/psychologist/agenda` y enlazar con el botón en el layout.

*(Skill 4 continúa pausada en el backlog)*

---

## Backlog Pendiente
**Skill 8: Módulo de Administración (Core System)**
- `[ ]` Dashboard de Administrador (`admin-layout.component`).
- `[ ]` Formulario seguro de Alta de Personal Clínico (Psicólogos).
- `[ ]` Panel de gestión de usuarios (suspensión, reactivación).

---

## Fase de Integración (Backend: PostgreSQL / PostgREST)

**7.1. Configuración del Entorno**
- `[x]` Configurar `environments/environment.ts` con credenciales de la API y llave de cifrado E2EE.
- `[x]` Instalar cliente (Supabase JS o HttpClient) y librería criptográfica (`crypto-js`).
- `[x]` Crear servicio base de conexión (`supabase.service.ts` y `crypto.service.ts`).

**7.2. Refactorización de Autenticación**
- `[x]` Conectar `auth.service.ts` con la base de datos para login real y manejo de sesión JWT.
- `[x]` Conectar el stepper de registro (`register.component.ts`) para guardar datos en las tablas `users`, `profiles` y `student_clinical_records`.

**7.3. Refactorización de Skills**
- `[x]` Conectar `chat.service.ts` con la tabla `messages`.
- `[x]` Conectar `diary.service.ts` (si existe la tabla, pendiente de crear en schema) o simular.
- `[x]` Conectar listado de pacientes del psicólogo con las tablas reales.
