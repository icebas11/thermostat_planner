"""Constantes de Thermostat Planner."""

DOMAIN = "thermostat_planner"
VERSION = "0.1.0"

CONF_CLIMATE = "climate_entity"
CONF_AWAY_ENTITY = "away_entity"
CONF_AWAY_STATE = "away_state"

DEFAULT_CLIMATE = "climate.thermostat"
DEFAULT_AWAY_STATE = "not_home"

MODES = ("home", "away")
LAYOUTS = ("all", "weekday_weekend", "daily")
DAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
SCHEDULE_KEYS = ("all", "weekdays", "weekend") + DAY_KEYS

MIN_TEMP = 5.0
MAX_TEMP = 35.0

SIGNAL_UPDATE = f"{DOMAIN}_update"

CARD_URL = f"/{DOMAIN}/thermostat-planner-card.js"
