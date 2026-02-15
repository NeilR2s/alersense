from ultralytics import YOLO

MODEL_NAME = "data-hub/models/last.pt"
model = YOLO(MODEL_NAME)
results = model.export(
    format="ncnn",
    imgsz=512,
    # half=True,
)
