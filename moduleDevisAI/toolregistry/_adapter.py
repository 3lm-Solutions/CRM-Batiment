from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import TypeVar

from .errors import (
    ProviderAPIError,
    ProviderAuthenticationError,
    ProviderInvalidRequestError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ToolRegistryError,
)

T = TypeVar("T")


class ProviderAdapter:

    provider: str

    def __init__(self, provider: str, logger: logging.Logger | None = None) -> None:
        self.provider = provider
        self.logger = logger or logging.getLogger(f"toolregistry.{provider}")

    def _call(self, operation: str, model: str, callback: Callable[[], T]) -> T:
        started_at = time.monotonic()
        self.logger.info(
            "toolregistry.provider_call_started",
            extra={"provider": self.provider, "operation": operation, "model": model},
        )
        try:
            response = callback()
        except ToolRegistryError:
            raise
        except Exception as error:
            normalized = self._normalize_error(error, operation)
            self.logger.warning(
                "toolregistry.provider_call_failed",
                extra={
                    "provider": self.provider,
                    "operation": operation,
                    "model": model,
                    "duration_ms": round((time.monotonic() - started_at) * 1_000),
                    "error_category": type(normalized).__name__,
                    "request_id": normalized.request_id,
                },
            )
            raise normalized from error

        self.logger.info(
            "toolregistry.provider_call_succeeded",
            extra={
                "provider": self.provider,
                "operation": operation,
                "model": model,
                "duration_ms": round((time.monotonic() - started_at) * 1_000),
                "request_id": getattr(response, "_request_id", None),
            },
        )
        return response

    def _normalize_error(self, error: Exception, operation: str) -> ToolRegistryError:
        request_id = getattr(error, "request_id", None) or getattr(
            error, "_request_id", None
        )
        status_code = getattr(error, "status_code", None) or getattr(error, "status", None)
        if not isinstance(status_code, int):
            status_code = getattr(getattr(error, "response", None), "status_code", status_code)
        class_name = type(error).__name__
        details = {"provider": self.provider, "operation": operation, "request_id": request_id}
        provider_message = str(error).strip()

        if status_code in (401, 403) or "Authentication" in class_name:
            return ProviderAuthenticationError(
                f"Provider authentication failed: {provider_message}", **details
            )
        if (
            status_code == 429
            or "RateLimit" in class_name
            or "Quota" in class_name
            or "TooMany" in class_name
        ):
            return ProviderRateLimitError(
                f"Provider rate limit reached: {provider_message}", **details
            )
        if status_code in (408, 504) or "Timeout" in class_name or isinstance(error, TimeoutError):
            return ProviderTimeoutError(
                f"Provider request timed out: {provider_message}", **details
            )
        if status_code in (400, 404, 409, 413, 422) or "BadRequest" in class_name:
            return ProviderInvalidRequestError(
                f"Provider rejected the request: {provider_message}", **details
            )
        return ProviderAPIError(
            f"Provider API request failed: {provider_message}", **details
        )
