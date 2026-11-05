"""Entité de base : appareil de la zone et rafraîchissement par le signal de la zone."""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .const import DOMAIN


class PlannerEntity(Entity):
    """Entité rattachée à l'appareil de l'entrée de configuration (une zone).

    `unique_id` = f"{entry_id}_{key}" : propre à l'entrée. L'appareil porte
    le titre de l'entrée (nom de la zone ; « Thermostat Planner » pour une
    installation d'avant le multi-thermostat, ce qui garde ses entity_id).
    Le nom de l'entité vient des traductions (`translation_key`).
    """

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, planner, entry: ConfigEntry, key: str) -> None:
        self._planner = planner
        self._attr_translation_key = key
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)}, name=entry.title or "Thermostat Planner"
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(self.hass, self._planner.signal, self._refresh)
        )

    @callback
    def _refresh(self) -> None:
        self.async_write_ha_state()
