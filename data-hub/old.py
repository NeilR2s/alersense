"""
{0: 'looking_away', 1: 'looking_forward', 2: 'phone_use', 3: 'raising_hand', 4: 'reading_writing', 5: 'sleeping', 6: 'standing', 7: 'talking'}
"""

import cv2
import base64
import socketio
import time
from ultralytics import YOLO
from dataclasses import dataclass


@dataclass
class Settings:
    azure_server_url: str = "http://localhost:8080"
    model_path: str = "./models/last_ncnn_model"
    stream_quality: int = 40
    frame_width: int = 640
    frame_height: int = 480


sio = socketio.Client()

try:
    sio.connect(Settings.azure_server_url)
    print("Connected to Flask server")
except Exception as e:
    print(f"Connection failed: {e}")

model = YOLO(Settings.model_path)

cap = cv2.VideoCapture(0)


while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break

    results = model(frame, verbose=False, device="cpu")

    detections = []
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = box.xywh[0].tolist()
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            label = model.names[cls_id]

            detections.append(
                {"label": label, "confidence": conf, "bbox": [x1, y1, x2, y2]}
            )

    frame = cv2.resize(frame, (Settings.frame_width, Settings.frame_height))
    _, buffer = cv2.imencode(
        ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, Settings.stream_quality]
    )
    base64_frame = base64.b64encode(buffer).decode("utf-8")

    payload = {
        "image": f"data:image/jpeg;base64,{base64_frame}",
        "detections": detections,
        "timestamp": time.time(),
    }

    if sio.connected:
        sio.emit("inference_data", payload)


cap.release()
sio.disconnect()
