"""Thermostat Planner : planning de chauffage avec modes Maison / Absent."""
from __future__ import annotations

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

PLATFORMS = [Platform.SENSOR]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

STORAGE_VERSION = 1


class Planner:
    """Moteur : stocke le planning et applique la consigne côté serveur."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self._store: Store = Store(hass, STORAGE_VERSION, f"{DOMAIN}.data")
        # Dernière plage appliquée, conservée au redémarrage pour ne pas écraser
        # un réglage manuel fait pendant cette plage.
        self._applied_store: Store = Store(hass, STORAGE_VERSION, f"{DOMAIN}.applied")
        # Dérogation temporaire : {"mode", "temp", "until"}, prioritaire sur le planning.
        self._override_store: Store = Store(hass, STORAGE_VERSION, f"{DOMAIN}.override")
        self.data: dict[str, Any] = schedule.default_data()
        self._applied: dict[str, Any] | None = None
        self.override: dict[str, Any] | None = None
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

    def can_edit(self, user) -> bool:
        """Droit de modifier le planning : tout le monde, sauf restriction
        (administrateurs + utilisateurs choisis dans les options)."""
        if not self.entry.options.get(CONF_RESTRICT_EDIT):
            return True
        return user is not None and (user.is_admin or user.id in self.entry.options.get(CONF_EDITORS, []))

    # -- cycle de vie ----------------------------------------------------
    async def async_start(self) -> None:
        stored = await self._store.async_load()
        if stored:
            try:
                self.data = schedule.validate(stored)
            except vol.Invalid as err:
                _LOGGER.warning("Planning enregistré invalide, valeurs par défaut utilisées : %s", err)
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
            "override": self.override if schedule.override_active(self.override, mode, now) else None,
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

    @callback
    def _notify(self) -> None:
        async_dispatcher_send(self.hass, SIGNAL_UPDATE)

    async def _tick(self, _now) -> None:
        before = (self._applied, self.override)
        await self._async_apply()
        if (self._applied, self.override) != before:
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


def _planner(hass: HomeAssistant) -> Planner | None:
    planners = hass.data.get(DOMAIN, {})
    return next(iter(planners.values()), None)


def _state_for(planner: Planner, user) -> dict[str, Any]:
    """État envoyé à la carte, avec les droits de l'utilisateur connecté."""
    return {**planner.state_dict(), "can_edit": planner.can_edit(user)}


# -- WebSocket API ---------------------------------------------------------
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get"})
@callback
def ws_get(hass, connection, msg) -> None:
    planner = _planner(hass)
    if planner is None:
        connection.send_error(msg["id"], "not_loaded", "Thermostat Planner n'est pas chargé")
        return
    connection.send_result(msg["id"], _state_for(planner, connection.user))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(hass, connection, msg) -> None:
    if _planner(hass) is None:
        connection.send_error(msg["id"], "not_loaded", "Thermostat Planner n'est pas chargé")
        return

    @callback
    def forward() -> None:
        # Relu à chaque fois : après un changement d'options, l'entrée est
        # rechargée et le moteur remplacé.
        planner = _planner(hass)
        if planner is not None:
            connection.send_message(
                websocket_api.event_message(msg["id"], _state_for(planner, connection.user))
            )

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_UPDATE, forward)
    connection.send_result(msg["id"])
    forward()


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/save", vol.Required("data"): dict}
)
@websocket_api.async_response
async def ws_save(hass, connection, msg) -> None:
    planner = _planner(hass)
    if planner is None:
        connection.send_error(msg["id"], "not_loaded", "Thermostat Planner n'est pas chargé")
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


_TEMPERATURE = vol.All(vol.Coerce(float), vol.Range(min=MIN_TEMP, max=MAX_TEMP))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_override",
        vol.Required("temperature"): _TEMPERATURE,
        vol.Optional("duration"): vol.All(int, vol.Range(min=1)),  # minutes
    }
)
@websocket_api.async_response
async def ws_set_override(hass, connection, msg) -> None:
    planner = _planner(hass)
    if planner is None:
        connection.send_error(msg["id"], "not_loaded", "Thermostat Planner n'est pas chargé")
        return
    duration = timedelta(minutes=msg["duration"]) if "duration" in msg else None
    await planner.async_set_override(msg["temperature"], duration)
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/clear_override"})
@websocket_api.async_response
async def ws_clear_override(hass, connection, msg) -> None:
    planner = _planner(hass)
    if planner is None:
        connection.send_error(msg["id"], "not_loaded", "Thermostat Planner n'est pas chargé")
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


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Enregistre la carte, l'API WebSocket et le service (une seule fois)."""
    hass.data.setdefault(DOMAIN, {})

    card_file = Path(__file__).parent / "www" / "thermostat-planner-card.js"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(card_file), False)]
    )
    if not await _async_register_resource(hass, f"{CARD_URL}?v={VERSION}"):
        add_extra_js_url(hass, f"{CARD_URL}?v={VERSION}")

    for command in (ws_get, ws_subscribe, ws_save, ws_set_mode, ws_set_override, ws_clear_override):
        websocket_api.async_register_command(hass, command)

    async def _handle_set_mode(call: ServiceCall) -> None:
        planner = _planner(hass)
        if planner is not None:
            await planner.async_set_mode(call.data["mode"])

    async def _handle_set_override(call: ServiceCall) -> None:
        planner = _planner(hass)
        if planner is not None:
            await planner.async_set_override(call.data["temperature"], call.data.get("duration"))

    async def _handle_clear_override(call: ServiceCall) -> None:
        planner = _planner(hass)
        if planner is not None:
            await planner.async_clear_override()

    hass.services.async_register(
        DOMAIN,
        "set_mode",
        _handle_set_mode,
        schema=vol.Schema({vol.Required("mode"): vol.In(MODES)}),
    )
    hass.services.async_register(
        DOMAIN,
        "set_override",
        _handle_set_override,
        schema=vol.Schema(
            {
                vol.Required("temperature"): _TEMPERATURE,
                vol.Optional("duration"): vol.All(cv.time_period, cv.positive_timedelta),
            }
        ),
    )
    hass.services.async_register(DOMAIN, "clear_override", _handle_clear_override)
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
