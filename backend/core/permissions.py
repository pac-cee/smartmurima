"""Role-based and object-level DRF permissions.

Roles: farmer | coop_admin | extension | admin.
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission


class _RolePermission(BasePermission):
    role: str = ""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == self.role)


class IsFarmer(_RolePermission):
    role = "farmer"


class IsCoopAdmin(_RolePermission):
    role = "coop_admin"


class IsExtension(_RolePermission):
    role = "extension"


class IsAdmin(BasePermission):
    """Platform administrator (role=admin OR Django superuser)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.role == "admin" or user.is_superuser)
        )


class IsAdminOrExtension(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.role in ("admin", "extension") or user.is_superuser)
        )


class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS


class IsOwnerOrCoop(BasePermission):
    """Object-level: the owning farmer, their cooperative admin, extension
    officers, or platform admins may access a resource.

    The object is expected to expose an ``owner_user`` attribute/property (or a
    ``get_owner_user()`` method) resolving to the ``User`` that owns it.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser or user.role in ("admin", "extension", "coop_admin"):
            return True
        owner = _resolve_owner(obj)
        return owner is not None and owner == user


class IsNodeOwnerOrUnclaimed(IsOwnerOrCoop):
    """Object access for field devices.

    Same rule as ``IsOwnerOrCoop``, except a device that nobody has claimed yet
    (``field is None``) is reachable by any authenticated user -- that is how a
    farmer pairs a brand-new board they just powered on.
    """

    def has_object_permission(self, request, view, obj):
        if getattr(obj, "field_id", "unset") is None:
            return True
        return super().has_object_permission(request, view, obj)


def _resolve_owner(obj):
    if hasattr(obj, "get_owner_user"):
        try:
            return obj.get_owner_user()
        except Exception:  # pragma: no cover - defensive
            return None
    return getattr(obj, "owner_user", None)
