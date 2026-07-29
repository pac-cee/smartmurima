# SmartMurima — Sequence Diagrams

Time-ordered interactions for four representative scenarios (dissertation §4.5.5 plus auth and disease
flows). GitHub and the Artifact viewer render Mermaid natively.

## (a) Sensor data to stored recommendation (UC-11 + UC-14)

```mermaid
sequenceDiagram
    autonumber
    participant ESP as ESP32 Node
    participant MQTT as MQTT Broker
    participant ING as Ingestion Worker
    participant DB as PostgreSQL
    participant FE as Frontend
    participant BE as Backend API
    participant ML as ML Service

    ESP->>MQTT: publish telemetry smartmurima/{id}/telemetry
    MQTT->>ING: deliver message (buffered if backend down)
    ING->>ING: parse, validate, dedupe (device_id, ts)
    ING->>DB: persist SensorReading, update node last_seen
    Note over FE,BE: later, farmer requests a recommendation
    FE->>BE: POST /recommendations/irrigation {field}
    BE->>DB: query latest + rolling readings, crop, stage
    BE->>BE: fetch cached weather forecast
    BE->>ML: infer(features)
    ML-->>BE: decision + confidence
    BE->>DB: persist Recommendation (+ alert if critical)
    BE-->>FE: {type, decision, value, unit, confidence, details}
```

## (b) Farmer RAG query (UC-20)

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant BE as Backend API
    participant AS as Assistant Service
    participant EMB as Ollama (embed)
    participant DB as pgvector Store
    participant LLM as Ollama (Llama 3.1 8B)

    FE->>BE: POST /assistant/chat {session?, question, language}
    BE->>AS: answer(question, session, language)
    AS->>EMB: embed(question) nomic-embed-text
    EMB-->>AS: query vector
    AS->>DB: cosine similarity search (top-k chunks)
    DB-->>AS: RAB/MINAGRI chunks
    alt no relevant context
        AS-->>BE: "I don't know" + suggest extension
    else context found
        AS->>AS: PromptBuilder (answer ONLY from context)
        AS->>LLM: generate (streamed)
        LLM-->>AS: grounded answer (SSE tokens)
    end
    AS->>DB: persist ChatMessages (user + assistant) with sources
    AS-->>BE: {answer, sources[]}
    BE-->>FE: answer + source chips (streamed via SSE)
```

## (c) Registration / OTP / login token issuance (UC-01, UC-02, UC-03)

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant BE as Backend API
    participant AUTH as AuthService
    participant OTP as OtpService
    participant SMS as SMS Gateway
    participant DB as PostgreSQL

    FE->>BE: POST /auth/register {full_name,email,phone,password,role,language}
    BE->>AUTH: register(dto)
    AUTH->>DB: create inactive User
    AUTH->>OTP: generate(purpose=register)
    OTP->>DB: store hashed code + TTL
    OTP->>SMS: send code (console backend in dev)
    BE-->>FE: 201 pending verification
    FE->>BE: POST /auth/otp/verify {identifier, code}
    BE->>OTP: verify(identifier, code)
    OTP->>DB: constant-time compare, check TTL/attempts
    alt valid
        OTP->>DB: mark consumed, activate account
        BE->>AUTH: issue_tokens(user)
        AUTH-->>BE: access + refresh (rotation)
        BE-->>FE: 200 tokens
    else invalid / expired / locked
        BE-->>FE: 400 otp_invalid / otp_expired (423/429 on lock)
    end
```

## (d) Disease image upload to report (UC-18)

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant BE as Backend API
    participant DS as DiseaseService
    participant CNN as CNN (MobileNetV2)
    participant MED as Media Storage
    participant DB as PostgreSQL

    FE->>BE: POST /diseases/detect (multipart {field, image})
    BE->>DS: detect(field, image)
    DS->>DS: validate format/size/quality
    alt invalid image
        DS-->>BE: reject, re-prompt (no report saved)
        BE-->>FE: 400 invalid image
    else valid
        DS->>DS: pre-process (resize, normalise)
        DS->>CNN: classify(image)
        CNN-->>DS: class + confidence
        DS->>MED: store image (access-controlled)
        alt confidence >= threshold
            DS->>DB: persist DiseaseReport (disease, confidence, treatment, image)
            DS-->>BE: diagnosis + treatment
        else confidence below threshold
            DS->>DB: persist DiseaseReport flagged low_confidence
            DS-->>BE: unreliable result, advise extension/clearer image
        end
        BE-->>FE: {disease, confidence, is_healthy, treatment, image_url}
    end
```
</content>
