from django.urls import path

from .views import WeatherForecastView

app_name = "weather"

urlpatterns = [
    path("forecast", WeatherForecastView.as_view(), name="forecast"),
]
