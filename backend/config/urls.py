"""Root URL configuration.

All API routes live under ``/api/v1/``. OpenAPI schema + Swagger UI are served
at ``/api/schema`` and ``/api/docs`` respectively.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
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
    path("health", healthcheck, name="health"),
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/v1/", include((api_v1, "v1"))),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
