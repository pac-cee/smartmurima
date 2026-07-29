# SmartMurima — State Diagrams (bonus)

Lifecycle states for the OTP code and for the AI-output entities (Recommendation, DiseaseReport),
consistent with the business rules in `../USE_CASES.md`. GitHub and the Artifact viewer render Mermaid
natively.

## OtpCode lifecycle (UC-01, UC-02)

```mermaid
stateDiagram-v2
    [*] --> Pending : generate (hashed, TTL, purpose)
    Pending --> Verified : correct code within TTL
    Pending --> Pending : wrong code (attempts++)
    Pending --> Locked : attempts >= max
    Pending --> Expired : TTL elapsed
    Locked --> Pending : resend (new code)
    Expired --> Pending : resend (new code)
    Verified --> [*] : consumed (single-use)
    Locked --> [*]
    Expired --> [*]
```

## Recommendation status (UC-14, UC-15, UC-16)

```mermaid
stateDiagram-v2
    [*] --> Requested : farmer requests
    Requested --> Suppressed : data gap too large
    Requested --> Generated : model / stub produces decision
    Generated --> Flagged : stale-data or stub or degraded confidence
    Generated --> Persisted : confidence acceptable
    Flagged --> Persisted : stored with limitation note
    Persisted --> Alerted : critical (e.g. low moisture)
    Persisted --> [*]
    Alerted --> [*]
    Suppressed --> [*]
```

## DiseaseReport status (UC-18, UC-19, UC-28)

```mermaid
stateDiagram-v2
    [*] --> Uploaded : farmer uploads image
    Uploaded --> Rejected : invalid / blurry image
    Uploaded --> Classified : CNN returns class + confidence
    Classified --> Confirmed : confidence >= threshold
    Classified --> LowConfidence : confidence below threshold
    Confirmed --> Healthy : is_healthy = true
    Confirmed --> Diagnosed : disease + treatment
    LowConfidence --> UnderReview : flagged for extension / coop
    Diagnosed --> [*]
    Healthy --> [*]
    UnderReview --> [*]
    Rejected --> [*]
```
</content>
