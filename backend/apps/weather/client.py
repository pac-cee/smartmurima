"""External weather API client with a deterministic offline fallback.

Fallback contract (documented for UC-29 E1):

* When ``WEATHER_API_URL`` is configured the client performs a live HTTP call
  and returns ``(items, "live")``.
* When the URL is unset, unreachable, times out, or returns an unparseable
  payload, the client never raises: it returns a synthetic, physically neutral
  outlook tagged ``(items, "neutral")``. Each neutral item carries
  ``raw={"source": "neutral"}`` so downstream layers can tell real forecasts
  from estimates and decide whether to prefer the last-known-good record.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional

from django.conf import settings

logger = logging.getLogger("smartmurima")

LIVE = "live"
NEUTRAL = "neutral"


class WeatherClient:
    def __init__(self, api_url: Optional[str] = None, api_key: Optional[str] = None):
        self.api_url = api_url if api_url is not None else settings.WEATHER_API_URL
        self.api_key = api_key if api_key is not None else settings.WEATHER_API_KEY

    def fetch(self, latitude, longitude, days: int = 5) -> tuple[list[dict], str]:
        """Return ``(forecast_items, source)`` where source is ``live`` or
        ``neutral``. Never raises."""
        if self.api_url:
            try:
                import requests

                resp = requests.get(
                    self.api_url,
                    params={
                        "lat": latitude,
                        "lon": longitude,
                        "days": days,
                        "appid": self.api_key,
                    },
                    timeout=10,
                )
                resp.raise_for_status()
                parsed = self._parse(resp.json(), days)
                if parsed:
                    return parsed, LIVE
                logger.warning("Weather API returned no usable items; using fallback.")
            except Exception as exc:
                logger.warning("Weather API failed (%s); using fallback.", exc)
        return self._fallback(days), NEUTRAL

    def forecast(self, latitude, longitude, days: int = 5) -> list[dict]:
        """Back-compat convenience: items only, source discarded."""
        items, _ = self.fetch(latitude, longitude, days)
        return items

    def _parse(self, payload: dict, days: int) -> list[dict]:
        # Generic best-effort parse; providers differ. Return [] if unexpected
        # so the caller falls back and reports the correct source.
        items = payload.get("list") or payload.get("daily") or []
        out = []
        today = date.today()
        for i, item in enumerate(items[:days]):
            out.append(
                {
                    "forecast_date": (today + timedelta(days=i)).isoformat(),
                    "temperature_min": item.get("temp_min"),
                    "temperature_max": item.get("temp_max"),
                    "humidity": item.get("humidity"),
                    "rainfall_mm": item.get("rain", 0),
                    "summary": item.get("weather", ""),
                    "raw": item,
                }
            )
        return out

    def _fallback(self, days: int) -> list[dict]:
        today = date.today()
        out = []
        for i in range(days):
            out.append(
                {
                    "forecast_date": (today + timedelta(days=i)).isoformat(),
                    "temperature_min": 16.0 + (i % 3),
                    "temperature_max": 27.0 + (i % 4),
                    "humidity": 65.0,
                    "rainfall_mm": 2.0 * (i % 3),
                    "summary": "Partly cloudy (estimated)",
                    "raw": {"source": "neutral"},
                }
            )
        return out
