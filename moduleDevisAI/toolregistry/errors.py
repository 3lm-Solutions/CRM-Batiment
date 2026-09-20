from __future__ import annotations


class ToolRegistryError(RuntimeError):
    """Base error raised at the ToolRegistry boundary."""

    def __init__(
        self,
        message: str,
        *,
        provider: str | None = None,
        operation: str | None = None,
        request_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.provider = provider
        self.operation = operation
        self.request_id = request_id


class InvalidProviderError(ToolRegistryError):
    """Raised when configuration selects an unknown provider."""


class ProviderAuthenticationError(ToolRegistryError):
    """Raised for missing, invalid, expired, or unauthorized credentials."""


class ProviderDependencyError(ToolRegistryError):
    """Raised when the selected provider's official SDK is not installed."""


class ProviderInvalidRequestError(ToolRegistryError):
    """Raised when a provider rejects a validly-routed request."""


class ProviderRateLimitError(ToolRegistryError):
    """Raised when the active provider has rate-limited the request."""


class ProviderTimeoutError(ToolRegistryError):
    """Raised when a configured request deadline is exceeded."""


class ProviderAPIError(ToolRegistryError):
    """Raised for connection failures and other provider-side API errors."""


class ProviderResponseError(ToolRegistryError):
    """Raised when a successful provider response has no usable expected output."""


class UnsupportedCapabilityError(ToolRegistryError):
    """Raised when the selected provider does not offer an abstract capability."""
