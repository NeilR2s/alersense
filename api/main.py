import eventlet

eventlet.monkey_patch()

import logging
from datetime import UTC, datetime

from attention import AttentionState
from config import settings
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, disconnect, emit, join_room
from persistence import snapshot_store
from werkzeug.exceptions import UnsupportedMediaType

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s | %(levelname)s : %(message)s",
)


logger = logging.getLogger(__name__)


app = Flask(__name__)
allowed_origins = [origin.strip() for origin in settings.allowed_origins.split(",")]
CORS(app, origins=allowed_origins)
socketio = SocketIO(
    app,
    cors_allowed_origins=allowed_origins,
    max_http_buffer_size=settings.max_http_buffer_size,
)
attention_state = AttentionState()
snapshot_task = None


@app.route("/health")
def health_check():
    return jsonify({"status": "healthy"}), 200


def _viewer_authorized() -> bool:
    if not settings.viewer_token:
        return True

    auth_header = request.headers.get("Authorization", "")
    bearer_token = auth_header.removeprefix("Bearer ").strip()
    header_token = request.headers.get("X-Viewer-Token", "")
    return settings.viewer_token in {bearer_token, header_token}


@app.route("/api/telemetry", methods=["POST"])
def receive_telemetry():
    try:
        if not request.is_json:
            raise UnsupportedMediaType("Request must be application/json")
        logger.info(f"Request: {request} type: {type(request)}")
        data = request.get_json(silent=True)
        logger.info(f"data: {data} type: {type(data)}")

        if data is None:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        attention_state.update_telemetry(data)
        logger.info("Recieved telemetry data")
        socketio.emit("telemetry_update", data)
        return jsonify({"message": "Data received successfully", "payload": data}), 200

    except UnsupportedMediaType as e:
        logger.warning(f"Unsupported Media Type: {e}")
        return jsonify({"error": "Request Content-Type must be application/json"}), 415
    except Exception as e:
        logger.error(f"Unexpected error in /api/telemetry: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/snapshots", methods=["GET"])
def list_snapshots():
    if not _viewer_authorized():
        return jsonify({"error": "Unauthorized"}), 401

    snapshot_date = request.args.get("date") or datetime.now(UTC).date().isoformat()
    try:
        datetime.strptime(snapshot_date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "date must use YYYY-MM-DD format"}), 400

    try:
        snapshots = snapshot_store.list_snapshots(snapshot_date)
        return jsonify({"date": snapshot_date, "snapshots": snapshots}), 200
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        logger.error(f"Unexpected error in /api/snapshots: {e}")
        return jsonify({"error": "Internal server error"}), 500


@socketio.on(settings.event_connect)
def handle_connect(auth):
    if not auth or "token" not in auth:
        logger.warning("Connection rejected: No auth token provided")
        raise ConnectionRefusedError("Authentication required")

    if auth.get("token") == settings.camera_token:
        logger.info("Camera device connected")
    elif auth.get("token") == settings.viewer_token:
        logger.info("Viewer client connected")
        join_room(settings.viewer_room)
    else:
        logger.warning("Connection rejected: Invalid token")
        return False


@socketio.on(settings.event_disconnect)
def handle_disconnect():
    # disconnect(request.sid)
    logger.info("Client disconnected.")


@socketio.on("video_feed")
def handle_video_feed(payload):
    if not isinstance(payload, dict):
        logger.warning("Invalid video feed payload")
        return

    # Emit video frames to viewers (page-specific display)
    image = payload.get("image")
    if image is not None:
        emit("video_feed", {"image": image}, to=settings.viewer_room)

    # Emit detections (context-level state management)
    predictions = payload.get("predictions")
    if predictions is not None:
        attention_state.update_detections(predictions)
        emit("detection_update", {"predictions": predictions}, to=settings.viewer_room)


def save_attention_snapshots():
    while True:
        socketio.sleep(7 * 60)
        if attention_state.has_signal():
            snapshot_store.save_snapshot(attention_state.get_students())


def start_snapshot_task():
    global snapshot_task
    if snapshot_task is None:
        snapshot_task = socketio.start_background_task(save_attention_snapshots)


start_snapshot_task()


if __name__ == "__main__":
    logger.info("Application Starup Complete.")
    socketio.run(app, port=8000, debug=False)
