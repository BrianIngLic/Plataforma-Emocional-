# Graph Report - Ecosistema-de-Asistencia-Emocional-con-IA-Generativa  (2026-06-29)

## Corpus Check
- 94 files · ~53,278 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 781 nodes · 1172 edges · 82 communities (34 shown, 48 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 72 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7aa7f887`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Core Services and Auth|Core Services and Auth]]
- [[_COMMUNITY_Modals Diary and Exceptions|Modals Diary and Exceptions]]
- [[_COMMUNITY_Package Config and Dependencies|Package Config and Dependencies]]
- [[_COMMUNITY_Angular Architect Configurations|Angular Architect Configurations]]
- [[_COMMUNITY_Angular Build Schemas|Angular Build Schemas]]
- [[_COMMUNITY_Psychologist Profile and Utilities|Psychologist Profile and Utilities]]
- [[_COMMUNITY_Faculty Occupancy Management|Faculty Occupancy Management]]
- [[_COMMUNITY_AI Triage and Student Agenda|AI Triage and Student Agenda]]
- [[_COMMUNITY_Admin Patient Statistics Overview|Admin Patient Statistics Overview]]
- [[_COMMUNITY_Alimentary Assessment Dashboard|Alimentary Assessment Dashboard]]
- [[_COMMUNITY_Patient Profile Expedient|Patient Profile Expedient]]
- [[_COMMUNITY_Admin Agenda Metrics|Admin Agenda Metrics]]
- [[_COMMUNITY_Dashboard UI Views|Dashboard UI Views]]
- [[_COMMUNITY_Psychologist Agenda Timeline|Psychologist Agenda Timeline]]
- [[_COMMUNITY_Main App Security Interceptors|Main App Security Interceptors]]
- [[_COMMUNITY_Profile Avatar Manager|Profile Avatar Manager]]
- [[_COMMUNITY_Schedule Exceptions Settings|Schedule Exceptions Settings]]
- [[_COMMUNITY_Therapeutic Diary Dashboard|Therapeutic Diary Dashboard]]
- [[_COMMUNITY_Dashboard Main Navigation Layout|Dashboard Main Navigation Layout]]
- [[_COMMUNITY_AI Chat Stream Service|AI Chat Stream Service]]
- [[_COMMUNITY_Security and Design Principles|Security and Design Principles]]
- [[_COMMUNITY_Assigned Patient Directory|Assigned Patient Directory]]
- [[_COMMUNITY_Admin Routing and Layout|Admin Routing and Layout]]
- [[_COMMUNITY_Chat Message Flow|Chat Message Flow]]
- [[_COMMUNITY_Psychologist Layout Navigation|Psychologist Layout Navigation]]
- [[_COMMUNITY_Agenda Schedule Settings Service|Agenda Schedule Settings Service]]
- [[_COMMUNITY_Appointment Booking Modal|Appointment Booking Modal]]
- [[_COMMUNITY_Clinical Note Management|Clinical Note Management]]
- [[_COMMUNITY_AI Command Center Integration|AI Command Center Integration]]
- [[_COMMUNITY_Admin Suite Administration|Admin Suite Administration]]
- [[_COMMUNITY_System Reports View|System Reports View]]
- [[_COMMUNITY_Psychologist Dashboard Core|Psychologist Dashboard Core]]
- [[_COMMUNITY_Alimentary Module Routing|Alimentary Module Routing]]
- [[_COMMUNITY_Auth Module Routing|Auth Module Routing]]
- [[_COMMUNITY_Development Environment Config|Development Environment Config]]
- [[_COMMUNITY_Invite User Serverless Function|Invite User Serverless Function]]
- [[_COMMUNITY_Graphify Knowledge Graph Workflows|Graphify Knowledge Graph Workflows]]
- [[_COMMUNITY_Welcome Email Serverless Function|Welcome Email Serverless Function]]
- [[_COMMUNITY_Main App Template Root|Main App Template Root]]
- [[_COMMUNITY_Strict Spec Adherence Constitution|Strict Spec Adherence Constitution]]
- [[_COMMUNITY_Clean Development Documentation Practices|Clean Development Documentation Practices]]
- [[_COMMUNITY_Clinical Priority Constitution|Clinical Priority Constitution]]
- [[_COMMUNITY_Amati Brand Logo Asset|Amati Brand Logo Asset]]
- [[_COMMUNITY_Project README Overview|Project README Overview]]
- [[_COMMUNITY_Privacy Disclaimer Modal|Privacy Disclaimer Modal]]
- [[_COMMUNITY_General Architecture Spec|General Architecture Spec]]
- [[_COMMUNITY_Amati Chat Spec|Amati Chat Spec]]
- [[_COMMUNITY_NutriMind Spec|NutriMind Spec]]
- [[_COMMUNITY_Diary Spec|Diary Spec]]
- [[_COMMUNITY_Profile Avatar Spec|Profile Avatar Spec]]
- [[_COMMUNITY_AI Triage Simulator Banner|AI Triage Simulator Banner]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]

## God Nodes (most connected - your core abstractions)
1. `RiskLevel` - 33 edges
2. `AuthService` - 31 edges
3. `TriageEngine` - 30 edges
4. `UserMessage` - 28 edges
5. `FacultiesComponent` - 25 edges
6. `PsychologistsComponent` - 25 edges
7. `SupabaseService` - 23 edges
8. `StudentAgendaComponent` - 19 edges
9. `classify()` - 18 edges
10. `PatientProfileComponent` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Skill 9: RoleGuard Security` --semantically_similar_to--> `Ciberseguridad y Privacidad`  [INFERRED] [semantically similar]
  spec.md → .constitution.md
- `TriageEngine` --uses--> `RiskLevel`  [INFERRED]
  engine.py → constant.py
- `SessionState` --uses--> `RiskLevel`  [INFERRED]
  models.py → constant.py
- `TriageResult` --uses--> `RiskLevel`  [INFERRED]
  models.py → constant.py
- `UserMessage` --uses--> `RiskLevel`  [INFERRED]
  models.py → constant.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Admin Dashboard Suite** — admin_layout_admin_layout_component_template, agenda_agenda_component_template, faculties_faculties_component_template, overview_overview_component_template, patients_patients_component_template, psychologists_psychologists_component_template, reports_reports_component_template [INFERRED 0.95]
- **Diana Deep Agents Team** — _diana_agents_angular_architect, _diana_agents_postgrest_dev, _diana_agents_ai_integrator, _diana_agents_ux_specialist, _diana_agents_cybersec_guardian [EXTRACTED 1.00]
- **Student Emotional Assistance and Care Flow** — dashboard_layout_dashboard_layout_component_student_sidebar, dashboard_dashboard_component_chat_view, dashboard_diary_dashboard_component_therapeutic_refuge, student_agenda_student_agenda_component_appointment_scheduler [INFERRED 0.85]
- **Psychologist Clinical Command Center and Triage Flow** — psychologist_layout_psychologist_layout_component_psychologist_sidebar, dashboard_dashboard_component_psychologist_triage_view, patients_patients_component_patient_directory, agenda_agenda_component_clinical_timeline, patient_profile_patient_profile_component_clinical_expedient_view [INFERRED 0.85]

## Communities (82 total, 48 thin omitted)

### Community 1 - "Modals Diary and Exceptions"
Cohesion: 0.06
Nodes (13): Appointment, AdminFaculty, FeedbackModalComponent, FeedbackModalData, ProfileAvatarComponent, RegisterComponent, AdminExceptionsService, WorkingDaysMap (+5 more)

### Community 2 - "Package Config and Dependencies"
Cohesion: 0.05
Nodes (44): build, extract-i18n, serve, test, builder, configurations, defaultConfiguration, options (+36 more)

### Community 3 - "Angular Architect Configurations"
Cohesion: 0.15
Nodes (28): classifier.py — Clasificador determinista de riesgo pre-LLM.  Este módulo es l, OverrideSource, Nivel de riesgo del usuario según el triaje.      Sigue un esquema semáforo de, Origen que puede activar un override de nivel de riesgo.      - PHQ9_ITEM9:, RiskLevel, Motor principal de triage determinista para clasificación de riesgo.  Orquesta, Enum, Motor determinista de triage para clasificación de riesgo en salud mental. Todas (+20 more)

### Community 4 - "Angular Build Schemas"
Cohesion: 0.11
Nodes (22): MessageRequest, post_triage(), BaseModel, quick_triage(), Devuelve un resumen del estado de la sesión para depuración/auditoría., Evaluación rápida de un mensaje individual.      Crea un motor de triage efíme, Motor de triage que procesa mensajes a través de capas de seguridad.      El f, Obtiene una sesión existente o crea una nueva.          Args:             ses (+14 more)

### Community 8 - "Admin Patient Statistics Overview"
Cohesion: 0.12
Nodes (5): OverviewComponent, AdminStatsService, ChartDataPoint, OverviewMetrics, PatientsComponent

### Community 9 - "Alimentary Assessment Dashboard"
Cohesion: 0.13
Nodes (3): AlimentaryDashboardComponent, ChatMessage, ClinicalService

### Community 12 - "Dashboard UI Views"
Cohesion: 0.17
Nodes (16): Psychologist Daily Agenda Timeline, Amati AI Chat Dashboard, Psychologist Triage Dashboard, Amati Therapeutic Refuge and Diary, Student Dashboard Sidebar, Clinical Expedient and AI Insights View, Psychologist Assigned Patients Directory, Profile Avatar Manager Component (+8 more)

### Community 14 - "Main App Security Interceptors"
Cohesion: 0.33
Nodes (4): App, appConfig, routes, authInterceptor()

### Community 15 - "Profile Avatar Manager"
Cohesion: 0.22
Nodes (5): CalendarDay, TimeBlock, WorkingDay, AiTriageMockService, UrgencyLevel

### Community 20 - "Security and Design Principles"
Cohesion: 0.09
Nodes (22): angular-architect, cybersec-guardian, postgrest-dev, ux-specialist, Ciberseguridad y Privacidad, Diseño y UX, LoginComponent Template, Arquitectura General (+14 more)

### Community 28 - "AI Command Center Integration"
Cohesion: 0.40
Nodes (5): ai-integrator, AgendaComponent Template, OverviewComponent Template, PatientsComponent Template, Skill 5: Command Center Clínico

### Community 29 - "Admin Suite Administration"
Cohesion: 0.40
Nodes (5): AdminLayoutComponent Template, FacultiesComponent Template, PsychologistsComponent Template, ReportsComponent Template, Skill 8: Módulo de Administración

### Community 43 - "Project README Overview"
Cohesion: 0.25
Nodes (7): Additional Resources, Building, Code scaffolding, Development server, PlataformaEmocional, Running end-to-end tests, Running unit tests

### Community 45 - "General Architecture Spec"
Cohesion: 0.08
Nodes (24): dependencies, @angular/animations, @angular/cdk, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/material (+16 more)

### Community 51 - "Community 51"
Cohesion: 0.10
Nodes (16): check_literal_terms(), classify(), Clasifica el riesgo de un mensaje de texto del usuario.      Ejecuta la cadena, Busca términos de riesgo alto y medio en el texto normalizado.      Primero re, Detección de patrones metafóricos con temática de autosacrificio., Fragmento con 'abismo', 'matarlos', 'desaparecía', 'sacrificio'         debe se, Verifica que el override se active cuando la clasificación es ROJO., Una clasificación ROJO debe producir un override activo. (+8 more)

### Community 52 - "Community 52"
Cohesion: 0.12
Nodes (14): normalize_text(), Normaliza el texto del usuario para la clasificación.      Pasos:     1. Conv, get_crisis_message(), Devuelve el mensaje de crisis fijo en español.      Este mensaje se muestra al, Tests completos para el motor de triage determinista.  Cubre: normalización de, Verifica que el mensaje de crisis incluya recursos verificados., El mensaje de crisis debe incluir números de teléfono         de los recursos v, Verifica la normalización de texto: acentos, minúsculas, variantes. (+6 more)

### Community 53 - "Community 53"
Cohesion: 0.26
Nodes (5): environment, Psychologist, Holiday, DiaryEntry, SupabaseService

### Community 54 - "Community 54"
Cohesion: 0.13
Nodes (14): Categoría 1: Recursos de Crisis (CERO TOLERANCIA a error), Categoría 2: Información Clínica General, Categoría 3: Protocolos de Derivación México, Categoría 4: Técnicas de Soporte Emocional, Categoría 5: Preguntas Trampa (para detectar confabulación), Configuración del Modelo, Criterio de Aceptación, Cómo Ejecutar (+6 more)

### Community 55 - "Community 55"
Cohesion: 0.14
Nodes (14): devDependencies, @angular/build, @angular/cli, @angular/compiler-cli, jasmine-core, karma, karma-chrome-launcher, karma-coverage (+6 more)

### Community 57 - "Community 57"
Cohesion: 0.18
Nodes (10): 1. Planificación de Infraestructura, 2. Rutas de Despliegue, 3. Seguridad Clínica y Auditoría de Logs, 4. Respaldos y Recuperación ante Desastres, Auditoría de Crisis (Overrides), Manual de Despliegue en Producción y Políticas de Seguridad, Reglas Clínicas Invariables (en `contract.json`), Requisitos de Hardware para Producción (+2 more)

### Community 58 - "Community 58"
Cohesion: 0.20
Nodes (9): Backlog Pendiente, Fase de Integración (Backend: PostgreSQL / PostgREST), Skill 1: Capa de Datos (PostgreSQL + PostgREST), Skill 2: Autenticación y Onboarding Clínico (Fase actual: Ejecutada), Skill 3: Amati Chat Estudiantil (Fase actual: Ejecución), Skill 5: Command Center Clínico (Fase actual: Ejecución), Skill 6: Mi Diario Personal (Fase actual: Ejecución), Skill 7: Gestión de Perfil y Avatares (Fase actual: Planeación SDD) (+1 more)

### Community 59 - "Community 59"
Cohesion: 0.22
Nodes (8): 1. Requisitos del Sistema, 2. Automatización con Makefile, 3. Estructura de Scripts (`scripts/`), 4. Estructura del Repositorio, Comandos de Configuración e Instalación, Comandos de Contenedores (Docker), Comandos de Ejecución y Diagnóstico, Guía de Operación y Desarrollo

### Community 60 - "Community 60"
Cohesion: 0.50
Nodes (3): EmergencyChangeRequest, WebPushSubscriptionPayload, WhatsAppRoutingSession

### Community 61 - "Community 61"
Cohesion: 0.25
Nodes (7): name, prettier, overrides, printWidth, singleQuote, private, version

### Community 62 - "Community 62"
Cohesion: 0.25
Nodes (5): Estado mutable de una sesión de conversación.      Mantiene el historial de me, Agrega un mensaje al historial de la sesión.          Args:             msg:, Actualiza el nivel de riesgo actual de la sesión.          El nivel solo puede, Activa un override y lo registra en el historial.          Establece ``is_over, SessionState

### Community 63 - "Community 63"
Cohesion: 0.25
Nodes (7): 1. Justificación Clínica y del Proyecto, 2. Arquitectura de Seguridad Híbrida, 3. Niveles de Riesgo y Acciones, Contexto del Proyecto: Ecosistema de Asistencia Emocional con IA Generativa, El Desafío del Lenguaje Metafórico (Caso "Oprobios"), Funcionamiento del Override (Nivel ROJO), Selección de Modelos: Qwen 2.5 14B vs Llama 3.1 8B

### Community 64 - "Community 64"
Cohesion: 0.29
Nodes (6): 1. Ciberseguridad y Privacidad como Pilar Absoluto, 2. La Especificación es la Ley, 3. Prioridad Clínica y Responsabilidad, 4. Diseño y UX (User Experience), 5. Prácticas de Desarrollo y Documentación, Constitución del Ecosistema de Asistencia Emocional

### Community 65 - "Community 65"
Cohesion: 0.33
Nodes (6): check_metaphoric_patterns(), _has_cooccurrence(), _pattern_found_in_sentences(), Detecta patrones metafóricos de riesgo en el texto.      Para cada patrón en `, Comprueba co-ocurrencia en ventanas de 2 oraciones consecutivas.      Si solo, Verifica si la ventana contiene al menos un término primario y uno contextual.

### Community 66 - "Community 66"
Cohesion: 0.33
Nodes (6): scripts, build, ng, start, test, watch

### Community 70 - "Community 70"
Cohesion: 0.24
Nodes (4): authGuard(), roleGuard(), AuditService, ChatMessage

### Community 73 - "Community 73"
Cohesion: 0.50
Nodes (3): Verifica que el override NO se active en nivel VERDE., Una clasificación VERDE no debe producir override., TestOverrideInactiveOnVerde

### Community 74 - "Community 74"
Cohesion: 0.50
Nodes (3): Verifica detección literal de alto riesgo → ROJO., Expresión literal de ideación suicida debe ser ROJO., TestClassifyRojoLiteral

### Community 75 - "Community 75"
Cohesion: 0.50
Nodes (3): Verifica detección de variantes informales → ROJO., kiero morir' (variante informal) debe ser ROJO., TestClassifyRojoInformal

## Knowledge Gaps
- **182 isolated node(s):** `$schema`, `version`, `newProjectRoot`, `projectType`, `style` (+177 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SupabaseService` connect `Community 53` to `Core Services and Auth`, `Modals Diary and Exceptions`, `Community 67`, `Community 70`, `Admin Patient Statistics Overview`, `Main App Security Interceptors`, `Profile Avatar Manager`, `Community 60`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `AuthService` connect `Core Services and Auth` to `Modals Diary and Exceptions`, `Community 67`, `Community 70`, `Community 72`, `Profile Avatar Manager`, `Community 53`, `Psychologist Layout Navigation`, `Community 60`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `PsychologistsComponent` connect `Psychologist Profile and Utilities` to `Community 53`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `RiskLevel` (e.g. with `TriageEngine` and `OverrideSignal`) actually correct?**
  _`RiskLevel` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `TriageEngine` (e.g. with `MessageRequest` and `RiskLevel`) actually correct?**
  _`TriageEngine` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `UserMessage` (e.g. with `MessageRequest` and `TriageEngine`) actually correct?**
  _`UserMessage` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Motor determinista de triage para clasificación de riesgo en salud mental. Todas`, `$schema`, `version` to the rest of the system?**
  _247 weakly-connected nodes found - possible documentation gaps or missing edges._