import logging
import eventlet

from config import settings
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, disconnect, emit, join_room
from werkzeug.exceptions import UnsupportedMediaType


eventlet.monkey_patch()
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s | %(levelname)s : %(message)s",
)


logger = logging.getLogger(__name__)


app = Flask(__name__)
socketio = SocketIO(
    app,
    cors_allowed_origins=[
        # "http://localhost:8000",
        # "http://localhost:3000",
        settings.allowed_origins
    ],
    max_http_buffer_size=settings.max_http_buffer_size,
)


@app.route("/health")
def health_check():
    return jsonify({"status": "healthy"}), 200


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

        logger.info("Recieved telemetry data")
        socketio.emit("telemetry_update", data)
        return jsonify({"message": "Data received successfully", "payload": data}), 200

    except UnsupportedMediaType as e:
        logger.warning(f"Unsupported Media Type: {e}")
        return jsonify({"error": "Request Content-Type must be application/json"}), 415
    except Exception as e:
        logger.error(f"Unexpected error in /api/telemetry: {e}")
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
        emit("detection_update", {"predictions": predictions}, to=settings.viewer_room)


if __name__ == "__main__":
    logger.info("Application Starup Complete.")
    socketio.run(app, port=8000, debug=False)
