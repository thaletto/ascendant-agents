"""Domain errors exposed by the hosted MCP connector."""


class HostedRecordError(ValueError):
    """A hosted record request cannot be completed for the current account."""
