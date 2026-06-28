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
  - **Ajustes Clínicos y Modalidad Híbrida (Virtual / Presencial):**
    - Switch interactivo para alternar entre atención `Virtual` (con enlace de reunión) y `Presencial`.
    - Configuración presencial con selector de Facultad base predeterminada, Edificio y Número de Oficina/Aula.
    - **Vinculación con Recorridos Virtuales BUAP:** Al confirmar o consultar una cita presencial, el estudiante visualiza un botón inmersivo para "📍 Abrir Recorrido Virtual" de su facultad, reduciendo la ansiedad espacial y facilitando la llegada al campus.
    - **Reserva Unificada (Psicólogo y Nutriólogo):** El estudiante puede consultar y reservar en un mismo calendario unificado utilizando un Combo Box selector para elegir qué atención necesita (Psicología o Nutrición). En caso de no tener un especialista asignado en la rama seleccionada, el sistema lanza una alerta modal emergente y despliega el directorio de su facultad.
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

### Skill 9: RoleGuard Security (Barrera de Roles)
- Implementación de seguridad transversal en Angular (Route Guards).
- Restricción de acceso basado en el `role` del usuario (Estudiante, Psicólogo, Admin).
- Redirección automática al módulo o dashboard correspondiente al rol real en caso de un intento de acceso no autorizado, protegiendo la confidencialidad de la clínica.

### Skill 10: Responsividad Móvil y Optimización de Layouts
- **Sidebar Drawer (Overlay):** En pantallas con un ancho inferior a 768px (móviles), los sidebars de estudiantes y psicólogos deben transformarse en paneles desplegables (drawers) que se muestren encima del contenido principal. Se agregará un fondo semi-transparente (backdrop overlay) y un gatillo flotante (hamburger menu) para abrirlo y cerrarlo de forma amigable.
- **Simplificación del Chat:** Eliminar o esconder el encabezado (`.chat-header`) en móviles para dar prioridad al historial de mensajes.
- **Botón Unificado "+":** En la barra de entrada del chat para dispositivos móviles, unificar los botones de acciones de adjuntos/imágenes/emojis en un único botón "+" ubicado a la izquierda y pegado directamente al input sin separación. Este botón desplegará un menú flotante para las acciones secundarias.
- **Prevención de Rupturas por Teclado:** Evitar que el teclado virtual en navegadores móviles rompa el layout visual fijando el contenedor `:host` con `position: fixed; inset: 0` y utilizando `100dvh` (Dynamic Viewport Height).
- **Alineación Vertical:** Apilar las columnas y grillas de componentes complejos (como el Diario Emocional y las secciones del Psicólogo) para que queden legibles en pantallas estrechas.

### Skill 11: Animaciones Premium y Micro-Interacciones
- **Transición de Entrada de Páginas (Page Transitions):** Todas las vistas principales del sistema (diario, chat, triage, agenda, etc.) se deslizarán suavemente hacia arriba y se desvanecerán al cargarse usando una curva `cubic-bezier(0.16, 1, 0.3, 1)` para un efecto fluido y premium.
- **Entrada Dinámica de Mensajes:** Las burbujas del chat no aparecerán bruscamente; en su lugar, se animarán con una escala sutil y elevación hacia arriba cuando se agreguen al flujo.
- **Micro-interacciones en Botones y Tarjetas:**
  - Los botones de estado de ánimo (`.mood-btn`) y botones de envío escalarán ligeramente hacia arriba (`scale(1.03)`) al pasar el ratón por encima, y se comprimirán (`scale(0.97)`) al ser presionados.
  - Las tarjetas de estadísticas y calendario se elevarán sutilmente y generarán una sombra profunda (`transform: translateY(-4px)`) en hover.
  - Los ítems de navegación lateral (`.nav-item`) se desplazarán lateralmente hacia la derecha (`transform: translateX(4px)`) al pasar el cursor para guiar el foco visual.


