"""Generic repository base class.

Repositories are the ONLY layer permitted to touch the Django ORM / querysets.
Services depend on repositories, never on models directly. This keeps business
logic testable and the persistence concern swappable.
"""
from __future__ import annotations

from typing import Generic, Iterable, Optional, TypeVar

from django.db.models import Model, QuerySet

M = TypeVar("M", bound=Model)


class BaseRepository(Generic[M]):
    """Generic CRUD operations over a single Django model.

    Subclass and set ``model``, or pass it to ``__init__``. Add domain-specific
    query methods (``list_for_user``, ``filter_by_field`` ...) on subclasses.
    """

    model: type[M]

    def __init__(self, model: Optional[type[M]] = None) -> None:
        if model is not None:
            self.model = model
        if getattr(self, "model", None) is None:
            raise ValueError("Repository requires a `model` attribute.")

    # -- read -------------------------------------------------------------
    def get_queryset(self) -> QuerySet[M]:
        return self.model.objects.all()

    def all(self) -> QuerySet[M]:
        return self.get_queryset()

    def get_by_id(self, pk) -> Optional[M]:
        return self.get_queryset().filter(pk=pk).first()

    def get_or_none(self, **filters) -> Optional[M]:
        return self.get_queryset().filter(**filters).first()

    def filter(self, **filters) -> QuerySet[M]:
        return self.get_queryset().filter(**filters)

    def exists(self, **filters) -> bool:
        return self.get_queryset().filter(**filters).exists()

    def count(self, **filters) -> int:
        return self.get_queryset().filter(**filters).count()

    # -- write ------------------------------------------------------------
    def create(self, **data) -> M:
        return self.model.objects.create(**data)

    def bulk_create(self, objects: Iterable[M]) -> list[M]:
        return list(self.model.objects.bulk_create(list(objects)))

    def update(self, instance: M, **data) -> M:
        for field, value in data.items():
            setattr(instance, field, value)
        instance.save(update_fields=list(data.keys()) or None)
        return instance

    def delete(self, instance: M) -> None:
        instance.delete()

    def get_or_create(self, defaults: Optional[dict] = None, **filters):
        return self.model.objects.get_or_create(defaults=defaults or {}, **filters)
