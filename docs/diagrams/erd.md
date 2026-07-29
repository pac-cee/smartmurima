# SmartMurima — Entity Relationship Diagram

Normalised (3NF) data model with BIGSERIAL surrogate primary keys, matching the dissertation ERD
(§4.5.9) and data dictionary (§4.5.10) and the `BACKEND_PROMPT.md` model. Physical table names are
used. The RAG corpus table `knowledge_documents` carries a pgvector `embedding VECTOR(768)`. GitHub and
the Artifact viewer render Mermaid natively.

```mermaid
erDiagram
    USERS ||--o| FARMERS : "has profile"
    USERS ||--o{ OTP_CODES : "issues"
    USERS ||--o{ CHAT_SESSIONS : "owns"
    USERS ||--o{ ALERTS : "receives"
    FARMERS ||--o{ FARMS : "owns"
    FARMS ||--o{ FIELDS : "contains"
    FARMS ||--o{ WEATHER_RECORDS : "location"
    CROPS ||--o{ FIELDS : "planted in"
    FIELDS ||--o{ SENSOR_NODES : "monitored by"
    SENSOR_NODES ||--o{ SENSOR_READINGS : "produces"
    FIELDS ||--o{ RECOMMENDATIONS : "has"
    FIELDS ||--o{ DISEASE_REPORTS : "has"
    CHAT_SESSIONS ||--o{ CHAT_MESSAGES : "aggregates"

    USERS {
        bigserial id PK
        varchar username "NOT NULL, UNIQUE"
        varchar email "NOT NULL, UNIQUE"
        varchar password_hash "NOT NULL"
        varchar full_name "NOT NULL"
        varchar phone_number "NULL"
        varchar role "CHECK farmer|coop_admin|extension|admin"
        varchar language "DEFAULT rw"
        boolean is_active "DEFAULT TRUE"
        timestamp created_at "DEFAULT now()"
    }

    OTP_CODES {
        bigserial id PK
        bigint user_id FK
        varchar identifier "email or phone"
        varchar code_hash "NOT NULL"
        varchar purpose "register|login|reset"
        timestamp expires_at "NOT NULL"
        timestamp consumed_at "NULL"
        int attempts "DEFAULT 0"
    }

    FARMERS {
        bigserial id PK
        bigint user_id FK "UNIQUE (1-1)"
    }

    FARMS {
        bigserial id PK
        bigint farmer_id FK "NOT NULL"
        varchar name "NOT NULL"
        varchar sector "NOT NULL"
        decimal latitude "NULL"
        decimal longitude "NULL"
        decimal area_hectares "DEFAULT 0"
        timestamp created_at "DEFAULT now()"
    }

    FIELDS {
        bigserial id PK
        bigint farm_id FK "NOT NULL"
        bigint crop_id FK "NULL"
        varchar name "NOT NULL"
        date planting_date "NULL"
        varchar growth_stage "NULL"
        decimal area_hectares "DEFAULT 0"
    }

    CROPS {
        bigserial id PK
        varchar name "NOT NULL"
        decimal base_temp "for GDD"
        varchar season
    }

    SENSOR_NODES {
        bigserial id PK
        bigint field_id FK "NOT NULL"
        varchar device_id "NOT NULL, UNIQUE"
        varchar status
        int battery "NULL"
        timestamp last_seen "NULL"
    }

    SENSOR_READINGS {
        bigserial id PK
        bigint sensor_node_id FK "NOT NULL"
        decimal soil_moisture "NOT NULL"
        decimal temperature "NULL"
        decimal humidity "NULL"
        decimal rainfall "NULL"
        timestamp recorded_at "DEFAULT now(), INDEX(node, recorded_at)"
    }

    WEATHER_RECORDS {
        bigserial id PK
        bigint farm_id FK "NOT NULL"
        decimal rainfall_forecast "NULL"
        decimal temperature "NULL"
        decimal humidity "NULL"
        timestamp forecast_for
        timestamp fetched_at "DEFAULT now()"
    }

    RECOMMENDATIONS {
        bigserial id PK
        bigint field_id FK "NOT NULL"
        varchar type "CHECK irrigation|fertilizer|yield"
        varchar decision "NOT NULL"
        decimal value "NULL"
        varchar unit "NULL"
        decimal confidence "0..1"
        text details "NULL"
        timestamp created_at "DEFAULT now()"
    }

    DISEASE_REPORTS {
        bigserial id PK
        bigint field_id FK "NOT NULL"
        varchar image "media path"
        varchar disease
        decimal confidence "0..1"
        boolean is_healthy
        text treatment "NULL"
        timestamp created_at "DEFAULT now()"
    }

    CHAT_SESSIONS {
        bigserial id PK
        bigint user_id FK "NOT NULL"
        varchar title
        timestamp created_at "DEFAULT now()"
    }

    CHAT_MESSAGES {
        bigserial id PK
        bigint session_id FK "NOT NULL"
        varchar role "user|assistant"
        text content "NOT NULL"
        json sources "source refs"
        timestamp created_at "DEFAULT now()"
    }

    KNOWLEDGE_DOCUMENTS {
        bigserial id PK
        varchar title "NOT NULL"
        varchar source "RAB|MINAGRI"
        text content "chunk text"
        int chunk_index
        vector embedding "VECTOR(768) pgvector, HNSW/IVF"
        varchar status "embedded|pending"
    }

    ALERTS {
        bigserial id PK
        bigint user_id FK "NOT NULL"
        varchar type "low_moisture|disease_risk|weather|system"
        varchar message
        varchar severity
        boolean is_read "DEFAULT FALSE"
        timestamp created_at "DEFAULT now()"
    }
```

**Notes**
- `KNOWLEDGE_DOCUMENTS` is the RAG corpus and has no foreign-key relationship to farmer data (privacy,
  BR-AS2); it is retrieved by vector similarity, not by join.
- `SENSOR_READINGS` are immutable and deduplicated on `(device_id, timestamp)` at ingestion; indexed on
  `(sensor_node_id, recorded_at)` for dashboard/aggregation performance.
- Every AI output row (`RECOMMENDATIONS`, `DISEASE_REPORTS`) carries a `confidence` and provenance
  (`details` / `treatment`).
</content>
