"""Interrupteur : planification activée (flag `enabled` des données)."""
from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import Unauthorized
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .entity import PlannerEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([PlannerSchedulingSwitch(hass.data[DOMAIN][entry.entry_id], entry)])


class PlannerSchedulingSwitch(PlannerEntity, SwitchEntity):
    """Active ou met en pause la planification.

    Même règle que `thermostat_planner/save` : avec l'option `restrict_edit`,
    seuls les administrateurs et les éditeurs choisis peuvent la changer.
    L'utilisateur est celui du contexte de l'appel ; un appel sans utilisateur
    (automatisation, script déclenché par le système) est autorisé.
    """

    _attr_icon = "mdi:calendar-sync"

    def __init__(self, planner, entry: ConfigEntry) -> None:
        super().__init__(planner, entry, "scheduling")

    @property
    def is_on(self) -> bool:
        return self._planner.data["enabled"]

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._async_set(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._async_set(False)

    async def _async_set(self, enabled: bool) -> None:
        context = self._context
        user_id = context.user_id if context is not None else None
        if user_id is not None:
            user = await self.hass.auth.async_get_user(user_id)
            if not self._planner.can_edit(user):
                raise Unauthorized(context=context, entity_id=self.entity_id)
        await self._planner.async_set_enabled(enabled)
