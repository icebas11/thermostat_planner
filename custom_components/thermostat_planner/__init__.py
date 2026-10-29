"""Thermostat Planner : planning de chauffage avec modes Maison / Absent."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import Event, HomeAssistant, ServiceCall, callback
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
    DEFAULT_AWAY_STATE,
    DEFAULT_CLIMATE,
    DOMAIN,
    MODES,
    SIGNAL_UPDATE,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.SENSOR]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

STORAGE_VERSION = 1


class Planner:
    """Moteur : stocke le planning et applique la consigne côté serveur."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self._store: Store = Store(hass, STORAGE_VERSION, f"{DOMAIN}.data")
        self.data: dict[str, Any] = schedule.default_data()
        self._last_target: float | None = None
        self._unsubs: list = []

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

    # -- cycle de vie ----------------------------------------------------
    async def async_start(self) -> None:
        stored = await self._store.async_load()
        if stored:
            try:
                self.data = schedule.validate(stored)
            except vol.Invalid as err:
                _LOGGER.warning("Planning enregistré invalide, valeurs par défaut utilisées : %s", err)
        self._unsubs.append(async_track_time_change(self.hass, self._tick, second=0))
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
    def effective_mode(self) -> str:
        if self.forced_by_entity:
            return "away"
        return self.data["manual_mode"]

    def state_dict(self) -> dict[str, Any]:
        now = dt_util.now()
        mode = self.effective_mode
        following = schedule.next_change(self.data, mode, now)
        return {
            "data": self.data,
            "effective_mode": mode,
            "forced_by_entity": self.forced_by_entity,
            "target": schedule.target_for(self.data, mode, now),
            "next_change": following.isoformat() if following else None,
            "climate_entity": self.climate_entity,
            "away_entity": self.away_entity,
        }

    # -- actions ---------------------------------------------------------
    async def async_save(self, data: dict[str, Any]) -> None:
        self.data = schedule.validate(data)
        await self._store.async_save(self.data)
        await self._async_apply()
        self._notify()

    async def async_set_mode(self, mode: str) -> None:
        if mode not in MODES:
            raise ValueError(f"mode inconnu : {mode}")
        data = {**self.data, "manual_mode": mode}
        await self.async_save(data)

    async def _async_apply(self) -> None:
        """Envoie la consigne au thermostat si elle a changé."""
        if not self.data["enabled"]:
            return
        target = schedule.target_for(self.data, self.effective_mode, dt_util.now())
        if target == self._last_target:
            return
        self._last_target = target
        _LOGGER.debug("Consigne %s -> %s", self.climate_entity, target)
        try:
            await self.hass.services.async_call(
                "climate",
                "set_temperature",
                {"entity_id": self.climate_entity, "temperature": target},
                blocking=False,
            )
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Impossible de régler %s", self.climate_entity)

    @callback
    def _notify(self) -> None:
        async_dispatcher_send(self.hass, SIGNAL_UPDATE)

    async def _tick(self, _now) -> None:
        before = self._last_target
        await self._async_apply()
        if self._last_target != before:
            self._notify()

    async def _away_changed(self, _event: Event) -> None:
        await self._async_apply()
        self._notify()


def _planner(hass: HomeAssistant) -> Planner | None:
    planners = hass.data.get(DOMAIN, {})
    return next(iter(planners.values()), None)


# -- WebSocket API ---------------------------------------------------------
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get"})
@callback
def ws_get(hass, connection, msg) -> None:
    planner = _planner(hass)
    if planner is None:
        connection.send_error(msg["id"], "not_loaded", "Thermostat Planner n'est pas chargé")
        return
    connection.send_result(msg["id"], planner.state_dict())


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(hass, connection, msg) -> None:
    planner = _planner(hass)
    if planner is None:
        connection.send_error(msg["id"], "not_loaded", "Thermostat Planner n'est pas chargé")
        return

    @callback
    def forward() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], planner.state_dict()))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_UPDATE, forward)
    connection.send_result(msg["id"])
    forward()


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/save", vol.Required("data"): dict}
)
@websocket_api.async_response
async def ws_save(hass, connection, msg) -> None:
    planner = _planner(hass)
    if planner is None:
        connection.send_error(msg["id"], "not_loaded", "Thermostat Planner n'est pas chargé")
        return
    try:
        await planner.async_save(msg["data"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/set_mode", vol.Required("mode"): vol.In(MODES)}
)
@websocket_api.async_response
async def ws_set_mode(hass, connection, msg) -> None:
    planner = _planner(hass)
    if planner is None:
        connection.send_error(msg["id"], "not_loaded", "Thermostat Planner n'est pas chargé")
        return
    await planner.async_set_mode(msg["mode"])
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


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Enregistre la carte, l'API WebSocket et le service (une seule fois)."""
    hass.data.setdefault(DOMAIN, {})

    card_file = Path(__file__).parent / "www" / "thermostat-planner-card.js"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(card_file), False)]
    )
    if not await _async_register_resource(hass, f"{CARD_URL}?v={VERSION}"):
        add_extra_js_url(hass, f"{CARD_URL}?v={VERSION}")

    for command in (ws_get, ws_subscribe, ws_save, ws_set_mode):
        websocket_api.async_register_command(hass, command)

    async def _handle_set_mode(call: ServiceCall) -> None:
        planner = _planner(hass)
        if planner is not None:
            await planner.async_set_mode(call.data["mode"])

    hass.services.async_register(
        DOMAIN,
        "set_mode",
        _handle_set_mode,
        schema=vol.Schema({vol.Required("mode"): vol.In(MODES)}),
    )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    planner = Planner(hass, entry)
    hass.data[DOMAIN][entry.entry_id] = planner
    await planner.async_start()
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    return True


async def _async_reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Retire la ressource Lovelace quand l'intégration est supprimée."""
    resources = _resource_collection(hass)
    if resources is None or not resources.loaded:
        return
    for item in list(resources.async_items()):
        if item["url"].split("?")[0] == CARD_URL:
            await resources.async_delete_item(item["id"])


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        planner: Planner = hass.data[DOMAIN].pop(entry.entry_id)
        planner.async_stop()
    return unloaded
