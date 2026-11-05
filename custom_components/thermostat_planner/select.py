"""Sélecteur : mode manuel Maison / Absent."""
from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, MODES
from .entity import PlannerEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([PlannerModeSelect(hass.data[DOMAIN].planners[entry.entry_id], entry)])


class PlannerModeSelect(PlannerEntity, SelectEntity):
    """Mode manuel (`data.manual_mode`), ouvert à tous comme `set_mode`.

    Mode commun à toutes les zones : le sélecteur de chaque zone le change
    partout. L'entité d'absence de la zone ou « Zone absente » peuvent forcer
    le mode effectif de la zone à `away` : il est exposé en attribut
    (`effective_mode`, `forced_by_entity`, `zone_away`).
    """

    _attr_icon = "mdi:home-switch-outline"
    _attr_options = list(MODES)

    def __init__(self, planner, entry: ConfigEntry) -> None:
        super().__init__(planner, entry, "manual_mode")

    @property
    def current_option(self) -> str:
        return self._planner.data["manual_mode"]

    @property
    def extra_state_attributes(self) -> dict:
        return {
            "effective_mode": self._planner.effective_mode,
            "forced_by_entity": self._planner.forced_by_entity,
            "zone_away": self._planner.zone_away,
        }

    async def async_select_option(self, option: str) -> None:
        await self._planner.async_set_mode(option)
