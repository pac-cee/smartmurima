from django.urls import path

from .views import ReportExportView, ReportSummaryView

app_name = "reports"

urlpatterns = [
    path("summary", ReportSummaryView.as_view(), name="summary"),
    path("export", ReportExportView.as_view(), name="export"),
]
