# AlerSense

AlerSense monitors student attention with two signals. A wrist wearable reports heart rate and skin conductance. A camera hub reports vision behavior classes. An API hub fuses both signals. A Next.js dashboard shows the result live.

## System Architecture

| Tier | Directory | Entry | Tech |
|---|---|---|---|
| Wearable | `wearable/esp_alersense/` | `esp_alersense.ino` | ESP32 Arduino, MAX30105, GSR, buzzer |
| API hub | `api/` | `main.py` | Flask-SocketIO plus eventlet, port 8000 |
| Vision hub | `data-hub/` | `main.py` | Python, YOLO NCNN, OpenCV |
| Frontend | `frontend/` | `app/page.tsx` | Next.js 16, React 19, Tailwind v4 |

Data flow uses two independent paths. The wearable posts to the API. The vision hub streams to the API. The API fuses the data in memory. The frontend renders the fused state.

1. Wearable sends `POST /api/telemetry` every 5 seconds.
2. API broadcasts the payload as `telemetry_update`.
3. Vision hub emits `video_feed` with image plus predictions.
4. API forwards image as `video_feed` to viewers.
5. API forwards predictions as `detection_update` to viewers.
6. API and frontend map devices and detections to 5 zones.
7. Frontend shows wearable status, camera status, and final status.

## Repository Layout

- `wearable/esp_alersense/` — active firmware template, device `S-000X`.
- `wearable/esp_alersense_passive/` — same logic, preset SSID `STARLINK` and device `S-0005`.
- `wearable/esp_test_hr/` — heart rate test sketch, no network.
- `wearable/esp_test_skt/` — MAX30205 temperature test sketch, no network.
- `api/` — central hub with fusion logic and snapshot storage.
- `data-hub/` — vision inference engine with test videos.
- `frontend/` — dashboard with 5 routes.
- `DOCS.md` — latency analysis for the wearable firmware.
- `AGENTS.md` — agent toolchain notes and production traps.

## Wearable

The wearable runs on ESP32 with Arduino C++. It reads heart rate from MAX30105 over I2C. It reads skin conductance from an analog divider on GPIO0. It drives an active-low buzzer on GPIO2. I2C uses SDA on GPIO9 and SCL on GPIO10.

Skin temperature is stubbed in the main firmware. The code sends a fixed raw value of 72. This converts to about 35.1 C. A real MAX30205 driver exists only in `esp_test_skt`.

### Telemetry Payload

The firmware posts JSON to `/api/telemetry` with header `Content-Type: application/json`. It sends one message every 5 seconds from a FreeRTOS task on Core 0. Sensing runs on Core 1. A queue of length 10 links the cores.

Fields:

- `device_id` such as `S-0005`
- `hr` in beats per minute
- `skt` in degrees Celsius, stubbed
- `gsr` in microsiemens, temperature compensated
- `gsr_diff` as percent change from baseline
- `hr_diff` as percent change from baseline
- `status` as one of `Calibrating`, `Attentive`, `Inattentive`, `Warning`, `Error`, `Failed`

Status `Inattentive` requires both drops at once. Heart rate must drop more than 3.98 percent. Skin conductance must drop more than 9.49 percent. Other valid readings report `Attentive`.

### Calibration

The device calibrates once at startup. It waits for a finger with IR above 50000. It waits for a valid heart rate above 0. It then averages for 30 seconds. It streams `Calibrating` during this period. A failed baseline streams `Failed`.

### Firmware Setup

Required libraries:

- `Wire` from the ESP32 core
- `SparkFun MAX3010x` for `MAX30105.h` and `heartRate.h`
- `WiFi`, `HTTPClient`, `WiFiClientSecure` from the ESP32 core

Steps:

1. Open `wearable/esp_alersense/esp_alersense.ino` in Arduino IDE.
2. Set `ssid` and `password` for a 2.4 GHz network.
3. Set a unique `deviceID` such as `S-0001`.
4. Set `serverName` to your API URL plus `/api/telemetry`.
5. Select an ESP32 board with GPIO0, GPIO9, GPIO10, and GPIO2 free.
6. Flash the firmware.
7. Open the serial monitor at 9600 baud.

Local testing requires plain HTTP. Point `serverName` at `http://<host>:8000/api/telemetry`. Replace `WiFiClientSecure` with `WiFiClient` for plain HTTP.

## API Hub

The API is the central hub. It accepts wearable posts over REST. It accepts vision frames over SocketIO. It emits updates to viewers over SocketIO. It stores snapshots in Azure Cosmos DB every 7 minutes when signal exists.

### REST Routes

| Method | Route | Use | Notes |
|---|---|---|---|
| `GET` | `/health` | Health check | Returns `{"status": "healthy"}` |
| `POST` | `/api/telemetry` | Wearable ingest | Requires JSON, broadcasts `telemetry_update` |
| `GET` | `/api/snapshots?date=YYYY-MM-DD` | Snapshot history | Requires viewer auth, needs Cosmos config |

There is no `/data` route. Use `/api/telemetry` for all wearable posts.

### SocketIO Events

The server requires a token on connect. A camera token marks a vision device. A viewer token joins `viewer_room`. An unknown token is rejected.

Listened events:

- `connect` with `auth.token`
- `disconnect`
- `video_feed` with `{image, predictions}` from the vision hub

Emitted events:

- `telemetry_update` with the raw wearable payload, broadcast to all clients
- `video_feed` with `{image}` to `viewer_room` only
- `detection_update` with `{predictions}` to `viewer_room` only

### Fusion Logic

`api/attention.py` holds the fusion state. It keeps one telemetry record per `device_id`. It keeps the latest detection list. It builds 5 fixed zones across a 640 pixel frame. It sorts devices by `device_id` and maps each device to one zone. Empty zones use placeholder names such as `Student 3`.

For each zone it picks the detection with the highest confidence whose box center falls in the zone. Wearable status is `Inattentive` when `hr_diff` is below -3.98 and `gsr_diff` is below -9.49. Camera status is `Inattentive` for class `looking_away`, `phone_use`, `sleeping`, or `talking`. Final status is `Inattentive` when either source reports `Inattentive`.

### API Setup

Requirements:

- Python 3.13
- A dedicated venv at `api/api-env`, not shared with `data-hub`

Steps:

1. Open a terminal in `api/`.
2. Create a venv with `python3 -m venv api-env`.
3. Activate it with `source api-env/bin/activate`.
4. Copy `.env.sample` to `.env`.
5. Fill in the tokens and Cosmos values.
6. Install packages with `pip install -r requirements.txt`.
7. Start the server with `python3 main.py`.
8. Confirm `GET http://localhost:8000/health` returns healthy.

Dependencies in `requirements.txt`:

- `eventlet`, `gunicorn`, `flask`, `flask-cors`, `flask-socketio`
- `python-dotenv`, `azure-cosmos`

Environment variables in `api/.env.sample`:

- `CAMERA_TOKEN` for vision hub auth
- `VIEWER_TOKEN` for viewer auth and snapshot access
- `ALLOWED_ORIGINS` as a comma list, default `https://alersense.vercel.app`
- `COSMOS_URI` and `COSMOS_PRIMARY_KEY`, empty means snapshots are disabled
- `COSMOS_DATABASE` default `alersense`
- `COSMOS_CONTAINER` default `attention_snapshots`

When `VIEWER_TOKEN` is empty, snapshot access is open. When Cosmos values are empty, the server runs without storage. Telemetry and live events still work.

## Vision Hub

The vision hub runs YOLO detection on video frames. It annotates each frame with boxes. It sends the JPEG frame plus predictions to the API over SocketIO. It does not process wearable data.

Model details:

- Active model is `./models/lyka_ncnn_model/`, NCNN format.
- `models/` also holds `best.pt`, `last.pt`, and `neil_ncnn_model/` as unused artifacts.
- Input size is 640 pixels, confidence threshold is 0.05, limit is 10 detections.
- Output frame is 640 by 480, scaled by 0.85 for transit, JPEG quality 75.
- Send rate is capped at 1 frame per second with latest-only coalescing.

Detected classes:

- `looking_away`, `looking_forward`, `phone_use`, `raising_hand`
- `reading_writing`, `sleeping`, `standing`, `talking`

Emitted message:

- Event `video_feed` with `{image, predictions}`
- `image` is JPEG bytes of the annotated frame
- `predictions` is a list of `{class_name, confidence, bbox}` where `bbox` is `[x1, y1, x2, y2]`

### Vision Hub Setup

Requirements:

- Python 3.13
- A dedicated venv at `data-hub/rpi-env`, not shared with `api`
- On Raspberry Pi use 64-bit OS and install `libgl1-mesa-glx` and `libglib2.0-0`

Steps:

1. Open a terminal in `data-hub/`.
2. Create a venv with `python3 -m venv rpi-env`.
3. Activate it with `source rpi-env/bin/activate`.
4. Copy `.env.sample` to `.env`.
5. Set `SERVER_URL` to your API address.
6. Set `CAMERA_TOKEN` to match the API value.
7. Install packages with `pip install -r requirements.txt`.
8. Start the hub with `python main.py`.

Dependencies in `requirements.txt`:

- `ultralytics`, `opencv-python`, `python-socketio[asyncio_client]`
- `onnx`, `onnxruntime`, `ncnn`, `Flask`, `python-dotenv`

Environment variables in `data-hub/.env.sample`:

- `SERVER_URL` default `http://localhost:8000`
- `CAMERA_TOKEN` default empty

Video source is hardcoded in `data-hub/main.py:237` to `tests/test_1.mp4`. Line 238 holds the live camera option with `settings.camera_index`, default 0. Uncomment line 238 and comment line 237 to use a live camera. Test clips `test_1.mp4` and `test_2.mp4` live in `data-hub/tests/`.

## Frontend

The frontend is a Next.js 16 plus React 19 app with Tailwind v4 and Radix UI. It shows live telemetry, vision stream, zone status, and snapshot history. It uses Google login through Firebase project `alersense-e5a43`.

Routes:

- `/` is the public landing page with sign-in.
- `/dashboard` shows telemetry tables and live status.
- `/home` shows the teacher dashboard with the same data shape.
- `/stream` shows the live `video_feed` image plus 5 zone cards and the behavior legend.
- `/snapshots` loads `GET /api/snapshots?date=YYYY-MM-DD` with the viewer token header.

Realtime behavior:

- One global socket connects with `NEXT_PUBLIC_SERVER_URL` and `NEXT_PUBLIC_VIEWER_TOKEN`.
- `telemetry_update` updates the per-device telemetry map.
- `detection_update` updates the detection list.
- The `/stream` page listens for `video_feed` and renders the image as a Blob URL.
- Zone logic mirrors the API with 5 zones, the same -3.98 and -9.49 thresholds, and the same 4 inattentive classes.

### Frontend Setup

Requirements:

- `bun`, use `bun.lock` and ignore `package-lock.json`

Steps:

1. Open a terminal in `frontend/`.
2. Copy the sample env values to `.env` if needed.
3. Set `NEXT_PUBLIC_SERVER_URL` to your API address.
4. Set `NEXT_PUBLIC_VIEWER_TOKEN` to match the API value.
5. Install packages with `bun install`.
6. Start the app with `bun dev`.
7. Open `http://localhost:3000`.

Scripts in `package.json`:

- `bun dev` starts the dev server
- `bun run build` builds for production
- `bun run start` serves the production build
- `bun run lint` runs ESLint

## Test Without Hardware

Use the mock sender to test the API and frontend without ESP32 boards.

1. Open `api/test_datahub.py`.
2. Change the target URL to `http://localhost:8000/api/telemetry` for local tests.
3. Run the script with `python test_datahub.py`.
4. Confirm new rows appear on `/dashboard`.

The script sends 5 random student payloads every 4 seconds. Device IDs range from `S_0001` to `S_0005`. Fields include `hr`, `skt`, `gsr`, `gsr_diff`, `hr_diff`, `status`, and `status_yolo`.

Use the bundled clips to test vision without a camera. Run the vision hub with the default `tests/test_1.mp4` source. Confirm frames appear on `/stream`.

## Production Traps

These defaults point at production or test fixtures. Change them for local work.

- `api/test_datahub.py:45` defaults to the Azure production URL. Switch it to `localhost:8000` for local tests.
- `data-hub/main.py:237` loops `tests/test_1.mp4`. Uncomment line 238 to use the live camera index.
- `wearable/esp_alersense/esp_alersense.ino:25` hardcodes the Azure production URL. Point it at your local API for bench tests.
- `frontend/.env` holds both a legacy `SERVER_URL` and the active `NEXT_PUBLIC_SERVER_URL`. The client code uses only the `NEXT_PUBLIC_` values.

## Deployment

The API runs on Azure Web Apps with Oryx build. The frontend runs on Vercel. Set the same `CAMERA_TOKEN` and `VIEWER_TOKEN` in both services. Set `ALLOWED_ORIGINS` on the API to include the Vercel URL plus `http://localhost:3000` for local work.

## Security Note

This repo is a prototype for demo use. It ships with empty sample secrets and stubbed temperature. Viewer auth is open when `VIEWER_TOKEN` is empty. Device traffic uses `setInsecure` TLS on the ESP32. Add proper auth, secret storage, cert validation, and hardening before personal or commercial use.

## Further Docs

- `DOCS.md` covers wearable latency in depth with measurement methods.
- `data-hub/README.md` covers Raspberry Pi bring-up and OpenBLAS fixes.
- `AGENTS.md` covers toolchain rules and operational truths.
