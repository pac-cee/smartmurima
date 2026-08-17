"""Locations controllers -- read-only, public (needed before login)."""
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from .serializers import LocationSerializer
from .services import LocationService


class LocationListView(ListAPIView):
    """GET /api/v1/locations?level=&parent=&search=

    Public read access: the registration form needs to populate cascading
    province/district/sector pickers before the user has any credentials.
    Returns a plain list (pagination disabled -- the hierarchy is small).
    """

    serializer_class = LocationSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        p = self.request.query_params
        return LocationService().list(
            level=p.get("level"),
            parent_id=p.get("parent"),
            search=p.get("search"),
        )

    @extend_schema(
        parameters=[
            OpenApiParameter("level", str, description="country|province|district|sector"),
            OpenApiParameter("parent", int, description="Parent location id (cascading pickers)."),
            OpenApiParameter("search", str, description="Case-insensitive name search."),
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
