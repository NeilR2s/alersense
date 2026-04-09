"""
Optimized real-time inference & streaming.
Docs:
  https://docs.ultralytics.com/guides/raspberry-pi/
  https://docs.ultralytics.com/modes/export/

"""

import sys
import time
import logging
import threading
import pathlib

import cv2
import numpy as np
import socketio
from ultralytics import YOLO

from config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


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

_PALETTE = [
    (220, 57, 18),
    (16, 150, 24),
    (51, 105, 232),
    (255, 153, 0),
    (153, 0, 255),
    (0, 153, 198),
    (221, 68, 119),
    (102, 170, 0),
]


class FrameGrabber(threading.Thread):
    """
    Continuously reads the camera in a dedicated thread.
    If reading a video file, it throttles the read speed to simulate a live
    feed and loops the video when it ends.
    """

    def __init__(self, cap: cv2.VideoCapture, is_video_file: bool = False):
        super().__init__(daemon=True, name="frame-grabber")
        self._cap = cap
        self._lock = threading.Lock()
        self._frame: np.ndarray | None = None
        self._ok = False
        self._running = True

        self._is_video_file = is_video_file
        # Get the native FPS of the video, fallback to 30 if unavailable
        self._fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    def run(self):
        frame_delay = 1.0 / self._fps

        while self._running:
            t0 = time.monotonic()
            ok, frame = self._cap.read()

            if not ok and self._is_video_file:
                self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue  # Go back to the top of the loop and read the first frame

            with self._lock:
                self._ok, self._frame = ok, frame

            if not ok:
                time.sleep(0.1)
            elif self._is_video_file:
                elapsed = time.monotonic() - t0
                if elapsed < frame_delay:
                    time.sleep(frame_delay - elapsed)

    def read(self) -> tuple[bool, np.ndarray | None]:
        with self._lock:
            if self._frame is None:
                return False, None
            return self._ok, self._frame.copy()

    def stop(self):
        self._running = False


class EmitWorker(threading.Thread):
    """
    Sends payloads to the server in a background thread.
    Only the latest payload is kept, stale frames are silently dropped
    so network back-pressure never blocks inference.
    """

    def __init__(self, sio_client: socketio.Client):
        super().__init__(daemon=True, name="emit-worker")
        self._sio = sio_client
        self._lock = threading.Lock()
        self._payload: dict | None = None
        self._event = threading.Event()
        self._running = True

    def run(self):
        while self._running:
            self._event.wait(timeout=2.0)
            self._event.clear()
            with self._lock:
                payload = self._payload
                self._payload = None
            if payload is not None and self._sio.connected:
                try:
                    self._sio.emit("video_feed", payload)
                except Exception as e:
                    logger.error(f"Emit error: {e}")

    def submit(self, payload: dict):
        with self._lock:
            self._payload = payload
        self._event.set()

    def stop(self):
        self._running = False
        self._event.set()


def open_camera(source) -> tuple[cv2.VideoCapture, bool]:
    """Open camera or video file."""
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video source: {source}")

    is_video_file = isinstance(source, str)

    if not is_video_file:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, settings.video_width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, settings.video_height)

    return cap, is_video_file


def load_model() -> YOLO:
    """
    Load YOLO weights.
    """
    model = YOLO(str(settings.model_path))
    _warmup(model)
    return model


def _warmup(model: YOLO, rounds: int = 3):
    logger.info("Warming up model …")
    dummy = np.zeros((settings.video_height, settings.video_width, 3), dtype=np.uint8)
    for _ in range(rounds):
        model(dummy, imgsz=settings.infer_size, verbose=False)
    logger.info("Warm-up complete.")


def annotate(frame: np.ndarray, results) -> tuple[np.ndarray, list[dict]]:
    """
    Draw boxes with plain cv2 calls and extract location bounding boxes for zones.
    """
    predictions: list[dict] = []
    if not results or results[0].boxes is None or len(results[0].boxes) == 0:
        return frame, predictions

    for box in results[0].boxes:
        cls_id = int(box.cls[0].item())
        conf = float(box.conf[0].item())
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        name = CLASS_MAP.get(cls_id, "unknown")
        color = _PALETTE[cls_id % len(_PALETTE)]

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

        label = f"{name} {conf:.0%}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
        cv2.putText(
            frame,
            label,
            (x1 + 2, y1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

        predictions.append(
            {"class_name": name, "confidence": round(conf, 3), "bbox": [x1, y1, x2, y2]}
        )

    return frame, predictions


sio = socketio.Client(reconnection=True, reconnection_attempts=0, reconnection_delay=1)


@sio.event
def connect():
    logger.info("Socket.IO connected.")


@sio.event
def disconnect():
    logger.warning("Socket.IO disconnected.")


def main():
    try:
        logger.info("Connecting to Socket.IO server …")
        sio.connect(settings.server_url, auth={"token": settings.camera_token})
    except Exception as e:
        logger.error(f"Initial connection failed: {e}  (will retry in background)")

    try:
        model = load_model()
    except Exception as e:
        logger.critical(f"Model load failed: {e}")
        sys.exit(1)

    try:
        # cap, is_video = open_camera("tests/test_1.mp4")
        cap, is_video = open_camera(settings.camera_index)
    except RuntimeError as e:
        logger.critical(e)
        sys.exit(1)

    # Pass the flag into the grabber
    grabber = FrameGrabber(cap, is_video_file=is_video)
    grabber.start()

    emitter = EmitWorker(sio)
    emitter.start()

    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), settings.video_quality]
    frame_delay = 1.0 / settings.fps_cap

    logger.info("Inference loop running …")

    try:
        while True:
            t0 = time.monotonic()

            ok, frame = grabber.read()
            if not ok or frame is None:
                time.sleep(0.5)
                continue

            try:
                results = model(
                    frame,
                    imgsz=settings.infer_size,
                    conf=settings.conf_threshold,
                    max_det=settings.max_det,
                    verbose=settings.yolo_verbose_logging,
                )
            except Exception as e:
                logger.error(f"Inference error: {e}")
                continue

            annotated, predictions = annotate(frame, results)

            if settings.stream_scale < 1.0:
                transmit = cv2.resize(
                    annotated,
                    None,
                    fx=settings.stream_scale,
                    fy=settings.stream_scale,
                    interpolation=cv2.INTER_AREA,
                )
            else:
                transmit = annotated

            ok, buf = cv2.imencode(".jpg", transmit, encode_params)
            if not ok:
                continue

            emitter.submit({"image": buf.tobytes(), "predictions": predictions})

            remaining = frame_delay - (time.monotonic() - t0)
            if remaining > 0:
                time.sleep(remaining)

    except KeyboardInterrupt:
        logger.info("Shutting down …")
    finally:
        grabber.stop()
        emitter.stop()
        # cap.release()
        if sio.connected:
            sio.disconnect()
        logger.info("Cleanup complete.")
        exit()


if __name__ == "__main__":
    main()
