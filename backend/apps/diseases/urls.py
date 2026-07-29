from django.urls import path

from .views import DiseaseDetectView, DiseaseReportListView

app_name = "diseases"

urlpatterns = [
    path("diseases/detect", DiseaseDetectView.as_view(), name="disease-detect"),
    path("diseases/reports", DiseaseReportListView.as_view(), name="disease-reports"),
]
