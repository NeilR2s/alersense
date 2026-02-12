"""
{0: 'looking_away', 1: 'looking_forward', 2: 'phone_use', 3: 'raising_hand', 4: 'reading_writing', 5: 'sleeping', 6: 'standing', 7: 'talking'}
"""

import cv2
import socketio
import time
import threading
from ultralytics import YOLO
from settings import config


class CameraStream:
    """
    Reads frames from the camera in a separate thread.
    """

    def __init__(self):
        self.stream = cv2.VideoCapture(config.camera_index)
        self.stream.set(cv2.CAP_PROP_FRAME_WIDTH, config.video_width)
        self.stream.set(cv2.CAP_PROP_FRAME_HEIGHT, config.video_height)

        (self.grabbed, self.frame) = self.stream.read()
        self.stopped = False
        self.lock = threading.Lock()

    def start(self):
        threading.Thread(target=self._update, args=(), daemon=True).start()
        return self

    def _update(self):
        while not self.stopped:
            grabbed, frame = self.stream.read()
            with self.lock:
                self.grabbed = grabbed
                self.frame = frame

    def read(self):
        with self.lock:
            return self.frame.copy() if self.grabbed else None

    def stop(self):
        self.stopped = True
        self.stream.release()


class VideoWorker(threading.Thread):
    def __init__(self, camera: CameraStream, sio: socketio.Client):
        super().__init__(daemon=True)
        self.camera = camera
        self.sio = sio
        self.stopped = False
        self.sleep_time = 1.0 / config.video_fps

    def run(self):
        while not self.stopped:
            start_time = time.time()

            frame = self.camera.read()

            # >>> FIX: Check if frame is valid before processing <<<
            if frame is None:
                time.sleep(0.01)  # Wait a bit for camera
                continue

            # Now it's safe to resize
            frame = cv2.resize(frame, (config.video_width, config.video_height))
            _, buffer = cv2.imencode(
                ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, config.video_quality]
            )

            if self.sio.connected:
                self.sio.emit("video_feed", buffer.tobytes())

            elapsed = time.time() - start_time
            time.sleep(max(0, self.sleep_time - elapsed))

    def stop(self):
        self.stopped = True


# --- 2. Fix the Inference Worker ---
class InferenceWorker(threading.Thread):
    def __init__(self, camera: CameraStream, sio: socketio.Client, model):
        super().__init__(daemon=True)
        self.camera = camera
        self.sio = sio
        self.model = model
        self.stopped = False
        self.sleep_time = 1.0 / config.inference_fps

    def run(self):
        while not self.stopped:
            start_time = time.time()

            frame = self.camera.read()

            # >>> FIX: Check if frame is valid before processing <<<
            if frame is None:
                time.sleep(0.01)
                continue

            # Run Inference
            results = self.model(frame, verbose=False)

            detections = []
            for result in results:
                for box in result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    detections.append(
                        {
                            "label": self.model.names[int(box.cls[0])],
                            "confidence": round(float(box.conf[0]), 2),
                            "bbox": [int(x1), int(y1), int(x2), int(y2)],
                        }
                    )

            if self.sio.connected:
                self.sio.emit(
                    "inference_data", {"detections": detections, "timestamp": time.time()}
                )

            elapsed = time.time() - start_time
            time.sleep(max(0, self.sleep_time - elapsed))

    def stop(self):
        self.stopped = True


class StreamOrchestrator:
    def __init__(self):
        self.sio = socketio.Client()
        self.camera = None
        self.video_worker = None
        self.inference_worker = None

    def start(self):
        # 1. Connect to Server
        try:
            self.sio.connect(config.server_url)
            print("Connected to socket server.")
        except Exception as e:
            print(f"Server connection failed: {e}")
            return

        # 2. Load Model
        print("Loading Model...")
        model = YOLO(config.model_path)

        # 3. Start Camera
        print("Starting Camera...")
        self.camera = CameraStream().start()
        print("Waiting for camera warmup...", end="", flush=True)
        while self.camera.read() is None:
            time.sleep(0.1)
            print(".", end="", flush=True)
        print("\nCamera ready!")

        # 4. Start Workers
        self.video_worker = VideoWorker(self.camera, self.sio)
        self.inference_worker = InferenceWorker(self.camera, self.sio, model)

        self.video_worker.start()
        self.inference_worker.start()

        print(
            f"Streaming started.\n Video: {config.video_fps} FPS\n Inference: {config.inference_fps} FPS"
        )

        # Keep main thread alive
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        print("Stopping services...")
        if self.video_worker:
            self.video_worker.stop()
        if self.inference_worker:
            self.inference_worker.stop()
        if self.camera:
            self.camera.stop()
        if self.sio.connected:
            self.sio.disconnect()
        print("Done.")


# --- Run ---
if __name__ == "__main__":
    app = StreamOrchestrator()
    app.start()
