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
    DOMAIN,
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
        # Zone forcée en Absent, quel que soit le mode commun (multi-thermostat).
        vol.Optional("zone_away", default=False): bool,
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
            "zone_away": False,
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


def next_block(
    data: dict[str, Any], mode: str, now: datetime
) -> tuple[datetime, float] | None:
    """Prochain changement effectif de consigne : (début, température), ou None.

    Comme `block_start`, les segments consécutifs de même consigne ne comptent
    pas : on enchaîne `next_change` jusqu'à une température différente, sur
    8 jours au plus.
    """
    current = target_for(data, mode, now)
    limit = now + timedelta(days=8)
    when = next_change(data, mode, now)
    while when is not None and when <= limit:
        temp = target_for(data, mode, when)
        if temp != current:
            return when, temp
        when = next_change(data, mode, when)
    return None


def planned(
    data: dict[str, Any], mode: str, override: dict[str, Any] | None, now: datetime
) -> dict[str, Any]:
    """Consigne prévue maintenant et prochain changement, pour les entités.

    - `target` : consigne de la dérogation en cours, sinon celle du planning
      (même planification en pause : c'est la consigne *prévue*) ;
    - `source` : "override" ou "schedule" ;
    - `next_change` / `next_target` : prochain changement de consigne. Pendant
      une dérogation, c'est sa fin (puis la consigne du planning à cet instant,
      ou None si la planification est en pause : rien ne sera renvoyé).
      Planification en pause sans dérogation : None (aucun changement prévu).
    """
    if override_active(override, mode, now):
        until = datetime.fromisoformat(override["until"])
        return {
            "target": float(override["temp"]),
            "source": "override",
            "next_change": until,
            "next_target": target_for(data, mode, until) if data["enabled"] else None,
        }
    following = next_block(data, mode, now) if data["enabled"] else None
    return {
        "target": target_for(data, mode, now),
        "source": "schedule",
        "next_change": following[0] if following else None,
        "next_target": following[1] if following else None,
    }


# -- Plusieurs thermostats (une entrée de configuration par zone) ------------
def effective_mode(manual_mode: str, forced_by_entity: bool, zone_away: bool) -> str:
    """Mode effectif d'une zone.

    Absent si le mode manuel commun est Absent, si l'entité d'absence de la
    zone est dans l'état d'absence, ou si la zone est marquée « Zone absente ».
    Une zone n'est donc jamais Maison quand le mode commun est Absent.
    """
    if manual_mode == "away" or forced_by_entity or zone_away:
        return "away"
    return manual_mode


class ResolveError(Exception):
    """Zone introuvable ou ambiguë. `code` sert de code d'erreur WebSocket."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def resolve_entry(
    entries: dict[str, str], entry_id: str | None = None, climate: str | None = None
) -> str:
    """Choisit l'entrée visée par une commande.

    `entries` : entry_id -> entité climate. `entry_id` et/ou `climate`
    désignent la zone ; sans l'un ni l'autre, l'unique entrée est choisie.
    Lève ResolveError : `not_loaded` (aucune entrée), `not_found` (zone
    inconnue, ou entry_id et climate qui ne désignent pas la même zone),
    `ambiguous` (plusieurs entrées et aucun paramètre).
    """
    if not entries:
        raise ResolveError("not_loaded", "Thermostat Planner n'est pas chargé")
    if entry_id:
        if entry_id not in entries:
            raise ResolveError("not_found", f"Aucune zone Thermostat Planner pour entry_id {entry_id}")
        if climate and entries[entry_id] != climate:
            raise ResolveError(
                "not_found", f"L'entrée {entry_id} ne gère pas {climate} (elle gère {entries[entry_id]})"
            )
        return entry_id
    if climate:
        for key, entity in entries.items():
            if entity == climate:
                return key
        raise ResolveError("not_found", f"Aucune zone Thermostat Planner pour {climate}")
    if len(entries) > 1:
        raise ResolveError(
            "ambiguous",
            "Plusieurs thermostats sont configurés : précise entry_id ou climate "
            f"(thermostats : {', '.join(sorted(entries.values()))})",
        )
    return next(iter(entries))


STORE_KINDS = ("data", "applied", "override")


def legacy_store_key(kind: str) -> str:
    """Fichier de stockage de la v0.4 et avant (un seul thermostat)."""
    return f"{DOMAIN}.{kind}"


def store_key(entry_id: str, kind: str) -> str:
    """Fichier de stockage propre à une entrée : thermostat_planner.<entry_id>.<kind>."""
    return f"{DOMAIN}.{entry_id}.{kind}"


def may_claim_legacy(owner: str | None, entry_id: str, legacy_entry_ids: list[str]) -> bool:
    """Cette entrée peut-elle reprendre les anciens fichiers de stockage ?

    - un propriétaire est déjà enregistré (`owner`) : lui seul, ce qui rend
      la migration rejouable après une interruption sans qu'une autre entrée
      ne reprenne les mêmes données ;
    - sinon, une entrée créée avant le multi-thermostat (`legacy_entry_ids`,
      unique_id historique) est prioritaire ;
    - sinon, la première entrée chargée.
    """
    if owner:
        return owner == entry_id
    if legacy_entry_ids:
        return entry_id in legacy_entry_ids
    return True


def legacy_copy_plan(legacy: dict[str, Any], current: dict[str, Any]) -> list[str]:
    """Fichiers à copier : présents dans l'ancien stockage, absents du nouveau.

    Un fichier déjà présent dans le nouveau stockage n'est jamais écrasé
    (il peut avoir été modifié depuis une migration interrompue).
    """
    return [
        kind
        for kind in STORE_KINDS
        if legacy.get(kind) is not None and current.get(kind) is None
    ]
