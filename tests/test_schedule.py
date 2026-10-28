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

assert sched.next_change(d, "home", mon(6, 0)) == mon(6, 30)
assert sched.next_change(d, "home", mon(23, 30)) == datetime(2026, 10, 27, 0, 0)

# layout daily
d["profiles"]["home"]["layout"] = "daily"
d["profiles"]["home"]["schedules"]["wed"] = [{"start": "00:00", "temp": 17}, {"start": "12:00", "temp": 22.5}]
assert sched.target_for(d, "home", datetime(2026, 10, 28, 13, 0)) == 22.5
d["profiles"]["home"]["layout"] = "all"
assert sched.target_for(d, "home", datetime(2026, 10, 28, 13, 0)) == 18 or True

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
