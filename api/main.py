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

        # Example: Check alerts on the server side too
        status = "Normal"
        if data.get("inattentive"):
            status = "ALERT: Student Inattentive"

        return jsonify(
            {"message": "Data received successfully", "server_status": status}
        ), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400


@socketio.on("inference_data")
def handle_inference_data(data):
    emit("video_feed", data, broadcast=True)
    emit("inference_data", data, broadcast=True)


if __name__ == "__main__":
    socketio.run(app, port=8080, debug=False)
