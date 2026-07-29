# SmartMurima — Deployment Diagram

Physical arrangement of software artefacts across hardware nodes and the communication paths between
them (dissertation §4.5.11), mapped to the containers in `docker-compose.yml`. Each application unit is
containerised with Docker and orchestrated with Docker Compose; the containers may be co-located on a
single well-provisioned server for the pilot or distributed as demand grows. GitHub and the Artifact
viewer render Mermaid natively.

```mermaid
flowchart TB
    subgraph FIELD["Field site (Bugesera)"]
        direction TB
        NODES["ESP32 sensor nodes<br/>(capacitive soil moisture + DHT22 + optional rain)"]
        GW["Site gateway / router<br/>(Wi-Fi + 4G/LTE uplink)"]
        NODES -->|"Wi-Fi / MQTT"| GW
    end

    subgraph CLIENT["Client devices"]
        BROWSER["Web browser<br/>(smartphone / tablet / computer)"]
    end

    subgraph SERVER["Application server (Docker Compose host, Ubuntu 22.04)"]
        direction TB
        NGINX["Nginx container<br/>(reverse proxy, TLS)"]
        FE["sm_frontend<br/>Next.js container"]
        BE["sm_backend<br/>Django + Gunicorn container"]
        ING["sm_ingestion<br/>run_ingestion worker container"]
        MQTT["sm_mqtt<br/>Mosquitto broker container"]
        PGADMIN["sm_pgadmin<br/>pgAdmin container"]
    end

    subgraph DBNODE["Database node"]
        DB["sm_db<br/>PostgreSQL 17 + pgvector container<br/>(volume: db_data)"]
    end

    subgraph GPUHOST["Ollama / GPU host"]
        OLLAMA["sm_ollama<br/>Ollama + Llama 3.1 8B<br/>(NVIDIA GPU, volume: ollama_data)"]
    end

    WAPI["Weather API (external cloud)"]

    GW -->|"MQTT 1883 (buffered)"| MQTT
    MQTT --> ING
    BROWSER -->|"HTTPS 443"| NGINX
    NGINX --> FE
    NGINX -->|"/api/v1"| BE
    FE -->|"REST + SSE"| BE
    ING -->|"TCP 5432"| DB
    BE -->|"TCP 5432"| DB
    PGADMIN -->|"TCP 5432"| DB
    BE -->|"HTTP 11434"| OLLAMA
    BE -->|"HTTPS"| WAPI
```

## Container → port mapping (per docker-compose.yml)

| Container | Image / role | Host port |
|---|---|---|
| `sm_db` | pgvector/pgvector:pg17 | 5432 |
| `sm_pgadmin` | dpage/pgadmin4 | 5050 |
| `sm_ollama` | ollama/ollama (GPU optional) | 11434 |
| `sm_mqtt` | eclipse-mosquitto:2 | 1883, 9001 |
| `sm_backend` | Django + Gunicorn (3 workers) | 8000 |
| `sm_ingestion` | same image, `run_ingestion` entrypoint | — (worker) |
| `sm_frontend` | Next.js 14 | 3000 |

Persistent volumes: `db_data`, `pgadmin_data`, `ollama_data`, `mqtt_data`, `media_data`.
</content>
