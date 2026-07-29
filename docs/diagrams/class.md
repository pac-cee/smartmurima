# SmartMurima — Class Diagram

Static domain model mirroring the dissertation class diagram (§4.5.3), the ERD (§4.5.9), and the
`BACKEND_PROMPT.md` data model. Attributes use the persisted field names; multiplicities match the
business rules in `../USE_CASES.md`. A second block shows the layered architecture stereotypes
(Repository / Service / View) conceptually. GitHub and the Artifact viewer render Mermaid natively.

## Domain model

```mermaid
classDiagram
    class User {
        +bigint id
        +string username
        +string email
        +string password_hash
        +string full_name
        +string phone_number
        +string role
        +string language
        +bool is_active
        +datetime created_at
        +authenticate(password) bool
        +issue_tokens() TokenPair
    }
    class OtpCode {
        +bigint id
        +string identifier
        +string code_hash
        +string purpose
        +datetime expires_at
        +datetime consumed_at
        +int attempts
        +verify(code) bool
        +is_expired() bool
    }
    class Farmer {
        +bigint id
        +bigint user_id
    }
    class Farm {
        +bigint id
        +bigint farmer_id
        +string name
        +string sector
        +decimal latitude
        +decimal longitude
        +decimal area_hectares
        +datetime created_at
    }
    class Field {
        +bigint id
        +bigint farm_id
        +bigint crop_id
        +string name
        +date planting_date
        +string growth_stage
        +decimal area_hectares
    }
    class Crop {
        +bigint id
        +string name
        +decimal base_temp
        +string season
    }
    class SensorNode {
        +bigint id
        +bigint field_id
        +string device_id
        +string status
        +int battery
        +datetime last_seen
        +update_last_seen()
    }
    class SensorReading {
        +bigint id
        +bigint sensor_node_id
        +decimal soil_moisture
        +decimal temperature
        +decimal humidity
        +decimal rainfall
        +datetime recorded_at
    }
    class WeatherRecord {
        +bigint id
        +bigint farm_id
        +decimal rainfall_forecast
        +decimal temperature
        +decimal humidity
        +datetime forecast_for
        +datetime fetched_at
    }
    class Recommendation {
        +bigint id
        +bigint field_id
        +string type
        +string decision
        +decimal value
        +string unit
        +decimal confidence
        +string details
        +datetime created_at
    }
    class DiseaseReport {
        +bigint id
        +bigint field_id
        +string image
        +string disease
        +decimal confidence
        +bool is_healthy
        +string treatment
        +datetime created_at
    }
    class ChatSession {
        +bigint id
        +bigint user_id
        +string title
        +datetime created_at
    }
    class ChatMessage {
        +bigint id
        +bigint session_id
        +string role
        +string content
        +json sources
        +datetime created_at
    }
    class KnowledgeDocument {
        +bigint id
        +string title
        +string source
        +string content
        +int chunk_index
        +vector embedding
        +string status
    }
    class Alert {
        +bigint id
        +bigint user_id
        +string type
        +string message
        +string severity
        +bool is_read
        +datetime created_at
    }

    User "1" -- "0..1" Farmer : profile
    User "1" -- "0..*" OtpCode : codes
    User "1" -- "0..*" ChatSession : owns
    User "1" -- "0..*" Alert : receives
    Farmer "1" -- "0..*" Farm : owns
    Farm "1" -- "0..*" Field : contains
    Farm "1" -- "0..*" WeatherRecord : location
    Crop "1" -- "0..*" Field : planted_in
    Field "1" -- "0..*" SensorNode : monitored_by
    SensorNode "1" -- "0..*" SensorReading : produces
    Field "1" -- "0..*" Recommendation : has
    Field "1" -- "0..*" DiseaseReport : has
    ChatSession "1" -- "0..*" ChatMessage : aggregates
```

## Layered architecture stereotypes (conceptual)

Every domain app follows the strict layering from `BACKEND_PROMPT.md`
(views → services → repositories → models). The example below shows the Recommendations app; the same
pattern applies to accounts, farms, sensors, diseases, assistant, alerts, reports, and weather.

```mermaid
classDiagram
    class RecommendationView {
        <<View>>
        +post_irrigation(request) Response
        +list(request) Response
    }
    class RecommendationService {
        <<Service>>
        +irrigation(field) Recommendation
        +fertilizer(field) Recommendation
        +yield_forecast(field) Recommendation
    }
    class FeatureBuilder {
        <<Service>>
        +build(field) FeatureVector
    }
    class IrrigationClassifier {
        <<MLInference>>
        +predict(features) Prediction
    }
    class RecommendationRepository {
        <<Repository>>
        +create(dto) Recommendation
        +list_for_field(field) list
    }
    class SensorReadingRepository {
        <<Repository>>
        +latest_for_field(field) SensorReading
        +rolling_avg(field, days) float
    }
    class Recommendation {
        <<Model>>
    }

    RecommendationView --> RecommendationService : calls
    RecommendationService --> FeatureBuilder : uses
    RecommendationService --> IrrigationClassifier : infers
    RecommendationService --> RecommendationRepository : persists
    FeatureBuilder --> SensorReadingRepository : reads
    RecommendationRepository --> Recommendation : maps
```
</content>
