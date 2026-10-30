# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Home Assistant custom integration + Lovelace card (distributed via HACS) for a heating schedule with **Home / Away** profiles. Code comments, docstrings, README and user-facing strings are in **French**; keep that convention (the card also has an `en` I18N table that must stay in sync with `fr`).

## Commands

```bash
python3 tests/test_schedule.py   # pure scheduling logic; prints "python OK" on success
```

- There is no test runner, linter or build step. The test is a plain script of `assert`s: it loads `const.py` and `schedule.py` by file path (no Home Assistant install needed), so `schedule.py` must stay free of `homeassistant` imports.
- The card is a single dependency-free JS file (no bundler). Quick syntax check: `node -e 'global.window={};global.HTMLElement=class{};global.customElements={get:()=>true};require("./custom_components/thermostat_planner/www/thermostat-planner-card.js")'`. Pure helpers are exposed as `ThermostatPlannerCard.helpers` for ad-hoc testing.
- Anything touching `__init__.py`, `sensor.py` or the card can only be verified in a running Home Assistant.

## Architecture

Everything lives in `custom_components/thermostat_planner/`.

- **`schedule.py`** — HA-independent core: voluptuous schema for the stored data, `default_data()`, and time computations (`target_for`, `block_start`, `next_change`, `override_active`). A day is a sorted list of segments `{"start": "HH:MM", "temp"}`; the first must start at `00:00`, each lasts until the next one. Each profile has a `layout` (`all` / `weekday_weekend` / `daily`) and `schedule_key()` maps a weekday to the schedule key to use. All keys in `SCHEDULE_KEYS` are always stored, whatever the layout.
- **`__init__.py`** — `Planner` engine (one per config entry, but `_planner()` returns the first: only one thermostat is supported), the WebSocket API used by the card (`thermostat_planner/get|subscribe|save|set_mode|set_override|clear_override`), services, and auto-registration of the card as a Lovelace resource (`/thermostat_planner/thermostat-planner-card.js?v=VERSION`, falling back to `add_extra_js_url` in YAML mode).
- **`sensor.py`** — `sensor.thermostat_planner_mode`, refreshed through the `SIGNAL_UPDATE` dispatcher signal, like the WebSocket subscription.
- **`www/thermostat-planner-card.js`** — vanilla custom element (shadow DOM, full `innerHTML` re-render, event delegation through `data-action` attributes). It subscribes to `thermostat_planner/subscribe` and saves the **whole** `data` object (debounced) via `thermostat_planner/save`.

### Setpoint application (key invariant)

The setpoint is applied **server-side** by `Planner._async_apply`, called every minute (`async_track_time_change`), on save/mode change, when the away entity changes, and when the climate entity becomes available again. It sends `climate.set_temperature` **only when the "applied" key changes**: `{mode, start of current block, target}`, or `{mode, override until, target}` during an override. The key is persisted in `.storage/thermostat_planner.applied`, so a manual change made on the thermostat survives until the next block, even across restarts. Consecutive segments with the same temperature (even across midnight / days) count as one block (`block_start`).

Storage files: `.storage/thermostat_planner.data` (schedule), `.applied`, `.override` (temporary override `{mode, temp, until}`, which takes priority over the schedule, even when scheduling is disabled, and is cleared when it expires or when the effective mode changes).

Effective mode = `away` if the configured away entity is in the configured state, otherwise `data.manual_mode`.

### Permissions

`thermostat_planner/save` (schedule, layout, enabled flag) is open to every user unless the `restrict_edit` option is set; then only admins and the user ids in the `editors` option may save (`Planner.can_edit`). The card receives `can_edit` in the subscribed state and renders read-only. `set_mode` / `set_override` / `clear_override` are always open to all users. The state is sent per connection (`_state_for`) because `can_edit` depends on the user.

## Roadmap (proposed, not implemented yet)

Ideas agreed with the user to implement later, in suggested order. Already done: on-card setpoint control (− / +) and temporary override (v0.3.0).

1. **Native entities** — add `select` (home/away mode), `switch` (scheduling enabled), `sensor`s for planned target and next change (`device_class: timestamp`), so everything is usable in automations, voice assistants and history without custom services. Avoid a full proxy `climate` entity (duplicates the real thermostat).
2. **Public holidays** — optional `binary_sensor` from the core **Workday** integration: a non-working day uses the weekend schedule (or Sunday in `daily` layout). Configured in the config/options flow.
3. **Multiple thermostats / zones** — one config entry per thermostat. Requires: an `entry_id` (or climate) parameter on every WebSocket command and in the card config instead of `_planner()` returning the first planner; per-entry storage files with migration of the current `.storage/thermostat_planner.*`; deciding whether Away mode is global (probably yes) or per zone. Do it before the data schema grows further.
4. **Drag to edit on the bar** — drag block boundaries directly on the colored bar (snap to 15 min), tap a block to edit. Keep the modal as fallback (accessibility, precision); watch for scroll conflicts on touch.
5. **Holidays / planned absences** — list of periods `{start, end, mode}` forcing Away (or a fixed temperature), optionally ending early so the house is warm on return. Needs a date picker and a priority rule: vacation > away entity > manual mode.
6. **Extra / seasonal profiles** — named profiles beyond Home/Away (e.g. "Remote work", winter / mid-season). `profiles: {home, away}` is fixed in the schema, so this needs a data migration; a lighter variant is a single "remote work" profile applicable to chosen days.
7. **Pre-heating (anticipation)** — reach the target *at* the block start by learning heating speed from `current_temperature` history. Most complex item; a simple first step is a configurable fixed advance ("start 30 min earlier").
8. **Small high-value improvements**:
   - undo / redo after an edit or paste (every change is saved immediately);
   - copy one day to several days at once (checkboxes Mon–Sun);
   - visual card editor (`getConfigElement`) for `title`, `expand_today`, `show_controls`, `override_duration`, `colors`;
   - overlay the actual room temperature curve (history) on today's bar;
   - respect the thermostat's `min_temp` / `max_temp` / `target_temp_step` in the block temperature picker too (only the − / + controls do so today);
   - JS tests for the pure card helpers (`paint`, `applyEdit`, `removeBlock`, `seedLayout`, `stepSetpoint`).

## Releasing

Bump the version in **three places** together: `const.py` (`VERSION`, used for the resource cache-busting query string), `manifest.json`, and the header comment of the card JS.
