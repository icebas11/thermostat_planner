"""Thermostat Planner : planning de chauffage avec modes Maison / Absent.

Une entrée de configuration par thermostat (zone). Le mode manuel
Maison / Absent est commun à toutes les zones ; chaque zone peut en plus être
forcée en Absent (« Zone absente ») ou par sa propre entité d'absence.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN, Platform
from homeassistant.core import Event, HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType
from homeassistant.util import dt as dt_util

from . import schedule
from .const import (
    CARD_URL,
    CONF_AWAY_ENTITY,
    CONF_AWAY_STATE,
    CONF_CLIMATE,
    CONF_EDITORS,
    CONF_RESTRICT_EDIT,
    DEFAULT_AWAY_STATE,
    DEFAULT_CLIMATE,
    DOMAIN,
    MAX_TEMP,
    MIN_TEMP,
    MODES,
    SIGNAL_UPDATE,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.SELECT, Platform.SENSOR, Platform.SWITCH]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

STORAGE_VERSION = 1


class Shared:
    """État commun à toutes les zones, dans hass.data[DOMAIN].

    `.storage/thermostat_planner.global` : {"manual_mode", "legacy_owner"}.
    `legacy_owner` est l'entrée qui a repris les fichiers de stockage d'avant
    le multi-thermostat ; aucune autre ne les reprendra.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.planners: dict[str, Planner] = {}
        self._store: Store = Store(hass, STORAGE_VERSION, f"{DOMAIN}.global")
        self.state: dict[str, Any] = {}
        # Sérialise les migrations : deux entrées chargées en même temps ne
        # peuvent pas reprendre les mêmes anciens fichiers.
        self.lock = asyncio.Lock()

    async def async_load(self) -> None:
        self.state = await self._store.async_load() or {}

    async def async_save(self) -> bool:
        """Enregistre et relit : True seulement si l'écriture a réussi."""
        await self._store.async_save(self.state)
        return await self._store.async_load() == self.state

    @property
    def manual_mode(self) -> str | None:
        mode = self.state.get("manual_mode")
        return mode if mode in MODES else None

    async def async_set_manual_mode(self, mode: str) -> None:
        """Change le mode commun et l'applique à toutes les zones."""
        if mode not in MODES:
            raise ValueError(f"mode inconnu : {mode}")
        self.state = {**self.state, "manual_mode": mode}
        await self.async_save()
        for planner in list(self.planners.values()):
            await planner.async_manual_mode_changed(mode)

    @callback
    def async_notify_all(self) -> None:
        """Republie toutes les zones (ex. nombre de zones changé)."""
        for planner in self.planners.values():
            planner.notify()

    def resolve(self, entry_id: str | None = None, climate: str | None = None) -> Planner:
        """Zone visée par une commande. Lève schedule.ResolveError."""
        key = schedule.resolve_entry(
            {key: planner.climate_entity for key, planner in self.planners.items()},
            entry_id,
            climate,
        )
        return self.planners[key]


def _shared(hass: HomeAssistant) -> Shared | None:
    return hass.data.get(DOMAIN)


class Planner:
    """Moteur d'une zone : stocke le planning et applique la consigne côté serveur."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, shared: Shared) -> None:
        self.hass = hass
        self.entry = entry
        self.shared = shared
        self.signal = f"{SIGNAL_UPDATE}_{entry.entry_id}"
        self._open_stores(legacy=False)
        self.data: dict[str, Any] = schedule.default_data()
        self._applied: dict[str, Any] | None = None
        self.override: dict[str, Any] | None = None
        # Dernier état publié aux entités et à la carte (voir _tick).
        self._published: tuple | None = None
        self._unsubs: list = []

    def _open_stores(self, legacy: bool) -> None:
        def key(kind: str) -> str:
            if legacy:
                return schedule.legacy_store_key(kind)
            return schedule.store_key(self.entry.entry_id, kind)

        self._store: Store = Store(self.hass, STORAGE_VERSION, key("data"))
        # Dernière plage appliquée, conservée au redémarrage pour ne pas écraser
        # un réglage manuel fait pendant cette plage.
        self._applied_store: Store = Store(self.hass, STORAGE_VERSION, key("applied"))
        # Dérogation temporaire : {"mode", "temp", "until"}, prioritaire sur le planning.
        self._override_store: Store = Store(self.hass, STORAGE_VERSION, key("override"))

    # -- options ---------------------------------------------------------
    @property
    def climate_entity(self) -> str:
        return self.entry.options.get(CONF_CLIMATE, DEFAULT_CLIMATE)

    @property
    def away_entity(self) -> str | None:
        return self.entry.options.get(CONF_AWAY_ENTITY) or None

    @property
    def away_state(self) -> str:
        return (self.entry.options.get(CONF_AWAY_STATE) or DEFAULT_AWAY_STATE).strip().lower()

    @property
    def zone_name(self) -> str:
        return self.entry.title

    def can_edit(self, user) -> bool:
        """Droit de modifier le planning : tout le monde, sauf restriction
        (administrateurs + utilisateurs choisis dans les options)."""
        if not self.entry.options.get(CONF_RESTRICT_EDIT):
            return True
        return user is not None and (user.is_admin or user.id in self.entry.options.get(CONF_EDITORS, []))

    # -- stockage et migration -------------------------------------------
    async def _async_migrate_legacy(self) -> None:
        """Reprend une seule fois les fichiers `.storage/thermostat_planner.*`
        d'avant le multi-thermostat.

        Rien n'est perdu : le propriétaire est d'abord enregistré (une autre
        entrée ne reprendra jamais ces fichiers), chaque fichier est copié sans
        écraser un fichier déjà présent, relu pour vérifier l'écriture, et les
        anciens fichiers ne sont supprimés qu'une fois tout vérifié. En cas
        d'échec, la zone utilise les anciens fichiers jusqu'au prochain
        démarrage, où la migration est retentée.
        """
        shared = self.shared
        entry_id = self.entry.entry_id
        async with shared.lock:
            legacy_ids = [
                entry.entry_id
                for entry in self.hass.config_entries.async_entries(DOMAIN)
                if entry.unique_id == DOMAIN
            ]
            if not schedule.may_claim_legacy(shared.state.get("legacy_owner"), entry_id, legacy_ids):
                return
            legacy_stores = {
                kind: Store(self.hass, STORAGE_VERSION, schedule.legacy_store_key(kind))
                for kind in schedule.STORE_KINDS
            }
            legacy = {kind: await store.async_load() for kind, store in legacy_stores.items()}
            if all(value is None for value in legacy.values()):
                return
            new_stores = {
                "data": self._store,
                "applied": self._applied_store,
                "override": self._override_store,
            }
            current = {kind: await store.async_load() for kind, store in new_stores.items()}

            if shared.state.get("legacy_owner") != entry_id:
                shared.state = {**shared.state, "legacy_owner": entry_id}
                if not await shared.async_save():
                    _LOGGER.error("Migration du stockage reportée : écriture impossible")
                    self._open_stores(legacy=True)
                    return
            ok = True
            for kind in schedule.legacy_copy_plan(legacy, current):
                await new_stores[kind].async_save(legacy[kind])
                if await new_stores[kind].async_load() != legacy[kind]:
                    ok = False
            if not ok:
                _LOGGER.error(
                    "Migration du stockage incomplète : anciens fichiers conservés et utilisés"
                )
                self._open_stores(legacy=True)
                return
            for store in legacy_stores.values():
                try:
                    await store.async_remove()
                except Exception:  # noqa: BLE001 - déjà repris, ne sera plus lu
                    _LOGGER.warning("Ancien fichier de stockage non supprimé", exc_info=True)
            _LOGGER.info("Stockage de Thermostat Planner migré vers l'entrée %s", entry_id)

    # -- cycle de vie ----------------------------------------------------
    async def async_start(self) -> None:
        await self._async_migrate_legacy()
        stored = await self._store.async_load()
        if stored:
            try:
                self.data = schedule.validate(stored)
            except vol.Invalid as err:
                _LOGGER.warning("Planning enregistré invalide, valeurs par défaut utilisées : %s", err)
        # Mode commun : repris de la première zone si aucun n'est encore enregistré.
        if self.shared.manual_mode is None:
            self.shared.state = {**self.shared.state, "manual_mode": self.data["manual_mode"]}
            await self.shared.async_save()
        self.data["manual_mode"] = self.shared.manual_mode
        self._applied = await self._applied_store.async_load()
        self.override = await self._override_store.async_load()
        self._unsubs.append(async_track_time_change(self.hass, self._tick, second=0))
        self._unsubs.append(
            async_track_state_change_event(self.hass, [self.climate_entity], self._climate_changed)
        )
        if self.away_entity:
            self._unsubs.append(
                async_track_state_change_event(self.hass, [self.away_entity], self._away_changed)
            )
        await self._async_apply()
        self._notify()

    @callback
    def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()

    # -- état calculé ----------------------------------------------------
    @property
    def forced_by_entity(self) -> bool:
        if not self.away_entity:
            return False
        state = self.hass.states.get(self.away_entity)
        return state is not None and state.state.strip().lower() == self.away_state

    @property
    def zone_away(self) -> bool:
        return bool(self.data.get("zone_away"))

    @property
    def effective_mode(self) -> str:
        return schedule.effective_mode(self.data["manual_mode"], self.forced_by_entity, self.zone_away)

    def planned(self) -> dict[str, Any]:
        """Consigne prévue et prochain changement (dérogation comprise)."""
        return schedule.planned(self.data, self.effective_mode, self.override, dt_util.now())

    def state_dict(self) -> dict[str, Any]:
        now = dt_util.now()
        mode = self.effective_mode
        following = schedule.next_change(self.data, mode, now)
        return {
            "data": self.data,
            "effective_mode": mode,
            "forced_by_entity": self.forced_by_entity,
            "zone_away": self.zone_away,
            "target": schedule.target_for(self.data, mode, now),
            "next_change": following.isoformat() if following else None,
            "override": self.override if schedule.override_active(self.override, mode, now) else None,
            "climate_entity": self.climate_entity,
            "away_entity": self.away_entity,
            "entry_id": self.entry.entry_id,
            "zone_name": self.zone_name,
            "zone_count": len(self.shared.planners),
        }

    # -- actions ---------------------------------------------------------
    async def _async_store_data(self, data: dict[str, Any]) -> None:
        self.data = schedule.validate(data)
        await self._store.async_save(self.data)
        await self._async_apply()
        self._notify()

    async def async_save(self, data: dict[str, Any]) -> None:
        """Enregistre le planning envoyé par la carte.

        Le mode commun et « Zone absente » ne changent que par leurs propres
        commandes : les valeurs envoyées (éventuellement périmées) sont ignorées.
        """
        await self._async_store_data(
            {**data, "manual_mode": self.data["manual_mode"], "zone_away": self.zone_away}
        )

    async def async_set_enabled(self, enabled: bool) -> None:
        """Active ou met en pause la planification (même chemin que la sauvegarde)."""
        await self._async_store_data({**self.data, "enabled": bool(enabled)})

    async def async_set_mode(self, mode: str) -> None:
        """Mode manuel commun : s'applique à toutes les zones."""
        await self.shared.async_set_manual_mode(mode)

    async def async_manual_mode_changed(self, mode: str) -> None:
        await self._async_store_data({**self.data, "manual_mode": mode})

    async def async_set_zone_away(self, away: bool) -> None:
        """Force (ou non) cette seule zone en Absent."""
        await self._async_store_data({**self.data, "zone_away": bool(away)})

    async def async_set_override(self, temperature: float, duration: timedelta | None = None) -> None:
        """Déroge au planning jusqu'à la prochaine plage, ou pendant `duration`."""
        now = dt_util.now()
        mode = self.effective_mode
        until = now + duration if duration else schedule.next_change(self.data, mode, now)
        if until is None:
            until = now + timedelta(days=1)
        await self._async_store_override(
            {"mode": mode, "temp": float(temperature), "until": until.isoformat()}
        )
        await self._async_apply()
        self._notify()

    async def async_clear_override(self) -> None:
        """Reprend le planning : la consigne de la plage en cours est renvoyée."""
        if self.override is None:
            return
        await self._async_store_override(None)
        await self._async_apply()
        self._notify()

    async def _async_store_override(self, override: dict[str, Any] | None) -> None:
        self.override = override
        if override is None:
            await self._override_store.async_remove()
        else:
            await self._override_store.async_save(override)

    @property
    def climate_available(self) -> bool:
        state = self.hass.states.get(self.climate_entity)
        return state is not None and state.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)

    async def _async_apply(self) -> None:
        """Envoie la consigne une fois par plage.

        Une plage déjà appliquée (même après un redémarrage) n'est pas renvoyée :
        un réglage manuel reste en place jusqu'à la plage suivante. Tant que le
        thermostat est indisponible, rien n'est envoyé ni mémorisé ;
        _climate_changed réessaie à son retour, le tick chaque minute sinon.

        Une dérogation en cours prime sur le planning, même planification en
        pause ; échue ou après un changement de mode, elle est effacée.
        """
        now = dt_util.now()
        mode = self.effective_mode
        if self.override is not None and not schedule.override_active(self.override, mode, now):
            await self._async_store_override(None)
        if self.override is not None:
            applied = {"mode": mode, "override": self.override["until"], "target": self.override["temp"]}
        elif not self.data["enabled"]:
            return
        else:
            applied = {
                "mode": mode,
                "start": schedule.block_start(self.data, mode, now).isoformat(),
                "target": schedule.target_for(self.data, mode, now),
            }
        if applied == self._applied or not self.climate_available:
            return
        _LOGGER.debug("Consigne %s -> %s", self.climate_entity, applied["target"])
        try:
            await self.hass.services.async_call(
                "climate",
                "set_temperature",
                {"entity_id": self.climate_entity, "temperature": applied["target"]},
                blocking=True,
            )
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Impossible de régler %s", self.climate_entity)
            return
        self._applied = applied
        await self._applied_store.async_save(applied)

    def _snapshot(self) -> tuple:
        """État vu par les entités et la carte (une partie dépend de l'heure)."""
        return self.state_dict(), self.planned()

    @callback
    def notify(self) -> None:
        self._notify()

    @callback
    def _notify(self) -> None:
        self._published = self._snapshot()
        async_dispatcher_send(self.hass, self.signal)

    async def _tick(self, _now) -> None:
        """Chaque minute : applique la consigne, puis prévient les entités et la
        carte si l'état publié a changé (nouvelle plage, dérogation échue, ou
        simple passage d'un segment, même planification en pause)."""
        before = (self._applied, self.override)
        await self._async_apply()
        if (self._applied, self.override) != before or self._snapshot() != self._published:
            self._notify()

    async def _away_changed(self, _event: Event) -> None:
        await self._async_apply()
        self._notify()

    async def _climate_changed(self, event: Event) -> None:
        """Au retour du thermostat, applique la plage si elle ne l'a pas encore été."""
        old = event.data.get("old_state")
        new = event.data.get("new_state")
        was_down = old is None or old.state in (STATE_UNAVAILABLE, STATE_UNKNOWN)
        is_up = new is not None and new.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)
        if was_down and is_up:
            await self._async_apply()


def _resolve(hass: HomeAssistant, entry_id: str | None, climate: str | None) -> Planner:
    """Zone visée (entry_id et/ou climate, ou l'unique zone). Lève schedule.ResolveError."""
    shared = _shared(hass)
    if shared is None:
        raise schedule.ResolveError("not_loaded", "Thermostat Planner n'est pas chargé")
    return shared.resolve(entry_id, climate)


def _state_for(planner: Planner, user) -> dict[str, Any]:
    """État envoyé à la carte, avec les droits de l'utilisateur connecté."""
    return {**planner.state_dict(), "can_edit": planner.can_edit(user)}


# -- WebSocket API ---------------------------------------------------------
# Toutes les commandes acceptent `entry_id` et/ou `climate` pour choisir la
# zone ; sans eux, l'unique zone (erreur `ambiguous` s'il y en a plusieurs).
_TARGET = {vol.Optional("entry_id"): str, vol.Optional("climate"): str}


def _ws_planner(hass, connection, msg) -> Planner | None:
    try:
        return _resolve(hass, msg.get("entry_id"), msg.get("climate"))
    except schedule.ResolveError as err:
        connection.send_error(msg["id"], err.code, str(err))
        return None


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get", **_TARGET})
@callback
def ws_get(hass, connection, msg) -> None:
    planner = _ws_planner(hass, connection, msg)
    if planner is not None:
        connection.send_result(msg["id"], _state_for(planner, connection.user))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe", **_TARGET})
@callback
def ws_subscribe(hass, connection, msg) -> None:
    planner = _ws_planner(hass, connection, msg)
    if planner is None:
        return
    entry_id = planner.entry.entry_id

    @callback
    def forward() -> None:
        # Relu à chaque fois : après un changement d'options, l'entrée est
        # rechargée et le moteur remplacé (même entry_id, même signal).
        shared = _shared(hass)
        current = shared.planners.get(entry_id) if shared else None
        if current is not None:
            connection.send_message(
                websocket_api.event_message(msg["id"], _state_for(current, connection.user))
            )

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, planner.signal, forward)
    connection.send_result(msg["id"])
    forward()


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/save", vol.Required("data"): dict, **_TARGET}
)
@websocket_api.async_response
async def ws_save(hass, connection, msg) -> None:
    planner = _ws_planner(hass, connection, msg)
    if planner is None:
        return
    if not planner.can_edit(connection.user):
        connection.send_error(
            msg["id"], websocket_api.ERR_UNAUTHORIZED, "Modification du planning non autorisée"
        )
        return
    try:
        await planner.async_save(msg["data"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/set_mode", vol.Required("mode"): vol.In(MODES), **_TARGET}
)
@websocket_api.async_response
async def ws_set_mode(hass, connection, msg) -> None:
    """Mode commun : la zone éventuellement indiquée est vérifiée, mais le
    changement s'applique à toutes les zones (pas d'erreur `ambiguous`)."""
    shared = _shared(hass)
    if msg.get("entry_id") or msg.get("climate") or shared is None or len(shared.planners) <= 1:
        if _ws_planner(hass, connection, msg) is None:
            return
    await shared.async_set_manual_mode(msg["mode"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_zone_away",
        vol.Required("away"): bool,
        **_TARGET,
    }
)
@websocket_api.async_response
async def ws_set_zone_away(hass, connection, msg) -> None:
    planner = _ws_planner(hass, connection, msg)
    if planner is None:
        return
    await planner.async_set_zone_away(msg["away"])
    connection.send_result(msg["id"])


_TEMPERATURE = vol.All(vol.Coerce(float), vol.Range(min=MIN_TEMP, max=MAX_TEMP))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_override",
        vol.Required("temperature"): _TEMPERATURE,
        vol.Optional("duration"): vol.All(int, vol.Range(min=1)),  # minutes
        **_TARGET,
    }
)
@websocket_api.async_response
async def ws_set_override(hass, connection, msg) -> None:
    planner = _ws_planner(hass, connection, msg)
    if planner is None:
        return
    duration = timedelta(minutes=msg["duration"]) if "duration" in msg else None
    await planner.async_set_override(msg["temperature"], duration)
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/clear_override", **_TARGET})
@websocket_api.async_response
async def ws_clear_override(hass, connection, msg) -> None:
    planner = _ws_planner(hass, connection, msg)
    if planner is None:
        return
    await planner.async_clear_override()
    connection.send_result(msg["id"])


# -- Installation ------------------------------------------------------------
def _resource_collection(hass: HomeAssistant):
    """Collection des ressources Lovelace en mode stockage, sinon None (mode YAML)."""
    lovelace = hass.data.get("lovelace")
    if lovelace is None:
        return None
    resources = getattr(lovelace, "resources", None)
    if resources is None and isinstance(lovelace, dict):
        resources = lovelace.get("resources")
    if resources is None or not hasattr(resources, "async_create_item"):
        return None
    return resources


async def _async_register_resource(hass: HomeAssistant, url: str) -> bool:
    """Déclare la carte comme ressource Lovelace (chargée par le dashboard lui-même).

    Plus fiable que add_extra_js_url, dont l'URL est figée dans l'index.html
    mis en cache par l'app mobile. Renvoie False si impossible (mode YAML).
    """
    resources = _resource_collection(hass)
    if resources is None:
        return False
    try:
        if not resources.loaded:
            await resources.async_load()
            resources.loaded = True
        for item in resources.async_items():
            if item["url"].split("?")[0] == CARD_URL:
                if item["url"] != url:
                    await resources.async_update_item(item["id"], {"res_type": "module", "url": url})
                return True
        await resources.async_create_item({"res_type": "module", "url": url})
        return True
    except Exception:  # noqa: BLE001 - repli sur add_extra_js_url
        _LOGGER.warning("Impossible d'enregistrer la ressource Lovelace %s", url, exc_info=True)
        return False


_SERVICE_TARGET = {vol.Optional("entry_id"): cv.string, vol.Optional("climate"): cv.entity_id}


def _service_planner(hass: HomeAssistant, call: ServiceCall) -> Planner:
    try:
        return _resolve(hass, call.data.get("entry_id"), call.data.get("climate"))
    except schedule.ResolveError as err:
        raise ServiceValidationError(str(err)) from err


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Enregistre la carte, l'API WebSocket et les services (une seule fois)."""
    shared = Shared(hass)
    await shared.async_load()
    hass.data[DOMAIN] = shared

    card_file = Path(__file__).parent / "www" / "thermostat-planner-card.js"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(card_file), False)]
    )
    if not await _async_register_resource(hass, f"{CARD_URL}?v={VERSION}"):
        add_extra_js_url(hass, f"{CARD_URL}?v={VERSION}")

    for command in (
        ws_get,
        ws_subscribe,
        ws_save,
        ws_set_mode,
        ws_set_zone_away,
        ws_set_override,
        ws_clear_override,
    ):
        websocket_api.async_register_command(hass, command)

    async def _handle_set_mode(call: ServiceCall) -> None:
        # Mode commun : la zone éventuellement indiquée est seulement vérifiée.
        if call.data.get("entry_id") or call.data.get("climate") or len(shared.planners) <= 1:
            _service_planner(hass, call)
        await shared.async_set_manual_mode(call.data["mode"])

    async def _handle_set_zone_away(call: ServiceCall) -> None:
        await _service_planner(hass, call).async_set_zone_away(call.data["away"])

    async def _handle_set_override(call: ServiceCall) -> None:
        planner = _service_planner(hass, call)
        await planner.async_set_override(call.data["temperature"], call.data.get("duration"))

    async def _handle_clear_override(call: ServiceCall) -> None:
        await _service_planner(hass, call).async_clear_override()

    hass.services.async_register(
        DOMAIN,
        "set_mode",
        _handle_set_mode,
        schema=vol.Schema({vol.Required("mode"): vol.In(MODES), **_SERVICE_TARGET}),
    )
    hass.services.async_register(
        DOMAIN,
        "set_zone_away",
        _handle_set_zone_away,
        schema=vol.Schema({vol.Required("away"): cv.boolean, **_SERVICE_TARGET}),
    )
    hass.services.async_register(
        DOMAIN,
        "set_override",
        _handle_set_override,
        schema=vol.Schema(
            {
                vol.Required("temperature"): _TEMPERATURE,
                vol.Optional("duration"): vol.All(cv.time_period, cv.positive_timedelta),
                **_SERVICE_TARGET,
            }
        ),
    )
    hass.services.async_register(
        DOMAIN, "clear_override", _handle_clear_override, schema=vol.Schema(_SERVICE_TARGET)
    )
    return True


@callback
def _async_sync_unique_id(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """unique_id de l'entrée = entité climate gérée (refus des doublons dans
    l'assistant). L'entrée d'avant le multi-thermostat (unique_id = DOMAIN)
    est convertie, après la migration de son stockage."""
    climate = entry.options.get(CONF_CLIMATE, DEFAULT_CLIMATE)
    if entry.unique_id == climate:
        return
    taken = any(
        other.unique_id == climate
        for other in hass.config_entries.async_entries(DOMAIN)
        if other.entry_id != entry.entry_id
    )
    if not taken:
        hass.config_entries.async_update_entry(entry, unique_id=climate)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    shared: Shared = hass.data[DOMAIN]
    planner = Planner(hass, entry, shared)
    shared.planners[entry.entry_id] = planner
    try:
        await planner.async_start()
    except Exception:
        shared.planners.pop(entry.entry_id, None)
        planner.async_stop()
        raise
    _async_sync_unique_id(hass, entry)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    shared.async_notify_all()
    return True


async def _async_reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Supprime le stockage de la zone ; retire la ressource Lovelace avec la
    dernière zone."""
    for kind in schedule.STORE_KINDS:
        await Store(hass, STORAGE_VERSION, schedule.store_key(entry.entry_id, kind)).async_remove()
    others = [e for e in hass.config_entries.async_entries(DOMAIN) if e.entry_id != entry.entry_id]
    if others:
        return
    resources = _resource_collection(hass)
    if resources is None or not resources.loaded:
        return
    for item in list(resources.async_items()):
        if item["url"].split("?")[0] == CARD_URL:
            await resources.async_delete_item(item["id"])


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        shared: Shared = hass.data[DOMAIN]
        planner = shared.planners.pop(entry.entry_id)
        planner.async_stop()
        shared.async_notify_all()
    return unloaded
