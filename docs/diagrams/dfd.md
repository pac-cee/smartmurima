# SmartMurima — Data Flow Diagrams

Data-flow view per the dissertation §4.5.7. Notation mapped to Mermaid flowchart shapes: **external
entities** as rectangles `[...]`, **processes** as rounded boxes `(...)`, **data stores** as cylinders
`[(...)]`, and **data flows** as directed arrows. GitHub and the Artifact viewer render Mermaid
natively.

## Level 0 — Context Diagram (Figure 10)

The whole platform is a single process exchanging data with its external entities.

```mermaid
flowchart LR
    Farmer["Farmer"]
    Coop["Cooperative Admin"]
    Ext["Extension Officer"]
    Admin["System Administrator"]
    Node["IoT Sensor Node"]
    Weather["Weather API"]

    SYS(("SmartMurima Platform"))

    Farmer -->|"registration, requests, images, questions"| SYS
    SYS -->|"dashboards, recommendations, diagnoses, alerts, answers"| Farmer
    Node -->|"raw sensor readings"| SYS
    Weather -->|"forecast data"| SYS
    Coop -->|"management inputs"| SYS
    SYS -->|"reports, monitoring"| Coop
    Ext -->|"advisory / validation inputs"| SYS
    SYS -->|"reports, disease reports"| Ext
    Admin -->|"config, knowledge-document updates"| SYS
    SYS -->|"admin views, audit"| Admin
```

## Level 1 — Process Decomposition (Figure 11)

```mermaid
flowchart TB
    Farmer["Farmer"]
    CoopExt["Coop Admin / Extension"]
    Admin["System Administrator"]
    Node["IoT Sensor Node"]
    Weather["Weather API"]

    P1(("P1 Manage Users and Auth"))
    P2(("P2 Ingest Sensor Data"))
    P3(("P3 Generate Recommendations"))
    P4(("P4 Detect Crop Disease"))
    P5(("P5 Answer Queries (RAG)"))
    P6(("P6 Manage Alerts and Reports"))

    D1[("D1 Users")]
    D2[("D2 Sensor Readings")]
    D3[("D3 Recommendations")]
    D4[("D4 Disease Reports")]
    D5[("D5 Knowledge Documents")]
    D6[("D6 Chat Sessions and Messages")]
    D7[("D7 Alerts")]

    Farmer -->|"credentials / profile"| P1
    P1 <-->|"validate / store"| D1
    Admin -->|"manage users, nodes, docs"| P1
    Admin -->|"knowledge uploads (chunk + embed)"| D5

    Node -->|"telemetry via broker"| P2
    P2 -->|"validated readings"| D2

    Farmer -->|"recommendation request"| P3
    D2 -->|"latest + rolling readings"| P3
    Weather -->|"forecast"| P3
    P3 -->|"persisted recommendation"| D3
    P3 -->|"critical condition"| P6

    Farmer -->|"leaf image"| P4
    P4 -->|"diagnosis + treatment"| D4

    Farmer -->|"natural-language question"| P5
    D5 -->|"retrieved chunks"| P5
    P5 -->|"grounded answer + sources"| D6

    D2 --> P6
    D3 --> P6
    D4 --> P6
    P6 -->|"notifications"| D7
    P6 -->|"reports / dashboards"| CoopExt
    P6 -->|"alerts + reports"| Farmer
```
</content>
