# SmartMurima — Documentation Index

Formal software documentation for **SmartMurima**, the AI-driven precision agriculture platform for
smallholder farmers and cooperatives in Bugesera District, Rwanda (source dissertation: Tumusime Frank,
University of Kigali, 2026). All documents share the same requirement identifiers (FR-01…FR-10,
NFR-1…NFR-8) and use-case identifiers (UC-01…UC-30) and are mutually consistent.

> The diagram files contain fenced ```mermaid blocks. **GitHub and the claude.ai Artifact viewer render
> Mermaid diagrams natively**, so these files display as diagrams there with no extra tooling.

## Specifications

| Document | Description |
|---|---|
| [SRS.md](./SRS.md) | IEEE-830-style Software Requirements Specification: scope, actors, environment, constraints, all functional features (FR-01…FR-10 + derived), external interfaces, non-functional requirements, and data requirements. |
| [USE_CASES.md](./USE_CASES.md) | Use-case catalogue: all 30 use cases across 8 domains with preconditions, main/alternate/exception flows, business rules, endpoints, and UI routes. |
| [TRACEABILITY_MATRIX.md](./TRACEABILITY_MATRIX.md) | Two-way traceability: Requirement → Use Case → Endpoint → UI Route → Test, plus NFR mechanisms, reverse endpoint trace, test plan, and coverage gates. |
| [API_CONTRACT.md](./API_CONTRACT.md) | REST API contract (v1): base URL, auth, roles, and every endpoint with request/response shapes. |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Visual and UX design system: green/white/black identity, tokens, typography, layout, components, motion, accessibility. |

## Diagrams (`docs/diagrams/`)

| Diagram | Description |
|---|---|
| [use-case.md](./diagrams/use-case.md) | Use case diagram: all 30 use cases grouped by the 8 domains, with human and system actors (IoT Node, AI Engine, Weather API, SMS Gateway), across three readable views. |
| [class.md](./diagrams/class.md) | Class diagram of the domain model (15 entities with attributes, methods, associations, multiplicities) plus the layered Repository/Service/View stereotypes. |
| [component.md](./diagrams/component.md) | Component diagram: frontend, Nginx, backend, ingestion, ML service, AI Assistant/RAG, Ollama, PostgreSQL+pgvector, MQTT broker, Weather API, with dependency arrows and interfaces. |
| [deployment.md](./diagrams/deployment.md) | Deployment diagram mapping components to Docker containers and hosts (field ESP32 nodes → gateway → MQTT; app server; DB node; Ollama/GPU host) per docker-compose. |
| [erd.md](./diagrams/erd.md) | Entity relationship diagram: all tables with PK/FK attributes and cardinalities, matching the data dictionary, including the pgvector embedding on knowledge_documents. |
| [dfd.md](./diagrams/dfd.md) | Data flow diagrams: Level 0 context diagram and Level 1 process decomposition (users/auth, ingest, recommend, disease, RAG queries, alerts/reports). |
| [activity.md](./diagrams/activity.md) | Activity diagrams with decision/exception branches for registration+OTP, irrigation recommendation, crop-disease detection, and RAG assistant query. |
| [sequence.md](./diagrams/sequence.md) | Sequence diagrams for sensor→recommendation, RAG query, registration/OTP/login token issuance, and disease image upload→report. |
| [state.md](./diagrams/state.md) | State diagrams (bonus) for the OtpCode lifecycle and the Recommendation and DiseaseReport statuses. |

## Reading order

1. **SRS.md** for the requirements baseline.
2. **USE_CASES.md** for detailed flows, then **TRACEABILITY_MATRIX.md** to see how each requirement maps
   to endpoints, UI routes, and tests.
3. **API_CONTRACT.md** and **DESIGN_SYSTEM.md** for interface and UX detail.
4. The **diagrams** for structural (class, component, deployment, ERD) and behavioural (use-case, DFD,
   activity, sequence, state) views.
</content>
