from flask import Flask, request, jsonify
import logging
from flask_socketio import SocketIO, emit


logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s | %(levelname)s : %(message)s",
)


logger = logging.getLogger(__name__)

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")


@app.route("/api/telemetry", methods=["POST"])
def receive_telemetry():
    try:
        data = request.get_json()

        logger.info(f"Received Data: {data}")

        status = "Attentive"
        if data.get("inattentive"):
            status = "Inattentive"

        return jsonify(
            {"message": "Data received successfully", "server_status": status}
        ), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400


@socketio.on("inference_data")
def handle_inference_data(data):
    emit("inference_data", data, broadcast=True)

@socketio.on("video_feed")
def handle_frame_buffer(buffer):
    emit("video_feed", buffer, broadcast=True)

if __name__ == "__main__":
    socketio.run(app, port=8080, debug=False)
    logger.info("Application Starup Complete.")
