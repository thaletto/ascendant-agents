"""Typed boundaries between MCP tools and SQL persistence."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Protocol


class RecordStore(Protocol):
    """Persistence operations used by the account-scoped MCP tools."""

    def create_record(
        self,
        *,
        account_id: str,
        display_label: str,
        birth_input: dict[str, object],
        attested_at: str,
        artifacts: dict[str, object],
        provenance: dict[str, object],
    ) -> dict[str, object]: ...

    def list_records(self, *, account_id: str) -> list[dict[str, object]]: ...

    def get_context(
        self,
        *,
        account_id: str,
        record_id: str,
        artifact_revision_id: str | None = None,
    ) -> dict[str, object]: ...

    def add_revision(
        self,
        *,
        account_id: str,
        record_id: str,
        artifacts: dict[str, object],
        provenance: dict[str, object],
    ) -> dict[str, object]: ...

    def record_request(
        self,
        *,
        account_id: str,
        record_id: str,
        artifact_revision_id: str,
        topic: str,
        question: str,
        requested_moment: str | None,
    ) -> dict[str, object]: ...

    def history(
        self, *, account_id: str, record_id: str | None
    ) -> list[dict[str, object]]: ...

    def delete_record(self, *, account_id: str, record_id: str) -> bool: ...

    def delete_account_data(self, *, account_id: str) -> int: ...


class SqlRow(Protocol):
    """The mapping behaviour required from a database result row."""

    def __iter__(self) -> Iterator[str]: ...

    def __getitem__(self, key: str) -> object: ...


class SqlCursor(Protocol):
    """The cursor operations shared by SQLite and psycopg."""

    rowcount: int

    def execute(
        self,
        statement: str,
        values: tuple[object, ...] = (),
    ) -> object: ...

    def fetchone(self) -> SqlRow | None: ...

    def fetchall(self) -> list[SqlRow]: ...

    def close(self) -> None: ...


class SqlConnection(Protocol):
    """The synchronous persistence connection used by HostedRecordStore."""

    def cursor(self) -> SqlCursor: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...
