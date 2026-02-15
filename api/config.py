import os
from dataclasses import dataclass, field
from typing import Literal

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    allowed_origins: str = "https://alersense.vercel.app"
    camera_token: str | None = os.getenv("CAMERA_TOKEN")
    viewer_token: str | None = os.getenv("VIEWER_TOKEN")
    max_http_buffer_size: int = 1 * 1024 * 1024
    camera_room: str = "camera_room"
    viewer_room: str = "viewer_room"
    event_connect: str = "connect"
    event_disconnect: str = "disconnect"


settings = Settings()
