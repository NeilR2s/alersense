"""
https://docs.ultralytics.com/guides/raspberry-pi/
https://docs.ultralytics.com/models/yolo26/
"""

import sys
import time
import logging
import cv2
import socketio
from ultralytics import YOLO
from config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# --- Class Mapping ---
CLASS_MAP = {
    0: "looking_away",
    1: "looking_forward",
    2: "phone_use",
    3: "raising_hand",
    4: "reading_writing",
    5: "sleeping",
    6: "standing",
    7: "talking",
}

# --- Initialize Socket.IO Client ---
sio = socketio.Client(reconnection=True, reconnection_attempts=0, reconnection_delay=1)


@sio.event
def connect():
    logger.info("Connected to Socket.IO server.")


@sio.event
def disconnect():
    logger.warning("Disconnected from Socket.IO server")


def get_camera(index):
    """
    Initializes camera with optimized buffer settings.
    Limit buffer size to 1 to always get the newest frame
    """
    cap = cv2.VideoCapture(index)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open webcam at index {index}")
    return cap


def main():
    """
    Connect to network -> Load model -> Init camera (cap fps) -> Inference -> Transmit data
    Always compress payload and limit fps to prevent resource exhaustion
    """
    try:
        logger.info("Attempting to connect to Socket.IO server.")
        sio.connect(settings.server_url, auth={"token": settings.camera_token})
    except Exception as e:
        logger.error(
            f"Failed initial Socket.IO connection: {e}. Will retry in background."
        )

    try:
        logger.info(f"Loading YOLO model from {settings.model_path}...")
        model = YOLO(settings.model_path)
    except Exception as e:
        logger.critical(f"Failed to load model: {e}")
        sys.exit(1)

    try:
        cap = get_camera(settings.camera_index)
    except Exception as e:
        logger.critical(e)
        sys.exit(1)

    logger.info("Starting production video feed...")

    frame_delay = 1.0 / settings.fps_cap

    try:
        while True:
            start_time = time.time()
            ret, frame = cap.read()

            if not ret:
                logger.warning(
                    "Failed to grab frame. Camera disconnected? Retrying in 2s..."
                )
                time.sleep(2)
                cap.release()
                try:
                    cap = get_camera(settings.camera_index)
                except Exception:
                    pass
                continue

            try:
                results = model(
                    frame, stream=False, verbose=settings.yolo_verbose_logging
                )
            except Exception as e:
                logger.error(f"Inference error: {e}")
                continue

            predictions_data = []
            annotated_frame = frame

            if results:
                r = results[0]
                annotated_frame = r.plot()

                if r.boxes is not None:
                    for box in r.boxes:
                        cls_id = int(box.cls[0].item())
                        conf = float(box.conf[0].item())
                        predictions_data.append(
                            {
                                "class_name": CLASS_MAP.get(cls_id, "unknown"),
                                "confidence": round(conf, 3),
                            }
                        )

            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), settings.video_quality]
            success, buffer = cv2.imencode(".jpg", annotated_frame, encode_param)
            if not success:
                logger.error("Failed to encode frame to JPEG")
                continue

            payload = {
                "image": buffer.tobytes(),
                "predictions": predictions_data,
            }

            if sio.connected:
                try:
                    sio.emit("video_feed", payload)
                except Exception as e:
                    logger.error(f"Socket emit failed: {e}")

            elapsed_time = time.time() - start_time
            sleep_time = frame_delay - elapsed_time
            if sleep_time > 0:
                time.sleep(sleep_time)

    except KeyboardInterrupt:
        logger.info("Shutdown signal received.")
    finally:
        logger.info("Cleaning up hardware and network resources...")
        cap.release()
        sio.disconnect()
        logger.info("Graceful shutdown complete.")


if __name__ == "__main__":
    main()
