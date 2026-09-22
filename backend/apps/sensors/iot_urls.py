"""Device-facing routes, mounted under /api/v1/iot/."""
from django.urls import path

from .iot_views import DeviceAnnounceView, DeviceTelemetryView

app_name = "iot"

# Trailing slashes here, because the firmware's URLs are baked into flash and
# end with one. Both spellings are accepted so a board flashed either way works.
urlpatterns = [
    path("announce/", DeviceAnnounceView.as_view(), name="announce"),
    path("announce", DeviceAnnounceView.as_view()),
    path("telemetry/", DeviceTelemetryView.as_view(), name="telemetry"),
    path("telemetry", DeviceTelemetryView.as_view()),
]
