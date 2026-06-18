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
- En el registro del estudiante, incluir el paso para contestar el cuestionario de afecciones conocidas (Depresión, Ansiedad, etc.) que se enlazará con la IA.

### Skill 3: EmolA Chat (Estudiante)
- Vista en modo oscuro.
- Conexión HTTPS segura con el núcleo IA (FastAPI).
- Interfaz de historial de chats a la izquierda, área principal de chat a la derecha.

### Skill 4: NutriMind (Módulo Alimentario)
- Dashboard con barras de progreso para proteínas, grasas y carbohidratos.
- Listado de comidas agrupadas por tiempo (desayuno, etc.).

### Skill 5: Command Center Clínico (Dashboard del Psicólogo)
- **Dashboard Principal (Triage):** Vista de alto nivel con estadísticas, lista de casos de emergencia (`urgency_score` alto), agenda del día y métricas (gráficas).
- **Directorio de Pacientes:** Tabla filtrable y buscable con los pacientes asignados y su nivel de riesgo.
- **Visor Clínico Integral (Perfil):** Pantalla de detalle del paciente (basado en `PatientProfile.tsx`) que incluye:
  - Información de contacto y clínica (Diagnóstico, Tratamiento, Medicamentos).
  - Gráfica de progreso (ej. PHQ-9).
  - **Superpoder EmolA:** Interfaz donde el psicólogo puede leer el historial de chat de la IA con el estudiante.
- **Agenda Clínica:** Pantalla dedicada con vista de calendario para organizar, agendar y cancelar citas de los pacientes basadas en recomendaciones del núcleo IA.

### Skill 6: Mi Diario (Personal)
- Interfaz privada para que el estudiante registre sus pensamientos y estado de ánimo diario.
- Integración visual alineada al ecosistema (Glassmorphism / Modo Dinámico).
- Componente de "Mood Tracker" (Registro de Emociones).

### Skill 8: Módulo de Administración (Core System)
- Interfaz exclusiva para el rol 'Admin'.
- Panel de control para gestionar altas, bajas y modificaciones del personal clínico (Psicólogos).
- Asignación manual de pacientes (Estudiantes) a psicólogos específicos (opcional, dependiendo de la política de la clínica).
