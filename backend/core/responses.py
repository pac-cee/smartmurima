"""Helpers for consistent success responses."""
from rest_framework.response import Response


def ok(data=None, status=200):
    return Response(data if data is not None else {}, status=status)


def created(data=None):
    return Response(data if data is not None else {}, status=201)
