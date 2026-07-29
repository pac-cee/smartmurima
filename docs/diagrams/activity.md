# SmartMurima — Activity Diagrams

Control-flow for the four key workflows, with the decision and exception branches specified in
`../USE_CASES.md` (stale data, low confidence, no-context "don't know"). Modelled as Mermaid flowcharts
with decision nodes. GitHub and the Artifact viewer render Mermaid natively.

## (a) Registration + OTP verification (UC-01, UC-02)

```mermaid
flowchart TD
    START(["Start"]) --> SUBMIT["User submits registration form"]
    SUBMIT --> VALID{"Unique email/phone and strong password?"}
    VALID -->|"No: duplicate"| E1["409 already_exists (no OTP sent)"] --> STOP1(["End"])
    VALID -->|"No: weak password"| E2["400 field errors"] --> STOP1
    VALID -->|"Yes"| CREATE["Create inactive User"]
    CREATE --> GEN["OtpService generates 6-digit code, hashed, TTL, purpose=register"]
    GEN --> SEND{"SMS send succeeded?"}
    SEND -->|"No"| KEEP["Keep account inactive; offer resend"] --> ENTER
    SEND -->|"Yes"| ENTER["User enters code on Verify OTP screen"]
    ENTER --> CHECK{"Code valid, unexpired, unconsumed, attempts &lt; max?"}
    CHECK -->|"Wrong code"| INC["Increment attempts, 400 otp_invalid"] --> LOCK{"Max attempts reached?"}
    LOCK -->|"Yes"| LOCKED["Lock code (423/429), require resend"] --> ENTER
    LOCK -->|"No"| ENTER
    CHECK -->|"Expired"| EXP["400 otp_expired, prompt resend"] --> ENTER
    CHECK -->|"Valid"| CONSUME["Mark OTP consumed, activate account"]
    CONSUME --> TOKENS["Issue JWT access + refresh"]
    TOKENS --> DASH["Redirect to dashboard"] --> STOP2(["End"])
```

## (b) Irrigation recommendation (UC-14)

```mermaid
flowchart TD
    START(["Start"]) --> REQ["Farmer selects field, requests irrigation recommendation"]
    REQ --> HASFIELD{"Field has a node?"}
    HASFIELD -->|"No"| E2["400 prompt to register node (UC-09)"] --> STOP1(["End"])
    HASFIELD -->|"Yes"| FRESH{"Recent readings available?"}
    FRESH -->|"Stale / missing"| GAP{"Gap too large?"}
    GAP -->|"Yes"| SUPPRESS["Suppress: 'insufficient recent data'"] --> STOP1
    GAP -->|"No"| FALLBACK["Use most-recent valid data, flag limitation"] --> CROP
    FRESH -->|"Yes"| CROP["Retrieve crop type and growth stage"]
    CROP --> WX{"Weather API available?"}
    WX -->|"No"| NOWX["Proceed without forecast, note reduced confidence"] --> FEAT
    WX -->|"Yes"| FEAT["FeatureBuilder assembles features (rolling 3/7-day avg, GDD, days-since-irrigation, forecast rain)"]
    FEAT --> ART{"Model artifact present?"}
    ART -->|"No"| STUB["Use deterministic heuristic stub, flag details.stub=true"] --> PREDICT
    ART -->|"Yes"| PREDICT["IrrigationClassifier predicts decision + confidence"]
    PREDICT --> PERSIST["Persist Recommendation (type, decision, value mm, unit, confidence, details)"]
    PERSIST --> CRIT{"Soil moisture critically low?"}
    CRIT -->|"Yes"| ALERT["Raise low_moisture alert (UC-22)"] --> SHOW
    CRIT -->|"No"| SHOW["Display recommendation on dashboard"]
    SHOW --> STOP2(["End"])
```

## (c) Crop-disease detection (UC-18)

```mermaid
flowchart TD
    START(["Start"]) --> UPLOAD["Farmer uploads / captures leaf photo"]
    UPLOAD --> IMGOK{"Image valid (format, size, quality)?"}
    IMGOK -->|"No"| REJECT["Reject and re-prompt (no report saved)"] --> STOP1(["End"])
    IMGOK -->|"Yes"| PRE["Pre-process: resize + normalise"]
    PRE --> ART{"CNN artifact present?"}
    ART -->|"No"| STUB["Use stub classifier, flag"] --> INFER
    ART -->|"Yes"| INFER["DiseaseClassifier (CNN) returns class + confidence"]
    INFER --> CONF{"Confidence >= threshold?"}
    CONF -->|"No"| LOW["Advise unreliable result; suggest clearer image or extension officer"]
    LOW --> SAVELOW["Save DiseaseReport flagged low_confidence for review (UC-28)"] --> STOP2(["End"])
    CONF -->|"Yes"| HEALTHY{"Leaf healthy?"}
    HEALTHY -->|"Yes"| OK["Set is_healthy=true, reassuring message"] --> SAVE
    HEALTHY -->|"No"| GUIDE["Fetch management guidance / treatment"] --> SAVE
    SAVE["Persist DiseaseReport (disease, confidence, treatment, image)"]
    SAVE --> DISPLAY["Display diagnosis + treatment"] --> STOP2
```

## (d) RAG assistant query (UC-20)

```mermaid
flowchart TD
    START(["Start"]) --> ASK["User submits question in chat session"]
    ASK --> EMPTY{"Question empty?"}
    EMPTY -->|"Yes"| E1["400 question_required"] --> STOP1(["End"])
    EMPTY -->|"No"| EMBOK{"Embedding model available?"}
    EMBOK -->|"No"| E4["503 clear ops message"] --> STOP1
    EMBOK -->|"Yes"| EMBED["Embed question (nomic-embed-text)"]
    EMBED --> SEARCH["pgvector top-k similarity search over RAB/MINAGRI chunks"]
    SEARCH --> CTX{"Relevant context found?"}
    CTX -->|"No"| DONTKNOW["Assistant says it does not know; suggest contacting extension (no hallucination)"] --> PERSIST
    CTX -->|"Yes"| PROMPT["PromptBuilder: 'answer ONLY from context', inject chunks, route language (rw/en)"]
    PROMPT --> LLM{"Ollama reachable?"}
    LLM -->|"No"| E3["503 assistant_unavailable, graceful UI message"] --> STOP1
    LLM -->|"Yes"| GEN["Llama 3.1 8B generates grounded answer, streamed (SSE)"]
    GEN --> PERSIST["Persist ChatMessages (user + assistant) with source references"]
    PERSIST --> SHOW["Display answer + source chips"] --> STOP2(["End"])
```
</content>
