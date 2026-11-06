// Tests des fonctions pures de la carte : `node tests/test_card.js` (aucune dépendance).
const assert = require("node:assert/strict");
const path = require("node:path");

// Mêmes bouchons que la vérification de syntaxe de CLAUDE.md.
global.window = {};
global.HTMLElement = class {};
global.customElements = { get: () => true };
const Card = require(path.join(__dirname, "..", "custom_components", "thermostat_planner", "www", "thermostat-planner-card.js"));
const H = Card && Card.helpers;
assert.ok(H, "ThermostatPlannerCard.helpers doit être exposé");
const { paint, applyEdit, removeBlock, seedLayout, stepSetpoint, scheduleLimits, keyFor, toMin, toStr } = H;

const seg = (...pairs) => pairs.map(([start, temp]) => ({ start, temp }));
const DAY = seg(["00:00", 18], ["06:30", 21], ["08:00", 18], ["17:30", 21], ["22:30", 18]);
const frozen = JSON.stringify(DAY);

// ---- toMin / toStr ------------------------------------------------------
assert.equal(toMin("00:00"), 0);
assert.equal(toMin("23:59"), 1439);
assert.equal(toStr(0), "00:00");
assert.equal(toStr(605), "10:05");

// ---- paint ---------------------------------------------------------------
// Au milieu d'une plage : découpe en trois.
assert.deepEqual(paint(seg(["00:00", 18]), 600, 720, 21), seg(["00:00", 18], ["10:00", 21], ["12:00", 18]));
// Depuis 00:00 : le premier segment reste à 00:00.
assert.deepEqual(paint(seg(["00:00", 18]), 0, 360, 16), seg(["00:00", 16], ["06:00", 18]));
// Jusqu'à minuit : la plage peinte devient la dernière.
assert.deepEqual(paint(seg(["00:00", 18]), 1320, 1440, 16), seg(["00:00", 18], ["22:00", 16]));
// Toute la journée : un seul segment.
assert.deepEqual(paint(DAY, 0, 1440, 19), seg(["00:00", 19]));
// À cheval sur plusieurs plages : celles recouvertes disparaissent.
assert.deepEqual(paint(DAY, 420, 1080, 20), seg(["00:00", 18], ["06:30", 21], ["07:00", 20], ["18:00", 21], ["22:30", 18]));
// Même température que la plage : pas de découpe.
assert.deepEqual(paint(seg(["00:00", 18]), 600, 720, 18), seg(["00:00", 18]));
// Même température qu'une voisine : fusion avec elle.
assert.deepEqual(paint(DAY, 480, 600, 21), seg(["00:00", 18], ["06:30", 21], ["10:00", 18], ["17:30", 21], ["22:30", 18]));
// Comble l'écart entre deux plages identiques : les trois n'en font qu'une.
assert.deepEqual(paint(DAY, 480, 1050, 21), seg(["00:00", 18], ["06:30", 21], ["22:30", 18]));
assert.equal(JSON.stringify(DAY), frozen, "paint ne modifie pas son entrée");

// ---- applyEdit -----------------------------------------------------------
// Plage du milieu : la fin déplace le début de la suivante.
assert.deepEqual(applyEdit(DAY, 1, 360, 510, 22).segs,
  seg(["00:00", 18], ["06:00", 22], ["08:30", 18], ["17:30", 21], ["22:30", 18]));
// Premier bloc : le début est forcé à 00:00, quoi qu'on saisisse.
assert.deepEqual(applyEdit(DAY, 0, 120, 360, 17).segs.slice(0, 2), seg(["00:00", 17], ["06:00", 21]));
assert.deepEqual(applyEdit(DAY, 0, NaN, 360, 17).segs[0], { start: "00:00", temp: 17 });
// Dernier bloc : finit toujours à minuit, la fin saisie est ignorée.
assert.deepEqual(applyEdit(DAY, 4, 1380, NaN, 16).segs.slice(-1), seg(["23:00", 16]));
// Erreurs.
assert.deepEqual(applyEdit(DAY, 1, NaN, 480, 21), { error: "eEmpty" });
assert.deepEqual(applyEdit(DAY, 1, 480, 420, 21), { error: "eOrder" });
assert.deepEqual(applyEdit(DAY, 1, 480, 480, 21), { error: "eOrder" });
assert.deepEqual(applyEdit(DAY, 1, 0, 480, 21), { error: "eEraseBefore" });
assert.deepEqual(applyEdit(DAY, 1, 390, 1050, 21), { error: "eEraseAfter" });
// Plage unique : 00:00 → minuit, seule la température change.
assert.deepEqual(applyEdit(seg(["00:00", 18]), 0, NaN, NaN, 20).segs, seg(["00:00", 20]));
assert.equal(JSON.stringify(DAY), frozen, "applyEdit ne modifie pas son entrée");

// ---- removeBlock ---------------------------------------------------------
// Premier bloc : le suivant reprend à 00:00.
assert.deepEqual(removeBlock(DAY, 0).segs, seg(["00:00", 21], ["08:00", 18], ["17:30", 21], ["22:30", 18]));
// Dernier bloc : le précédent s'étend jusqu'à minuit.
assert.deepEqual(removeBlock(DAY, 4).segs, seg(["00:00", 18], ["06:30", 21], ["08:00", 18], ["17:30", 21]));
// Bloc du milieu : le précédent s'étend.
assert.deepEqual(removeBlock(DAY, 2).segs, seg(["00:00", 18], ["06:30", 21], ["17:30", 21], ["22:30", 18]));
// Dernière plage restante : interdit.
assert.deepEqual(removeBlock(seg(["00:00", 18]), 0), { error: "eLast" });
assert.equal(JSON.stringify(DAY), frozen, "removeBlock ne modifie pas son entrée");

// ---- keyFor / seedLayout -------------------------------------------------
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
DAYS.forEach((d, i) => {
  assert.equal(keyFor("all", i), "all");
  assert.equal(keyFor("weekday_weekend", i), i < 5 ? "weekdays" : "weekend");
  assert.equal(keyFor("daily", i), d);
});

const one = (t) => seg(["00:00", t]);
const profile = (layout) => ({
  layout,
  schedules: {
    all: one(10), weekdays: one(11), weekend: one(12),
    mon: one(20), tue: one(21), wed: one(22), thu: one(23), fri: one(24), sat: one(25), sun: one(26),
  },
});
const resolved = (p) => DAYS.map((_, i) => p.schedules[keyFor(p.layout, i)][0].temp);

// all → weekday_weekend → daily → all
let p = profile("all");
seedLayout(p, "weekday_weekend");
assert.equal(p.layout, "weekday_weekend");
assert.deepEqual(resolved(p), [10, 10, 10, 10, 10, 10, 10], "le planning effectif ne change pas");
seedLayout(p, "daily");
assert.deepEqual(resolved(p), [10, 10, 10, 10, 10, 10, 10]);
seedLayout(p, "all");
assert.deepEqual(resolved(p), [10, 10, 10, 10, 10, 10, 10]);

// weekday_weekend → daily : lundi–vendredi reprennent la semaine, samedi–dimanche le week-end.
p = profile("weekday_weekend");
seedLayout(p, "daily");
assert.deepEqual(resolved(p), [11, 11, 11, 11, 11, 12, 12]);
p.schedules.mon[0].temp = 30;
assert.equal(p.schedules.tue[0].temp, 11, "chaque jour reçoit une copie indépendante");

// daily → weekday_weekend : lundi pour la semaine, samedi pour le week-end.
p = profile("daily");
seedLayout(p, "weekday_weekend");
assert.deepEqual(resolved(p), [20, 20, 20, 20, 20, 25, 25]);
assert.equal(p.schedules.sun[0].temp, 26, "les autres clés restent stockées");

// daily → all : le planning du lundi.
p = profile("daily");
seedLayout(p, "all");
assert.deepEqual(resolved(p), [20, 20, 20, 20, 20, 20, 20]);

// Même layout : rien ne change.
p = profile("daily");
seedLayout(p, "daily");
assert.deepEqual(resolved(p), [20, 21, 22, 23, 24, 25, 26]);

// ---- stepSetpoint ------------------------------------------------------
const L = { min: 5, max: 35, step: 0.5 };
assert.equal(stepSetpoint(20, 0.5, L), 20.5);
assert.equal(stepSetpoint(20, -0.5, L), 19.5);
assert.equal(stepSetpoint(35, 0.5, L), 35, "borne haute");
assert.equal(stepSetpoint(5, -0.5, L), 5, "borne basse");
assert.equal(stepSetpoint(20.3, 0, L), 20.5, "delta 0 : arrondi au pas");
assert.equal(stepSetpoint(99, 0, L), 35);
assert.equal(stepSetpoint(-3, 0, L), 5);
// Pas de 0,1 sans erreur de virgule flottante.
const L01 = { min: 7, max: 30, step: 0.1 };
assert.equal(stepSetpoint(21, 0.1, L01), 21.1);
assert.equal(stepSetpoint(21.2, 0.1, L01), 21.3);
assert.equal(stepSetpoint(21, -0.1, L01), 20.9);
// Pas de 1.
const L1 = { min: 7, max: 30, step: 1 };
assert.equal(stepSetpoint(21.5, 1, L1), 23, "arrondi au pas après le saut");
assert.equal(stepSetpoint(29, 1, L1), 30);
assert.equal(stepSetpoint(30, 1, L1), 30);
// Bornes qui ne tombent pas sur le pas : l'arrondi ne doit pas en sortir.
const Lodd = { min: 7.2, max: 30.3, step: 0.5 };
assert.equal(stepSetpoint(30, 0.5, Lodd), 30, "jamais au-dessus de max");
assert.equal(stepSetpoint(7.5, -0.5, Lodd), 7.5, "jamais en dessous de min");
assert.equal(stepSetpoint(30.5, 1, { min: 5, max: 30.5, step: 1 }), 30);

// ---- scheduleLimits (sélecteur de température des plages) -----------------
assert.deepEqual(scheduleLimits(L), { min: 5, max: 35, step: 0.5 }, "défaut : 5–35 °C par 0,5");
assert.deepEqual(scheduleLimits({ min: 7, max: 30, step: 0.1 }), { min: 7, max: 30, step: 0.5 },
  "le serveur arrondit au 0,5 : pas plus fin que 0,5");
assert.deepEqual(scheduleLimits({ min: 7, max: 30, step: 1 }), { min: 7, max: 30, step: 1 });
assert.deepEqual(scheduleLimits({ min: 7.2, max: 30.3, step: 0.5 }), { min: 7.5, max: 30, step: 0.5 },
  "bornes alignées sur le pas, à l'intérieur de celles du thermostat");
const SL = scheduleLimits({ min: 7, max: 28, step: 1 });
assert.equal(stepSetpoint(25.5, 0, SL), 26);
assert.equal(stepSetpoint(32, 0, SL), 28, "une ancienne consigne trop haute est ramenée au max");
assert.equal(stepSetpoint(5, 0, SL), 7, "une ancienne consigne trop basse est ramenée au min");
assert.equal(stepSetpoint(27, 1, SL), 28);
assert.equal(stepSetpoint(28, 1, SL), 28);

// ---- zone visée (multi-thermostat) -----------------------------------------
const { targetOf, withTarget, defaultTitle, subscribeErrorKey } = H;
assert.deepEqual(targetOf({}), {}, "sans paramètre : zone unique, comportement historique");
assert.deepEqual(targetOf(undefined), {});
assert.deepEqual(targetOf({ entry_id: " abc " }), { entry_id: "abc" });
assert.deepEqual(targetOf({ climate: "climate.chambre", title: "x" }), { climate: "climate.chambre" });
assert.deepEqual(targetOf({ entry_id: "abc", climate: "climate.chambre" }), { entry_id: "abc", climate: "climate.chambre" });
assert.deepEqual(targetOf({ entry_id: "", climate: null }), {});
assert.throws(() => targetOf({ entry_id: 12 }), /entry_id/);
assert.throws(() => targetOf({ climate: "sensor.x" }), /climate/);

assert.deepEqual(withTarget({ type: "t", mode: "away" }, { entry_id: "abc" }), { type: "t", mode: "away", entry_id: "abc" });
assert.deepEqual(withTarget({ type: "t" }, {}), { type: "t" }, "aucun paramètre ajouté sans zone");
assert.deepEqual(withTarget({ type: "t" }, undefined), { type: "t" });

assert.equal(defaultTitle("Planning", null), "Planning");
assert.equal(defaultTitle("Planning", { zone_count: 1, zone_name: "Salon" }), "Planning", "une zone : titre inchangé");
assert.equal(defaultTitle("Planning", { zone_count: 2, zone_name: "Salon" }), "Planning · Salon");
assert.equal(defaultTitle("Planning", { zone_name: "Salon" }), "Planning", "ancien serveur sans zone_count");

assert.equal(subscribeErrorKey({ code: "ambiguous" }), "ambiguous");
assert.equal(subscribeErrorKey({ code: "not_found" }), "notFound");
assert.equal(subscribeErrorKey({ code: "unknown_command" }), null);
assert.equal(subscribeErrorKey(undefined), null);

// ---- « Absent pour cette zone uniquement » (option show_zone_away) ----------
const { zoneAwayDisplay } = H;
assert.equal(zoneAwayDisplay({}, { zone_away: false, zone_count: 2 }), null, "masqué par défaut, même avec plusieurs zones");
assert.equal(zoneAwayDisplay({}, { zone_away: true }), "hint", "option absente mais zone absente : simple mention");
assert.equal(zoneAwayDisplay({ show_zone_away: true }, { zone_away: false }), "row");
assert.equal(zoneAwayDisplay({ show_zone_away: true }, { zone_away: true, zone_count: 1 }), "row");
assert.equal(zoneAwayDisplay({ show_zone_away: "true" }, { zone_away: false }), null, "seul true active l'option");
assert.equal(zoneAwayDisplay({ show_zone_away: true }, { data: {} }), null, "ancien serveur sans zone_away");
assert.equal(zoneAwayDisplay(undefined, null), null);

// ---- Échelle de couleurs par défaut (tempColors) ------------------------------
const { tempColors, parseScale, fmtTemp, targetAt, upcoming } = H;
/** "hsl(h s% l% / a)" → { rgb: [0-1]×3, a }. */
function hsl(str) {
  const m = str.match(/^hsl\((\d+) (\d+)% (\d+)%(?: \/ ([\d.]+))?\)$/);
  assert.ok(m, `couleur hsl attendue : ${str}`);
  const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { h, s, rgb: [f(0), f(8), f(4)], a: m[4] === undefined ? 1 : Number(m[4]) };
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (rgb) =>
  rgb
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)))
    .reduce((acc, x, i) => acc + x * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const over = (c, base) => c.rgb.map((x, i) => x * c.a + base[i] * (1 - c.a));
// Fonds de carte du thème par défaut de Home Assistant (clair / sombre).
const CARD = { light: hex("#ffffff"), dark: hex("#1c1c1c") };
for (const theme of ["light", "dark"]) {
  for (let t = 5; t <= 35; t += 0.5) {
    const c = tempColors(t, null, theme === "dark");
    const bg = hsl(c.bg);
    // Texte posé sur les plages de la barre : contraste AA (4,5:1).
    assert.ok(contrast(bg.rgb, hsl(c.fg).rgb) >= 4.5, `${theme} ${t}° : texte sur la plage`);
    // Température en couleur sur le fond teinté des plages de la liste.
    const tint = over(hsl(c.tint), CARD[theme]);
    assert.ok(contrast(hsl(c.accent).rgb, tint) >= 4.5, `${theme} ${t}° : température de la liste`);
    // Pas de vert : teintes hors 75–165, sauf quasi-gris.
    assert.ok(bg.s < 0.2 || bg.h < 75 || bg.h > 165, `${theme} ${t}° : teinte ${bg.h} (vert)`);
  }
  // Thème clair : fonds clairs ; thème sombre : fonds sombres.
  const l17 = lum(hsl(tempColors(17, null, theme === "dark").bg).rgb);
  assert.ok(theme === "dark" ? l17 < 0.1 : l17 > 0.4, `${theme} : luminosité des fonds`);
}
// Les températures courantes d'un planning (17 / 20,5) se distinguent nettement.
assert.ok(hsl(tempColors(17, null, false).bg).h > 180 && hsl(tempColors(20.5, null, false).bg).h < 45);
assert.notEqual(tempColors(19, null, false).bg, tempColors(19, null, true).bg, "dépend du thème");
// L'option `colors` prime, quel que soit le thème ; hors paliers, retour à l'échelle par défaut.
const scale = parseScale([{ max: 18, color: "#123456", text_color: "#ffffff" }, { min: 21, color: "red", text_color: "black" }]);
assert.equal(tempColors(17, scale, true).bg, "#123456");
assert.equal(tempColors(17, scale, false).fg, "#ffffff");
assert.equal(tempColors(22, scale, false).bg, "red");
assert.equal(tempColors(19.5, scale, true).bg, tempColors(19.5, null, true).bg);
assert.equal(parseScale(undefined), null);
assert.throws(() => parseScale({}), /liste/);
assert.throws(() => parseScale([{ min: 1 }]), /color/);

// ---- Format des températures --------------------------------------------------
assert.equal(fmtTemp(20.5, "fr"), "20,5");
assert.equal(fmtTemp(20.5, "en"), "20.5");
assert.equal(fmtTemp(17, "fr"), "17");
assert.equal(fmtTemp("21.25", "en"), "21.3");

// ---- Prochain changement (upcoming / targetAt) ---------------------------------
const WEEK = seg(["00:00", 17], ["06:30", 20], ["08:15", 17.5], ["17:30", 20.5], ["22:30", 17]);
const WEEKEND = seg(["00:00", 17], ["08:30", 20.5], ["23:30", 17]);
const mkData = (enabled = true) => ({
  enabled,
  profiles: {
    home: { layout: "weekday_weekend", schedules: { weekdays: WEEK, weekend: WEEKEND } },
    away: { layout: "all", schedules: { all: seg(["00:00", 15], ["06:30", 16], ["21:00", 15]) } },
  },
});
const at = (d, h, m) => new Date(2026, 10, d, h, m); // novembre 2026 : le 6 est un vendredi
assert.equal(targetAt(mkData().profiles.home, at(6, 18, 40)), 20.5);
assert.equal(targetAt(mkData().profiles.home, at(6, 6, 29)), 17);
assert.equal(targetAt(mkData().profiles.home, at(7, 9, 0)), 20.5, "samedi : week-end");
const same = (r, d, h, m, temp) => {
  assert.ok(r, "changement attendu");
  assert.equal(r.at.getTime(), at(d, h, m).getTime());
  assert.equal(r.temp, temp);
};
same(upcoming(mkData(), "home", null, at(6, 18, 40)), 6, 22, 30, 17);
same(upcoming(mkData(), "home", null, at(6, 6, 30)), 6, 8, 15, 17.5, "début de plage exact : la suivante");
// Vendredi 23:00 : samedi 00:00 a la même consigne (17), le changement est samedi 08:30.
same(upcoming(mkData(), "home", null, at(6, 23, 0)), 7, 8, 30, 20.5);
same(upcoming(mkData(), "away", null, at(6, 22, 0)), 7, 6, 30, 16);
// Dérogation : sa fin, puis la consigne du planning à cet instant.
const ovr = { mode: "home", temp: 21.5, until: at(6, 20, 30).toISOString() };
same(upcoming(mkData(), "home", ovr, at(6, 18, 40)), 6, 20, 30, 20.5);
// Planification en pause : rien sans dérogation ; avec, l'heure de fin sans consigne.
assert.equal(upcoming(mkData(false), "home", null, at(6, 18, 40)), null);
const paused = upcoming(mkData(false), "home", ovr, at(6, 18, 40));
assert.equal(paused.at.getTime(), at(6, 20, 30).getTime());
assert.equal(paused.temp, null);
// Une seule consigne toute la semaine : aucun changement.
const flat = { enabled: true, profiles: { home: { layout: "all", schedules: { all: seg(["00:00", 19]) } } } };
assert.equal(upcoming(flat, "home", null, at(6, 12, 0)), null);
assert.equal(upcoming(mkData(), "home", { until: "n'importe quoi" }, at(6, 12, 0)), null);

console.log("js OK");
