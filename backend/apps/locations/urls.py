from django.urls import path

from .views import LocationListView

app_name = "locations"

urlpatterns = [
    path("locations", LocationListView.as_view(), name="locations"),
]
