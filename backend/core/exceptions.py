"""Domain exceptions and the global DRF exception handler.

Every error response is normalised to::

    { "detail": "...", "code": "...", "errors": { field: [msg, ...] } }
"""
from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger("smartmurima")


class DomainError(APIException):
    """Base class for business-rule violations raised by services."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "A domain error occurred."
    default_code = "domain_error"


class ValidationError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Validation failed."
    default_code = "validation_error"


class NotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Resource not found."
    default_code = "not_found"


class PermissionDeniedError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "You do not have permission to perform this action."
    default_code = "permission_denied"


class ConflictError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Conflicting state."
    default_code = "conflict"


class RateLimitedError(DomainError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Too many requests. Please try again later."
    default_code = "rate_limited"


class ServiceUnavailableError(DomainError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "A dependent service is unavailable."
    default_code = "service_unavailable"


def api_exception_handler(exc, context):
    """Normalise all API errors to ``{detail, code, errors}``."""
    response = drf_exception_handler(exc, context)

    if response is None:
        # Unhandled exception -> 500. Never leak internals to the client.
        logger.exception("Unhandled exception in API", exc_info=exc)
        return Response(
            {
                "detail": "Internal server error.",
                "code": "server_error",
                "errors": {},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = response.data
    code = getattr(exc, "default_code", "error")
    errors: dict = {}
    detail = "Request failed."

    if isinstance(data, dict):
        if "detail" in data and len(data) == 1:
            detail = _stringify(data["detail"])
            code = getattr(data["detail"], "code", code)
        else:
            # Field-level validation errors from serializers.
            errors = {k: _as_list(v) for k, v in data.items()}
            detail = "Validation failed."
            code = "validation_error"
    elif isinstance(data, list):
        errors = {"non_field_errors": _as_list(data)}
        detail = "Validation failed."
        code = "validation_error"

    response.data = {"detail": detail, "code": code, "errors": errors}
    return response


def _as_list(value):
    if isinstance(value, list):
        return [_stringify(v) for v in value]
    return [_stringify(value)]


def _stringify(value):
    try:
        return str(value)
    except Exception:  # pragma: no cover - defensive
        return "error"
