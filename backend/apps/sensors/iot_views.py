"""Device-facing IoT endpoints, mounted under /api/v1/iot/.

These are the only two routes an ESP32 ever calls, and they are plain HTTP
JSON -- no broker, no queue, no session. The device authenticates with a token
it was handed at pairing time, so both views are ``AllowAny`` at the DRF level
and do their own auth on the body.

Contract (matches firmware/agrimind_smart_farm verbatim):

  POST /iot/announce/
      {"hardware_id": "...", "name": "..."}
   -> {"status": "pending"|"claimed", "device_id": "...", "token": "..."?}

  POST /iot/telemetry/
      {"token": "...", "pump": bool,
       "readings": [{"sensor_type": "moisture", "value": 31.2, ...}, ...]}
   -> {"command": {"pump_mode": ..., "pump_on": ..., "dry_level": N,
                   "wet_level": N}}
"""
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.farms.services import SensorNodeService

from .services import IngestionService


class AnnounceSerializer(serializers.Serializer):
    hardware_id = serializers.CharField(max_length=120)
    name = serializers.CharField(max_length=120, required=False, allow_blank=True)


class ReadingSerializer(serializers.Serializer):
    sensor_type = serializers.CharField(max_length=40)
    value = serializers.FloatField()
    optimal_min = serializers.FloatField(required=False)
    optimal_max = serializers.FloatField(required=False)


class TelemetrySerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)
    readings = ReadingSerializer(many=True)
    pump = serializers.BooleanField(required=False)
    # Optional: a device that keeps its own clock may stamp the reading.
    ts = serializers.CharField(required=False, allow_blank=True)


class DeviceAnnounceView(APIView):
    """Heartbeat from a board that is booting or waiting to be claimed."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "iot"

    @extend_schema(request=AnnounceSerializer, responses=dict)
    def post(self, request):
        serializer = AnnounceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = SensorNodeService().announce(
            serializer.validated_data["hardware_id"],
            serializer.validated_data.get("name", ""),
        )
        return Response(result, status=status.HTTP_200_OK)


class DeviceTelemetryView(APIView):
    """One batch of readings from a paired device."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "iot"

    @extend_schema(request=TelemetrySerializer, responses=dict)
    def post(self, request):
        serializer = TelemetrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        command = IngestionService().ingest_from_device(request.data)
        return Response(command, status=status.HTTP_200_OK)
