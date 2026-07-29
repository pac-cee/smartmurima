from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import ValidationError

from .serializers import WeatherForecastSerializer
from .services import WeatherService


class WeatherForecastView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[OpenApiParameter("farm", int, required=True)],
        responses=WeatherForecastSerializer(many=True),
    )
    def get(self, request):
        farm_id = request.query_params.get("farm")
        if not farm_id:
            raise ValidationError("farm query parameter is required.")
        result = WeatherService().forecast(request.user, farm_id)
        return Response({"farm": int(farm_id), **result})
