"""Capteur : mode effectif (maison / absent) et consigne prévue."""
from __future__ import annotations

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, MODES, SIGNAL_UPDATE


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([PlannerModeSensor(hass.data[DOMAIN][entry.entry_id], entry)])


class PlannerModeSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_name = "Mode"
    _attr_icon = "mdi:calendar-clock"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(MODES)

    def __init__(self, planner, entry: ConfigEntry) -> None:
        self._planner = planner
        self._attr_unique_id = f"{entry.entry_id}_mode"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)}, name="Thermostat Planner"
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_UPDATE, self._refresh)
        )

    @callback
    def _refresh(self) -> None:
        self.async_write_ha_state()

    @property
    def native_value(self) -> str:
        return self._planner.effective_mode

    @property
    def extra_state_attributes(self) -> dict:
        state = self._planner.state_dict()
        override = state["override"] or {}
        return {
            "manual_mode": self._planner.data["manual_mode"],
            "forced_by_entity": state["forced_by_entity"],
            "target_temperature": state["target"],
            "next_change": state["next_change"],
            "override_temperature": override.get("temp"),
            "override_until": override.get("until"),
            "enabled": self._planner.data["enabled"],
            "climate_entity": state["climate_entity"],
        }
