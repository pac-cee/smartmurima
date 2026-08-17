from django.urls import path

from .views import RecommendationViewSet

app_name = "recommendations"

urlpatterns = [
    path(
        "recommendations",
        RecommendationViewSet.as_view({"get": "list"}),
        name="recommendations",
    ),
    path(
        "recommendations/latest",
        RecommendationViewSet.as_view({"get": "latest"}),
        name="recommendation-latest",
    ),
    path(
        "recommendations/irrigation",
        RecommendationViewSet.as_view({"post": "irrigation"}),
        name="recommendation-irrigation",
    ),
    path(
        "recommendations/fertilizer",
        RecommendationViewSet.as_view({"post": "fertilizer"}),
        name="recommendation-fertilizer",
    ),
    path(
        "recommendations/yield",
        RecommendationViewSet.as_view({"post": "yield_estimate"}),
        name="recommendation-yield",
    ),
]
