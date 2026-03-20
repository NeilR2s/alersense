# AlerSense

AlerSense is an attention monitoring system that tracks physiological data (Heart Rate, Skin Temperature, Galvanic Skin Response) via an ESP32 wearable, processes it through a data hub, and visualizes real-time alerts on a Next.js dashboard.

---

## High-Level System Architecture

The project is divided into four main components:

1.  **Wearable (`/wearable`)**: ESP32 firmware that collects sensor data and transmits it via HTTP.
2.  **Data Hub (`/data-hub`)**: A Python-based processing engine that runs inference on incoming data.
3.  **API (`/api`)**: A Flask-SocketIO server that facilitates real-time communication between the hub and the frontend.
4.  **Frontend (`/frontend`)**: A Next.js web application for real-time data visualization and user management.

---

## Getting Started

### 1. Wearable Setup (ESP32)
The wearable uses an ESP32 to interface with MAX30105 (Heart Rate/SpO2) and MLX90614 (Temperature) sensors.

* **Dependencies**: `Wire.h`, `MAX30105.h`, `heartRate.h`, `WiFi.h`, and `HTTPClient.h`.
* **Configuration**: Update the WiFi credentials and the `serverName` (pointing to your Data Hub IP) in `esp_alersense.ino`.
* **Data Transmission**: Data is sent as a JSON POST request to the `/data` endpoint.

### 2. Data Hub & API (Backend)
Both services are built with Python. It is best to use Python 3.13 to avoid any dependency errors.

* **Setup**:
    ```bash
    # Navigate to the service directory (api or data-hub)
    python3 -m venv venv # make sure that api and data-hub do NOT share the same venv
    source api-env/bin-activate # adjust if you are using powershell, this is for linux
    pip install -r requirements.txt
    python3 main.py
    ```

### 3. Frontend Setup (Next.js)
The dashboard provides a real-time stream of health metrics.

* **Setup**:
    ```bash
    cd frontend
    bun install 
    bun dev
    ```

---

## Development Details

### Data Flow

1.  **Ingestion**: The ESP32 sends a JSON payload containing `hr` (Heart Rate), `spo2`, and `temp`.
2.  **Processing**: The Data Hub processes these metrics to determine if thresholds are exceeded.
3.  **Broadcasting**: The API receives processed updates and emits them via SocketIO events.
4.  **Visualization**: The Frontend listens for these events and updates the UI state without a page refresh.


## Security Footnotes
### Environment Configuration
Ensure you copy the `.env.sample` files in the `api/`, `data-hub/`, and `frontend/` directories to `.env` and fill in the required keys, including your Firebase configuration for authentication and database management.

### Security
This is a bare-bones prototype for demo purposes. Ensure proper authetication methods and production hardening techniques for personal or commercial use.