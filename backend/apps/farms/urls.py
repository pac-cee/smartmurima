from rest_framework.routers import DefaultRouter

from .views import CropViewSet, FarmViewSet, FieldViewSet, SensorNodeViewSet

app_name = "farms"

router = DefaultRouter()
router.register("farms", FarmViewSet, basename="farm")
router.register("fields", FieldViewSet, basename="field")
router.register("crops", CropViewSet, basename="crop")
router.register("sensor-nodes", SensorNodeViewSet, basename="sensor-node")

urlpatterns = router.urls
