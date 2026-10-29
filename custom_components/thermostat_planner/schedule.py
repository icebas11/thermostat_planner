"""Logique de planification (sans dépendance à Home Assistant).

Modèle de données
-----------------
Une journée est une liste de segments ordonnés, chacun valable jusqu'au début
du suivant (le dernier va jusqu'à 24:00) :

    [{"start": "00:00", "temp": 18}, {"start": "06:30", "temp": 21}, ...]

Le premier segment commence toujours à 00:00, ce qui garantit que la journée
est entièrement couverte.
"""
from __future__ import annotations

import copy
from datetime import datetime, timedelta
from typing import Any

import voluptuous as vol

from .const import (
    DAY_KEYS,
    LAYOUTS,
    MAX_TEMP,
    MIN_TEMP,
    MODES,
    SCHEDULE_KEYS,
)

_TIME_RE = r"^([01]\d|2[0-3]):[0-5]\d$"


def to_minutes(value: str) -> int:
    hours, minutes = value.split(":")
    return int(hours) * 60 + int(minutes)


def _segments(value: Any) -> list[dict[str, Any]]:
    """Valide une liste de segments."""
    segment = vol.Schema(
        {
            vol.Required("start"): vol.All(str, vol.Match(_TIME_RE)),
            vol.Required("temp"): vol.All(
                vol.Coerce(float), vol.Range(min=MIN_TEMP, max=MAX_TEMP)
            ),
        }
    )
    segments = vol.All(list, [segment])(value)
    if not segments:
        raise vol.Invalid("au moins un segment est requis")
    if segments[0]["start"] != "00:00":
        raise vol.Invalid("le premier segment doit commencer à 00:00")
    previous = -1
    for item in segments:
        current = to_minutes(item["start"])
        if current <= previous:
            raise vol.Invalid("les segments doivent être triés et sans doublon")
        previous = current
        item["temp"] = round(item["temp"] * 2) / 2  # pas de 0,5 °C
    return segments


_PROFILE = vol.Schema(
    {
        vol.Required("layout"): vol.In(LAYOUTS),
        vol.Required("schedules"): {vol.Required(key): _segments for key in SCHEDULE_KEYS},
    }
)

DATA_SCHEMA = vol.Schema(
    {
        vol.Required("manual_mode"): vol.In(MODES),
        vol.Required("enabled"): bool,
        vol.Required("profiles"): {
            vol.Required("home"): _PROFILE,
            vol.Required("away"): _PROFILE,
        },
    }
)


def validate(data: Any) -> dict[str, Any]:
    """Valide et normalise les données complètes. Lève vol.Invalid."""
    return DATA_SCHEMA(data)


def _seg(*pairs: tuple[str, float]) -> list[dict[str, Any]]:
    return [{"start": start, "temp": temp} for start, temp in pairs]


def default_data() -> dict[str, Any]:
    """Planning par défaut : semaine / week-end, mode absent à 16 °C."""
    weekdays = _seg(
        ("00:00", 18), ("06:30", 21), ("08:00", 18), ("17:30", 21), ("23:00", 18)
    )
    weekend = _seg(("00:00", 18), ("08:00", 21), ("23:00", 18))
    home = {"layout": "weekday_weekend", "schedules": {"all": weekdays, "weekdays": weekdays, "weekend": weekend}}
    for index, key in enumerate(DAY_KEYS):
        home["schedules"][key] = weekdays if index < 5 else weekend
    away = {"layout": "all", "schedules": {key: _seg(("00:00", 16)) for key in SCHEDULE_KEYS}}
    return copy.deepcopy(
        {
            "manual_mode": "home",
            "enabled": True,
            "profiles": {"home": home, "away": away},
        }
    )


def schedule_key(layout: str, weekday: int) -> str:
    """Clé du planning à utiliser pour un jour (0 = lundi)."""
    if layout == "all":
        return "all"
    if layout == "weekday_weekend":
        return "weekdays" if weekday < 5 else "weekend"
    return DAY_KEYS[weekday]


def target_for(data: dict[str, Any], mode: str, now: datetime) -> float:
    """Consigne prévue à l'instant `now` pour le mode donné."""
    profile = data["profiles"][mode]
    segments = profile["schedules"][schedule_key(profile["layout"], now.weekday())]
    minutes = now.hour * 60 + now.minute
    target = segments[0]["temp"]
    for item in segments:
        if to_minutes(item["start"]) <= minutes:
            target = item["temp"]
        else:
            break
    return float(target)


def block_start(data: dict[str, Any], mode: str, now: datetime) -> datetime:
    """Début de la plage en cours.

    Les segments consécutifs de même consigne (y compris d'un jour sur l'autre,
    ex. 23:00 → 00:00 à 18 °C) forment une seule plage. Remonte jusqu'à 7 jours.
    """
    profile = data["profiles"][mode]
    target = target_for(data, mode, now)
    minutes = now.hour * 60 + now.minute
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start = midnight
    for offset in range(8):
        day = midnight - timedelta(days=offset)
        segments = profile["schedules"][schedule_key(profile["layout"], day.weekday())]
        for item in reversed(segments):
            begin = to_minutes(item["start"])
            if offset == 0 and begin > minutes:
                continue
            if float(item["temp"]) != target:
                return start
            start = day + timedelta(minutes=begin)
    return start


def override_active(override: dict[str, Any] | None, mode: str, now: datetime) -> bool:
    """Vrai si la dérogation s'applique encore : même mode et pas encore échue."""
    if not override or override.get("mode") != mode:
        return False
    try:
        return now < datetime.fromisoformat(override["until"])
    except (KeyError, TypeError, ValueError):
        return False


def next_change(data: dict[str, Any], mode: str, now: datetime) -> datetime | None:
    """Prochain début de plage (jusqu'à 7 jours), ou None."""
    profile = data["profiles"][mode]
    minutes = now.hour * 60 + now.minute
    for offset in range(8):
        day = now + timedelta(days=offset)
        segments = profile["schedules"][schedule_key(profile["layout"], day.weekday())]
        for item in segments:
            start = to_minutes(item["start"])
            if offset == 0 and start <= minutes:
                continue
            return day.replace(
                hour=start // 60, minute=start % 60, second=0, microsecond=0
            )
    return None
