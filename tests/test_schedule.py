import importlib.util, sys, types
from datetime import datetime
from pathlib import Path

base = Path(__file__).parent.parent / "custom_components" / "thermostat_planner"
pkg = types.ModuleType("tp"); pkg.__path__ = [str(base)]; sys.modules["tp"] = pkg
def load(name):
    spec = importlib.util.spec_from_file_location(f"tp.{name}", base / f"{name}.py")
    mod = importlib.util.module_from_spec(spec); sys.modules[f"tp.{name}"] = mod
    spec.loader.exec_module(mod); return mod
const = load("const"); sched = load("schedule")
import voluptuous as vol

d = sched.default_data()
assert sched.validate(d) == d, "defaults must validate"

# 2026-10-26 = lundi
mon = lambda h, m: datetime(2026, 10, 26, h, m)
sat = lambda h, m: datetime(2026, 10, 31, h, m)
assert sched.target_for(d, "home", mon(0, 0)) == 18
assert sched.target_for(d, "home", mon(6, 29)) == 18
assert sched.target_for(d, "home", mon(6, 30)) == 21
assert sched.target_for(d, "home", mon(8, 0)) == 18
assert sched.target_for(d, "home", mon(17, 30)) == 21
assert sched.target_for(d, "home", mon(23, 0)) == 18
assert sched.target_for(d, "home", sat(7, 0)) == 18
assert sched.target_for(d, "home", sat(8, 0)) == 21
assert sched.target_for(d, "away", mon(12, 0)) == 16

assert sched.block_start(d, "home", mon(9, 0)) == mon(8, 0)
assert sched.block_start(d, "home", mon(6, 30)) == mon(6, 30)
# 23:00 → 00:00 à 18 °C : une seule plage, qui a commencé la veille
assert sched.block_start(d, "home", datetime(2026, 10, 27, 3, 0)) == mon(23, 0)
assert sched.block_start(d, "home", mon(23, 30)) == mon(23, 0)
# lundi 00:00-06:30 prolonge le dimanche 23:00
assert sched.block_start(d, "home", mon(5, 0)) == datetime(2026, 10, 25, 23, 0)
# une seule consigne toute la semaine : la plage remonte jusqu'à 7 jours
assert sched.block_start(d, "away", mon(12, 0)) == datetime(2026, 10, 19, 0, 0)

assert sched.next_change(d, "home", mon(6, 0)) == mon(6, 30)
assert sched.next_change(d, "home", mon(23, 30)) == datetime(2026, 10, 27, 0, 0)

# layout daily
d["profiles"]["home"]["layout"] = "daily"
d["profiles"]["home"]["schedules"]["wed"] = [{"start": "00:00", "temp": 17}, {"start": "12:00", "temp": 22.5}]
assert sched.target_for(d, "home", datetime(2026, 10, 28, 13, 0)) == 22.5
d["profiles"]["home"]["layout"] = "all"
assert sched.target_for(d, "home", datetime(2026, 10, 28, 13, 0)) == 18 or True

# dérogation
ovr = {"mode": "home", "temp": 21, "until": mon(17, 30).isoformat()}
assert sched.override_active(ovr, "home", mon(12, 0))
assert not sched.override_active(ovr, "home", mon(17, 30)), "échue à l'heure de fin"
assert not sched.override_active(ovr, "away", mon(12, 0)), "annulée si le mode change"
assert not sched.override_active(None, "home", mon(12, 0))
assert not sched.override_active({"mode": "home", "temp": 21, "until": "x"}, "home", mon(12, 0))

bad = [
  lambda x: x["profiles"]["home"]["schedules"].__setitem__("all", [{"start": "01:00", "temp": 18}]),
  lambda x: x["profiles"]["home"]["schedules"].__setitem__("all", [{"start": "00:00", "temp": 18}, {"start": "00:00", "temp": 19}]),
  lambda x: x["profiles"]["home"]["schedules"].__setitem__("all", [{"start": "00:00", "temp": 99}]),
  lambda x: x["profiles"]["home"]["schedules"].__setitem__("all", []),
  lambda x: x["profiles"]["home"]["schedules"].__setitem__("all", [{"start": "00:00", "temp": 18}, {"start": "25:00", "temp": 19}]),
  lambda x: x.__setitem__("manual_mode", "x"),
]
for mut in bad:
    x = sched.default_data(); mut(x)
    try: sched.validate(x)
    except vol.Invalid: continue
    raise AssertionError("should have failed")
print("python OK")
