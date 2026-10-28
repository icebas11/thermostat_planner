"""Assistant de configuration."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_AWAY_ENTITY,
    CONF_AWAY_STATE,
    CONF_CLIMATE,
    DEFAULT_AWAY_STATE,
    DEFAULT_CLIMATE,
    DOMAIN,
)


def _schema(defaults: dict[str, Any]) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(
                CONF_CLIMATE, default=defaults.get(CONF_CLIMATE, DEFAULT_CLIMATE)
            ): selector.EntitySelector(selector.EntitySelectorConfig(domain="climate")),
            vol.Optional(
                CONF_AWAY_ENTITY,
                description={"suggested_value": defaults.get(CONF_AWAY_ENTITY)},
            ): selector.EntitySelector(),
            vol.Optional(
                CONF_AWAY_STATE,
                default=defaults.get(CONF_AWAY_STATE, DEFAULT_AWAY_STATE),
            ): selector.TextSelector(),
        }
    )


class ThermostatPlannerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Une seule instance : un thermostat."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="Thermostat Planner", data={}, options=user_input)
        return self.async_show_form(step_id="user", data_schema=_schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        return ThermostatPlannerOptionsFlow()


class ThermostatPlannerOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        return self.async_show_form(
            step_id="init", data_schema=_schema(dict(self.config_entry.options))
        )
