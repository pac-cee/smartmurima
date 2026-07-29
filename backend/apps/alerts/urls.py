from django.urls import path

from .views import AlertViewSet

app_name = "alerts"

urlpatterns = [
    path("alerts", AlertViewSet.as_view({"get": "list"}), name="alerts"),
    path(
        "alerts/<int:pk>/read",
        AlertViewSet.as_view({"post": "read"}),
        name="alert-read",
    ),
]
