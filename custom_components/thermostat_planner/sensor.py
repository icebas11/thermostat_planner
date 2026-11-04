"""Capteurs : mode effectif, consigne prévue et prochain changement."""
from __future__ import annotations

from datetime import datetime

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, MODES
from .entity import PlannerEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    planner = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            PlannerModeSensor(planner, entry),
            PlannerTargetSensor(planner, entry),
            PlannerNextChangeSensor(planner, entry),
        ]
    )


class PlannerModeSensor(PlannerEntity, SensorEntity):
    """Mode effectif. `unique_id` historique `{entry_id}_mode` : l'entity_id
    existant (`sensor.thermostat_planner_mode`) est conservé par le registre."""

    _attr_icon = "mdi:calendar-clock"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(MODES)

    def __init__(self, planner, entry: ConfigEntry) -> None:
        super().__init__(planner, entry, "mode")

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


class PlannerTargetSensor(PlannerEntity, SensorEntity):
    """Consigne prévue maintenant : dérogation en cours, sinon planning."""

    _attr_icon = "mdi:thermometer-auto"
    _attr_device_class = SensorDeviceClass.TEMPERATURE
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS

    def __init__(self, planner, entry: ConfigEntry) -> None:
        super().__init__(planner, entry, "target")

    @property
    def native_value(self) -> float:
        return self._planner.planned()["target"]

    @property
    def extra_state_attributes(self) -> dict:
        planned = self._planner.planned()
        return {
            "source": planned["source"],
            "mode": self._planner.effective_mode,
            "enabled": self._planner.data["enabled"],
        }


class PlannerNextChangeSensor(PlannerEntity, SensorEntity):
    """Prochain changement de consigne (inconnu si aucun n'est prévu)."""

    _attr_icon = "mdi:clock-end"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, planner, entry: ConfigEntry) -> None:
        super().__init__(planner, entry, "next_change")

    @property
    def native_value(self) -> datetime | None:
        return self._planner.planned()["next_change"]

    @property
    def extra_state_attributes(self) -> dict:
        planned = self._planner.planned()
        return {"next_temperature": planned["next_target"], "source": planned["source"]}
