"""SQL persistence for hosted Ascendant person records and evidence."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from dataclasses import dataclass
from functools import wraps
from threading import RLock
from typing import Concatenate, ParamSpec, TypeVar, cast
from uuid import uuid4

from ascendant_mcp.codec import (
    from_json,
    integer_field,
    now,
    row_to_dict,
    string_field,
    to_json,
)
from ascendant_mcp.contracts import SqlConnection, SqlCursor
from ascendant_mcp.errors import HostedRecordError

StoreT = TypeVar("StoreT", bound="HostedRecordStore")
ParametersT = ParamSpec("ParametersT")
ResultT = TypeVar("ResultT")


def _sqlite_dict_row(
    cursor: sqlite3.Cursor,
    values: tuple[object, ...],
) -> dict[str, object]:
    """Normalize SQLite rows to the mapping shape returned by psycopg."""

    description = cursor.description
    if description is None:
        return {}
    return {
        column[0]: values[index]
        for index, column in enumerate(description)
    }


@dataclass(frozen=True)
class _SqlDialect:
    placeholder: str

    def placeholders(self, count: int) -> str:
        return ", ".join([self.placeholder] * count)


def _sql(*parts: str) -> str:
    """Join readable SQL fragments without implicit string concatenation."""

    return "".join(parts)


def _serialized(
    operation: Callable[Concatenate[StoreT, ParametersT], ResultT],
) -> Callable[Concatenate[StoreT, ParametersT], ResultT]:
    """Serialize use of the synchronous per-instance database connection."""

    @wraps(operation)
    def wrapped(
        store: StoreT,
        /,
        *args: ParametersT.args,
        **kwargs: ParametersT.kwargs,
    ) -> ResultT:
        with store.lock:
            return operation(store, *args, **kwargs)

    return wrapped


class HostedRecordStore:
    """SQL persistence shared by test SQLite and production Neon Postgres."""

    _dialect: _SqlDialect
    _connection: SqlConnection
    lock: RLock

    def __init__(self, connection: SqlConnection, *, placeholder: str) -> None:
        super().__init__()
        self._connection = connection
        self.lock = RLock()
        self._dialect = _SqlDialect(placeholder=placeholder)
        self._initialize_schema()

    @classmethod
    def in_memory(cls) -> HostedRecordStore:
        """Create an isolated SQL store for the public MCP integration seam."""

        # FastMCP invokes synchronous tools in a worker thread. The test store
        # is deliberately configured for that transport boundary.
        connection = sqlite3.connect(":memory:", check_same_thread=False)
        connection.row_factory = _sqlite_dict_row
        _ = connection.execute("PRAGMA foreign_keys = ON")
        return cls(
            cast(SqlConnection, cast(object, connection)),
            placeholder="?",
        )

    def _initialize_schema(self) -> None:
        statements = (
            """
            CREATE TABLE IF NOT EXISTS hosted_person_records (
                record_id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                display_label TEXT NOT NULL,
                birth_input TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS consent_attestations (
                record_id TEXT PRIMARY KEY
                    REFERENCES hosted_person_records(record_id)
                    ON DELETE CASCADE,
                account_id TEXT NOT NULL,
                attested_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS artifact_revisions (
                artifact_revision_id TEXT PRIMARY KEY,
                record_id TEXT NOT NULL
                    REFERENCES hosted_person_records(record_id)
                    ON DELETE CASCADE,
                rule_pack TEXT NOT NULL,
                schema_version INTEGER NOT NULL,
                provenance TEXT NOT NULL,
                artifacts TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS reading_requests (
                reading_request_id TEXT PRIMARY KEY,
                record_id TEXT NOT NULL
                    REFERENCES hosted_person_records(record_id)
                    ON DELETE CASCADE,
                artifact_revision_id TEXT NOT NULL
                    REFERENCES artifact_revisions(artifact_revision_id)
                    ON DELETE CASCADE,
                account_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                question TEXT NOT NULL,
                requested_moment TEXT,
                created_at TEXT NOT NULL
            )
            """,
        )
        cursor = self._connection.cursor()
        try:
            for statement in statements:
                _ = cursor.execute(statement)
            self._connection.commit()
        finally:
            cursor.close()

    def _execute(
        self, statement: str, values: tuple[object, ...] = ()
    ) -> SqlCursor:
        cursor = self._connection.cursor()
        _ = cursor.execute(statement, values)
        return cursor

    @_serialized
    def create_record(
        self,
        *,
        account_id: str,
        display_label: str,
        birth_input: dict[str, object],
        attested_at: str,
        artifacts: dict[str, object],
        provenance: dict[str, object],
    ) -> dict[str, object]:
        record_id = str(uuid4())
        revision_id = str(uuid4())
        created_at = now()
        try:
            cursor = self._execute(
                _sql(
                    "INSERT INTO hosted_person_records ",
                    "(record_id, account_id, display_label, birth_input, ",
                    "created_at) ",
                    f"VALUES ({self._dialect.placeholders(5)})",
                ),
                (
                    record_id,
                    account_id,
                    display_label,
                    to_json(birth_input),
                    created_at,
                ),
            )
            cursor.close()
            cursor = self._execute(
                _sql(
                    "INSERT INTO consent_attestations ",
                    "(record_id, account_id, attested_at) ",
                    f"VALUES ({self._dialect.placeholders(3)})",
                ),
                (record_id, account_id, attested_at),
            )
            cursor.close()
            cursor = self._execute(
                _sql(
                    "INSERT INTO artifact_revisions ",
                    "(artifact_revision_id, record_id, rule_pack, ",
                    "schema_version, provenance, artifacts, created_at) ",
                    f"VALUES ({self._dialect.placeholders(7)})",
                ),
                (
                    revision_id,
                    record_id,
                    string_field(provenance, "rule_pack"),
                    integer_field(provenance, "schema_version"),
                    to_json(provenance),
                    to_json(artifacts),
                    created_at,
                ),
            )
            cursor.close()
            self._connection.commit()
        except Exception:
            self._connection.rollback()
            raise
        return {
            "record_id": record_id,
            "display_label": display_label,
            "artifact_revision_id": revision_id,
        }

    @_serialized
    def list_records(self, *, account_id: str) -> list[dict[str, object]]:
        cursor = self._execute(
            _sql(
                "SELECT record_id, display_label, created_at ",
                "FROM hosted_person_records WHERE account_id = ",
                f"{self._dialect.placeholder} ORDER BY created_at",
            ),
            (account_id,),
        )
        try:
            return [row_to_dict(record) for record in cursor.fetchall()]
        finally:
            cursor.close()

    @_serialized
    def get_context(
        self,
        *,
        account_id: str,
        record_id: str,
        artifact_revision_id: str | None = None,
    ) -> dict[str, object]:
        revision_filter = ""
        parameters: tuple[object, ...] = (record_id, account_id)
        if artifact_revision_id is not None:
            revision_filter = (
                " AND r.artifact_revision_id = " + self._dialect.placeholder
            )
            parameters += (artifact_revision_id,)
        statement = _sql(
            "SELECT p.record_id, p.display_label, p.birth_input, ",
            "r.artifact_revision_id, r.provenance, r.artifacts ",
            "FROM hosted_person_records p ",
            "JOIN artifact_revisions r ON r.record_id = p.record_id ",
            "WHERE p.record_id = ",
            f"{self._dialect.placeholder} AND p.account_id = ",
            f"{self._dialect.placeholder} ",
            revision_filter,
            " ORDER BY r.created_at DESC LIMIT 1",
        )
        cursor = self._execute(statement, parameters)
        try:
            record = cursor.fetchone()
        finally:
            cursor.close()
        if record is None:
            raise HostedRecordError("Hosted person record was not found")
        values = row_to_dict(record)
        return {
            "record_id": values["record_id"],
            "display_label": values["display_label"],
            "birth_input": from_json(values["birth_input"]),
            "artifact_revision_id": values["artifact_revision_id"],
            "provenance": from_json(values["provenance"]),
            "artifacts": from_json(values["artifacts"]),
        }

    @_serialized
    def add_revision(
        self,
        *,
        account_id: str,
        record_id: str,
        artifacts: dict[str, object],
        provenance: dict[str, object],
    ) -> dict[str, object]:
        _ = self.get_context(account_id=account_id, record_id=record_id)
        revision_id = str(uuid4())
        created_at = now()
        cursor = self._execute(
            _sql(
                "INSERT INTO artifact_revisions ",
                "(artifact_revision_id, record_id, rule_pack, ",
                "schema_version, ",
                "provenance, artifacts, created_at) ",
                f"VALUES ({self._dialect.placeholders(7)})",
            ),
            (
                revision_id,
                record_id,
                string_field(provenance, "rule_pack"),
                integer_field(provenance, "schema_version"),
                to_json(provenance),
                to_json(artifacts),
                created_at,
            ),
        )
        cursor.close()
        self._connection.commit()
        return {"record_id": record_id, "artifact_revision_id": revision_id}

    @_serialized
    def record_request(
        self,
        *,
        account_id: str,
        record_id: str,
        artifact_revision_id: str,
        topic: str,
        question: str,
        requested_moment: str | None,
    ) -> dict[str, object]:
        self._require_revision(
            account_id=account_id,
            record_id=record_id,
            artifact_revision_id=artifact_revision_id,
        )
        request_id = str(uuid4())
        created_at = now()
        cursor = self._execute(
            _sql(
                "INSERT INTO reading_requests ",
                "(reading_request_id, record_id, artifact_revision_id, ",
                "account_id, topic, question, requested_moment, created_at) ",
                f"VALUES ({self._dialect.placeholders(8)})",
            ),
            (
                request_id,
                record_id,
                artifact_revision_id,
                account_id,
                topic,
                question,
                requested_moment,
                created_at,
            ),
        )
        cursor.close()
        self._connection.commit()
        return {"reading_request_id": request_id, "created_at": created_at}

    @_serialized
    def history(
        self, *, account_id: str, record_id: str | None
    ) -> list[dict[str, object]]:
        filters = ["account_id = " + self._dialect.placeholder]
        values: list[object] = [account_id]
        if record_id is not None:
            filters.append("record_id = " + self._dialect.placeholder)
            values.append(record_id)
        cursor = self._execute(
            _sql(
                "SELECT reading_request_id, record_id, artifact_revision_id, ",
                "topic, question, requested_moment, created_at ",
                "FROM reading_requests WHERE ",
                " AND ".join(filters),
                " ORDER BY created_at DESC",
            ),
            tuple(values),
        )
        try:
            return [row_to_dict(request) for request in cursor.fetchall()]
        finally:
            cursor.close()

    @_serialized
    def delete_record(self, *, account_id: str, record_id: str) -> bool:
        cursor = self._execute(
            _sql(
                "DELETE FROM hosted_person_records WHERE record_id = ",
                f"{self._dialect.placeholder} AND account_id = ",
                self._dialect.placeholder,
            ),
            (record_id, account_id),
        )
        try:
            deleted = cursor.rowcount == 1
        finally:
            cursor.close()
        self._connection.commit()
        if not deleted:
            raise HostedRecordError("Hosted person record was not found")
        return True

    @_serialized
    def delete_account_data(self, *, account_id: str) -> int:
        """Delete every hosted record owned by an authenticated account."""

        cursor = self._execute(
            _sql(
                "DELETE FROM hosted_person_records WHERE account_id = ",
                self._dialect.placeholder,
            ),
            (account_id,),
        )
        try:
            deleted_count = cursor.rowcount
        finally:
            cursor.close()
        self._connection.commit()
        return deleted_count

    def _require_revision(
        self,
        *,
        account_id: str,
        record_id: str,
        artifact_revision_id: str,
    ) -> None:
        cursor = self._execute(
            _sql(
                "SELECT 1 FROM hosted_person_records p ",
                "JOIN artifact_revisions r ON r.record_id = p.record_id ",
                "WHERE p.record_id = ",
                f"{self._dialect.placeholder} AND p.account_id = ",
                f"{self._dialect.placeholder} AND ",
                "r.artifact_revision_id = ",
                self._dialect.placeholder,
            ),
            (record_id, account_id, artifact_revision_id),
        )
        try:
            exists = cursor.fetchone() is not None
        finally:
            cursor.close()
        if not exists:
            raise HostedRecordError(
                "Evidence bundle was not found for this account"
            )


class NeonHostedRecordStore(HostedRecordStore):
    """Neon PostgreSQL implementation for the deployed service."""

    def __init__(self, connection_string: str) -> None:
        import psycopg
        from psycopg.rows import dict_row

        connection = cast(
            SqlConnection,
            cast(
                object,
                psycopg.Connection[dict[str, object]].connect(
                    connection_string,
                    row_factory=dict_row,
                ),
            ),
        )
        super().__init__(connection, placeholder="%s")
