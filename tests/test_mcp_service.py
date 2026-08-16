"""Public FastMCP behavior for hosted Ascendant records."""

from __future__ import annotations

import asyncio
import re
import socket
import time
from collections.abc import Generator, Mapping
from contextlib import contextmanager
from pathlib import Path
from threading import Thread
from typing import Protocol, cast

import httpx
import pytest
import uvicorn
from ascendant_mcp.auth import create_remote_auth
from ascendant_mcp.errors import HostedRecordError
from ascendant_mcp.records import build_birth_input
from ascendant_mcp.server import create_mcp_server, create_vercel_app
from ascendant_mcp.store import HostedRecordStore
from fastapi import FastAPI
from fastmcp import Client
from fastmcp.client import BearerAuth
from fastmcp.server.auth import RemoteAuthProvider
from fastmcp.server.auth.providers.jwt import JWTVerifier
from joserfc import jwt
from joserfc.jwk import OctKey
from mcp.types import TextResourceContents
from pydantic import AnyHttpUrl


class ToolResult(Protocol):
    """Typed view of the FastMCP result fields used by these tests."""

    @property
    def data(self) -> object: ...


def _tool_data(result: ToolResult) -> dict[str, object]:
    data = result.data
    assert isinstance(data, dict)
    return cast(dict[str, object], data)


def _object(value: Mapping[str, object], key: str) -> dict[str, object]:
    item = value[key]
    assert isinstance(item, dict)
    return cast(dict[str, object], item)


def _string(value: Mapping[str, object], key: str) -> str:
    item = value[key]
    assert isinstance(item, str)
    return item


def _objects(value: Mapping[str, object], key: str) -> list[dict[str, object]]:
    items = value[key]
    assert isinstance(items, list)
    typed_items: list[dict[str, object]] = []
    for item in cast(list[object], items):
        assert isinstance(item, dict)
        typed_items.append(cast(dict[str, object], item))
    return typed_items


@contextmanager
def _serve_asgi(app: FastAPI) -> Generator[str, None, None]:
    """Run the same stateless FastMCP ASGI shape Vercel receives."""

    with socket.socket() as port_socket:
        port_socket.bind(("127.0.0.1", 0))
        address = cast(object, port_socket.getsockname())
        assert isinstance(address, tuple)
        address_parts = cast(tuple[object, ...], address)
        port = address_parts[1]
        assert isinstance(port, int)
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
    )
    thread = Thread(target=server.run, daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 5
        while not server.started and time.monotonic() < deadline:
            time.sleep(0.01)
        if not server.started:
            raise RuntimeError("FastMCP ASGI server did not start")
        yield f"http://127.0.0.1:{port}"
    finally:
        server.should_exit = True
        thread.join(timeout=5)


def test_birth_input_rejects_non_finite_coordinates() -> None:
    with pytest.raises(HostedRecordError, match="must be finite"):
        _ = build_birth_input(
            "1990-01-01T12:00:00+05:30",
            float("nan"),
            77.2090,
        )


def test_connector_source_does_not_use_any() -> None:
    """Keep the hosted boundary explicit instead of leaking untyped values."""

    connector_root = Path(__file__).parents[1] / "mcp" / "src"
    any_type = re.compile(r"\bAny\b")
    source_files = sorted(connector_root.rglob("*.py"))
    assert source_files
    assert all(
        any_type.search(path.read_text(encoding="utf-8")) is None
        for path in source_files
    )


def test_data_tools_reject_a_request_without_an_account() -> None:
    async def exercise() -> None:
        server = create_mcp_server(store=HostedRecordStore.in_memory())
        async with Client(server) as client:
            result = await client.call_tool(
                "list_person_records", {}, raise_on_error=False
            )
            assert result.is_error

    asyncio.run(exercise())


def test_remote_auth_configuration_requires_all_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BASE_URL", "https://ascendant.example/api")
    monkeypatch.setenv("OAUTH_ISSUER_URL", "https://issuer.example")
    monkeypatch.setenv("OAUTH_JWKS_URL", "https://issuer.example/jwks.json")
    monkeypatch.setenv("OAUTH_JWT_ALGORITHM", "RS256")
    monkeypatch.setenv("OAUTH_AUDIENCE", "https://ascendant.example/api/mcp")

    auth = create_remote_auth()

    assert isinstance(auth, RemoteAuthProvider)
    assert [str(url) for url in auth.authorization_servers] == [
        "https://issuer.example/"
    ]
    assert auth.token_verifier.required_scopes == ["ascendant:records"]


def test_remote_auth_configuration_fails_closed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("BASE_URL", raising=False)
    monkeypatch.delenv("OAUTH_ISSUER_URL", raising=False)
    monkeypatch.delenv("OAUTH_JWKS_URL", raising=False)
    monkeypatch.delenv("OAUTH_JWT_ALGORITHM", raising=False)
    monkeypatch.delenv("OAUTH_AUDIENCE", raising=False)

    with pytest.raises(RuntimeError, match="OAUTH_ISSUER_URL"):
        _ = create_remote_auth()


def _test_remote_auth() -> RemoteAuthProvider:
    issuer = "https://issuer.example"
    verifier = JWTVerifier(
        public_key="test-signing-secret",
        issuer=issuer,
        audience="https://ascendant.example/api/mcp",
        algorithm="HS256",
        required_scopes=["ascendant:records"],
    )
    return RemoteAuthProvider(
        token_verifier=verifier,
        authorization_servers=[AnyHttpUrl(issuer)],
        base_url="https://ascendant.example/api",
        scopes_supported=["ascendant:records"],
    )


def _test_access_token(
    subject: str,
    *,
    scope: str = "ascendant:records",
) -> str:
    return jwt.encode(
        {"alg": "HS256"},
        {
            "iss": "https://issuer.example",
            "aud": "https://ascendant.example/api/mcp",
            "sub": subject,
            "scope": scope,
            "exp": int(time.time()) + 60,
        },
        OctKey.import_key("test-signing-secret"),
    )


def test_protected_asgi_route_challenges_unauthenticated_requests() -> None:
    async def exercise(server_url: str) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{server_url}/api/mcp",
                headers={"accept": "application/json"},
                json={"jsonrpc": "2.0", "id": 1, "method": "initialize"},
            )
        assert response.status_code == 401
        assert "resource_metadata" in response.headers["www-authenticate"]

    auth = _test_remote_auth()
    server = create_mcp_server(store=HostedRecordStore.in_memory(), auth=auth)
    with _serve_asgi(create_vercel_app(server)) as server_url:
        asyncio.run(exercise(server_url))


def test_protected_asgi_route_accepts_a_valid_subject_token() -> None:
    store = HostedRecordStore.in_memory()
    server = create_mcp_server(store=store, auth=_test_remote_auth())

    async def exercise(server_url: str) -> None:
        async with Client(
            f"{server_url}/api/mcp",
            auth=BearerAuth(_test_access_token("alice")),
        ) as client:
            records = await client.call_tool("list_person_records", {})
        assert _tool_data(records) == {"records": []}

    with _serve_asgi(create_vercel_app(server)) as server_url:
        asyncio.run(exercise(server_url))


def test_stateless_asgi_route_returns_json_for_an_initialized_request() -> None:
    """Avoid an SSE response that a serverless function closes after each call."""

    server = create_mcp_server(
        store=HostedRecordStore.in_memory(), auth=_test_remote_auth()
    )

    async def exercise(server_url: str) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{server_url}/api/mcp",
                headers={
                    "accept": "application/json",
                    "authorization": "Bearer " + _test_access_token("alice"),
                },
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2025-03-26",
                        "capabilities": {},
                        "clientInfo": {"name": "test-client", "version": "1.0"},
                    },
                },
            )
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/json")
        assert response.json()["result"]["serverInfo"]["name"] == "Ascendant"

    with _serve_asgi(create_vercel_app(server)) as server_url:
        asyncio.run(exercise(server_url))


def test_protected_asgi_route_rejects_a_token_without_required_scope() -> None:
    server = create_mcp_server(
        store=HostedRecordStore.in_memory(), auth=_test_remote_auth()
    )

    async def exercise(server_url: str) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{server_url}/api/mcp",
                headers={
                    "accept": "application/json",
                    "authorization": "Bearer "
                    + _test_access_token("alice", scope="profile"),
                },
                json={"jsonrpc": "2.0", "id": 1, "method": "initialize"},
            )
        assert response.status_code == 401

    with _serve_asgi(create_vercel_app(server)) as server_url:
        asyncio.run(exercise(server_url))


def test_hosted_record_lifecycle_is_account_scoped() -> None:
    """An authenticated account can use only its own hosted evidence."""

    store = HostedRecordStore.in_memory()
    alice = create_mcp_server(store=store, account_id="alice")
    bob = create_mcp_server(store=store, account_id="bob")

    async def exercise(server_url: str) -> None:
        async with Client(f"{server_url}/api/mcp") as alice_client:
            resources = await alice_client.list_resources()
            assert any(
                str(resource.uri) == "skill://ascendant/career"
                for resource in resources
            )
            career_skill = await alice_client.read_resource(
                "skill://ascendant/career"
            )
            assert isinstance(career_skill[0], TextResourceContents)
            assert "Career" in career_skill[0].text
            assert "## Reference: topic.md" in career_skill[0].text
            init_skill = await alice_client.read_resource(
                "skill://ascendant/init-person"
            )
            assert isinstance(init_skill[0], TextResourceContents)
            init_text = init_skill[0].text
            assert "create_person_record" in init_text
            assert "<path-to-init-person-skill>" not in init_text

            created = await alice_client.call_tool(
                "create_person_record",
                {
                    "display_label": "Me",
                    "dob": "1990-01-01T12:00:00+05:30",
                    "latitude": 28.6139,
                    "longitude": 77.2090,
                    "consent_attested": True,
                },
            )
            created_data = _tool_data(created)
            record_id = _string(created_data, "record_id")
            revision_id = _string(created_data, "artifact_revision_id")

            context = await alice_client.call_tool(
                "get_person_context", {"record_id": record_id}
            )
            context_data = _tool_data(context)
            assert _string(context_data, "record_id") == record_id
            assert _string(context_data, "artifact_revision_id") == revision_id
            provenance = _object(context_data, "provenance")
            assert _string(provenance, "rule_pack") == (
                "parashari_raman_jaimini_v3"
            )

            recalculated = await alice_client.call_tool(
                "recalculate_person_record", {"record_id": record_id}
            )
            recalculated_data = _tool_data(recalculated)
            assert (
                _string(recalculated_data, "artifact_revision_id")
                != revision_id
            )
            original_context = await alice_client.call_tool(
                "get_person_context",
                {
                    "record_id": record_id,
                    "artifact_revision_id": revision_id,
                },
            )
            original_data = _tool_data(original_context)
            assert (
                _string(original_data, "artifact_revision_id")
                == revision_id
            )

            partner = await alice_client.call_tool(
                "create_person_record",
                {
                    "display_label": "Partner",
                    "dob": "1991-02-01T12:00:00+05:30",
                    "latitude": 28.6139,
                    "longitude": 77.2090,
                    "consent_attested": True,
                },
            )
            partner_data = _tool_data(partner)
            partner_id = _string(partner_data, "record_id")
            compatibility = await alice_client.call_tool(
                "get_relationship_context",
                {
                    "first_record_id": record_id,
                    "second_record_id": partner_id,
                },
            )
            compatibility_data = _tool_data(compatibility)
            first = _object(compatibility_data, "first")
            second = _object(compatibility_data, "second")
            assert _string(first, "record_id") == record_id
            assert _string(second, "record_id") == partner_id

            request = await alice_client.call_tool(
                "record_reading_request",
                {
                    "record_id": record_id,
                    "topic": "career",
                    "question": (
                        "What professional patterns should I reflect on?"
                    ),
                    "artifact_revision_id": revision_id,
                },
            )
            _ = _tool_data(request)

            history = await alice_client.call_tool(
                "get_reading_history", {"record_id": record_id}
            )
            history_data = _tool_data(history)
            requests = _objects(history_data, "requests")
            assert _string(requests[0], "question") == (
                "What professional patterns should I reflect on?"
            )

        async with Client(bob) as bob_client:
            inaccessible = await bob_client.call_tool(
                "get_person_context",
                {"record_id": record_id},
                raise_on_error=False,
            )
            assert inaccessible.is_error

        async with Client(alice) as alice_client:
            deleted = await alice_client.call_tool(
                "delete_person_record", {"record_id": record_id}
            )
            assert _tool_data(deleted) == {
                "record_id": record_id,
                "deleted": True,
            }

            history = await alice_client.call_tool("get_reading_history", {})
            assert _tool_data(history) == {"requests": []}

            deleted_account = await alice_client.call_tool(
                "delete_account_data", {}
            )
            assert _tool_data(deleted_account) == {
                "deleted_record_count": 1,
                "deleted": True,
            }
            records = await alice_client.call_tool("list_person_records", {})
            assert _tool_data(records) == {"records": []}

    with _serve_asgi(create_vercel_app(alice)) as server_url:
        asyncio.run(exercise(server_url))
