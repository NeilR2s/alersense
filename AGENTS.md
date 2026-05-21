# AlerSense - Agent Instructions

This repository is a monorepo containing a multi-tier IoT application for monitoring student attention.

## Architecture & Entrypoints
- `/frontend`: Next.js 16 (React 19) + Tailwind v4 + Radix UI. Entry: `app/page.tsx`.
- `/api`: Flask-SocketIO central hub. Entry: `main.py`.
- `/data-hub`: Python inference engine (YOLO/OpenCV). Entry: `main.py`.
- `/wearable`: ESP32 Arduino/C++ firmware. Entry: `esp_alersense.ino`.

## Mandatory Toolchain
- **Frontend**: You MUST use **`bun`** (`bun install`, `bun dev`). A `package-lock.json` exists but should be ignored in favor of `bun.lock`.
- **Python**: Use Python 3.13. Create isolated venvs for each service (`api/api-env`, `data-hub/rpi-env`) to avoid dependency conflicts.
- **Environment**: Copy `.env.sample` to `.env` in `api/`, `data-hub/`, and `frontend/`.

## Operational Truths (Trust Code over Docs)
- **Telemetry Endpoint**: Post to `/api/telemetry`. Ignore the `/data` endpoint mentioned in the root `README.md`.
- **Hardcoded Production Traps**:
  - `api/test_datahub.py`: Defaults to production Azure URL on line 45. Switch to `localhost:8000` for local testing.
  - `data-hub/main.py`: Hardcoded to loop `tests/test_1.mp4` on line 237. For live camera, uncomment line 238 (`settings.camera_index`).
  - `wearable/.../*.ino`: `serverName` is hardcoded to production Azure URL.
- **Socket Events**: Primary channels are `video_feed` (base64 image + detection JSON) and `telemetry_update`.

## Testing & Workflow
- **Mocking Data**: Use `python api/test_datahub.py` to simulate wearable telemetry without hardware.
- **Inference Verification**: `data-hub/tests/` contains `.mp4` samples for verifying detection logic without a live camera feed.
- **Deployment**: API runs on Azure Web Apps (Oryx build); Frontend runs on Vercel.
