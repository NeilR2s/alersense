from dataclasses import dataclass
import os
from dotenv import load_dotenv

is_loaded = load_dotenv()


@dataclass
class Settings:
    # Server Settings
    server_url: str = os.getenv("SERVER_URL", "http://localhost:8000")
    camera_token: str | None = os.getenv("CAMERA_TOKEN")
    model_path: str = "./models/lyka_ncnn_model/"

    # Camera Settings
    camera_index: int = 0
    video_width: int = 640
    video_height: int = 480

    # Network Optimization Settings
    video_quality: int = 75
    fps_cap: int = 1
    stream_scale = 0.85

    # YOLO Inference Settings
    infer_size: int = 640
    device: str = "cpu"
    yolo_verbose_logging: bool = False
    max_det = 10
    conf_threshold = 0.05


settings = Settings()
