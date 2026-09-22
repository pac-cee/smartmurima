"""Root URL configuration.

All API routes live under ``/api/v1/``. OpenAPI schema + Swagger UI are served
at ``/api/schema`` and ``/api/docs`` respectively.
"""
from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)


def healthcheck(_request):
    return JsonResponse({"status": "ok", "service": "smartmurima-api"})


api_v1 = [
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.locations.urls")),
    path("", include("apps.farms.urls")),
    path("", include("apps.sensors.urls")),
    path("iot/", include("apps.sensors.iot_urls")),
    path("", include("apps.recommendations.urls")),
    path("", include("apps.diseases.urls")),
    path("assistant/", include("apps.assistant.urls")),
    path("", include("apps.alerts.urls")),
    path("reports/", include("apps.reports.urls")),
    path("weather/", include("apps.weather.urls")),
    path("admin-api/", include("apps.accounts.admin_urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    # Uploaded media (disease photos) is served by Django itself, in every
    # environment. The old `if settings.DEBUG` guard meant uploads 404'd under
    # the container's prod settings, so every scan the farmer took came back as
    # a broken image. This stack ships as a single gunicorn container with no
    # nginx in front of it -- put a real static server here before scaling out.
    re_path(
        r"^media/(?P<path>.*)$",
        serve,
        {"document_root": settings.MEDIA_ROOT},
        name="media",
    ),
    path("health", healthcheck, name="health"),
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/v1/", include((api_v1, "v1"))),
]
