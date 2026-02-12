from ultralytics import YOLO

MODEL_NAME = "last.pt"
model = YOLO(MODEL_NAME)
results = model.export(
    format="onnx",
    imgsz=640,
    half=True,
)
