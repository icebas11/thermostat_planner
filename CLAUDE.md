# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Home Assistant custom integration + Lovelace card (distributed via HACS) for a heating schedule with **Home / Away** profiles. Code comments, docstrings, README and user-facing strings are in **French**; keep that convention (the card also has an `en` I18N table that must stay in sync with `fr`).

## Commands

```bash
python3 tests/test_schedule.py   # pure scheduling logic; prints "python OK" on success
node tests/test_card.js          # pure card helpers (paint, applyEdit, stepSetpoint…); prints "js OK" on success
```

- There is no test runner, linter or build step. Tests are plain scripts of `assert`s. The Python one loads `const.py` and `schedule.py` by file path (no Home Assistant install needed), so `schedule.py` must stay free of `homeassistant` imports.
- The card is a single dependency-free JS file (no bundler). Quick syntax check: `node -e 'global.window={};global.HTMLElement=class{};global.customElements={get:()=>true};require("./custom_components/thermostat_planner/www/thermostat-planner-card.js")'`. Pure helpers are exposed as `ThermostatPlannerCard.helpers`; under node the file also sets `module.exports = ThermostatPlannerCard`, which is how `tests/test_card.js` reaches them (with the same stubs). Add new pure logic there and test it.
- Anything touching `__init__.py`, `sensor.py` or the card can only be verified in a running Home Assistant.

## Architecture

Everything lives in `custom_components/thermostat_planner/`.

- **`schedule.py`** — HA-independent core: voluptuous schema for the stored data, `default_data()`, and time computations (`target_for`, `block_start`, `next_change`, `override_active`). A day is a sorted list of segments `{"start": "HH:MM", "temp"}`; the first must start at `00:00`, each lasts until the next one. Each profile has a `layout` (`all` / `weekday_weekend` / `daily`) and `schedule_key()` maps a weekday to the schedule key to use. All keys in `SCHEDULE_KEYS` are always stored, whatever the layout. Multi-thermostat helpers: `effective_mode`, `resolve_entry` / `ResolveError`, `store_key` / `legacy_store_key`, `may_claim_legacy`, `legacy_copy_plan`.
- **`__init__.py`** — one `Planner` engine per config entry (= one thermostat / zone), all held by `Shared` in `hass.data[DOMAIN]` (`planners` dict, common `manual_mode`, migration lock). Commands resolve their zone with `Shared.resolve(entry_id, climate)` (`schedule.resolve_entry`): optional `entry_id` and/or `climate`; without either, the only entry; with several entries and no parameter, error `ambiguous` (`not_found` / `not_loaded` otherwise). Also: the WebSocket API used by the card (`thermostat_planner/get|subscribe|save|set_mode|set_zone_away|set_override|clear_override`, all accepting `entry_id` / `climate`), services (same optional fields, `ServiceValidationError` on resolution errors), and auto-registration of the card as a Lovelace resource (`/thermostat_planner/thermostat-planner-card.js?v=VERSION`, falling back to `add_extra_js_url` in YAML mode; removed with the last entry).
- **`config_flow.py`** — one entry per thermostat, `unique_id` = climate entity (duplicates abort, the options flow refuses a climate used by another entry with `climate_in_use`). The pre-multi-thermostat entry has `unique_id = DOMAIN`; `_async_sync_unique_id` converts it at setup, after its storage migration. Entry title = zone name (optional field, defaults to the climate friendly name) = device name. New zones get the away entity pre-filled from an existing entry.
- **Entities** (`entity.py` base class `PlannerEntity`, one device per config entry named after `entry.title`, `has_entity_name` + `translation_key`, names in `translations/*.json` and `strings.json` under `entity`, `unique_id = f"{entry_id}_{key}"`). All refresh through the per-entry dispatcher signal `Planner.signal` (`f"{SIGNAL_UPDATE}_{entry_id}"`), like the WebSocket subscription. `_tick` also emits it every minute when the published state (`state_dict()` + `planned()`) changed, so time-based values stay current even when nothing is applied. The legacy entry keeps its title "Thermostat Planner", so existing `entity_id`s (e.g. `sensor.thermostat_planner_mode`) do not change.
  - `sensor.py` — `mode` (effective mode, legacy `sensor.thermostat_planner_mode`, keep its unique_id), `target` (`Planner.planned()["target"]`: override else schedule), `next_change` (timestamp of the next *temperature change*, `schedule.next_block`, or override end; `None` when scheduling is paused).
  - `select.py` — `manual_mode`, writes through `Planner.async_set_mode` → `Shared.async_set_manual_mode` (common to all zones, open to all).
  - `switch.py` — `scheduling` (`data.enabled`), writes through `Planner.async_set_enabled` → `_async_apply`. Checks `can_edit` on the calling user (`self._context.user_id`); calls without a user (automations) are allowed. `zone_away` (`data.zone_away`), open to all.
  - Pure logic for these lives in `schedule.py`: `next_block`, `planned`.
- **`www/thermostat-planner-card.js`** — vanilla custom element (shadow DOM, full `innerHTML` re-render, event delegation through `data-action` attributes). It subscribes to `thermostat_planner/subscribe` and saves the **whole** `data` object (debounced) via `thermostat_planner/save`. Card config `entry_id` / `climate` (`targetOf`) is added to every command (`withTarget`); without it the card targets the only zone. The "Away for this zone only" row shows only with the card option `show_zone_away: true` (default hidden, user's choice); without it, an active `zone_away` is just mentioned as a hint (`zoneAwayDisplay`).
  - Layout (v0.6): compact header (big setpoint, − / + with thermostat limits, live line with "20:30 → 20,5°", override banner with countdown `fmtDuration`; values refreshed in place by `_updateCtrl` / `_updateLive`, plus a 30 s clock), common Away switch, "Planning Maison / Absent" tabs (displayed profile only), then the **week grid**: one row-button per schedule key of the layout (`gridRows`), the selected row (`selectedRow`: user choice per profile in `_sel`, `null` = closed, default today when `expand_today` is not false) is taller with labels, and its block list + modal stay the accessible editor below. "Copier vers…" copies the selected row to checked rows of both profiles (`copyTargets`, `copyTo`). "Réglages" fold at the bottom.
  - UI state that must survive the full re-render lives on the element: `_profile`, `_sel`, `_copyOpen`, `_copySel`, `_settingsOpen`, `_modal`. Focus is restored after each render (`focusSelector` on the active element's `data-*`, or `_returnFocus`); checkbox changes in the copy panel update in place without re-render.

### Zones and Away mode

Effective mode of a zone (`schedule.effective_mode`) = `away` if the common `manual_mode` is `away`, **or** the zone's away entity (per-entry option) is in the configured state, **or** the zone's `data.zone_away` is set; otherwise `home`. The common mode lives in `.storage/thermostat_planner.global` (`{"manual_mode", "legacy_owner"}`) and is mirrored into each zone's `data.manual_mode`. `Planner.async_save` ignores the `manual_mode` and `zone_away` sent by the card (they only change through `set_mode` / `set_zone_away`), so a stale card cannot revert them. `set_mode` without parameter never fails with `ambiguous` (it acts on every zone); a given `entry_id` / `climate` is only validated.

### Setpoint application (key invariant)

The setpoint is applied **server-side** by `Planner._async_apply`, called every minute (`async_track_time_change`), on save/mode change, when the away entity changes, and when the climate entity becomes available again. It sends `climate.set_temperature` **only when the "applied" key changes**: `{mode, start of current block, target}`, or `{mode, override until, target}` during an override. The key is persisted in `.storage/thermostat_planner.applied`, so a manual change made on the thermostat survives until the next block, even across restarts. Consecutive segments with the same temperature (even across midnight / days) count as one block (`block_start`).

Storage files, per entry: `.storage/thermostat_planner.<entry_id>.data` (schedule), `.applied`, `.override` (temporary override `{mode, temp, until}`, which takes priority over the schedule, even when scheduling is disabled, and is cleared when it expires or when the zone's effective mode changes). They are deleted in `async_remove_entry`.

Legacy migration (`Planner._async_migrate_legacy`, under `Shared.lock`): the old global files `.storage/thermostat_planner.{data,applied,override}` are taken over once. `may_claim_legacy` picks the owner (the recorded `legacy_owner`, else an entry with the legacy `unique_id = DOMAIN`, else the first loaded). The owner is written to `.global` first, then each missing per-entry file is copied (never overwriting an existing one, `legacy_copy_plan`) and re-read to verify. Old files are removed only after everything verified; on any write failure the zone runs on the legacy files and the migration is retried next start.

### Permissions

Permissions are per entry (zone). `thermostat_planner/save` (schedule, layout, enabled flag) is open to every user unless the zone's `restrict_edit` option is set; then only admins and the user ids in its `editors` option may save (`Planner.can_edit`). The card receives `can_edit` in the subscribed state and renders read-only. `set_mode` / `set_zone_away` / `set_override` / `clear_override` are always open to all users. The `scheduling` switch applies `can_edit` to the user of the service call context; a call without user (automation) is allowed. The `manual_mode` select and the `zone_away` switch are open to all, like `set_mode`. The state is sent per connection (`_state_for`) because `can_edit` depends on the user.

## Roadmap (proposed, not implemented yet)

Ideas agreed with the user to implement later, in suggested order. Already done: native entities (select / switch / sensors); on-card setpoint control (− / +) and temporary override (v0.3.0); week grid with copy to several days (v0.6); JS tests for the card helpers and thermostat limits in the block temperature picker; multiple thermostats / zones (common Home / Away mode + per-zone "Zone away", chosen by the user over strictly global or strictly per-zone).

1. **Public holidays** — optional `binary_sensor` from the core **Workday** integration: a non-working day uses the weekend schedule (or Sunday in `daily` layout). Configured in the config/options flow (per zone).
2. **Drag to edit on the bar** — drag block boundaries directly on the colored bar (snap to 15 min), tap a block to edit. Keep the modal as fallback (accessibility, precision); watch for scroll conflicts on touch.
3. **Holidays / planned absences** — list of periods `{start, end, mode}` forcing Away (or a fixed temperature), optionally ending early so the house is warm on return. Needs a date picker and a priority rule: vacation > away entity > manual mode.
4. **Extra / seasonal profiles** — named profiles beyond Home/Away (e.g. "Remote work", winter / mid-season). `profiles: {home, away}` is fixed in the schema, so this needs a data migration; a lighter variant is a single "remote work" profile applicable to chosen days.
5. **Pre-heating (anticipation)** — reach the target *at* the block start by learning heating speed from `current_temperature` history. Most complex item; a simple first step is a configurable fixed advance ("start 30 min earlier").
6. **Small high-value improvements**:
   - undo / redo after an edit or paste (every change is saved immediately);
   - visual card editor (`getConfigElement`) for `title`, `expand_today`, `show_controls`, `override_duration`, `colors`;
   - overlay the actual room temperature curve (history) on today's bar;

## Releasing

Bump the version in **three places** together: `const.py` (`VERSION`, used for the resource cache-busting query string), `manifest.json`, and the header comment of the card JS.
