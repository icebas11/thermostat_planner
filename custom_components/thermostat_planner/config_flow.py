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
    CONF_EDITORS,
    CONF_RESTRICT_EDIT,
    CONF_ZONE_NAME,
    DEFAULT_AWAY_STATE,
    DEFAULT_CLIMATE,
    DOMAIN,
)


def _schema(
    defaults: dict[str, Any],
    users: list[selector.SelectOptionDict] | None = None,
    zone_name: bool = False,
) -> vol.Schema:
    """Formulaire ; `users` (options uniquement) ajoute les droits de
    modification, `zone_name` (création uniquement) le nom de la zone."""
    fields: dict = {}
    if zone_name:
        fields[vol.Optional(CONF_ZONE_NAME)] = selector.TextSelector()
    fields |= {
        # Pas de valeur par défaut pour une zone supplémentaire (climate = None).
        (
            vol.Required(CONF_CLIMATE, default=defaults.get(CONF_CLIMATE, DEFAULT_CLIMATE))
            if defaults.get(CONF_CLIMATE, DEFAULT_CLIMATE)
            else vol.Required(CONF_CLIMATE)
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
    if users is not None:
        fields[
            vol.Optional(CONF_RESTRICT_EDIT, default=defaults.get(CONF_RESTRICT_EDIT, False))
        ] = selector.BooleanSelector()
        fields[
            vol.Optional(CONF_EDITORS, default=defaults.get(CONF_EDITORS, []))
        ] = selector.SelectSelector(
            selector.SelectSelectorConfig(
                options=users, multiple=True, mode=selector.SelectSelectorMode.LIST
            )
        )
    return vol.Schema(fields)


def _climate_in_use(flow, climate: str, exclude: str | None = None) -> bool:
    """Ce thermostat est-il déjà géré par une autre entrée ?

    Compare aussi l'option climate : l'entrée d'avant le multi-thermostat a
    l'unique_id historique DOMAIN tant qu'elle n'a pas été rechargée.
    """
    return any(
        entry.entry_id != exclude
        and (entry.unique_id == climate or entry.options.get(CONF_CLIMATE) == climate)
        for entry in flow.hass.config_entries.async_entries(DOMAIN)
    )


class ThermostatPlannerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Une entrée par thermostat (zone) ; unique_id = entité climate."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            climate = user_input[CONF_CLIMATE]
            await self.async_set_unique_id(climate)
            self._abort_if_unique_id_configured()
            if _climate_in_use(self, climate):
                return self.async_abort(reason="already_configured")
            options = dict(user_input)
            name = (options.pop(CONF_ZONE_NAME, "") or "").strip()
            if not name:
                state = self.hass.states.get(climate)
                name = (state and state.attributes.get("friendly_name")) or climate
            return self.async_create_entry(title=name, data={}, options=options)
        # Nouvelle zone : entité d'absence pré-remplie avec celle d'une zone existante.
        defaults: dict[str, Any] = {}
        entries = self.hass.config_entries.async_entries(DOMAIN)
        if entries:
            defaults[CONF_CLIMATE] = None
        for entry in entries:
            if entry.options.get(CONF_AWAY_ENTITY):
                defaults[CONF_AWAY_ENTITY] = entry.options[CONF_AWAY_ENTITY]
                defaults[CONF_AWAY_STATE] = entry.options.get(CONF_AWAY_STATE, DEFAULT_AWAY_STATE)
                break
        return self.async_show_form(
            step_id="user", data_schema=_schema(defaults, zone_name=True)
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        return ThermostatPlannerOptionsFlow()


class ThermostatPlannerOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        errors: dict[str, str] = {}
        if user_input is not None:
            if _climate_in_use(self, user_input[CONF_CLIMATE], exclude=self.config_entry.entry_id):
                errors[CONF_CLIMATE] = "climate_in_use"
            else:
                return self.async_create_entry(data=user_input)
        # Les administrateurs ont toujours le droit : seuls les autres sont proposés.
        users = [
            selector.SelectOptionDict(value=user.id, label=user.name or user.id)
            for user in await self.hass.auth.async_get_users()
            if user.is_active and not user.system_generated and not user.is_admin
        ]
        defaults = {**self.config_entry.options, **(user_input or {})}
        return self.async_show_form(
            step_id="init", data_schema=_schema(defaults, users), errors=errors
        )
