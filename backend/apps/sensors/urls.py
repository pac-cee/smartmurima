from django.urls import path

from .views import SensorReadingViewSet

app_name = "sensors"

readings_list = SensorReadingViewSet.as_view({"get": "list"})
readings_latest = SensorReadingViewSet.as_view({"get": "latest"})

urlpatterns = [
    path("sensor-readings", readings_list, name="sensor-readings"),
    path("sensor-readings/latest", readings_latest, name="sensor-readings-latest"),
]
