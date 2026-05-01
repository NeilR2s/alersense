from __future__ import annotations

from copy import deepcopy
from threading import Lock
from typing import Any


INATTENTIVE_CLASSES = {
    "looking_away",
    "phone_use",
    "sleeping",
    "talking",
}

HR_INATTENTIVE_THRESHOLD = -3.98
GSR_INATTENTIVE_THRESHOLD = -9.49
ZONES = 5
DEFAULT_FRAME_WIDTH = 640


class AttentionState:
    def __init__(self):
        self._telemetry_map: dict[str, dict[str, Any]] = {}
        self._detections: list[dict[str, Any]] = []
        self._lock = Lock()

    def update_telemetry(self, telemetry: dict[str, Any]) -> None:
        device_id = telemetry.get("device_id")
        if not device_id:
            return

        with self._lock:
            self._telemetry_map[str(device_id)] = dict(telemetry)

    def update_detections(self, detections: list[dict[str, Any]]) -> None:
        with self._lock:
            self._detections = list(detections)

    def has_signal(self) -> bool:
        with self._lock:
            return bool(self._telemetry_map or self._detections)

    def get_students(self) -> list[dict[str, Any]]:
        with self._lock:
            telemetry_values = deepcopy(list(self._telemetry_map.values()))
            detections = deepcopy(self._detections)

        zone_width = DEFAULT_FRAME_WIDTH / ZONES
        sorted_devices = sorted(
            telemetry_values,
            key=lambda telemetry: str(telemetry.get("device_id", "")),
        )
        students: list[dict[str, Any]] = []

        for zone_index in range(ZONES):
            telemetry = sorted_devices[zone_index] if zone_index < len(sorted_devices) else None
            device_id = telemetry.get("device_id") if telemetry else f"Student {zone_index + 1}"
            best_detection = self._best_detection_for_zone(detections, zone_index, zone_width)
            wearable_status = self._wearable_status(telemetry)
            camera_status = self._camera_status(best_detection)
            final_status = (
                "Inattentive"
                if wearable_status == "Inattentive" or camera_status == "Inattentive"
                else "Attentive"
            )

            students.append(
                {
                    "device_id": device_id,
                    "hr": telemetry.get("hr") if telemetry else None,
                    "skt": telemetry.get("skt") if telemetry else None,
                    "gsr": telemetry.get("gsr") if telemetry else None,
                    "hr_diff": telemetry.get("hr_diff") if telemetry else None,
                    "gsr_diff": telemetry.get("gsr_diff") if telemetry else None,
                    "wearableStatus": wearable_status,
                    "cameraStatus": camera_status,
                    "finalStatus": final_status,
                }
            )

        return students

    def _best_detection_for_zone(
        self,
        detections: list[dict[str, Any]],
        zone_index: int,
        zone_width: float,
    ) -> dict[str, Any] | None:
        zone_detections = []

        for detection in detections:
            bbox = detection.get("bbox")
            if not isinstance(bbox, list) or len(bbox) < 3:
                continue

            center_x = (bbox[0] + bbox[2]) / 2
            if zone_index * zone_width <= center_x < (zone_index + 1) * zone_width:
                zone_detections.append(detection)

        return max(zone_detections, key=lambda item: item.get("confidence", 0), default=None)

    def _wearable_status(self, telemetry: dict[str, Any] | None) -> str:
        if not telemetry:
            return "No Signal"

        telemetry_status = telemetry.get("status")
        if telemetry_status in {"Calibrating", "Error", "No Signal"}:
            return telemetry_status

        hr_diff = telemetry.get("hr_diff")
        gsr_diff = telemetry.get("gsr_diff")
        if not isinstance(hr_diff, (int, float)) or not isinstance(gsr_diff, (int, float)):
            return "No Signal"

        if hr_diff < HR_INATTENTIVE_THRESHOLD and gsr_diff < GSR_INATTENTIVE_THRESHOLD:
            return "Inattentive"

        return "Attentive"

    def _camera_status(self, detection: dict[str, Any] | None) -> str:
        if not detection:
            return "No Signal"

        return "Inattentive" if detection.get("class_name") in INATTENTIVE_CLASSES else "Attentive"
