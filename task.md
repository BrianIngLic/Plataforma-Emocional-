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

*(Skills 4 y 5 continúan pausadas en el backlog)*
