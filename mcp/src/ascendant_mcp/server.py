"""FastMCP tools and ASGI composition for the hosted service."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastmcp import FastMCP
from fastmcp.server.auth import AuthProvider
from fastmcp.server.dependencies import get_access_token
from mcp.types import ToolAnnotations

from ascendant_mcp.auth import create_remote_auth
from ascendant_mcp.codec import now, object_field, parse_moment
from ascendant_mcp.contracts import RecordStore
from ascendant_mcp.errors import HostedRecordError
from ascendant_mcp.records import (
    build_birth_input,
    calculate_artifacts,
    calculate_transit,
)
from ascendant_mcp.resources import register_skill_resources
from ascendant_mcp.store import NeonHostedRecordStore

MAX_DISPLAY_LABEL_LENGTH = 120
MAX_TOPIC_LENGTH = 80
MAX_QUESTION_LENGTH = 4_000


def create_mcp_server(
    *,
    store: RecordStore,
    account_id: str | None = None,
    auth: AuthProvider | None = None,
) -> FastMCP:
    """Create compact data tools scoped to an authenticated account."""

    mcp = FastMCP("Ascendant", auth=auth)

    def current_account() -> str:
        if account_id is not None:
            return account_id
        token = get_access_token()
        subject = token.claims.get("sub") if token is not None else None
        if not isinstance(subject, str) or not subject:
            raise HostedRecordError(
                "An authenticated Ascendant account is required"
            )
        return subject

    @mcp.tool(
        annotations=ToolAnnotations(
            destructiveHint=False,
            idempotentHint=False,
            openWorldHint=False,
        )
    )
    def create_person_record(
        display_label: str,
        dob: str,
        latitude: float,
        longitude: float,
        consent_attested: bool,
    ) -> dict[str, object]:
        """Create a consent-attested hosted record and evidence bundle."""

        if not display_label.strip():
            raise HostedRecordError("display_label must not be empty")
        if len(display_label) > MAX_DISPLAY_LABEL_LENGTH:
            raise HostedRecordError("display_label is too long")
        if not consent_attested:
            raise HostedRecordError("consent_attested must be true")
        birth_input = build_birth_input(dob, latitude, longitude)
        artifacts, provenance = calculate_artifacts(birth_input)
        return store.create_record(
            account_id=current_account(),
            display_label=display_label.strip(),
            birth_input=birth_input,
            attested_at=now(),
            artifacts=artifacts,
            provenance=provenance,
        )

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=True))
    def list_person_records() -> dict[str, object]:
        """List hosted person records owned by the authenticated account."""

        return {"records": store.list_records(account_id=current_account())}

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=True))
    def get_person_context(
        record_id: str,
        artifact_revision_id: str | None = None,
        moment: str | None = None,
    ) -> dict[str, object]:
        """Retrieve a selected record's versioned natal/transit evidence."""

        context = store.get_context(
            account_id=current_account(),
            record_id=record_id,
            artifact_revision_id=artifact_revision_id,
        )
        birth_input = object_field(context, "birth_input")
        _ = context.pop("birth_input")
        if moment is not None:
            context["transit"] = calculate_transit(birth_input, moment)
        return context

    @mcp.tool(
        annotations=ToolAnnotations(
            destructiveHint=False,
            idempotentHint=False,
            openWorldHint=False,
        )
    )
    def recalculate_person_record(record_id: str) -> dict[str, object]:
        """Add a fresh evidence revision without replacing prior revisions."""

        account = current_account()
        context = store.get_context(account_id=account, record_id=record_id)
        artifacts, provenance = calculate_artifacts(
            object_field(context, "birth_input")
        )
        return store.add_revision(
            account_id=account,
            record_id=record_id,
            artifacts=artifacts,
            provenance=provenance,
        )

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=True))
    def get_relationship_context(
        first_record_id: str,
        second_record_id: str,
    ) -> dict[str, object]:
        """Retrieve evidence only when both selected records are authorized."""

        account = current_account()
        first = store.get_context(
            account_id=account,
            record_id=first_record_id,
        )
        second = store.get_context(
            account_id=account,
            record_id=second_record_id,
        )
        _ = first.pop("birth_input")
        _ = second.pop("birth_input")
        return {"first": first, "second": second}

    @mcp.tool(
        annotations=ToolAnnotations(
            destructiveHint=False,
            idempotentHint=False,
            openWorldHint=False,
        )
    )
    def record_reading_request(
        record_id: str,
        artifact_revision_id: str,
        topic: str,
        question: str,
        requested_moment: str | None = None,
    ) -> dict[str, object]:
        """Save a tool-level question and its exact Reading evidence bundle."""

        if not topic.strip() or not question.strip():
            raise HostedRecordError("topic and question must not be empty")
        if (
            len(topic) > MAX_TOPIC_LENGTH
            or len(question) > MAX_QUESTION_LENGTH
        ):
            raise HostedRecordError("topic or question is too long")
        if requested_moment is not None:
            _ = parse_moment(requested_moment)
        return store.record_request(
            account_id=current_account(),
            record_id=record_id,
            artifact_revision_id=artifact_revision_id,
            topic=topic.strip(),
            question=question.strip(),
            requested_moment=requested_moment,
        )

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=True))
    def get_reading_history(
        record_id: str | None = None,
    ) -> dict[str, object]:
        """Retrieve tool-level Reading requests, never a ChatGPT transcript."""

        return {
            "requests": store.history(
                account_id=current_account(), record_id=record_id
            )
        }

    @mcp.tool(
        annotations=ToolAnnotations(
            destructiveHint=True,
            idempotentHint=False,
            openWorldHint=False,
        )
    )
    def delete_person_record(record_id: str) -> dict[str, object]:
        """Delete a record and cascade its evidence, attestation,
        and history."""

        _ = store.delete_record(
            account_id=current_account(),
            record_id=record_id,
        )
        return {"record_id": record_id, "deleted": True}

    @mcp.tool(
        annotations=ToolAnnotations(
            destructiveHint=True,
            idempotentHint=True,
            openWorldHint=False,
        )
    )
    def delete_account_data() -> dict[str, object]:
        """Delete every hosted record and related data owned by this
        account."""

        deleted_count = store.delete_account_data(account_id=current_account())
        return {"deleted_record_count": deleted_count, "deleted": True}

    _ = (
        create_person_record,
        list_person_records,
        get_person_context,
        recalculate_person_record,
        get_relationship_context,
        record_reading_request,
        get_reading_history,
        delete_person_record,
        delete_account_data,
    )
    register_skill_resources(mcp)
    return mcp


def create_production_mcp_server() -> FastMCP:
    """Build the Vercel service from Neon and OAuth settings."""

    database_url = os.environ.get("NEON_DATABASE_URL") or os.environ.get(
        "POSTGRES_URL"
    )
    if not database_url:
        raise RuntimeError("NEON_DATABASE_URL or POSTGRES_URL is required")
    return create_mcp_server(
        store=NeonHostedRecordStore(database_url),
        auth=create_remote_auth(),
    )


def create_vercel_app(mcp: FastMCP) -> FastAPI:
    """Wrap the MCP ASGI app with Vercel's `/api` route and lifespan."""

    # A Vercel function is request-scoped, so a stateless transport is required.
    # Return the completed JSON-RPC payload directly instead of an SSE response:
    # ChatGPT can then consume the result before the function closes its request.
    mcp_app = mcp.http_app(stateless_http=True, json_response=True)
    app = FastAPI(title="Ascendant MCP", lifespan=mcp_app.lifespan)
    app.mount("/api", mcp_app)
    return app
