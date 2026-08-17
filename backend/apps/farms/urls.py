from rest_framework.routers import DefaultRouter

from .views import CropViewSet, FarmViewSet, FieldViewSet, SensorNodeViewSet

app_name = "farms"

# trailing_slash=False so routes match the frontend's slash-less calls
# (POST /farms, not /farms/). With the default trailing slash, Django 301-redirects
# the write and the browser retries it as a GET, silently dropping every create.
router = DefaultRouter(trailing_slash=False)
router.register("farms", FarmViewSet, basename="farm")
router.register("fields", FieldViewSet, basename="field")
router.register("crops", CropViewSet, basename="crop")
router.register("sensor-nodes", SensorNodeViewSet, basename="sensor-node")

urlpatterns = router.urls
