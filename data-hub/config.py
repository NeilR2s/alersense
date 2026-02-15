from dataclasses import dataclass
import os
from dotenv import load_dotenv

is_loaded = load_dotenv()


@dataclass
class Settings:
    server_url: str = os.getenv("SERVER_URL", "http://localhost:8000")
    camera_token: str | None = os.getenv("CAMERA_TOKEN")
    model_path: str = "./models/last.pt"
    video_width: int = 640
    video_height: int = 480
    video_quality: int = 35
    fps_cap: int = 3
    device: str = "cpu"
    camera_index: int = 0
    yolo_verbose_logging: bool = True


settings = Settings()

print(settings.camera_token)
