"""Admin-scoped management routes, mounted under /api/v1/admin-api/.

Aggregates admin CRUD for users, sensor-nodes, and knowledge documents.
"""
from rest_framework.routers import DefaultRouter

from apps.assistant.views import DocumentViewSet
from apps.farms.views import SensorNodeViewSet

from .views import UserAdminViewSet

app_name = "admin_api"

router = DefaultRouter(trailing_slash=False)
router.register("users", UserAdminViewSet, basename="admin-users")
router.register("sensor-nodes", SensorNodeViewSet, basename="admin-sensor-nodes")
router.register("documents", DocumentViewSet, basename="admin-documents")

urlpatterns = router.urls
