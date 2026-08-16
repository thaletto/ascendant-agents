"""Provider-neutral OAuth resource-server configuration."""

from __future__ import annotations

import os

from fastmcp.server.auth import RemoteAuthProvider
from fastmcp.server.auth.providers.jwt import JWTVerifier
from pydantic import AnyHttpUrl


def create_remote_auth() -> RemoteAuthProvider:
    """Create a fail-closed OAuth 2.1 resource-server integration."""

    required_settings = {
        "BASE_URL": os.environ.get("BASE_URL"),
        "OAUTH_ISSUER_URL": os.environ.get("OAUTH_ISSUER_URL"),
        "OAUTH_JWKS_URL": os.environ.get("OAUTH_JWKS_URL"),
        "OAUTH_JWT_ALGORITHM": os.environ.get("OAUTH_JWT_ALGORITHM"),
        "OAUTH_AUDIENCE": os.environ.get("OAUTH_AUDIENCE"),
    }
    missing = [name for name, value in required_settings.items() if not value]
    if missing:
        raise RuntimeError(
            "Missing OAuth resource-server settings: " + ", ".join(missing)
        )

    base_url = _setting(required_settings, "BASE_URL")
    issuer = _setting(required_settings, "OAUTH_ISSUER_URL")
    verifier = JWTVerifier(
        jwks_uri=_setting(required_settings, "OAUTH_JWKS_URL"),
        issuer=issuer,
        audience=_setting(required_settings, "OAUTH_AUDIENCE"),
        algorithm=_setting(required_settings, "OAUTH_JWT_ALGORITHM"),
        required_scopes=["ascendant:records"],
    )
    return RemoteAuthProvider(
        token_verifier=verifier,
        authorization_servers=[AnyHttpUrl(issuer)],
        base_url=base_url,
        scopes_supported=["ascendant:records"],
        resource_name="Ascendant hosted records",
        resource_documentation=AnyHttpUrl(
            "https://ascendant-docs.vercel.app/docs/privacy"
        ),
    )


def _setting(settings: dict[str, str | None], name: str) -> str:
    value = settings[name]
    if value is None:
        raise RuntimeError(f"Missing OAuth resource-server setting: {name}")
    return value
