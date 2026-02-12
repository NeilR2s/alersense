from dataclasses import dataclass


@dataclass
class Settings:
    server_url: str = "http://localhost:8080"
    model_path: str = "./models/last_ncnn_model"
    video_width: int = 640
    video_height: int = 480
    video_quality: int = 40
    video_fps: int = 30
    inference_fps: int = 30
    device: str = "cpu"
    camera_index: int = 0


config = Settings()
