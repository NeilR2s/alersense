from flask import Flask, request, jsonify
import logging


logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s | %(levelname)s : %(message)s",
)

logger = logging.getLogger(__name__)

app = Flask(__name__)


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


# if __name__ == "__main__":
#     app.run(debug=True)
