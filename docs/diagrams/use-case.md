# SmartMurima — Use Case Diagram

All **30 use cases (UC-01…UC-30)** across the **8 domains**, with the four human actors and the three
system/external actors (IoT Sensor Node, AI Engine, Weather API; SMS Gateway supporting).
Cross-reference `../USE_CASES.md`. GitHub and the Artifact viewer render Mermaid natively.

Because a single diagram with 30 use cases is dense, the model is split into three readable views:
authentication + farm/field + sensing, then intelligence (recommendations, disease, assistant), then
alerts/reports + administration/extension. Actors are reused consistently across views.

## Actors

- **Farmer** (primary human) · **Coop Admin / Agronomist** · **Extension Officer** · **System Admin**
- **IoT Sensor Node** (system) · **AI Engine** (system) · **Weather API** (external) · **SMS Gateway** (external, supporting)

## View 1 — Identity, Farm/Field, Sensing (UC-01…UC-13)

```mermaid
flowchart LR
    Farmer(("Farmer"))
    Coop(("Coop Admin / Agronomist"))
    Ext(("Extension Officer"))
    Node(("IoT Sensor Node"))
    Sms(("SMS Gateway"))

    subgraph AUTH["Domain 1 — Authentication and Identity"]
        UC01["UC-01 Register Account"]
        UC02["UC-02 Verify OTP"]
        UC03["UC-03 Login (2FA optional)"]
        UC04["UC-04 Reset Password (OTP)"]
        UC05["UC-05 Manage Profile and Language"]
        UC06["UC-06 Refresh Token / Logout"]
    end

    subgraph FARM["Domain 2 — Farm and Field Management"]
        UC07["UC-07 Register Farm"]
        UC08["UC-08 Manage Fields"]
        UC09["UC-09 Register / Manage Sensor Node"]
        UC10["UC-10 Switch Active Farm / Field"]
    end

    subgraph SENSE["Domain 3 — Sensing and Monitoring"]
        UC11["UC-11 Ingest Sensor Data"]
        UC12["UC-12 View Monitoring Dashboard"]
        UC13["UC-13 View Field Detail"]
    end

    Farmer --> UC01 & UC02 & UC03 & UC04 & UC05 & UC06
    Farmer --> UC07 & UC08 & UC10
    Farmer --> UC12 & UC13
    Coop --> UC07 & UC08 & UC09 & UC10 & UC12 & UC13
    Ext --> UC12 & UC13
    Node --> UC11
    UC01 -.-> Sms
    UC02 -.-> Sms
```

## View 2 — Intelligence: Recommendations, Disease, Assistant (UC-14…UC-21)

```mermaid
flowchart LR
    Farmer(("Farmer"))
    Ext(("Extension Officer"))
    AI(("AI Engine"))
    Weather(("Weather API"))
    Node(("IoT Sensor Node"))

    subgraph REC["Domain 4 — Recommendations"]
        UC14["UC-14 Request Irrigation Recommendation"]
        UC15["UC-15 Request Fertilizer Recommendation"]
        UC16["UC-16 Request / View Yield Forecast"]
        UC17["UC-17 View Recommendation History"]
    end

    subgraph DIS["Domain 5 — Disease Detection"]
        UC18["UC-18 Detect Crop Disease from Image"]
        UC19["UC-19 View Disease Reports"]
    end

    subgraph RAG["Domain 6 — AI Assistant (RAG)"]
        UC20["UC-20 Ask AI Assistant (grounded)"]
        UC21["UC-21 Manage Chat Sessions / History"]
    end

    Farmer --> UC14 & UC15 & UC16 & UC17
    Farmer --> UC18 & UC19
    Farmer --> UC20 & UC21
    Ext --> UC20
    AI --> UC14 & UC15 & UC16 & UC18 & UC20
    Weather -.-> UC14
    Weather -.-> UC15
    Weather -.-> UC16
    Node -.-> UC14
```

## View 3 — Alerts/Reports, Administration and Extension (UC-22…UC-30)

```mermaid
flowchart LR
    Farmer(("Farmer"))
    Coop(("Coop Admin / Agronomist"))
    Ext(("Extension Officer"))
    Admin(("System Admin"))
    AI(("AI Engine"))
    Weather(("Weather API"))
    Dev(("Developer / Admin"))

    subgraph AR["Domain 7 — Alerts and Reports"]
        UC22["UC-22 Receive and Manage Alerts"]
        UC23["UC-23 Generate and Export Reports"]
    end

    subgraph ADM["Domain 8 — Administration and Extension"]
        UC24["UC-24 Manage Users and Roles"]
        UC25["UC-25 Manage Sensor-Node Registry"]
        UC26["UC-26 Manage Knowledge Documents"]
        UC27["UC-27 Extension: Review Farmers / Validate"]
        UC28["UC-28 Review Disease Reports"]
        UC29["UC-29 Fetch Weather Forecast"]
        UC30["UC-30 View API Documentation"]
    end

    Farmer --> UC22 & UC23
    Coop --> UC22 & UC23 & UC25 & UC28
    Ext --> UC22 & UC23 & UC27 & UC28
    Admin --> UC22 & UC24 & UC25 & UC26
    AI -.-> UC22
    Weather -.-> UC29
    UC23 -.-> UC29
    Dev --> UC30
```
</content>
