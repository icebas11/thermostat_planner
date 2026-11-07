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

// ---- Nuanciers (tempColors / paletteOf) ---------------------------------------
const { tempColors, parseScale, fmtTemp, targetAt, upcoming, paletteOf, PALETTES } = H;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
/** "rgb(r g b / a)" → { rgb: [0-1]×3, a }. */
function rgba(str) {
  const m = str.match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/);
  assert.ok(m, `couleur rgb attendue : ${str}`);
  return { rgb: [m[1], m[2], m[3]].map((x) => Number(x) / 255), a: Number(m[4]) };
}
const lum = (rgb) =>
  rgb
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)))
    .reduce((acc, x, i) => acc + x * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const over = (c, base) => c.rgb.map((x, i) => x * c.a + base[i] * (1 - c.a));
/** Teinte en degrés d'un [r, g, b] de 0 à 1 (et saturation, pour écarter les quasi-gris). */
function hueSat(rgb) {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return { h: 0, s: 0 };
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(max + min - 1)) };
}
// Fonds de carte du thème par défaut de Home Assistant (clair / sombre).
const CARD = { light: hex("#ffffff"), dark: hex("#1c1c1c") };
const NAMES = Object.keys(PALETTES);
assert.deepEqual(NAMES, ["terre_cuite", "infrarouge", "nuit_jour", "braise", "glace_feu", "thermometre"]);
for (const name of NAMES) {
  for (const theme of ["light", "dark"]) {
    for (let t = 5; t <= 35; t += 0.5) {
      const c = tempColors(t, null, theme === "dark", name);
      const bg = hex(c.bg);
      // Texte posé sur les plages de la barre : contraste AA (4,5:1).
      assert.ok(contrast(bg, hex(c.fg)) >= 4.5, `${name} ${theme} ${t}° : texte sur la plage`);
      // Température en couleur sur le fond teinté des plages de la liste.
      const tint = over(rgba(c.tint), CARD[theme]);
      assert.ok(contrast(hex(c.accent), tint) >= 4.5, `${name} ${theme} ${t}° : température de la liste`);
      // Pas de vert : teintes hors 75–165, sauf quasi-gris.
      const { h, s } = hueSat(bg);
      assert.ok(s < 0.2 || h < 75 || h > 165, `${name} ${theme} ${t}° : teinte ${Math.round(h)} (vert)`);
    }
    // Deux demi-degrés courants voisins ne donnent jamais la même couleur.
    for (let t = 16; t < 21; t += 0.5) {
      assert.notEqual(tempColors(t, null, theme === "dark", name).bg, tempColors(t + 0.5, null, theme === "dark", name).bg, `${name} ${theme} ${t}°`);
    }
  }
  assert.notEqual(tempColors(19, null, false, name).bg, tempColors(19, null, true, name).bg, `${name} : dépend du thème`);
}
// Nuanciers « d'une seule rampe » : la luminance varie toujours dans le même sens de 16 à 21 °C.
for (const name of ["terre_cuite", "infrarouge", "braise"]) {
  for (const theme of ["light", "dark"]) {
    const L = [];
    for (let t = 16; t <= 21; t += 0.5) L.push(lum(hex(tempColors(t, null, theme === "dark", name).bg)));
    const up = L[L.length - 1] > L[0];
    L.slice(1).forEach((x, i) => assert.ok(up ? x >= L[i] : x <= L[i], `${name} ${theme} : luminance monotone`));
  }
}
// Terre cuite par défaut (sans palette, ou palette inconnue côté helper).
assert.equal(tempColors(17, null, false).bg, tempColors(17, null, false, "terre_cuite").bg);
assert.equal(tempColors(17, null, true, "nimporte").bg, tempColors(17, null, true, "terre_cuite").bg);
assert.equal(paletteOf({}), "terre_cuite");
assert.equal(paletteOf(undefined), "terre_cuite");
assert.equal(paletteOf({ palette: "" }), "terre_cuite");
assert.equal(paletteOf({ palette: "infrarouge" }), "infrarouge");
assert.throws(() => paletteOf({ palette: "classique" }), /palette doit valoir terre_cuite, infrarouge/);
assert.throws(() => paletteOf({ palette: "toString" }), /palette/);
// L'option `colors` prime, quel que soit le thème et le nuancier ; hors paliers, retour au nuancier.
const scale = parseScale([{ max: 18, color: "#123456", text_color: "#ffffff" }, { min: 21, color: "red", text_color: "black" }]);
assert.equal(tempColors(17, scale, true, "infrarouge").bg, "#123456");
assert.equal(tempColors(17, scale, false).fg, "#ffffff");
assert.equal(tempColors(22, scale, false).bg, "red");
assert.equal(tempColors(19.5, scale, true, "braise").bg, tempColors(19.5, null, true, "braise").bg);
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

// ---- Grille de la semaine (gridRows / selectedRow) -------------------------------
const { gridRows, selectedRow, copyTargets, copyTo, fmtDuration, focusSelector } = H;
assert.deepEqual(gridRows("all", 3).map((r) => [r.key, r.today]), [["all", true]]);
assert.deepEqual(gridRows("all", 3)[0].days, [0, 1, 2, 3, 4, 5, 6]);
assert.deepEqual(gridRows("weekday_weekend", 4).map((r) => [r.key, r.today]), [["weekdays", true], ["weekend", false]]);
assert.deepEqual(gridRows("weekday_weekend", 6).map((r) => r.today), [false, true]);
assert.deepEqual(gridRows("daily", 4).map((r) => r.key), DAYS);
assert.deepEqual(gridRows("daily", 4).filter((r) => r.today).map((r) => r.key), ["fri"]);

// Par défaut (expand_today) : la ligne d'aujourd'hui ; sans : aucune.
assert.equal(selectedRow("daily", undefined, 4, true), "fri");
assert.equal(selectedRow("weekday_weekend", undefined, 6, true), "weekend");
assert.equal(selectedRow("all", undefined, 2, true), "all");
assert.equal(selectedRow("daily", undefined, 4, false), null, "expand_today: false");
// Choix de l'utilisateur, conservé tant qu'il existe dans le layout.
assert.equal(selectedRow("daily", "mon", 4, true), "mon");
assert.equal(selectedRow("daily", "mon", 4, false), "mon");
assert.equal(selectedRow("daily", null, 4, true), null, "ligne refermée par l'utilisateur");
// Après un changement de layout, l'ancien choix n'existe plus : retour au défaut.
assert.equal(selectedRow("weekday_weekend", "mon", 4, true), "weekdays");
assert.equal(selectedRow("all", "weekend", 4, false), null);

// ---- Copier vers plusieurs jours (copyTargets / copyTo) ---------------------------
const cdata = () => ({
  enabled: true,
  profiles: { home: profile("daily"), away: profile("all") },
});
assert.deepEqual(copyTargets(cdata(), { profile: "home", key: "mon" }), [
  { profile: "home", keys: ["tue", "wed", "thu", "fri", "sat", "sun"] },
  { profile: "away", keys: ["all"] },
]);
assert.deepEqual(copyTargets(cdata(), { profile: "away", key: "all" }), [
  { profile: "home", keys: DAYS },
], "profil à une seule ligne : rien à copier en lui-même");
const wwData = cdata();
wwData.profiles.away.layout = "weekday_weekend";
assert.deepEqual(copyTargets(wwData, { profile: "away", key: "weekend" })[1], { profile: "away", keys: ["weekdays"] });

const src = cdata();
const before = JSON.stringify(src);
const copied = copyTo(src, { profile: "home", key: "mon" }, [
  { profile: "home", key: "tue" },
  { profile: "home", key: "sat" },
  { profile: "away", key: "all" },
  { profile: "home", key: "mon" }, // la source elle-même : ignorée
  { profile: "home", key: "nimporte" }, // clé inconnue : ignorée
  { profile: "vacances", key: "all" }, // profil inconnu : ignoré
]);
assert.equal(JSON.stringify(src), before, "copyTo ne modifie pas son entrée");
assert.deepEqual(DAYS.map((d) => copied.profiles.home.schedules[d][0].temp), [20, 20, 22, 23, 24, 20, 26]);
assert.equal(copied.profiles.away.schedules.all[0].temp, 20);
assert.equal(copied.profiles.home.schedules.nimporte, undefined);
assert.equal(copied.profiles.vacances, undefined);
copied.profiles.home.schedules.tue[0].temp = 5;
assert.equal(copied.profiles.home.schedules.sat[0].temp, 20, "chaque destination reçoit une copie indépendante");
assert.equal(copied.profiles.home.schedules.mon[0].temp, 20);
assert.deepEqual(copyTo(src, { profile: "home", key: "mon" }, []), src, "aucune destination : données identiques");

// ---- Compte à rebours de la dérogation ------------------------------------------
assert.equal(fmtDuration(110, "fr"), "1 h 50");
assert.equal(fmtDuration(65, "fr"), "1 h 05");
assert.equal(fmtDuration(110, "en"), "1 h 50 min");
assert.equal(fmtDuration(120, "fr"), "2 h");
assert.equal(fmtDuration(45, "fr"), "45 min");
assert.equal(fmtDuration(44.2, "fr"), "45 min", "minute entamée comptée");
assert.equal(fmtDuration(0, "fr"), "0 min");
assert.equal(fmtDuration(-3, "en"), "0 min");

// ---- Format compact (cardFormat / ribbon / ribbonTicks) -------------------------
const { cardFormat, ribbon, ribbonTicks } = H;
assert.equal(cardFormat({}), "full", "sans option : format actuel");
assert.equal(cardFormat(undefined), "full");
assert.equal(cardFormat({ format: "" }), "full");
assert.equal(cardFormat({ format: "compact" }), "compact");
assert.equal(cardFormat({ format: "full" }), "full");
assert.throws(() => cardFormat({ format: "mini" }), /format/);

const rib = (r) => r.map((p) => [p.start, p.end, p.temp, p.ovr]);
// Vendredi 18:40, dérogation 21,5° jusqu'à 20:30 : hachurée, puis 20,5° → 22:30, puis 17° jusqu'à 06:40 samedi
// (samedi 00:00 et 08:30 : week-end 17° puis 20,5° hors fenêtre).
assert.deepEqual(rib(ribbon(mkData(), "home", ovr, at(6, 18, 40))), [
  [0, 110, 21.5, true],
  [110, 230, 20.5, false],
  [230, 720, 17, false],
]);
assert.equal(ribbon(mkData(), "home", ovr, at(6, 18, 40))[1].at.getTime(), at(6, 20, 30).getTime());
// Sans dérogation, samedi 01:00 : 17° jusqu'à 08:30 puis 20,5°.
assert.deepEqual(rib(ribbon(mkData(), "home", null, at(7, 1, 0))), [
  [0, 450, 17, false],
  [450, 720, 20.5, false],
]);
// Dérogation à la même température que le planning : reste distincte (hachurée).
assert.deepEqual(rib(ribbon(mkData(), "home", { temp: 20.5, until: at(6, 19, 0).toISOString() }, at(6, 18, 40))).slice(0, 2), [
  [0, 20, 20.5, true],
  [20, 230, 20.5, false],
]);
// Dérogation expirée : ignorée.
assert.equal(ribbon(mkData(), "home", { temp: 25, until: at(6, 18, 0).toISOString() }, at(6, 18, 40))[0].ovr, false);
// Fenêtre plus courte que la dérogation : un seul morceau.
assert.deepEqual(rib(ribbon(mkData(), "home", ovr, at(6, 18, 40), 1)), [[0, 60, 21.5, true]]);
// Planification en pause : vide sans dérogation, sinon la dérogation puis « sans consigne ».
assert.deepEqual(ribbon(mkData(false), "home", null, at(6, 18, 40)), []);
assert.deepEqual(rib(ribbon(mkData(false), "home", ovr, at(6, 18, 40))), [
  [0, 110, 21.5, true],
  [110, 720, null, false],
]);
// Une seule consigne : un seul morceau ; profil Absent (layout all).
assert.deepEqual(rib(ribbon(flat, "home", null, at(6, 12, 0))), [[0, 720, 19, false]]);
assert.deepEqual(rib(ribbon(mkData(), "away", null, at(6, 18, 40))), [
  [0, 140, 16, false],
  [140, 710, 15, false],
  [710, 720, 16, false],
]);

const ticks = ribbonTicks(ribbon(mkData(), "home", ovr, at(6, 18, 40)), 720, 12);
assert.deepEqual(ticks.map((k) => Math.round(k.pos * 10) / 10), [0, 15.3, 31.9]);
assert.equal(ticks[0].at.getTime(), at(6, 18, 40).getTime(), "premier repère : maintenant");
// Repère trop proche du précédent : omis.
assert.deepEqual(ribbonTicks(ribbon(mkData(), "home", { temp: 20.5, until: at(6, 19, 0).toISOString() }, at(6, 18, 40)), 720, 12).map((k) => Math.round(k.pos)), [0, 32]);
assert.deepEqual(ribbonTicks([], 720, 12), []);

// ---- Focus conservé après un rendu complet --------------------------------------
assert.equal(focusSelector({ dataset: { action: "select", key: "mon" } }), '[data-action="select"][data-key="mon"]');
assert.equal(focusSelector({ dataset: { action: "copy-pick", target: "home:tue" } }), '[data-action="copy-pick"][data-target="home:tue"]');
assert.equal(focusSelector({ dataset: {}, id: "layout-select" }), "#layout-select");
assert.equal(focusSelector({ dataset: {} }), null);
assert.equal(focusSelector(null), null);

console.log("js OK");
