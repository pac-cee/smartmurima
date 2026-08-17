"""Farms controllers -- thin viewsets delegating to services."""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core.permissions import IsOwnerOrCoop

from .models import Crop, Farm, Field, SensorNode
from .serializers import (
    CropSerializer,
    FarmSerializer,
    FieldSerializer,
    SensorNodeSerializer,
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
    serializer_class = SensorNodeSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrCoop]
    queryset = SensorNode.objects.none()

    def get_queryset(self):
        return SensorNodeService().list_for_user(self.request.user)

    def perform_create(self, serializer):
        node = SensorNodeService().create_for_user(
            self.request.user, serializer.validated_data
        )
        serializer.instance = node
