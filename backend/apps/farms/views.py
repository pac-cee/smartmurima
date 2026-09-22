"""Farms controllers -- thin viewsets delegating to services."""
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsNodeOwnerOrUnclaimed, IsOwnerOrCoop

from .models import Crop, Farm, Field, SensorNode
from .serializers import (
    ClaimDeviceSerializer,
    CropSerializer,
    FarmSerializer,
    FieldSerializer,
    PumpCommandSerializer,
    SensorNodeSerializer,
    ThresholdSerializer,
)
from .services import (
    CropService,
    FarmService,
    FieldService,
    SensorNodeService,
)


class FarmViewSet(viewsets.ModelViewSet):
    serializer_class = FarmSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrCoop]
    queryset = Farm.objects.none()  # for schema generation

    def get_queryset(self):
        return FarmService().list_for_user(self.request.user)

    def perform_create(self, serializer):
        farm = FarmService().create_for_user(
            self.request.user, serializer.validated_data
        )
        serializer.instance = farm


class FieldViewSet(viewsets.ModelViewSet):
    serializer_class = FieldSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrCoop]
    queryset = Field.objects.none()

    def get_queryset(self):
        farm_id = self.request.query_params.get("farm")
        return FieldService().list_for_user(self.request.user, farm_id=farm_id)

    def perform_create(self, serializer):
        field = FieldService().create_for_user(
            self.request.user, serializer.validated_data
        )
        serializer.instance = field


class CropViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CropSerializer
    permission_classes = [IsAuthenticated]
    queryset = Crop.objects.all()

    def get_queryset(self):
        return CropService().all()


class SensorNodeViewSet(viewsets.ModelViewSet):
    """Field devices: list/inspect, pair to a field, and drive the pump."""

    serializer_class = SensorNodeSerializer
    permission_classes = [IsAuthenticated, IsNodeOwnerOrUnclaimed]
    queryset = SensorNode.objects.none()

    def get_queryset(self):
        qs = SensorNodeService().list_for_user(self.request.user)
        claimed = self.request.query_params.get("claimed")
        if claimed == "false":
            return qs.filter(field__isnull=True)
        if claimed == "true":
            return qs.filter(field__isnull=False)
        field_id = self.request.query_params.get("field")
        if field_id and str(field_id).isdigit():
            return qs.filter(field_id=int(field_id))
        return qs

    def perform_create(self, serializer):
        node = SensorNodeService().create_for_user(
            self.request.user, serializer.validated_data
        )
        serializer.instance = node

    def _respond(self, node):
        return Response(SensorNodeSerializer(node).data)

    @extend_schema(request=ClaimDeviceSerializer, responses=SensorNodeSerializer)
    @action(detail=True, methods=["post"])
    def claim(self, request, pk=None):
        """Pair a discovered device with one of my fields."""
        node = self.get_object()
        serializer = ClaimDeviceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        node = SensorNodeService().claim(
            request.user, node, serializer.validated_data["field"]
        )
        return self._respond(node)

    @extend_schema(request=None, responses=SensorNodeSerializer)
    @action(detail=True, methods=["post"])
    def release(self, request, pk=None):
        """Unpair the device; it drops back into the discovery list."""
        node = SensorNodeService().release(request.user, self.get_object())
        return self._respond(node)

    @extend_schema(request=PumpCommandSerializer, responses=SensorNodeSerializer)
    @action(detail=True, methods=["post"])
    def pump(self, request, pk=None):
        """Set the irrigation override the device picks up on its next POST."""
        node = self.get_object()
        serializer = PumpCommandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        node = SensorNodeService().set_pump(
            request.user,
            node,
            serializer.validated_data["pump_mode"],
            serializer.validated_data.get("pump_on"),
        )
        return self._respond(node)

    @extend_schema(request=ThresholdSerializer, responses=SensorNodeSerializer)
    @action(detail=True, methods=["post"])
    def thresholds(self, request, pk=None):
        """Re-tune the dry/wet soil-moisture band the pump runs on."""
        node = self.get_object()
        serializer = ThresholdSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        node = SensorNodeService().set_thresholds(
            request.user,
            node,
            serializer.validated_data["dry_level"],
            serializer.validated_data["wet_level"],
        )
        return self._respond(node)
