# Graph Report - Plataforma-Emocional-  (2026-06-27)

## Corpus Check
- 90 files · ~64,307 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 750 nodes · 1076 edges · 67 communities (16 shown, 51 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `474e4fe2`
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

## God Nodes (most connected - your core abstractions)
1. `AuthService` - 42 edges
2. `SupabaseService` - 30 edges
3. `FacultiesComponent` - 25 edges
4. `PsychologistsComponent` - 25 edges
5. `StudentAgendaComponent` - 22 edges
6. `PerfilPaciente` - 19 edges
7. `HealthProfessionalAgendaComponent` - 17 edges
8. `PatientProfileComponent` - 17 edges
9. `AgendaComponent` - 16 edges
10. `AlimentaryDashboardComponent` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Skill 9: RoleGuard Security` --semantically_similar_to--> `Ciberseguridad y Privacidad`  [INFERRED] [semantically similar]
  spec.md → .constitution.md
- `LoginComponent Template` --implements--> `Skill 2: Autenticación y Onboarding Clínico`  [INFERRED]
  src/app/features/auth/login/login.component.html → spec.md
- `LoginComponent Template` --implements--> `Ciberseguridad y Privacidad`  [INFERRED]
  src/app/features/auth/login/login.component.html → .constitution.md
- `ux-specialist` --conceptually_related_to--> `Diseño y UX`  [INFERRED]
  .diana/agents.yaml → .constitution.md
- `LoginComponent Template` --implements--> `Diseño y UX`  [INFERRED]
  src/app/features/auth/login/login.component.html → .constitution.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Admin Dashboard Suite** — admin_layout_admin_layout_component_template, agenda_agenda_component_template, faculties_faculties_component_template, overview_overview_component_template, patients_patients_component_template, psychologists_psychologists_component_template, reports_reports_component_template [INFERRED 0.95]
- **Diana Deep Agents Team** — _diana_agents_angular_architect, _diana_agents_postgrest_dev, _diana_agents_ai_integrator, _diana_agents_ux_specialist, _diana_agents_cybersec_guardian [EXTRACTED 1.00]
- **Student Emotional Assistance and Care Flow** — dashboard_layout_dashboard_layout_component_student_sidebar, dashboard_dashboard_component_chat_view, dashboard_diary_dashboard_component_therapeutic_refuge, student_agenda_student_agenda_component_appointment_scheduler [INFERRED 0.85]
- **Psychologist Clinical Command Center and Triage Flow** — psychologist_layout_psychologist_layout_component_psychologist_sidebar, dashboard_dashboard_component_psychologist_triage_view, patients_patients_component_patient_directory, agenda_agenda_component_clinical_timeline, patient_profile_patient_profile_component_clinical_expedient_view [INFERRED 0.85]

## Communities (67 total, 51 thin omitted)

### Community 0 - "Core Services and Auth"
Cohesion: 0.05
Nodes (25): Appointment, EmergencyModalData, AdminFaculty, FeedbackModalComponent, FeedbackModalData, Holiday, AgendaService, TimeBlock (+17 more)

### Community 2 - "Package Config and Dependencies"
Cohesion: 0.05
Nodes (37): dependencies, @angular/animations, @angular/cdk, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/material (+29 more)

### Community 3 - "Angular Architect Configurations"
Cohesion: 0.08
Nodes (30): build, extract-i18n, serve, test, builder, configurations, defaultConfiguration, options (+22 more)

### Community 4 - "Angular Build Schemas"
Cohesion: 0.07
Nodes (28): cli, analytics, newProjectRoot, prefix, projectType, root, schematics, sourceRoot (+20 more)

### Community 7 - "AI Triage and Student Agenda"
Cohesion: 0.13
Nodes (3): AiTriageMockService, UrgencyLevel, StudentAgendaComponent

### Community 8 - "Admin Patient Statistics Overview"
Cohesion: 0.11
Nodes (7): environment, OverviewComponent, Psychologist, AdminStatsService, ChartDataPoint, OverviewMetrics, PatientsComponent

### Community 9 - "Alimentary Assessment Dashboard"
Cohesion: 0.12
Nodes (3): AlimentaryDashboardComponent, ChatMessage, ClinicalService

### Community 12 - "Dashboard UI Views"
Cohesion: 0.17
Nodes (16): Psychologist Daily Agenda Timeline, Amati AI Chat Dashboard, Psychologist Triage Dashboard, Amati Therapeutic Refuge and Diary, Student Dashboard Sidebar, Clinical Expedient and AI Insights View, Psychologist Assigned Patients Directory, Profile Avatar Manager Component (+8 more)

### Community 14 - "Main App Security Interceptors"
Cohesion: 0.16
Nodes (7): App, appConfig, routes, authGuard(), roleGuard(), authInterceptor(), AuditService

### Community 18 - "Dashboard Main Navigation Layout"
Cohesion: 0.13
Nodes (3): DashboardLayoutComponent, DASHBOARD_ROUTES, ChatService

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

### Community 55 - "Community 55"
Cohesion: 0.20
Nodes (9): Backlog Pendiente, Fase de Integración (Backend: PostgreSQL / PostgREST), Skill 1: Capa de Datos (PostgreSQL + PostgREST), Skill 2: Autenticación y Onboarding Clínico (Fase actual: Ejecutada), Skill 3: Amati Chat Estudiantil (Fase actual: Ejecución), Skill 5: Command Center Clínico (Fase actual: Ejecución), Skill 6: Mi Diario Personal (Fase actual: Ejecución), Skill 7: Gestión de Perfil y Avatares (Fase actual: Planeación SDD) (+1 more)

### Community 57 - "Community 57"
Cohesion: 0.29
Nodes (6): 1. Ciberseguridad y Privacidad como Pilar Absoluto, 2. La Especificación es la Ley, 3. Prioridad Clínica y Responsabilidad, 4. Diseño y UX (User Experience), 5. Prácticas de Desarrollo y Documentación, Constitución del Ecosistema de Asistencia Emocional

## Knowledge Gaps
- **154 isolated node(s):** `$schema`, `version`, `newProjectRoot`, `projectType`, `style` (+149 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SupabaseService` connect `Core Services and Auth` to `Admin Patient Statistics Overview`, `Main App Security Interceptors`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `AuthService` connect `Core Services and Auth` to `Dashboard Main Navigation Layout`, `Main App Security Interceptors`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `PsychologistsComponent` connect `Psychologist Profile and Utilities` to `Admin Patient Statistics Overview`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `$schema`, `version`, `newProjectRoot` to the rest of the system?**
  _158 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Services and Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.05322953923837576 - nodes in this community are weakly interconnected._
- **Should `Package Config and Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `Angular Architect Configurations` be split into smaller, more focused modules?**
  _Cohesion score 0.08275862068965517 - nodes in this community are weakly interconnected._