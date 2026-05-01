from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosHttpResponseError

from config import settings


logger = logging.getLogger(__name__)


class SnapshotStore:
    def __init__(self):
        self._container = None

    @property
    def enabled(self) -> bool:
        return bool(settings.cosmos_uri and settings.cosmos_primary_key)

    def _get_container(self):
        if self._container is not None:
            return self._container

        if not self.enabled:
            raise RuntimeError("Cosmos DB settings are not configured")

        client = CosmosClient(settings.cosmos_uri, credential=settings.cosmos_primary_key)
        database = client.get_database_client(settings.cosmos_database)
        self._container = database.get_container_client(settings.cosmos_container)
        return self._container

    def save_snapshot(self, students: list[dict[str, Any]]) -> dict[str, Any] | None:
        if not self.enabled:
            logger.info("Skipping attention snapshot: Cosmos DB settings are not configured")
            return None

        captured_at = datetime.now(UTC).replace(microsecond=0)
        snapshot = {
            "id": captured_at.isoformat().replace("+00:00", "Z"),
            "snapshotDate": captured_at.date().isoformat(),
            "capturedAt": captured_at.isoformat().replace("+00:00", "Z"),
            "intervalMinutes": 6,
            "students": students,
        }

        try:
            self._get_container().upsert_item(snapshot)
            logger.info("Saved attention snapshot %s", snapshot["id"])
            return snapshot
        except CosmosHttpResponseError:
            logger.exception("Failed to save attention snapshot")
            return None

    def list_snapshots(self, snapshot_date: str) -> list[dict[str, Any]]:
        if not self.enabled:
            raise RuntimeError("Cosmos DB settings are not configured")

        query = "SELECT * FROM c WHERE c.snapshotDate = @snapshotDate ORDER BY c.capturedAt DESC"
        items = self._get_container().query_items(
            query=query,
            parameters=[{"name": "@snapshotDate", "value": snapshot_date}],
            partition_key=snapshot_date,
        )
        return list(items)


snapshot_store = SnapshotStore()
