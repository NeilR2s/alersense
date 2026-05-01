import time
import random
import logging
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_telemetry(endpoint_url):
    """
    Testing Alersense Telemetry
    """
    students = [f"S_000{i}" for i in range(1, 6)]
    logger.info("Background HTTP data stream started.")

    while True:
        for _ in range(5):
            data = {
                "device_id": random.choice(students),
                "hr": round(random.uniform(60.0, 110.0), 2),
                "skt": round(random.uniform(34.5, 36.5), 2),
                "gsr": round(random.uniform(1500.0, 1800.0), 2),
                "gsr_diff": round(random.uniform(-25.0, 25.0), 2),
                "hr_diff": round(random.uniform(-10.0, 10.0), 2),
                "status": random.choice(["Attentive", "Inattentive"]),
                "status_yolo": random.choice(["Attentive", "Inattentive"]),
            }
            logger.info(f"Generated: {data['device_id']}")

            # HTTP POST logic
            try:
                # Sends the dictionary as a JSON payload automatically
                response = requests.post(endpoint_url, json=data, timeout=3)
                response.raise_for_status()
            except requests.exceptions.RequestException as e:
                logger.error(f"Failed to send payload: {e}")

        # Sleep for 4 seconds after sending 5 payloads
        time.sleep(4)


if __name__ == "__main__":
    test_telemetry(
        "https://alersense-ghbxgzesfva7cfd0.southeastasia-01.azurewebsites.net/api/telemetry"
    )
    # test_telemetry("http://localhost:8000/api/telemetry")
