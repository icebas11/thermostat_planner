/* Thermostat Planner card — v0.7.0b3
 * Carte Lovelace sans dépendance : planning par plages horaires,
 * modes Maison / Absent, 3 modes de programmation des jours.
 */
(() => {
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const MIN_T = 5;
  const MAX_T = 35;
  const STEP = 0.5;
  // Actions qui modifient le planning (soumises au droit de modification).
  const EDIT_ACTIONS = new Set(["layout", "enabled-switch", "copy-apply", "edit", "add", "modal-remove", "modal-save"]);

  const I18N = {
    fr: {
      title: "Planning chauffage",
      home: "Maison",
      away: "Absent",
      tabHome: "Planning Maison",
      tabAway: "Planning Absent",
      settings: "Réglages",
      activeBadge: "Mode actif",
      activeShort: "actif",
      manualAway: "Passer en mode Absent",
      forcedBy: "Forcé Absent par",
      enabled: "Planification active",
      layout: "Programmer les jours",
      layout_all: "Tous les jours",
      layout_weekday_weekend: "Semaine + week-end",
      layout_daily: "Chaque jour",
      weekdays: "Lundi – Vendredi",
      weekend: "Samedi – Dimanche",
      all: "Tous les jours",
      days: { mon: "Lundi", tue: "Mardi", wed: "Mercredi", thu: "Jeudi", fri: "Vendredi", sat: "Samedi", sun: "Dimanche" },
      short: { mon: "Lun", tue: "Mar", wed: "Mer", thu: "Jeu", fri: "Ven", sat: "Sam", sun: "Dim", all: "L–D", weekdays: "L–V", weekend: "S–D" },
      today: "aujourd'hui",
      weekAria: "Jours du planning",
      pickDay: "Touche un jour pour voir et modifier ses plages.",
      pickDayRo: "Touche un jour pour voir ses plages.",
      copyTo: "Copier vers…",
      copyFrom: "Copier {day} vers :",
      copyApply: "Copier",
      remaining: "encore {d}",
      addBlock: "Ajouter une plage",
      editBlock: "Modifier la plage",
      newBlock: "Nouvelle plage",
      start: "Début",
      end: "Fin",
      temp: "Température",
      save: "Enregistrer",
      cancel: "Annuler",
      remove: "Supprimer",
      saving: "Enregistrement…",
      saved: "Enregistré",
      copied: "Copié",
      error: "Échec de l'enregistrement",
      connecting: "Connexion…",
      notLoaded: "Intégration Thermostat Planner non chargée. Vérifie qu'elle est ajoutée dans Paramètres › Appareils et services.",
      target: "Consigne",
      next: "prochain changement",
      nextAt: "Prochain changement à {time} : {temp}",
      room: "pièce",
      override: "Dérogation jusqu'à",
      resume: "Reprendre le planning",
      planned: "Planning",
      heating: "Chauffe en cours",
      idle: "Au repos",
      lower: "Baisser la consigne",
      raise: "Augmenter la consigne",
      unavailable: "Thermostat indisponible",
      off: "Planification en pause",
      readOnly: "Lecture seule : la modification du planning est réservée à certains utilisateurs.",
      allZones: "S'applique à toutes les zones",
      zoneAway: "Absent pour cette zone uniquement",
      zoneAwayHint: "Les autres zones suivent le mode commun",
      zoneAwayOn: "Cette zone est forcée en Absent (Zone absente)",
      ambiguous: "Plusieurs thermostats sont configurés : ajoute entry_id ou climate dans la configuration de la carte.",
      notFound: "Zone introuvable : vérifie entry_id ou climate dans la configuration de la carte.",
      eEmpty: "Renseigne une heure valide.",
      eOrder: "L'heure de fin doit être après l'heure de début.",
      eEraseBefore: "Le début doit rester après le début de la plage précédente.",
      eEraseAfter: "La fin doit rester avant la fin de la plage suivante.",
      eLast: "Il faut garder au moins une plage.",
      heatingShort: "chauffe",
      idleShort: "au repos",
      openPlanning: "Planning",
      openPlanningAria: "Ouvrir le planning complet",
      closePlanning: "Réduire",
      closePlanningAria: "Revenir à la carte compacte",
      nextHours: "Les {h} prochaines heures",
      nextShort: "{temp} à {time}",
      inDur: "dans {d}",
      untilT: "{temp} jusqu'à {time}",
      dayAria: "Historique du jour",
      dayPrev: "Jour précédent",
      dayNext: "Jour suivant",
      nowAt: "il est {time}",
      histLoading: "Chargement de l'historique…",
      histError: "Historique indisponible",
      histEmpty: "Aucune température enregistrée ce jour-là : le thermostat est peut-être exclu du recorder, ou ce jour a été purgé.",
      histNoMeas: "Le thermostat n'enregistre pas de température mesurée (attribut current_temperature).",
      planGuess: "Consigne passée reconstituée d'après le planning actuel : capteur Consigne introuvable ou sans historique.",
      chartAria: "{day} : consigne prévue et température mesurée. Détail dans le tableau des valeurs.",
      lgMeas: "mesurée",
      lgPlan: "prévue",
      lgLag: "retard de chauffe",
      lgHeat: "chauffe",
      tipRoom: "pièce",
      tipPlan: "prévu",
      tipHeatOn: "chauffe en cours",
      tipHeatOff: "chauffe à l'arrêt",
      reachTime: "pour atteindre {temp} à partir de {time}",
      notReached: "non atteinte",
      notReachedSub: "{temp} demandés depuis {time}",
      noRise: "aucune hausse de consigne ce jour-là",
      heatToday: "de chauffe depuis minuit",
      heatDay: "de chauffe sur la journée",
      devSince: "écart moyen à la consigne depuis {time}",
      devMidnight: "écart moyen à la consigne depuis minuit",
      devDay: "écart moyen à la consigne sur la journée",
      devNone: "écart moyen : consigne pas encore atteinte",
      showValues: "Voir les valeurs",
      hideValues: "Masquer les valeurs",
      tblCaption: "Valeurs heure par heure, {day}",
      thTime: "Heure",
      thRoom: "Pièce",
      thPlan: "Prévue",
      thHeat: "Chauffe (min)",
    },
    en: {
      title: "Heating schedule",
      home: "Home",
      away: "Away",
      tabHome: "Home schedule",
      tabAway: "Away schedule",
      settings: "Settings",
      activeBadge: "Active mode",
      activeShort: "active",
      manualAway: "Switch to Away mode",
      forcedBy: "Forced Away by",
      enabled: "Scheduling enabled",
      layout: "Schedule days",
      layout_all: "Every day",
      layout_weekday_weekend: "Weekdays + weekend",
      layout_daily: "Each day",
      weekdays: "Monday – Friday",
      weekend: "Saturday – Sunday",
      all: "Every day",
      days: { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" },
      short: { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun", all: "Mon–Sun", weekdays: "Mon–Fri", weekend: "Sat–Sun" },
      today: "today",
      weekAria: "Schedule days",
      pickDay: "Tap a day to see and edit its time blocks.",
      pickDayRo: "Tap a day to see its time blocks.",
      copyTo: "Copy to…",
      copyFrom: "Copy {day} to:",
      copyApply: "Copy",
      remaining: "{d} left",
      addBlock: "Add a time block",
      editBlock: "Edit time block",
      newBlock: "New time block",
      start: "Start",
      end: "End",
      temp: "Temperature",
      save: "Save",
      cancel: "Cancel",
      remove: "Delete",
      saving: "Saving…",
      saved: "Saved",
      copied: "Copied",
      error: "Could not save",
      connecting: "Connecting…",
      notLoaded: "Thermostat Planner integration is not loaded. Make sure it is added under Settings › Devices & services.",
      target: "Target",
      next: "next change",
      nextAt: "Next change at {time}: {temp}",
      room: "room",
      override: "Override until",
      resume: "Resume schedule",
      planned: "Schedule",
      heating: "Heating",
      idle: "Idle",
      lower: "Lower target",
      raise: "Raise target",
      unavailable: "Thermostat unavailable",
      off: "Scheduling paused",
      readOnly: "Read-only: schedule editing is restricted to some users.",
      allZones: "Applies to every zone",
      zoneAway: "Away for this zone only",
      zoneAwayHint: "Other zones follow the shared mode",
      zoneAwayOn: "This zone is forced to Away (Zone away)",
      ambiguous: "Several thermostats are configured: add entry_id or climate to the card configuration.",
      notFound: "Zone not found: check entry_id or climate in the card configuration.",
      eEmpty: "Enter a valid time.",
      eOrder: "End time must be after start time.",
      eEraseBefore: "Start must stay after the previous block's start.",
      eEraseAfter: "End must stay before the next block's end.",
      eLast: "At least one block is required.",
      heatingShort: "heating",
      idleShort: "idle",
      openPlanning: "Schedule",
      openPlanningAria: "Open the full schedule",
      closePlanning: "Collapse",
      closePlanningAria: "Back to the compact card",
      nextHours: "Next {h} hours",
      nextShort: "{temp} at {time}",
      inDur: "in {d}",
      untilT: "{temp} until {time}",
      dayAria: "Day history",
      dayPrev: "Previous day",
      dayNext: "Next day",
      nowAt: "now {time}",
      histLoading: "Loading history…",
      histError: "History unavailable",
      histEmpty: "No temperature recorded that day: the thermostat may be excluded from the recorder, or the day was purged.",
      histNoMeas: "The thermostat does not record a measured temperature (current_temperature attribute).",
      planGuess: "Past target rebuilt from the current schedule: Target sensor not found or without history.",
      chartAria: "{day}: planned target and measured temperature. Details in the values table.",
      lgMeas: "measured",
      lgPlan: "planned",
      lgLag: "heating delay",
      lgHeat: "heating",
      tipRoom: "room",
      tipPlan: "planned",
      tipHeatOn: "heating",
      tipHeatOff: "heating off",
      reachTime: "to reach {temp} from {time}",
      notReached: "not reached",
      notReachedSub: "{temp} requested since {time}",
      noRise: "no target increase that day",
      heatToday: "of heating since midnight",
      heatDay: "of heating over the day",
      devSince: "average gap to target since {time}",
      devMidnight: "average gap to target since midnight",
      devDay: "average gap to target over the day",
      devNone: "average gap: target not reached yet",
      showValues: "Show values",
      hideValues: "Hide values",
      tblCaption: "Hourly values, {day}",
      thTime: "Time",
      thRoom: "Room",
      thPlan: "Planned",
      thHeat: "Heating (min)",
    },
  };

  // ---- Fonctions pures (testables) -------------------------------------
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const toMin = (s) => {
    const [h, m] = String(s).split(":");
    return parseInt(h, 10) * 60 + parseInt(m, 10);
  };
  const toStr = (m) =>
    String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const intervals = (segs) =>
    segs.map((g, i) => ({
      s: toMin(g.start),
      e: i < segs.length - 1 ? toMin(segs[i + 1].start) : 1440,
      t: g.temp,
    }));
  /** Intervalles → segments triés, en fusionnant les voisins de même température. */
  const fromIntervals = (ivs) =>
    ivs
      .slice()
      .sort((a, b) => a.s - b.s)
      .filter((iv, i, a) => i === 0 || iv.t !== a[i - 1].t)
      .map((iv) => ({ start: toStr(iv.s), temp: iv.t }));

  /** Peint [s, e[ avec la température t, en découpant les plages existantes (voisines identiques fusionnées). */
  function paint(segs, s, e, t) {
    const out = [];
    intervals(segs).forEach((iv) => {
      if (iv.e <= s || iv.s >= e) {
        out.push(iv);
        return;
      }
      if (iv.s < s) out.push({ s: iv.s, e: s, t: iv.t });
      if (iv.e > e) out.push({ s: e, e: iv.e, t: iv.t });
    });
    out.push({ s, e, t });
    return fromIntervals(out);
  }

  /** Modifie la plage i ; la fin déplace le début de la suivante. */
  function applyEdit(segs, i, start, end, temp) {
    const n = segs.length;
    const ivs = intervals(segs);
    const ns = i === 0 ? 0 : start;
    const ne = i === n - 1 ? 1440 : end;
    if (Number.isNaN(ns) || Number.isNaN(ne)) return { error: "eEmpty" };
    if (ne <= ns) return { error: "eOrder" };
    if (i > 0 && ns <= ivs[i - 1].s) return { error: "eEraseBefore" };
    if (i < n - 1 && ne >= ivs[i + 1].e) return { error: "eEraseAfter" };
    const c = clone(segs);
    c[i].start = toStr(ns);
    c[i].temp = temp;
    if (i < n - 1) c[i + 1].start = toStr(ne);
    return { segs: c };
  }

  /** Supprime la plage i : la précédente (ou la suivante) s'étend. */
  function removeBlock(segs, i) {
    if (segs.length < 2) return { error: "eLast" };
    const c = clone(segs);
    c.splice(i, 1);
    if (i === 0) c[0].start = "00:00";
    return { segs: c };
  }

  /** Proposition de plage pour « Ajouter » : le tiers central de la plage la plus longue. */
  function suggestRange(segs) {
    const ivs = intervals(segs);
    let best = ivs[0];
    ivs.forEach((iv) => {
      if (iv.e - iv.s > best.e - best.s) best = iv;
    });
    const dur = best.e - best.s;
    const r5 = (x) => Math.round(x / 5) * 5;
    let s = best.s + r5(dur / 3);
    let e = best.s + r5((dur * 2) / 3);
    if (s <= best.s || e <= s || e > best.e) {
      s = best.s;
      e = best.e;
    }
    return { s, e, t: best.t };
  }

  /** Consigne après un appui ± (delta = 0 : simple mise aux bornes), bornée et arrondie au pas. */
  function stepSetpoint(value, delta, lim) {
    const { min, max, step } = lim;
    let v = Math.round(Math.max(min, Math.min(max, value + delta)) / step) * step;
    // L'arrondi au pas ne doit pas faire sortir des bornes (ex. max 30,3 et pas de 0,5).
    if (v > max) v = Math.floor(max / step + 1e-9) * step;
    if (v < min) v = Math.ceil(min / step - 1e-9) * step;
    if (v > max) v = min; // bornes plus resserrées que le pas
    return Number(v.toFixed(2));
  }

  /** Bornes d'une consigne de planning : le serveur arrondit au 0,5 °C, le pas est donc un multiple de 0,5. */
  function scheduleLimits(lim) {
    const step = Math.max(1, Math.ceil(lim.step / STEP - 1e-9)) * STEP;
    const min = Math.ceil(lim.min / step - 1e-9) * step;
    const max = Math.floor(lim.max / step + 1e-9) * step;
    return max >= min ? { min, max, step } : { min: lim.min, max: lim.max, step };
  }

  const keyFor = (layout, weekday) =>
    layout === "all" ? "all" : layout === "weekday_weekend" ? (weekday < 5 ? "weekdays" : "weekend") : DAYS[weekday];

  /** Change de mode de programmation en reprenant les plannings actuels. */
  function seedLayout(profile, next) {
    const resolve = (wd) => clone(profile.schedules[keyFor(profile.layout, wd)]);
    if (next === "all") profile.schedules.all = resolve(0);
    if (next === "weekday_weekend") {
      profile.schedules.weekdays = resolve(0);
      profile.schedules.weekend = resolve(5);
    }
    if (next === "daily") DAYS.forEach((d, i) => (profile.schedules[d] = resolve(i)));
    profile.layout = next;
  }

  let colorCtx = null;
  /** Couleur CSS → [r, g, b] (0-255), ou null si non résoluble (ex. var(--x)). */
  function rgbOf(color) {
    try {
      colorCtx = colorCtx || document.createElement("canvas").getContext("2d");
      const sentinel = "#010203";
      colorCtx.fillStyle = sentinel;
      colorCtx.fillStyle = color;
      const v = colorCtx.fillStyle;
      if (v === sentinel && String(color).toLowerCase() !== sentinel) return null;
      if (v.startsWith("#")) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
      const m = v.match(/\d+(\.\d+)?/g);
      return m ? m.slice(0, 3).map(Number) : null;
    } catch (e) {
      return null;
    }
  }

  /** Texte noir ou blanc selon la luminance du fond. */
  function textOn(color) {
    const rgb = rgbOf(color);
    if (!rgb) return "#fff";
    const [r, g, b] = rgb.map((c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "rgba(0,0,0,.85)" : "#fff";
  }

  /** Valide et prépare l'option `colors` : [{ min?, max?, color, text_color? }]. */
  function parseScale(colors) {
    if (colors === undefined || colors === null) return null;
    if (!Array.isArray(colors)) throw new Error("thermostat-planner-card: `colors` doit être une liste");
    return colors.map((c, i) => {
      if (!c || typeof c.color !== "string" || !c.color)
        throw new Error(`thermostat-planner-card: colors[${i}].color est requis`);
      const num = (k) => {
        if (c[k] === undefined || c[k] === null) return undefined;
        const n = Number(c[k]);
        if (Number.isNaN(n)) throw new Error(`thermostat-planner-card: colors[${i}].${k} doit être un nombre`);
        return n;
      };
      return {
        min: num("min"),
        max: num("max"),
        bg: c.color,
        fg: c.text_color || textOn(c.color),
        accent: c.color,
        tint: `color-mix(in srgb, ${c.color} 16%, transparent)`,
      };
    });
  }

  // ---- Nuanciers (option `palette`) ------------------------------------
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgbHex = (rgb) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
  /** h en degrés, s et l de 0 à 100 → [r, g, b] de 0 à 255. */
  function hslRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return 255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return [f(0), f(8), f(4)];
  }
  /** [r, g, b] de 0 à 255 → [h en degrés, s et l de 0 à 1]. */
  function rgbHsl(rgb) {
    const [r, g, b] = rgb.map((c) => c / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
  }
  /** Luminance relative WCAG d'un [r, g, b] de 0 à 255. */
  function luminance(rgb) {
    const [r, g, b] = rgb.map((c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  /** Interpolation entre des repères [[k, "#rrggbb"], …], k de 0 à 1. */
  function ramp(stops, k) {
    k = clamp01(k);
    let i = 0;
    while (i < stops.length - 2 && k > stops[i + 1][0]) i++;
    const [k0, c0] = stops[i];
    const [k1, c1] = stops[i + 1];
    const u = clamp01((k - k0) / (k1 - k0));
    const a = hexRgb(c0);
    const b = hexRgb(c1);
    return a.map((x, j) => x + (b[j] - x) * u);
  }
  // L'essentiel des consignes d'un planning tient entre 16 et 21 °C : c'est là que les couleurs varient.
  const spread = (t) => clamp01((t - 16) / 5);
  const COMFORT = 18.5; // seuil des nuanciers à deux rampes (froid / chaud)
  /** Nuanciers : (température, thème sombre) → [r, g, b]. Aucun ne passe par le vert. */
  const PALETTES = {
    // Du sable à la brique : la teinte et la clarté changent ensemble.
    terre_cuite: (t, dark) =>
      ramp(
        dark
          ? [[0, "#3e3526"], [0.3, "#6e5427"], [0.55, "#a2602b"], [0.8, "#c9553a"], [1, "#e0614c"]]
          : [[0, "#fbedc4"], [0.3, "#f7cd85"], [0.55, "#f09a52"], [0.8, "#dc5e3c"], [1, "#b2342d"]],
        spread(t)
      ),
    // Caméra thermique : violet nuit, cramoisi, orange, jaune.
    infrarouge: (t, dark) =>
      ramp(
        dark
          ? [[0, "#2c1b4d"], [0.28, "#6b1f62"], [0.55, "#b6304e"], [0.8, "#ea6a2a"], [1, "#f7c548"]]
          : [[0, "#46306e"], [0.28, "#8b2b6c"], [0.55, "#c8414a"], [0.8, "#ef8031"], [1, "#f5b73d"]],
        spread(t)
      ),
    // Le ciel au fil de la journée : bleu nuit, ciel, crème, or, soleil.
    nuit_jour: (t, dark) =>
      ramp(
        dark
          ? [[0, "#1f2f5e"], [0.3, "#3a6aa8"], [0.5, "#8ab6dc"], [0.6, "#e6dcc0"], [0.72, "#e9c463"], [1, "#ef8530"]]
          : [[0, "#2f4f8f"], [0.3, "#5f90c9"], [0.5, "#a9cbe8"], [0.6, "#f1e4c4"], [0.72, "#f0c862"], [1, "#e9792b"]],
        spread(t)
      ),
    // Une seule teinte, de la cendre à la braise.
    braise: (t, dark) => {
      const k = spread(t);
      return dark ? hslRgb(22, 20 + 72 * k, 16 + 46 * k) : hslRgb(24, 30 + 64 * k, 93 - 47 * k);
    },
    // Bleu glacier sous le seuil de confort, orange au-dessus, sans gris.
    glace_feu: (t, dark) => {
      const i = clamp01((Math.abs(t - COMFORT) + 0.5) / 3);
      if (t < COMFORT) return dark ? hslRgb(198, 50 + 30 * i, 62 - 30 * i) : hslRgb(198, 60 + 25 * i, 86 - 40 * i);
      return dark ? hslRgb(26, 65 + 25 * i, 64 - 18 * i) : hslRgb(26, 85, 84 - 36 * i);
    },
    // Bleu sous le seuil, rouge au-dessus, gris clair au seuil.
    thermometre: (t, dark) => {
      const i = clamp01(Math.abs(t - COMFORT) / 3);
      if (Math.abs(t - COMFORT) < 0.01) return dark ? hslRgb(30, 6, 46) : hslRgb(30, 8, 88);
      if (t < COMFORT) return dark ? hslRgb(212, 30 + 45 * i, 54 - 20 * i) : hslRgb(212, 50 + 30 * i, 86 - 34 * i);
      return dark ? hslRgb(8, 38 + 40 * i, 56 - 16 * i) : hslRgb(8, 65 + 20 * i, 87 - 34 * i);
    },
  };
  const DEFAULT_PALETTE = "terre_cuite";

  /** Nuancier choisi par l'option `palette` (terre_cuite par défaut). */
  function paletteOf(config) {
    const p = config && config.palette;
    if (p === undefined || p === null || p === "") return DEFAULT_PALETTE;
    if (!Object.prototype.hasOwnProperty.call(PALETTES, p))
      throw new Error(`thermostat-planner-card: palette doit valoir ${Object.keys(PALETTES).join(", ")}`);
    return p;
  }

  /**
   * Couleurs d'une température : palier de l'option `colors` (premier qui correspond), sinon le
   * nuancier `palette`, dans sa variante claire ou sombre. bg / fg : plage de la barre (texte noir
   * ou blanc, le plus contrasté) ; accent / tint : température en couleur sur fond teinté (liste des plages).
   */
  function tempColors(t, scale, dark, palette) {
    const hit =
      scale &&
      scale.find((c) => (c.min === undefined || t >= c.min) && (c.max === undefined || t <= c.max));
    if (hit) return hit;
    const rgb = (PALETTES[palette] || PALETTES[DEFAULT_PALETTE])(Number(t), !!dark).map((c) => Math.round(c));
    const lum = luminance(rgb);
    const [h, s] = rgbHsl(rgb);
    // Température en couleur sur un fond teinté : assez foncée (thème clair) ou claire (sombre).
    let l = dark ? 78 : 32;
    let accent = hslRgb(h, s * 100, l);
    while (dark ? luminance(accent) < 0.42 && l < 96 : luminance(accent) > 0.12 && l > 6) {
      l += dark ? 2 : -2;
      accent = hslRgb(h, s * 100, l);
    }
    return {
      bg: rgbHex(rgb),
      fg: (lum + 0.05) / 0.05 >= 1.05 / (lum + 0.05) ? "#000000" : "#ffffff",
      accent: rgbHex(accent),
      tint: `rgb(${rgb.join(" ")} / 0.22)`,
    };
  }

  /** Température au format local : virgule en français (20,5), point sinon (20.5). */
  function fmtTemp(t, lang) {
    const n = Number(t);
    const s = Number.isInteger(n) ? String(n) : n.toFixed(1);
    return lang === "fr" ? s.replace(".", ",") : s;
  }

  const weekdayOf = (date) => (date.getDay() + 6) % 7; // 0 = lundi

  /** Consigne du planning d'un profil à l'instant `date` (heure locale), comme schedule.target_for. */
  function targetAt(profile, date) {
    const segs = profile.schedules[keyFor(profile.layout, weekdayOf(date))];
    const m = date.getHours() * 60 + date.getMinutes();
    let temp = segs[0].temp;
    segs.forEach((g) => {
      if (toMin(g.start) <= m) temp = g.temp;
    });
    return Number(temp);
  }

  /**
   * Prochain changement de consigne affiché par la carte : { at: Date, temp } ou null.
   * Même règle que schedule.planned côté serveur : pendant une dérogation, sa fin puis la
   * consigne du planning à cet instant (temp null si la planification est en pause) ;
   * sinon le prochain début de plage de température différente (sur 8 jours), ou null
   * si la planification est en pause.
   */
  function upcoming(data, mode, override, now) {
    const profile = data.profiles[mode];
    if (override && override.until) {
      const at = new Date(override.until);
      if (Number.isNaN(at.getTime())) return null;
      return { at, temp: data.enabled ? targetAt(profile, at) : null };
    }
    if (!data.enabled) return null;
    const current = targetAt(profile, now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (let offset = 0; offset <= 8; offset++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const segs = profile.schedules[keyFor(profile.layout, weekdayOf(day))];
      for (const g of segs) {
        const start = toMin(g.start);
        if (offset === 0 && start <= nowMin) continue;
        if (Number(g.temp) !== current) {
          return { at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(start / 60), start % 60), temp: Number(g.temp) };
        }
      }
    }
    return null;
  }

  /** Zone visée d'après la config de la carte : { entry_id } et/ou { climate }, ou {} (zone unique). */
  function targetOf(config) {
    const out = {};
    ["entry_id", "climate"].forEach((k) => {
      const v = config && config[k];
      if (v === undefined || v === null || v === "") return;
      if (typeof v !== "string") throw new Error(`thermostat-planner-card: ${k} doit être une chaîne`);
      out[k] = v.trim();
    });
    if (out.climate && !out.climate.startsWith("climate."))
      throw new Error("thermostat-planner-card: climate doit être une entité climate.xxx");
    return out;
  }

  /** Message WebSocket complété par la zone visée. */
  const withTarget = (msg, target) => ({ ...msg, ...(target || {}) });

  /** Titre par défaut : suivi du nom de la zone dès qu'il y a plusieurs zones. */
  function defaultTitle(base, state) {
    return state && state.zone_count > 1 && state.zone_name ? `${base} · ${state.zone_name}` : base;
  }

  /**
   * Affichage de « Absent pour cette zone uniquement » :
   * "row" (interrupteur, option show_zone_away: true), "hint" (option absente mais
   * zone forcée en Absent : simple mention, pour expliquer le mode), ou null.
   * Ancien serveur sans zone_away : rien.
   */
  function zoneAwayDisplay(config, state) {
    if (!state || state.zone_away === undefined) return null;
    if (config && config.show_zone_away === true) return "row";
    return state.zone_away ? "hint" : null;
  }

  /** Clé de traduction d'une erreur d'abonnement (null : message générique « non chargé »). */
  const subscribeErrorKey = (err) =>
    err && err.code === "ambiguous" ? "ambiguous" : err && err.code === "not_found" ? "notFound" : null;

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Toutes les clés de planning stockées (schedule.SCHEDULE_KEYS côté serveur).
  const ALL_KEYS = new Set(["all", "weekdays", "weekend", ...DAYS]);

  /**
   * Lignes de la grille de la semaine pour un layout : [{ key, days, today }].
   * `all` : une ligne ; `weekday_weekend` : semaine et week-end ; `daily` : les sept jours.
   */
  function gridRows(layout, weekday) {
    if (layout === "all") return [{ key: "all", days: [0, 1, 2, 3, 4, 5, 6], today: true }];
    if (layout === "weekday_weekend")
      return [
        { key: "weekdays", days: [0, 1, 2, 3, 4], today: weekday < 5 },
        { key: "weekend", days: [5, 6], today: weekday >= 5 },
      ];
    return DAYS.map((d, i) => ({ key: d, days: [i], today: i === weekday }));
  }

  /**
   * Ligne sélectionnée dans la grille : le choix de l'utilisateur s'il existe dans ce layout
   * (null : aucune, l'utilisateur a refermé), sinon la ligne d'aujourd'hui si `expand`
   * (option expand_today), sinon aucune.
   */
  function selectedRow(layout, choice, weekday, expand) {
    if (choice === null) return null;
    if (choice !== undefined && gridRows(layout, weekday).some((r) => r.key === choice)) return choice;
    return expand ? keyFor(layout, weekday) : null;
  }

  /** Destinations proposées pour copier la ligne `src` ({ profile, key }) : lignes de chaque profil, sauf la source. */
  function copyTargets(data, src) {
    return ["home", "away"]
      .filter((profile) => data.profiles[profile])
      .map((profile) => ({
        profile,
        keys: gridRows(data.profiles[profile].layout, 0)
          .map((r) => r.key)
          .filter((k) => !(profile === src.profile && k === src.key)),
      }))
      .filter((g) => g.keys.length);
  }

  /** Copie le planning de `src` vers chaque destination [{ profile, key }] ; renvoie de nouvelles données. */
  function copyTo(data, src, targets) {
    const out = clone(data);
    const segs = data.profiles[src.profile].schedules[src.key];
    targets.forEach(({ profile, key }) => {
      if ((profile === src.profile && key === src.key) || !ALL_KEYS.has(key) || !out.profiles[profile]) return;
      out.profiles[profile].schedules[key] = clone(segs);
    });
    return out;
  }

  /** Durée en minutes → « 1 h 50 », « 45 min », « 2 h » (en : « 1 h 50 min »). Arrondi à la minute supérieure. */
  function fmtDuration(minutes, lang) {
    const m = Math.max(0, Math.ceil(minutes - 1e-9));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (!r) return `${h} h`;
    return lang === "fr" ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h ${r} min`;
  }

  /** Format de la carte (option `format`) : "full" (par défaut, planning complet) ou "compact" (coup d'œil). */
  function cardFormat(config) {
    const f = config && config.format;
    if (f === undefined || f === null || f === "") return "full";
    if (f !== "full" && f !== "compact")
      throw new Error('thermostat-planner-card: format doit valoir "full" ou "compact"');
    return f;
  }

  /**
   * Ruban des `hours` prochaines heures à partir de `now` : [{ start, end, temp, ovr, at }],
   * `start` / `end` en minutes depuis `now`, `at` la date de début. La dérogation (ovr: true) passe
   * avant le planning ; temp null si la planification est en pause. Plages voisines identiques fusionnées.
   * Liste vide si la planification est en pause et qu'il n'y a pas de dérogation.
   */
  function ribbon(data, mode, override, now, hours = 12) {
    const t0 = now.getTime();
    const t1 = t0 + hours * 3600000;
    let until = null;
    if (override && override.until) {
      const u = new Date(override.until).getTime();
      if (!Number.isNaN(u) && u > t0) until = u;
    }
    if (!data.enabled && until === null) return [];
    const profile = data.profiles[mode];
    const cuts = new Set([t0, t1]);
    if (until !== null && until < t1) cuts.add(until);
    if (data.enabled) {
      for (let off = 0; off <= Math.ceil(hours / 24) + 1; off++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
        profile.schedules[keyFor(profile.layout, weekdayOf(day))].forEach((g) => {
          const m = toMin(g.start);
          const ts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60).getTime();
          if (ts > t0 && ts < t1) cuts.add(ts);
        });
      }
    }
    const pts = [...cuts].sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const ovr = until !== null && a < until;
      const temp = ovr ? Number(override.temp) : data.enabled ? targetAt(profile, new Date(a)) : null;
      const last = out[out.length - 1];
      const end = (pts[i + 1] - t0) / 60000;
      if (last && last.temp === temp && last.ovr === ovr) last.end = end;
      else out.push({ start: (a - t0) / 60000, end, temp, ovr, at: new Date(a) });
    }
    return out;
  }

  /**
   * Repères sous le ruban : début de chaque plage, en % de `total` minutes. Le premier (maintenant) est
   * toujours gardé ; un repère trop proche du précédent (moins de `minGap` %) est omis.
   */
  function ribbonTicks(pieces, total, minGap) {
    const out = [];
    pieces.forEach((p) => {
      const pos = (p.start / total) * 100;
      if (out.length && pos - out[out.length - 1].pos < minGap) return;
      out.push({ pos, at: p.at });
    });
    return out;
  }

  /** Sélecteur CSS qui retrouve un élément `data-action` après un nouveau rendu (pour lui rendre le focus). */
  function focusSelector(el) {
    if (!el || !el.dataset || !el.dataset.action) return el && el.id ? `#${el.id}` : null;
    return ["action", "key", "profile", "target", "dir", "index"]
      .filter((k) => el.dataset[k] !== undefined)
      .map((k) => `[data-${k}="${String(el.dataset[k]).replace(/["\\]/g, "\\$&")}"]`)
      .join("");
  }

  // ---- Panneau du jour : historique (fonctions pures) ---------------------
  // Minutes depuis le début du jour affiché ; une série est une liste d'intervalles { s, e, v }.
  const HIST_DEFAULT_DAYS = 10; // purge par défaut du recorder
  const REACH_TOL = 0.15; // consigne « atteinte » à 0,15 °C près (arrondis des thermostats)

  /** Option history_days : jours consultables, aujourd'hui compris (10 par défaut). */
  function historyDays(config) {
    const v = config && config.history_days;
    if (v === undefined || v === null || v === "") return HIST_DEFAULT_DAYS;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 365)
      throw new Error("thermostat-planner-card: history_days doit être un entier de 1 à 365");
    return n;
  }

  /**
   * Capteur « Consigne » de la zone, d'après le registre d'entités du frontend (hass.entities,
   * hass.devices) : plateforme thermostat_planner, clé de traduction "target", appareil rattaché
   * à l'entrée `entryId`. À défaut d'appareil identifiable, l'unique capteur de ce type. Sinon null.
   */
  function findTargetSensor(entities, devices, entryId) {
    const targets = Object.values(entities || {}).filter(
      (e) => e && e.platform === "thermostat_planner" && e.translation_key === "target" && String(e.entity_id).startsWith("sensor.")
    );
    const mine = targets.filter((e) => {
      const d = devices && e.device_id && devices[e.device_id];
      return d && Array.isArray(d.config_entries) && d.config_entries.includes(entryId);
    });
    if (mine.length === 1) return mine[0].entity_id;
    if (!mine.length && targets.length === 1) return targets[0].entity_id;
    return null;
  }

  /**
   * États d'une entité renvoyés par history/history_during_period → [{ at (ms), s, a }] triés.
   * Format compressé ({ s, a, lu, lc }, secondes) ou complet ({ state, attributes, last_updated }) ;
   * un état sans attributs (minimal_response) reprend ceux du précédent.
   */
  function histStates(list) {
    let attrs = {};
    return (Array.isArray(list) ? list : [])
      .map((x) => ({
        at:
          x.lu !== undefined ? Number(x.lu) * 1000 : x.lc !== undefined ? Number(x.lc) * 1000 : Date.parse(x.last_updated || x.last_changed),
        s: x.s !== undefined ? x.s : x.state,
        a: x.a || x.attributes,
      }))
      .filter((x) => Number.isFinite(x.at))
      .sort((p, q) => p.at - q.at)
      .map((x) => {
        if (x.a) attrs = x.a;
        return { at: x.at, s: x.s, a: x.a || attrs };
      });
  }

  const isUp = (s) => s !== "unavailable" && s !== "unknown" && s !== undefined && s !== null;
  const numOrNull = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

  /** Ajoute { s, e, v } à une série en fusionnant avec le précédent s'il est contigu et de même valeur. */
  function pushStep(out, s, e, v) {
    if (e <= s) return;
    const last = out[out.length - 1];
    if (last && last.v === v && Math.abs(last.e - s) < 1e-6) last.e = e;
    else out.push({ s, e, v });
  }

  /** États → série { s, e, v } bornée à [0, upto] ; `pick(état)` donne la valeur (null : trou). */
  function holdSteps(states, start, upto, pick) {
    const out = [];
    states.forEach((x, i) => {
      const s = Math.max(0, (x.at - start) / 60000);
      const e = Math.min(upto, i < states.length - 1 ? (states[i + 1].at - start) / 60000 : upto);
      pushStep(out, s, e, pick(x));
    });
    return out;
  }

  /** Valeur d'une série à la minute m (null hors série ou dans un trou). */
  function valueAt(steps, m) {
    for (let i = 0; i < steps.length; i++) {
      const g = steps[i];
      if (m >= g.s && (m < g.e || (i === steps.length - 1 && m === g.e))) return g.v;
    }
    return null;
  }

  /** Moyenne par tranches de `bucket` minutes (pondérée par la durée) ; tranche à moitié vide : null. */
  function resample(steps, bucket) {
    const out = [];
    if (!steps.length) return out;
    const end = steps[steps.length - 1].e;
    let j = 0;
    for (let b = Math.floor(steps[0].s / bucket) * bucket; b < end; b += bucket) {
      const s0 = Math.max(b, steps[0].s);
      const be = Math.min(end, b + bucket);
      let sum = 0;
      let w = 0;
      while (j < steps.length && steps[j].e <= b) j++;
      for (let k = j; k < steps.length && steps[k].s < be; k++) {
        const g = steps[k];
        const o = Math.min(be, g.e) - Math.max(b, g.s);
        if (g.v !== null && o > 0) {
          sum += g.v * o;
          w += o;
        }
      }
      pushStep(out, s0, be, w > 0 && w >= (be - s0) / 2 ? Math.round((sum / w) * 100) / 100 : null);
    }
    return out;
  }

  /**
   * Série mesurée → tracés [[[m, t], …], …] (un par portion sans trou). Un palier long garde sa
   * valeur jusqu'à `ramp` minutes avant le suivant : la courbe ne « glisse » pas sur des heures.
   */
  function measRuns(steps, ramp = 10) {
    const runs = [];
    let cur = null;
    steps.forEach((g, i) => {
      if (g.v === null) {
        cur = null;
        return;
      }
      if (!cur) runs.push((cur = []));
      cur.push([g.s, g.v]);
      const next = steps[i + 1];
      const ends = !next || next.v === null || Math.abs(next.s - g.e) > 1e-6;
      if (ends) {
        cur.push([g.e, g.v]);
        cur = null;
      } else if (g.e - g.s > 2 * ramp) cur.push([g.e - ramp, g.v]);
    });
    return runs;
  }

  /** Tracé SVG lissé (cubique monotone : pas de dépassement entre deux points) de points [x, y]. */
  function smoothPath(P) {
    const f = (v) => (Math.round(v * 10) / 10).toString();
    const n = P.length;
    if (!n) return "";
    let d = `M${f(P[0][0])},${f(P[0][1])}`;
    if (n === 1) return d;
    const dx = [];
    const sl = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = P[i + 1][0] - P[i][0];
      sl[i] = dx[i] ? (P[i + 1][1] - P[i][1]) / dx[i] : 0;
    }
    const tg = [sl[0]];
    for (let i = 1; i < n - 1; i++) {
      tg[i] =
        sl[i - 1] * sl[i] <= 0 || !dx[i - 1] || !dx[i]
          ? 0
          : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / sl[i - 1] + (dx[i] + 2 * dx[i - 1]) / sl[i]);
    }
    tg[n - 1] = sl[n - 2];
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += ` C${f(P[i][0] + h)},${f(P[i][1] + tg[i] * h)} ${f(P[i + 1][0] - h)},${f(P[i + 1][1] - tg[i + 1] * h)} ${f(P[i + 1][0])},${f(P[i + 1][1])}`;
    }
    return d;
  }

  /**
   * Retards de chauffe : à chaque hausse de consigne avant `upto`, du début de la plage au moment
   * où la pièce l'atteint (à `tol` près). [{ s, e, t, from, reached }] ; reached false : pas encore
   * (ou jamais) atteinte avant la fin de la plage. Pièce déjà à la consigne : e = s. Sans mesure : ignorée.
   */
  function heatLags(plan, meas, upto, tol = REACH_TOL) {
    const out = [];
    for (let i = 1; i < plan.length; i++) {
      const p = plan[i];
      const q = plan[i - 1];
      if (p.s >= upto || p.v === null || q.v === null || p.v <= q.v || Math.abs(q.e - p.s) > 1e-6) continue;
      const before = valueAt(meas, p.s);
      if (before === null) continue;
      const goal = p.v - tol;
      const limit = Math.min(p.e, upto);
      let hit = before >= goal ? p.s : null;
      for (let k = 0; hit === null && k < meas.length; k++) {
        const g = meas[k];
        if (g.e > p.s && g.s < limit && g.v !== null && g.v >= goal) hit = Math.max(g.s, p.s);
      }
      out.push({ s: p.s, e: hit === null ? limit : hit, t: p.v, from: q.v, reached: hit !== null });
    }
    return out;
  }

  /** Minutes de chauffe dans [a, b[. */
  const heatIn = (heat, a, b) => heat.reduce((n, g) => n + Math.max(0, Math.min(b, g.e) - Math.max(a, g.s)), 0);

  /** Écart moyen (mesure − consigne) pondéré par la durée sur [a, b], ou null (moins de 10 min de données). */
  function meanDeviation(meas, plan, a, b) {
    const cuts = new Set([a, b]);
    meas.concat(plan).forEach((g) => [g.s, g.e].forEach((m) => m > a && m < b && cuts.add(m)));
    const pts = [...cuts].sort((x, y) => x - y);
    let sum = 0;
    let w = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const mid = (pts[i] + pts[i + 1]) / 2;
      const r = valueAt(meas, mid);
      const c = valueAt(plan, mid);
      if (r === null || c === null) continue;
      sum += (r - c) * (pts[i + 1] - pts[i]);
      w += pts[i + 1] - pts[i];
    }
    return w >= 10 ? sum / w : null;
  }

  /** Échelle des degrés du graphique : bornes entières autour des valeurs, au moins 3 °C d'amplitude. */
  function niceScale(values) {
    const v = values.filter((x) => typeof x === "number" && Number.isFinite(x));
    if (!v.length) return { lo: 16, hi: 21, step: 1 };
    let lo = Math.floor(Math.min(...v) - 0.3);
    let hi = Math.ceil(Math.max(...v) + 0.3);
    if (hi - lo < 3) {
      lo = Math.floor((lo + hi) / 2 - 1.5);
      hi = lo + 3;
    }
    const step = hi - lo > 8 ? 2 : 1;
    if (step === 2) {
      lo = Math.floor(lo / 2) * 2;
      hi = Math.ceil(hi / 2) * 2;
    }
    return { lo, hi, step };
  }

  /**
   * Modèle du jour affiché, à partir de l'historique :
   * - climate / target : listes d'états de l'entité climate et du capteur Consigne (ou null) ;
   * - start / end : bornes du jour (ms) ; now : instant présent (ms) si c'est aujourd'hui, sinon null ;
   * - future : consigne à venir [{ s, e, v }] (planning, à partir de now) ;
   * - schedule : consigne du jour d'après le planning, utilisée si le capteur n'a pas d'historique.
   * Renvoie { len, upto, now, meas, runs, heat (null sans hvac_action), plan, planFromSchedule,
   * lags, last, stats: { lag, heat, dev, devFrom }, scale }.
   */
  function dayModel({ climate, target, start, end, now = null, future = [], schedule = [] }) {
    const len = (end - start) / 60000;
    const today = now !== null && now >= start && now < end;
    const upto = today ? (now - start) / 60000 : len;
    const cs = histStates(climate);
    let meas = holdSteps(cs, start, upto, (x) => (isUp(x.s) ? numOrNull(x.a.current_temperature) : null));
    if (meas.length > len / 5) meas = resample(meas, 5);
    const hasAction = cs.some((x) => isUp(x.s) && x.a.hvac_action !== undefined && x.a.hvac_action !== null);
    const heat = hasAction
      ? holdSteps(cs, start, upto, (x) => isUp(x.s) && x.a.hvac_action === "heating").filter((g) => g.v)
      : null;

    let plan = holdSteps(histStates(target), start, upto, (x) => (isUp(x.s) ? numOrNull(x.s) : null));
    const planFromSchedule = !plan.some((g) => g.v !== null);
    if (planFromSchedule) {
      plan = [];
      schedule.forEach((g) => pushStep(plan, Math.max(0, g.s), Math.min(upto, g.e), g.v));
    }
    if (today) future.forEach((g) => pushStep(plan, Math.max(upto, g.s), Math.min(len, g.e), g.v));

    const lags = heatLags(plan, meas, upto);
    const lag = lags.length ? lags[lags.length - 1] : null;
    const devFrom = lag ? (lag.reached ? lag.e : null) : 0;
    const known = meas.filter((g) => g.v !== null);
    const lastStep = known[known.length - 1];
    const vals = known.map((g) => g.v).concat(plan.map((g) => g.v));
    return {
      len,
      upto,
      now: today ? upto : null,
      meas,
      runs: measRuns(meas),
      heat,
      plan,
      planFromSchedule,
      lags,
      last: lastStep ? { m: lastStep.e, t: lastStep.v } : null,
      stats: {
        lag,
        heat: heat ? heatIn(heat, 0, upto) : null,
        dev: devFrom === null ? null : meanDeviation(meas, plan, devFrom, upto),
        devFrom,
      },
      scale: niceScale(vals),
    };
  }

  /** Valeurs à la minute m (bulle du graphique) : { room, plan, heating } (null : inconnu). */
  function pointAt(model, m) {
    const past = m <= model.upto;
    return {
      room: past ? valueAt(model.meas, m) : null,
      plan: valueAt(model.plan, m),
      heating: past && model.heat ? model.heat.some((g) => m >= g.s && m < g.e) : null,
    };
  }

  /** Tableau des valeurs, toutes les `step` minutes : [{ m, room, plan, heat (min de chauffe dans la tranche) }]. */
  function valueRows(model, step = 60) {
    const rows = [];
    for (let m = 0; m < model.len; m += step) {
      const p = pointAt(model, m);
      rows.push({
        m,
        room: p.room,
        plan: p.plan,
        heat: model.heat && m < model.upto ? Math.round(heatIn(model.heat, m, Math.min(m + step, model.upto))) : null,
      });
    }
    return rows;
  }

  // ---- Styles -----------------------------------------------------------
  const STYLE = `
    :host { display: block; }
    ha-card { display: block; padding: 16px; overflow: hidden; }
    * { box-sizing: border-box; }
    button { font: inherit; color: inherit; cursor: pointer; }
    button:focus-visible, select:focus-visible, input:focus-visible, summary:focus-visible {
      outline: 2px solid var(--primary-color); outline-offset: 2px;
    }
    .sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
      clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

    /* En-tête « coup d'œil » : consigne en grand, ± à droite. */
    .title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 24px; }
    .title { font-size: 1.0625rem; font-weight: 500; color: var(--primary-text-color); }
    .hvac { flex: none; display: flex; color: var(--disabled-text-color, #8a8a8a); }
    .hvac.on { color: var(--state-climate-heat-color, #ff8100); }
    .hero { display: flex; align-items: center; gap: 12px; margin-top: 2px; }
    .hero-main { flex: 1; min-width: 0; }
    .big { display: block; font-size: 3.25rem; line-height: 1.05; font-weight: 300; letter-spacing: -.03em;
      color: var(--primary-text-color); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .big small { display: inline-block; vertical-align: top; margin: .32em 0 0 3px; font-size: 1.125rem;
      font-weight: 400; letter-spacing: 0; color: var(--secondary-text-color); }
    .live { margin-top: 4px; font-size: .875rem; line-height: 1.45; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
    .live b { color: var(--primary-text-color); font-weight: 500; }
    .next { white-space: nowrap; }
    .step { flex: none; display: flex; gap: 8px; }
    .round { width: 48px; height: 48px; border: 0; border-radius: 50%; background: var(--secondary-background-color);
      color: var(--primary-text-color); font-size: 1.625rem; line-height: 1; display: flex; align-items: center; justify-content: center; }
    .round[disabled] { opacity: .45; cursor: default; }
    .ovr { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px;
      padding: 4px 4px 4px 12px; min-height: 52px; border-radius: 12px; font-size: .875rem; color: var(--primary-text-color);
      background: color-mix(in srgb, var(--accent-color, #ff9800) 18%, var(--card-background-color, #fff));
      border-left: 4px solid var(--accent-color, #ff9800); font-variant-numeric: tabular-nums; }
    .ovr b { font-weight: 600; }
    .ovr button { flex: none; min-height: 44px; padding: 0 14px; border: 0; border-radius: 10px; font-weight: 500;
      background: var(--card-background-color, #fff); color: var(--primary-text-color); }
    .note { margin-top: 8px; font-size: .8125rem; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }

    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 14px; background: var(--secondary-background-color); border-radius: 14px; margin-top: 12px; }
    .row + .row { margin-top: 8px; }
    .row .label { color: var(--primary-text-color); }
    .row .hint { font-size: .8125rem; color: var(--secondary-text-color); margin-top: 2px; }
    select { font: inherit; color: var(--primary-text-color); background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color); border-radius: 10px; padding: 8px 10px; max-width: 55%; min-height: 44px; }

    .switch { position: relative; width: 46px; height: 28px; flex: none; }
    .switch input { position: absolute; inset: -8px; opacity: 0; margin: 0; cursor: pointer; width: calc(100% + 16px); height: calc(100% + 16px); z-index: 1; }
    .switch span { position: absolute; inset: 0; border-radius: 999px; background: var(--disabled-text-color, #8a8a8a); transition: background .15s; }
    .switch span::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px;
      border-radius: 50%; background: #fff; transition: transform .15s; }
    .switch input:checked + span { background: var(--primary-color); }
    .switch input:checked + span::after { transform: translateX(18px); }
    .switch input:focus-visible + span { outline: 2px solid var(--primary-color); outline-offset: 2px; }
    .switch input[disabled] { cursor: default; }
    .switch input[disabled] + span, select[disabled] { opacity: .5; }

    /* Onglets : planning affiché (et non le mode). */
    .tabs { display: flex; gap: 20px; margin-top: 16px; border-bottom: 1px solid var(--divider-color); }
    .tab { border: 0; background: transparent; padding: 0 0 2px; min-height: 44px; margin-bottom: -1px;
      border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      color: var(--secondary-text-color); font-weight: 500; }
    .tab.on { color: var(--primary-text-color); border-bottom-color: var(--primary-color); }
    .badge { font-size: .6875rem; font-weight: 500; line-height: 1.5; padding: 0 7px; border-radius: 999px;
      border: 1px solid currentColor; color: var(--secondary-text-color); }

    .ro-note { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: .8125rem; color: var(--secondary-text-color); }
    .ro-note ha-icon { --mdc-icon-size: 18px; width: 18px; height: 18px; flex: none; }

    /* Grille de la semaine : une ligne par planning du layout, la ligne choisie est agrandie. */
    .week { margin-top: 8px; }
    .wrow { width: 100%; display: grid; grid-template-columns: var(--lw) 1fr; align-items: center; column-gap: 8px;
      min-height: 44px; padding: 4px 6px; border: 0; border-radius: 10px; background: transparent; text-align: left; }
    .wrow + .wrow { margin-top: 2px; }
    .wrow.sel { background: var(--secondary-background-color); padding-top: 6px; padding-bottom: 6px; }
    .wlabel { font-size: .8125rem; color: var(--secondary-text-color); white-space: nowrap; }
    .wrow.today .wlabel, .wrow.sel .wlabel { color: var(--primary-text-color); font-weight: 600; }
    .wbar { position: relative; display: block; height: 28px; }
    .wrow.sel .wbar { height: 48px; }
    .wsegs { display: flex; gap: 2px; height: 100%; border-radius: 7px; overflow: hidden; }
    .wseg { min-width: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;
      background: var(--bg); color: var(--fg); font-size: .8125rem; font-weight: 600; font-variant-numeric: tabular-nums; }
    .now { position: absolute; top: -3px; bottom: -3px; width: 2px; border-radius: 1px; pointer-events: none;
      background: var(--primary-text-color); box-shadow: 0 0 0 1px var(--card-background-color, #fff); }
    .waxis { position: relative; height: 18px; margin: 2px 6px 0 calc(var(--lw) + 14px);
      font-size: .75rem; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
    .waxis span { position: absolute; top: 0; transform: translateX(-50%); }
    .waxis span:first-child { transform: none; }
    .waxis span:last-child { transform: translateX(-100%); }
    .pick { margin-top: 8px; text-align: center; font-size: .8125rem; color: var(--secondary-text-color); }

    /* Panneau du jour : consigne prévue, température mesurée, chauffe (historique). */
    .day { --heat: var(--state-climate-heat-color, #ff8100); margin-top: 10px; }
    .dayhead { display: flex; align-items: center; gap: 2px; min-height: 44px; }
    .nav { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: transparent;
      color: var(--primary-text-color); font-size: 1.5rem; line-height: 1; display: flex; align-items: center; justify-content: center; }
    .nav:hover:not([disabled]) { background: var(--secondary-background-color); }
    .nav[disabled] { opacity: .35; cursor: default; }
    .dname { min-width: 0; margin: 0 4px; font-size: 1rem; font-weight: 500; color: var(--primary-text-color); }
    .dnow { margin-left: auto; padding-left: 8px; font-size: .8125rem; color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums; white-space: nowrap; }
    .hmsg { padding: 8px 0; font-size: .8125rem; color: var(--secondary-text-color); }
    .plot { position: relative; margin-top: 2px; }
    .plot > svg { display: block; width: 100%; height: auto; overflow: visible; touch-action: pan-y; user-select: none; }
    .plot text { font-family: inherit; font-size: 10px; fill: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
    .plot text.pl { font-weight: 500; }
    .plot text.nowv { font-size: 11px; font-weight: 700; fill: var(--primary-text-color);
      stroke: var(--card-background-color, #fff); stroke-width: 4px; paint-order: stroke; }
    .plot text.pill { font-weight: 700; fill: rgba(0,0,0,.85); }
    .tip { position: absolute; z-index: 2; padding: 8px 10px; border-radius: 10px; font-size: .75rem; line-height: 1.45;
      pointer-events: none; white-space: nowrap; font-variant-numeric: tabular-nums;
      background: var(--card-background-color, #fff); color: var(--primary-text-color);
      border: 1px solid var(--divider-color); box-shadow: 0 4px 14px rgba(0,0,0,.18); }
    .tip[hidden] { display: none; }
    .tip .h { font-weight: 500; margin-bottom: 2px; }
    .tip b { font-weight: 600; }
    .k { display: inline-block; margin-right: 6px; vertical-align: middle; flex: none; }
    .lg { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 8px; font-size: .75rem; color: var(--secondary-text-color); }
    .lg span { display: inline-flex; align-items: center; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; margin-top: 12px; }
    .tiles div { padding: 10px; border-radius: 10px; background: var(--secondary-background-color); font-size: .75rem;
      line-height: 1.3; color: var(--secondary-text-color); }
    .tiles b { display: block; margin-bottom: 2px; font-size: 1.125rem; font-weight: 400; color: var(--primary-text-color);
      font-variant-numeric: tabular-nums; }
    .tablelink { margin-top: 4px; }
    .tablelink button { min-height: 44px; padding: 0; border: 0; background: none; color: var(--primary-color);
      font-size: .8125rem; text-decoration: underline; text-underline-offset: 2px; }
    .vals { max-height: 320px; overflow: auto; border: 1px solid var(--divider-color); border-radius: 10px; }
    .vals table { width: 100%; border-collapse: collapse; font-size: .8125rem; font-variant-numeric: tabular-nums; }
    .vals caption { padding: 8px 10px; text-align: left; font-weight: 500; color: var(--primary-text-color); }
    .vals th, .vals td { padding: 6px 10px; text-align: right; border-top: 1px solid var(--divider-color); }
    .vals th:first-child, .vals td:first-child { text-align: left; }
    .vals thead th { position: sticky; top: 0; background: var(--card-background-color, #fff); font-weight: 500;
      color: var(--secondary-text-color); }
    .vals td { color: var(--primary-text-color); }

    /* Éditeur du jour sélectionné. */
    .editor { margin-top: 10px; padding: 12px; border-radius: 14px; background: var(--secondary-background-color); }
    .ed-name { font-size: 1rem; font-weight: 500; color: var(--primary-text-color); }
    .ed-name small { margin-left: 8px; font-size: .75rem; font-weight: 400; color: var(--secondary-text-color); }
    .blocks { display: grid; gap: 8px; margin-top: 10px; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    .block { width: 100%; min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
      text-align: left; border: 0; border-left: 4px solid var(--accent); border-radius: 4px 12px 12px 4px; padding: 8px 10px 8px 12px;
      background: linear-gradient(var(--tint), var(--tint)), var(--card-background-color, #fff); }
    .block .range, .block .deg { display: block; }
    .block .range { font-size: 1rem; font-weight: 500; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
    .block .deg { font-size: .9375rem; color: var(--accent); font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 2px; }
    button.block::after { content: ""; width: 8px; height: 8px; border-right: 2px solid var(--secondary-text-color);
      border-top: 2px solid var(--secondary-text-color); transform: rotate(45deg); flex: none; }
    .tools { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 10px; }
    .btn { min-height: 44px; border: 1px solid var(--divider-color); background: var(--card-background-color, #fff);
      border-radius: 10px; padding: 0 14px; color: var(--primary-text-color); font-weight: 500; }
    .btn.primary { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
    .btn.danger { color: var(--error-color, #db4437); }
    .btn[disabled] { opacity: .45; cursor: default; }

    .copy { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--divider-color); }
    .copy-what { font-size: .875rem; color: var(--secondary-text-color); }
    .copy-what b { color: var(--primary-text-color); font-weight: 500; }
    .copy-group { margin-top: 10px; }
    .copy-prof { display: block; margin-bottom: 4px; font-size: .8125rem; color: var(--secondary-text-color); }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .chip { position: relative; flex: 1 1 40px; max-width: 120px; height: 44px; }
    .chip input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
    .chip span { display: flex; align-items: center; justify-content: center; height: 100%; padding: 0 6px; pointer-events: none;
      border: 1px solid var(--divider-color); border-radius: 10px; background: var(--card-background-color, #fff);
      font-size: .8125rem; color: var(--primary-text-color); white-space: nowrap; }
    .chip input:checked + span { background: var(--primary-text-color); border-color: var(--primary-text-color);
      color: var(--card-background-color, #fff); font-weight: 600; }
    .chip input:focus-visible + span { outline: 2px solid var(--primary-color); outline-offset: 2px; }
    .copy-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }

    .settings { margin-top: 12px; border-top: 1px solid var(--divider-color); }
    .settings summary { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 4px; cursor: pointer;
      list-style: none; border-radius: 8px; }
    .settings summary::-webkit-details-marker { display: none; }
    .settings .sum-name { color: var(--primary-text-color); }
    .settings .sum-hint { margin-left: auto; font-size: .8125rem; color: var(--secondary-text-color); text-align: right; }
    .settings .row:first-of-type { margin-top: 4px; }
    .chev { width: 10px; height: 10px; border-right: 2px solid var(--secondary-text-color); flex: none;
      border-bottom: 2px solid var(--secondary-text-color); transform: rotate(45deg); transition: transform .15s; margin-right: 4px; }
    .settings[open] .chev { transform: rotate(-135deg); }

    .status { text-align: right; font-size: .8125rem; color: var(--secondary-text-color); min-height: 1.2em; margin-top: 4px; }
    .status.err { color: var(--error-color, #db4437); }
    .msg { padding: 12px; color: var(--secondary-text-color); }

    .overlay { position: fixed; inset: 0; z-index: 20; display: flex; align-items: flex-end; justify-content: center;
      background: rgba(0,0,0,.5); }
    .modal { width: min(440px, 100%); background: var(--card-background-color, #fff); color: var(--primary-text-color);
      border-radius: 20px 20px 0 0; padding: 20px 20px 24px; }
    @media (min-width: 600px) { .overlay { align-items: center; } .modal { border-radius: 20px; } }
    .modal h3 { margin: 0 0 16px; font-size: 1.125rem; font-weight: 500; }
    .field { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .field label { color: var(--secondary-text-color); }
    .field input[type=time], .field input[type=text] { font: inherit; color: var(--primary-text-color);
      background: var(--secondary-background-color); border: 1px solid var(--divider-color); border-radius: 10px;
      padding: 9px 10px; width: 140px; min-height: 44px; font-variant-numeric: tabular-nums; }
    .field input[disabled] { opacity: .55; }
    .stepper { display: flex; align-items: center; gap: 8px; }
    .stepper button { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--divider-color);
      background: var(--secondary-background-color); font-size: 1.25rem; line-height: 1; }
    .stepper input { width: 76px; text-align: center; font: inherit; font-size: 1.125rem; font-weight: 600;
      color: var(--primary-text-color); background: transparent; border: 0; border-bottom: 2px solid var(--primary-color);
      padding: 4px; font-variant-numeric: tabular-nums; }
    .modal .err { color: var(--error-color, #db4437); min-height: 1.3em; font-size: .875rem; margin-bottom: 8px; }
    .actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .actions .right { display: flex; gap: 8px; margin-left: auto; }
    /* Format compact (option format: compact) : maintenant et ensuite, sans édition. */
    ha-card.compact { padding: 14px 16px 16px; }
    .c-top { display: flex; align-items: center; gap: 8px; min-height: 24px; }
    .c-zone { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: 1rem; font-weight: 500; color: var(--primary-text-color); }
    .c-mode { flex: none; padding: 1px 8px; border-radius: 999px; background: var(--secondary-background-color);
      font-size: .75rem; color: var(--secondary-text-color); }
    .c-mode.away { background: color-mix(in srgb, var(--primary-color) 18%, transparent); color: var(--primary-text-color); }
    .c-top .hvac { margin-left: auto; align-items: center; gap: 4px; font-size: .8125rem; --mdc-icon-size: 18px; }
    .c-top .hvac:not(.on) { color: var(--secondary-text-color); }
    .c-top .hvac ha-icon { width: 18px; height: 18px; }
    .c-hero { display: flex; align-items: flex-end; gap: 6px 16px; flex-wrap: wrap; margin-top: 2px; }
    .c-hero .big { font-size: 4.5rem; line-height: .95; font-weight: 300; letter-spacing: -.04em; }
    .c-hero .big small { font-size: 1.375rem; margin-top: .3em; }
    .c-side { padding-bottom: 6px; font-size: .875rem; line-height: 1.5; color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums; }
    .c-side b { color: var(--primary-text-color); font-weight: 500; }
    .c-side .c-room b { font-size: 1rem; }
    .c-rib { margin-top: 14px; }
    .c-bar { display: flex; gap: 2px; height: 30px; border-radius: 8px; overflow: hidden; }
    .c-seg { min-width: 0; display: flex; align-items: center; padding-left: 8px; overflow: hidden; white-space: nowrap;
      background: var(--bg); color: var(--fg); font-size: .8125rem; font-weight: 600; font-variant-numeric: tabular-nums; }
    .c-seg.hatch { background: repeating-linear-gradient(135deg, var(--bg) 0 6px,
      color-mix(in srgb, var(--accent-color, #ff9800) 45%, var(--bg)) 6px 9px); }
    .c-seg.none { background: var(--secondary-background-color); color: var(--secondary-text-color); }
    .c-ticks { position: relative; height: 18px; margin-top: 4px; font-size: .75rem; color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums; }
    .c-ticks span { position: absolute; top: 0; transform: translateX(-50%); white-space: nowrap; }
    .c-ticks span:first-child { transform: none; color: var(--primary-text-color); font-weight: 500; }
    .c-ticks span.end { transform: translateX(-100%); }
    .c-actions { display: flex; gap: 8px; margin-top: 12px; }
    .c-actions .sq { flex: 1; min-height: 48px; border: 0; border-radius: 14px; background: var(--secondary-background-color);
      color: var(--primary-text-color); font-size: 1.5rem; line-height: 1; }
    .c-actions .sq[disabled] { opacity: .45; cursor: default; }
    .c-actions .plan { flex: 1.3; min-height: 48px; border: 0; border-radius: 14px; background: var(--secondary-background-color);
      color: var(--primary-text-color); font-size: .9375rem; font-weight: 500;
      display: flex; align-items: center; justify-content: center; gap: 8px; }
    .c-actions .plan:only-child { flex: none; margin-left: auto; padding: 0 18px; }
    ha-card.compact .status:empty { display: none; }
    .chev-r { width: 8px; height: 8px; border-right: 2px solid currentColor; border-top: 2px solid currentColor;
      transform: rotate(45deg); flex: none; }
    .title-row:has(.collapse) .title { flex: 1; }
    .collapse { flex: none; min-height: 44px; padding: 0 12px; border: 0; border-radius: 10px;
      background: var(--secondary-background-color); color: var(--primary-text-color); font-weight: 500; }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  `;

  // ---- Carte -------------------------------------------------------------
  class ThermostatPlannerCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._state = null;
      this._profile = "home";
      // État d'interface conservé d'un rendu à l'autre.
      this._sel = {}; // ligne choisie par profil (undefined : défaut, null : refermée)
      this._copyOpen = false;
      this._copySel = new Set(); // destinations cochées "profil:clé"
      this._settingsOpen = false;
      this._returnFocus = null;
      this._modal = null;
      this._pending = false;
      this._flushing = false;
      this._status = "";
      this._error = "";
      this._timer = null;
      this._unsub = null;
      this._subscribing = false;
      this._ovrValue = null; // consigne choisie avec ± pas encore envoyée
      this._ovrTimer = null;
      // Panneau du jour : jour affiché (0 = aujourd'hui, 1 = hier…), historique par jour, tableau ouvert.
      this._dayOff = 0;
      this._hist = {};
      this._tableOpen = false;
      this._model = null;
      this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
      // Bulle du graphique : souris et toucher (pan-y laisse défiler la page verticalement).
      ["pointermove", "pointerdown"].forEach((type) => this.shadowRoot.addEventListener(type, (e) => this._onPlotPointer(e)));
      this.shadowRoot.addEventListener("pointerout", (e) => {
        const plot = e.target.closest && e.target.closest(".plot");
        if (plot && e.pointerType === "mouse" && !(e.relatedTarget && plot.contains(e.relatedTarget))) this._hideTip();
      });
      this.shadowRoot.addEventListener("pointercancel", () => this._hideTip());
      this.shadowRoot.addEventListener("change", (e) => this._onChange(e));
      this.shadowRoot.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this._modal) this._closeModal();
      });
      // Repli « Réglages » (toggle ne remonte pas : capture).
      this.shadowRoot.addEventListener(
        "toggle",
        (e) => {
          if (e.target.id === "settings" && e.target.isConnected) this._settingsOpen = e.target.open;
        },
        true
      );
    }

    static getStubConfig() {
      return {};
    }

    setConfig(config) {
      this._scale = parseScale(config && config.colors);
      this._palette = paletteOf(config);
      this._histDays = historyDays(config);
      if (this._dayOff > this._histDays - 1) this._dayOff = 0;
      const target = targetOf(config);
      const changed = this._target !== undefined && JSON.stringify(target) !== JSON.stringify(this._target);
      this._target = target;
      this._config = { ...config };
      const format = cardFormat(config);
      if (format !== this._format) this._expanded = false;
      this._format = format;
      if (changed) {
        // Autre zone (éditeur de carte) : nouvel abonnement.
        if (this._unsub) {
          this._unsub();
          this._unsub = null;
        }
        this._state = null;
        this._loadError = false;
        this._hist = {};
        this._dayOff = 0;
        if (this._hass && !this._subscribing) this._subscribe();
      }
      this._render();
    }

    /** Appel WebSocket vers la zone de la carte. */
    _ws(msg) {
      return this._hass.callWS(withTarget(msg, this._target));
    }

    getCardSize() {
      return this._format === "compact" ? 4 : 7;
    }

    // Vue « sections » : toute la largeur de la section (même sur 2+ colonnes), hauteur automatique.
    // Format compact : la largeur d'une section, pour en aligner plusieurs (une par zone).
    getGridOptions() {
      return this._format === "compact" ? { columns: 12, min_columns: 6 } : { columns: "full", min_columns: 6 };
    }

    /** Format compact affiché (et non le planning complet ouvert depuis la carte compacte). */
    _isCompact() {
      return this._format === "compact" && !this._expanded;
    }

    /** Seuils d'affichage dépendant de la largeur réelle des barres de la grille. */
    _barMetrics() {
      const bw = this._width ? this._width - 92 : 0; // padding de la carte, étiquette du jour
      return {
        labelMinPct: bw ? (40 / bw) * 100 : 10,
        tickStep: bw >= 480 ? 3 : 6,
      };
    }

    set hass(hass) {
      this._hass = hass;
      const lang = (hass.locale && hass.locale.language) || hass.language || "en";
      this._lang = String(lang).toLowerCase().startsWith("fr") ? "fr" : "en";
      // Échelle de couleurs par défaut : dépend du thème clair / sombre de Home Assistant.
      const dark = !!(hass.themes && hass.themes.darkMode);
      if (this._dark !== undefined && dark !== this._dark) {
        this._dark = dark;
        if (!this._modal) this._render();
      }
      this._dark = dark;
      if (!this._unsub && !this._subscribing) this._subscribe();
      this._updateLive();
    }

    connectedCallback() {
      if (this._hass && !this._unsub && !this._subscribing) this._subscribe();
      if (!this._ro && window.ResizeObserver) {
        this._ro = new ResizeObserver((entries) => {
          const w = Math.round(entries[0].contentRect.width / 20) * 20;
          if (!w || w === this._width) return;
          this._width = w;
          if (!this._modal) this._render();
        });
      }
      if (this._ro) this._ro.observe(this);
      // Compte à rebours de la dérogation et prochain changement.
      clearInterval(this._clock);
      this._clock = setInterval(() => {
        this._updateLive();
        this._tickDay();
      }, 30000);
    }

    disconnectedCallback() {
      if (this._ro) this._ro.disconnect();
      clearInterval(this._clock);
      if (this._unsub) {
        this._unsub();
        this._unsub = null;
      }
    }

    get t() {
      return I18N[this._lang || "en"];
    }

    async _subscribe() {
      this._subscribing = true;
      try {
        this._unsub = await this._hass.connection.subscribeMessage(
          (ev) => this._onState(ev),
          withTarget({ type: "thermostat_planner/subscribe" }, this._target)
        );
        this._loadError = false;
      } catch (err) {
        this._loadError = subscribeErrorKey(err) || true;
        this._render();
      } finally {
        this._subscribing = false;
      }
    }

    _onState(ev) {
      if (this._pending || this._flushing) {
        // Ne pas écraser des modifications locales en cours d'enregistrement.
        this._state = { ...ev, data: this._state ? this._state.data : ev.data };
      } else {
        this._state = ev;
      }
      if (this._modal) {
        this._updateLive();
        return;
      }
      this._render();
    }

    // -- sauvegarde --------------------------------------------------------
    _commit() {
      this._pending = true;
      this._status = "saving";
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this._flush(), 400);
      this._render();
    }

    async _flush() {
      this._pending = false;
      this._flushing = true;
      try {
        await this._ws({ type: "thermostat_planner/save", data: this._state.data });
        this._status = "saved";
        this._error = "";
      } catch (err) {
        this._status = "error";
        this._error = (err && err.message) || "";
      }
      this._flushing = false;
      this._updateSaveStatus();
    }

    // -- rendu -------------------------------------------------------------
    _fmt(t) {
      return fmtTemp(t, this._lang);
    }

    _fmtTime(iso) {
      try {
        return new Date(iso).toLocaleTimeString(this._lang === "fr" ? "fr-FR" : "en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        return "";
      }
    }

    /** Nom complet d'une ligne de planning (« Vendredi », « Lundi – Vendredi », « Tous les jours »). */
    _rowName(key) {
      const t = this.t;
      return t.days[key] || t[key] || key;
    }

    /** Ligne d'état sous la consigne : mode, pièce, prochain changement. */
    _liveHtml() {
      const s = this._state;
      if (!s) return "";
      const t = this.t;
      if (!s.data.enabled) return esc(t.off);
      const parts = [`<b>${esc(t[s.effective_mode])}</b>`];
      const climate = this._climate();
      const current = climate && climate.attributes.current_temperature;
      if (current !== undefined && current !== null) parts.push(`${this._fmt(Number(current))}° ${esc(t.room)}`);
      const next = upcoming(s.data, s.effective_mode, s.override, new Date());
      if (next && next.temp !== null) {
        // Visuel court « 20:30 → 20,5° », phrase complète pour les lecteurs d'écran et au survol.
        const time = this._fmtTime(next.at.toISOString());
        const full = t.nextAt.replace("{time}", time).replace("{temp}", `${this._fmt(next.temp)}°`);
        parts.push(
          `<span class="next" title="${esc(full)}"><span aria-hidden="true">${esc(time)} → <b>${this._fmt(next.temp)}°</b></span><span class="sr">${esc(full)}</span></span>`
        );
      } else if (next) {
        parts.push(`${esc(t.next)} ${esc(this._fmtTime(next.at.toISOString()))}`);
      }
      return parts.join(" · ");
    }

    _updateLive() {
      const set = (id, fn) => {
        const el = this.shadowRoot.getElementById(id);
        if (!el) return;
        const html = fn();
        if (el._html !== html) {
          el._html = html;
          el.innerHTML = html;
        }
      };
      if (this._isCompact()) {
        set("c-side", () => this._compactSideHtml());
        set("c-rib", () => this._ribbonHtml());
      } else {
        set("live", () => this._liveHtml());
      }
      this._updateCtrl();
    }

    // -- format compact ------------------------------------------------------
    /** Carte compacte : zone, mode, chauffe ; consigne et ± ; dérogation ; ruban des 12 prochaines heures. */
    _compactHtml(title, msg) {
      const t = this.t;
      const s = this._state;
      let mode = "";
      if (s) {
        const why = s.forced_by_entity ? `${t.forcedBy} ${s.away_entity}` : s.zone_away ? t.zoneAwayOn : "";
        mode = `<span class="c-mode${s.effective_mode === "away" ? " away" : ""}"${why ? ` title="${esc(why)}"` : ""}>${esc(t[s.effective_mode])}</span>`;
      }
      const top = `<div class="c-top"><span class="c-zone">${esc(title)}</span>${mode}<span class="hvac" id="hvac" data-text="1"></span></div>`;
      if (msg) return `${top}<div class="msg">${esc(msg)}</div>`;
      const controls = this._showControls();
      const step = controls
        ? `<button class="sq" data-action="ovr-step" data-dir="-1" aria-label="${esc(t.lower)}">−</button>
           <button class="sq" data-action="ovr-step" data-dir="1" aria-label="${esc(t.raise)}">+</button>`
        : "";
      return `${top}
        <div class="c-hero"><span class="big" id="ctrl-val" aria-live="polite"></span><div class="c-side" id="c-side"></div></div>
        <div id="ctrl-info"></div>
        <div class="c-rib" id="c-rib"></div>
        <div class="c-actions">${step}
          <button class="plan" data-action="planning-open" aria-label="${esc(t.openPlanningAria)}">${esc(t.openPlanning)}<span class="chev-r" aria-hidden="true"></span></button>
        </div>
        <div id="save-status" class="status" role="status"></div>`;
    }

    /** À côté de la consigne : température de la pièce, puis prochain changement (« → 20,5° à 20:30, dans 1 h 50 »). */
    _compactSideHtml() {
      const s = this._state;
      if (!s) return "";
      const t = this.t;
      const lines = [];
      const climate = this._climate();
      const current = climate && climate.attributes.current_temperature;
      if (current !== undefined && current !== null)
        lines.push(`<div class="c-room"><b>${this._fmt(Number(current))}°</b> ${esc(t.room)}</div>`);
      const now = new Date();
      const next = upcoming(s.data, s.effective_mode, s.override, now);
      if (next && next.temp !== null) {
        const time = this._fmtTime(next.at.toISOString());
        const temp = `${this._fmt(next.temp)}°`;
        const dur = s.override ? "" : t.inDur.replace("{d}", fmtDuration((next.at.getTime() - now.getTime()) / 60000, this._lang));
        const full = t.nextAt.replace("{time}", time).replace("{temp}", temp) + (dur ? `, ${dur}` : "");
        const short = esc(t.nextShort).replace("{temp}", `<b>${temp}</b>`).replace("{time}", esc(time));
        lines.push(`<div title="${esc(full)}"><span aria-hidden="true">→ ${short}${dur ? `, ${esc(dur)}` : ""}</span><span class="sr">${esc(full)}</span></div>`);
      } else if (next) {
        lines.push(`<div>${esc(t.next)} ${esc(this._fmtTime(next.at.toISOString()))}</div>`);
      }
      if (!s.data.enabled) lines.push(`<div>${esc(t.off)}</div>`);
      return lines.join("");
    }

    /** Ruban des 12 prochaines heures : dérogation hachurée, puis les plages du planning. */
    _ribbonHtml() {
      const s = this._state;
      if (!s) return "";
      const t = this.t;
      const hours = 12;
      const total = hours * 60;
      const pieces = ribbon(s.data, s.effective_mode, s.override, new Date(), hours);
      if (!pieces.length) return "";
      const bw = this._width ? this._width - 32 : 0;
      const minPct = bw ? (46 / bw) * 100 : 12; // largeur mini d'une étiquette (température ou heure)
      const endTime = (p) => this._fmtTime(new Date(p.at.getTime() + (p.end - p.start) * 60000).toISOString());
      const segs = pieces
        .map((p) => {
          const w = ((p.end - p.start) / total) * 100;
          if (p.temp === null) return `<span class="c-seg none" style="width:${w}%">${w >= minPct ? "—" : ""}</span>`;
          const c = tempColors(p.temp, this._scale, this._dark, this._palette);
          return `<span class="c-seg${p.ovr ? " hatch" : ""}" style="width:${w}%;--bg:${c.bg};--fg:${c.fg}">${w >= minPct ? this._fmt(p.temp) + "°" : ""}</span>`;
        })
        .join("");
      const ticks = ribbonTicks(pieces, total, minPct)
        .map((k, i) => `<span${i && k.pos > 88 ? ' class="end"' : ""} style="left:${k.pos}%">${esc(this._fmtTime(k.at.toISOString()))}</span>`)
        .join("");
      const label =
        t.nextHours.replace("{h}", hours) +
        " : " +
        pieces
          .map((p) => t.untilT.replace("{temp}", p.temp === null ? "—" : `${this._fmt(p.temp)}°`).replace("{time}", endTime(p)))
          .join(", ");
      return `<div role="img" aria-label="${esc(label)}"><div class="c-bar">${segs}</div><div class="c-ticks">${ticks}</div></div>`;
    }

    // -- réglage courant du thermostat ---------------------------------------
    _showControls() {
      return !this._config || this._config.show_controls !== false;
    }

    _climate() {
      return this._state && this._hass ? this._hass.states[this._state.climate_entity] : undefined;
    }

    _climateUp(climate) {
      return !!climate && climate.state !== "unavailable" && climate.state !== "unknown";
    }

    /** Bornes et pas du thermostat, dans la plage acceptée par l'intégration. */
    _limits(climate) {
      const a = (climate && climate.attributes) || {};
      const num = (v, d) => (v === undefined || v === null || Number.isNaN(Number(v)) ? d : Number(v));
      return {
        min: Math.max(MIN_T, num(a.min_temp, MIN_T)),
        max: Math.min(MAX_T, num(a.max_temp, MAX_T)),
        step: num(a.target_temp_step, STEP) > 0 ? num(a.target_temp_step, STEP) : STEP,
      };
    }

    /** Bornes du sélecteur de température des plages (thermostat, ou 5–35 °C à défaut). */
    _scheduleLimits() {
      return scheduleLimits(this._limits(this._climate()));
    }

    /** Consigne affichée : saisie en cours, sinon dérogation, sinon celle du thermostat. */
    _setpoint() {
      if (this._ovrValue !== null) return this._ovrValue;
      const s = this._state;
      if (s && s.override) return Number(s.override.temp);
      const climate = this._climate();
      const v = climate && climate.attributes.temperature;
      return v === undefined || v === null ? null : Number(v);
    }

    /** En-tête : consigne en grand, ± (option show_controls), ligne d'état, bandeau de dérogation. */
    _heroHtml(title) {
      const t = this.t;
      const controls = this._state && this._showControls();
      const step = controls
        ? `<div class="step" role="group" aria-label="${esc(t.target)}">
            <button class="round" data-action="ovr-step" data-dir="-1" aria-label="${esc(t.lower)}">−</button>
            <button class="round" data-action="ovr-step" data-dir="1" aria-label="${esc(t.raise)}">+</button>
          </div>`
        : "";
      const collapse =
        this._format === "compact"
          ? `<button class="collapse" data-action="planning-close" aria-label="${esc(t.closePlanningAria)}">${esc(t.closePlanning)}</button>`
          : "";
      return `<div class="title-row"><div class="title">${esc(title)}</div><span class="hvac" id="hvac"></span>${collapse}</div>
        ${this._state
          ? `<div class="hero"><div class="hero-main"><span class="big" id="ctrl-val" aria-live="polite"></span>
              <div class="live" id="live"></div></div>${step}</div>
            <div id="ctrl-info"></div>`
          : ""}`;
    }

    /** Met à jour les valeurs sans reconstruire les boutons (garde le focus). */
    _updateCtrl() {
      const root = this.shadowRoot;
      const s = this._state;
      const t = this.t;
      const climate = this._climate();
      const up = this._climateUp(climate);
      const setHtml = (el, html) => {
        if (!el || el._html === html) return;
        el._html = html;
        el.innerHTML = html;
      };

      const action = up && climate.attributes.hvac_action;
      const hvac = root.getElementById("hvac");
      if (hvac) {
        hvac.className = "hvac" + (action === "heating" ? " on" : "");
        hvac.title = action === "heating" ? t.heating : action ? t.idle : "";
        const label = hvac.dataset.text ? `<span>${esc(action === "heating" ? t.heatingShort : t.idleShort)}</span>` : "";
        setHtml(hvac, action ? `<ha-icon icon="${action === "heating" ? "mdi:fire" : "mdi:fire-off"}"></ha-icon>${label}` : "");
      }

      const val = root.getElementById("ctrl-val");
      if (!val || !s) return;
      const controls = this._showControls();
      // Sans contrôles : la consigne prévue (dérogation comprise), comme le capteur « Consigne ».
      let sp = controls ? this._setpoint() : s.target;
      if ((sp === null || sp === undefined) && !controls) sp = this._setpoint();
      const shown = sp !== null && sp !== undefined && !Number.isNaN(Number(sp)) && (up || !controls);
      setHtml(val, shown ? `<span class="sr">${esc(t.target)} </span>${this._fmt(Number(sp))}<small>°C</small>` : "—");
      root.querySelectorAll('[data-action="ovr-step"]').forEach((b) => (b.disabled = !up || sp === null));

      let info = "";
      if (!up) info = `<div class="note">${esc(t.unavailable)}</div>`;
      else if (s.override)
        info = `<div class="ovr"><span>${esc(t.override)} <b>${esc(this._fmtTime(s.override.until))}</b><span id="ovr-left"></span></span>
          ${controls ? `<button data-action="ovr-clear">${esc(t.resume)}</button>` : ""}</div>`;
      else if (controls && s.data.enabled && sp !== null && sp !== s.target && s.target !== null && s.target !== undefined)
        info = `<div class="note">${esc(t.planned)} ${this._fmt(s.target)}°</div>`;
      setHtml(root.getElementById("ctrl-info"), info);
      const left = root.getElementById("ovr-left");
      if (left && s.override) {
        const ms = new Date(s.override.until).getTime() - Date.now();
        left.textContent = ms > 0 ? ` · ${t.remaining.replace("{d}", fmtDuration(ms / 60000, this._lang))}` : "";
      }
    }

    _stepOverride(dir) {
      const climate = this._climate();
      const base = this._setpoint();
      if (!this._climateUp(climate) || base === null) return;
      const lim = this._limits(climate);
      this._ovrValue = stepSetpoint(base, dir * lim.step, lim);
      this._updateCtrl();
      // Un seul envoi après une série d'appuis.
      clearTimeout(this._ovrTimer);
      this._ovrTimer = setTimeout(() => this._sendOverride(), 1000);
    }

    async _sendOverride() {
      const value = this._ovrValue;
      const s = this._state;
      const duration = Number(this._config && this._config.override_duration);
      try {
        if (s.override && value === s.target) {
          // Retour à la consigne prévue : c'est une reprise du planning.
          await this._ws({ type: "thermostat_planner/clear_override" });
        } else {
          const msg = { type: "thermostat_planner/set_override", temperature: value };
          if (duration > 0) msg.duration = Math.round(duration);
          await this._ws(msg);
        }
      } catch (err) {
        this._status = "error";
        this._error = (err && err.message) || "";
        this._updateSaveStatus();
      }
      if (this._ovrValue === value) this._ovrValue = null;
      this._updateCtrl();
    }

    _updateSaveStatus() {
      const el = this.shadowRoot.getElementById("save-status");
      if (!el) return;
      const t = this.t;
      const text = { saving: t.saving, saved: t.saved, error: t.error, copied: t.copied }[this._status] || "";
      el.textContent = text + (this._status === "error" && this._error ? ` (${this._error})` : "");
      el.className = "status" + (this._status === "error" ? " err" : "");
    }

    _expandToday() {
      return !this._config || this._config.expand_today !== false;
    }

    /** Ligne sélectionnée du profil affiché, ou null. */
    _selKey(profileName) {
      const layout = this._state.data.profiles[profileName].layout;
      return selectedRow(layout, this._sel[profileName], weekdayOf(new Date()), this._expandToday());
    }

    /** Grille de la semaine du profil : une ligne-bouton par planning du layout. */
    _weekHtml(profileName, selKey) {
      const t = this.t;
      const s = this._state;
      const profile = s.data.profiles[profileName];
      const rows = gridRows(profile.layout, weekdayOf(new Date()));
      const nowDate = new Date();
      const nowPct = ((nowDate.getHours() * 60 + nowDate.getMinutes()) / 1440) * 100;
      const { labelMinPct, tickStep } = this._barMetrics();
      const lw = Math.max(...rows.map((r) => t.short[r.key].length)) * 0.62 + 0.4;
      const html = rows
        .map((r) => {
          const sel = r.key === selKey;
          const segs = intervals(profile.schedules[r.key])
            .map((iv) => {
              const w = ((iv.e - iv.s) / 1440) * 100;
              const c = tempColors(iv.t, this._scale, this._dark, this._palette);
              return `<span class="wseg" style="width:${w}%;--bg:${c.bg};--fg:${c.fg}">${sel && w >= labelMinPct ? this._fmt(iv.t) + "°" : ""}</span>`;
            })
            .join("");
          const now = r.today && profileName === s.effective_mode ? `<span class="now" style="left:calc(${nowPct}% - 1px)"></span>` : "";
          const name = this._rowName(r.key) + (r.today ? `, ${t.today}` : "");
          return `<button class="wrow${sel ? " sel" : ""}${r.today ? " today" : ""}" data-action="select" data-key="${r.key}" aria-pressed="${sel}" aria-label="${esc(name)}">
            <span class="wlabel" aria-hidden="true">${esc(t.short[r.key])}</span>
            <span class="wbar"><span class="wsegs">${segs}</span>${now}</span></button>`;
        })
        .join("");
      const ticks = [];
      for (let h = 0; h <= 24; h += tickStep) ticks.push(`<span style="left:${(h / 24) * 100}%">${h}:00</span>`);
      return `<div class="week" role="group" aria-label="${esc(t.weekAria)}" style="--lw:${lw.toFixed(2)}em">
        ${html}<div class="waxis" aria-hidden="true">${ticks.join("")}</div></div>`;
    }

    /** Éditeur accessible de la ligne sélectionnée : liste des plages, ajout, copie vers d'autres jours. */
    _editorHtml(profileName, key) {
      const t = this.t;
      const s = this._state;
      const editable = this._canEdit();
      const ivs = intervals(s.data.profiles[profileName].schedules[key]);
      const today = gridRows(s.data.profiles[profileName].layout, weekdayOf(new Date())).some((r) => r.key === key && r.today);
      const name = this._rowName(key);
      const blocks = ivs
        .map((iv, i) => {
          const c = tempColors(iv.t, this._scale, this._dark, this._palette);
          const inner = `<span><span class="range">${toStr(iv.s)} – ${toStr(iv.e)}</span><span class="deg">${this._fmt(iv.t)}°</span></span>`;
          const style = `--accent:${c.accent};--tint:${c.tint}`;
          return editable
            ? `<button class="block" data-action="edit" data-profile="${profileName}" data-key="${key}" data-index="${i}" style="${style}">${inner}</button>`
            : `<div class="block" style="${style}">${inner}</div>`;
        })
        .join("");
      const tools = editable
        ? `<div class="tools">
            <button class="btn" data-action="copy-open" aria-expanded="${this._copyOpen}">${esc(t.copyTo)}</button>
            <button class="btn" data-action="add" data-profile="${profileName}" data-key="${key}">${esc(t.addBlock)}</button>
          </div>${this._copyOpen ? this._copyHtml(profileName, key, name) : ""}`
        : "";
      return `<section class="editor" aria-label="${esc(name)}">
        <div class="ed-name">${esc(name)}${today && key !== "all" ? `<small>${esc(t.today)}</small>` : ""}</div>
        <div class="blocks">${blocks}</div>
        ${tools}
      </section>`;
    }

    /** Panneau « Copier vers » : cases des lignes de chaque profil. */
    _copyHtml(profileName, key, name) {
      const t = this.t;
      const [before, after] = t.copyFrom.split("{day}");
      const groups = copyTargets(this._state.data, { profile: profileName, key })
        .map(
          (g) => `<div class="copy-group" role="group" aria-label="${esc(t[g.profile === "home" ? "tabHome" : "tabAway"])}">
            <span class="copy-prof" aria-hidden="true">${esc(t[g.profile === "home" ? "tabHome" : "tabAway"])}</span>
            <div class="chips">${g.keys
              .map((k) => {
                const id = `${g.profile}:${k}`;
                return `<label class="chip"><input type="checkbox" data-action="copy-pick" data-target="${id}" aria-label="${esc(this._rowName(k))}" ${this._copySel.has(id) ? "checked" : ""}><span aria-hidden="true">${esc(t.short[k])}</span></label>`;
              })
              .join("")}</div></div>`
        )
        .join("");
      return `<div class="copy" id="copy-panel">
        <div class="copy-what">${esc(before)}<b>${esc(name)}</b>${esc(after || "")}</div>
        ${groups}
        <div class="copy-actions">
          <button class="btn" data-action="copy-cancel">${esc(t.cancel)}</button>
          <button class="btn primary" data-action="copy-apply" ${this._copySel.size ? "" : "disabled"}>${esc(t.copyApply)}</button>
        </div>
      </div>`;
    }

    _modalHtml() {
      const m = this._modal;
      if (!m) return "";
      const t = this.t;
      const segs = this._state.data.profiles[m.profile].schedules[m.key];
      const n = segs.length;
      const first = m.kind === "edit" && m.index === 0;
      const last = m.kind === "edit" && m.index === n - 1;
      const lim = this._scheduleLimits();
      const timeField = (id, label, value, disabled) =>
        disabled
          ? `<div class="field"><label>${esc(label)}</label><input type="text" id="${id}" value="${esc(value)}" disabled></div>`
          : `<div class="field"><label for="${id}">${esc(label)}</label><input type="time" id="${id}" value="${esc(value)}" step="60"></div>`;
      return `<div class="overlay" data-action="overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(m.kind === "edit" ? t.editBlock : t.newBlock)}">
          <h3>${esc(m.kind === "edit" ? t.editBlock : t.newBlock)} · ${esc(this._rowName(m.key))}</h3>
          ${timeField("m-start", t.start, toStr(m.s), first)}
          ${timeField("m-end", t.end, toStr(m.e), last)}
          <div class="field"><label for="m-temp">${esc(t.temp)}</label>
            <div class="stepper">
              <button data-action="step" data-dir="-1" aria-label="-${lim.step}">−</button>
              <input id="m-temp" type="number" inputmode="decimal" min="${lim.min}" max="${lim.max}" step="${lim.step}" value="${stepSetpoint(m.t, 0, lim)}">
              <button data-action="step" data-dir="1" aria-label="+${lim.step}">+</button>
            </div>
          </div>
          <div class="err" id="m-err" role="alert"></div>
          <div class="actions">
            ${m.kind === "edit" ? `<button class="btn danger" data-action="modal-remove" ${n < 2 ? "disabled" : ""}>${esc(t.remove)}</button>` : ""}
            <div class="right">
              <button class="btn" data-action="modal-cancel">${esc(t.cancel)}</button>
              <button class="btn primary" data-action="modal-save">${esc(t.save)}</button>
            </div>
          </div>
        </div>
      </div>`;
    }

    _render() {
      if (!this._hass && !this._state) {
        this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card><div class="msg">…</div></ha-card>`;
        return;
      }
      // Rendu complet : on retient l'élément qui a le focus pour le lui rendre ensuite.
      const active = this.shadowRoot.activeElement;
      const focus = this._returnFocus || focusSelector(active);
      this._returnFocus = null;

      const t = this.t;
      if (this._isCompact()) {
        const s = this._state;
        const ctitle = (this._config && this._config.title) || (s && s.zone_name) || t.title;
        const msg = s ? "" : this._loadError ? t[this._loadError] || t.notLoaded : t.connecting;
        this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card class="compact">${this._compactHtml(ctitle, msg)}</ha-card>`;
        this._updateLive();
        this._updateSaveStatus();
        if (focus) {
          const el = this.shadowRoot.querySelector(focus);
          if (el) el.focus();
        }
        return;
      }
      const title = (this._config && this._config.title) || defaultTitle(t.title, this._state);
      let body;
      if (this._loadError && !this._state) {
        body = `<div class="msg">${esc(t[this._loadError] || t.notLoaded)}</div>`;
      } else if (!this._state) {
        body = `<div class="msg">${esc(t.connecting)}</div>`;
      } else {
        const s = this._state;
        const profile = s.data.profiles[this._profile];
        const editable = this._canEdit();
        const ro = editable ? "" : "disabled";
        const tab = (name) => {
          const on = this._profile === name;
          return `<button class="tab${on ? " on" : ""}" role="tab" aria-selected="${on}" data-action="tab" data-profile="${name}">${esc(t[name === "home" ? "tabHome" : "tabAway"])}${s.effective_mode === name ? `<span class="badge" title="${esc(t.activeBadge)}">${esc(t.activeShort)}</span>` : ""}</button>`;
        };
        const multi = s.zone_count > 1;
        // « Zone absente » : ligne affichée seulement avec l'option show_zone_away.
        const zoneMode = zoneAwayDisplay(this._config, s);
        const forced =
          (multi ? `<div class="hint">${esc(t.allZones)}</div>` : "") +
          (s.forced_by_entity ? `<div class="hint">${esc(t.forcedBy)} ${esc(s.away_entity)}</div>` : "") +
          (zoneMode === "hint" ? `<div class="hint">${esc(t.zoneAwayOn)}</div>` : "");
        const zoneAway =
          zoneMode === "row"
            ? `<div class="row"><div><div class="label" id="zone-away-label">${esc(t.zoneAway)}</div><div class="hint">${esc(t.zoneAwayHint)}</div></div>
            <label class="switch"><input type="checkbox" data-action="zone-away-switch" aria-labelledby="zone-away-label" ${s.zone_away ? "checked" : ""}><span></span></label></div>`
            : "";
        const selKey = this._selKey(this._profile);
        // Contrôles du mode Absent : seulement dans l'onglet « Planning Absent ».
        const awayControls =
          this._profile === "away"
            ? `<div class="row"><div><div class="label" id="away-label">${esc(t.manualAway)}</div>${forced}</div>
            <label class="switch"><input type="checkbox" data-action="away-switch" aria-labelledby="away-label" ${s.data.manual_mode === "away" ? "checked" : ""}><span></span></label></div>
          ${zoneAway}`
            : "";
        body = `
          <div class="tabs" role="tablist">${tab("home")}${tab("away")}</div>
          ${awayControls}
          ${editable ? "" : `<div class="ro-note"><ha-icon icon="mdi:lock-outline"></ha-icon><span>${esc(t.readOnly)}</span></div>`}
          ${this._weekHtml(this._profile, selKey)}
          ${this._dayShown(selKey) ? `<section class="day" id="day-panel" aria-label="${esc(t.dayAria)}">${this._dayPanelInner()}</section>` : ""}
          ${selKey ? this._editorHtml(this._profile, selKey) : `<div class="pick">${esc(editable ? t.pickDay : t.pickDayRo)}</div>`}
          <details class="settings" id="settings" ${this._settingsOpen ? "open" : ""}>
            <summary><span class="sum-name">${esc(t.settings)}</span>
              <span class="sum-hint">${esc(t["layout_" + profile.layout])}${s.data.enabled ? "" : ` · ${esc(t.off)}`}</span>
              <span class="chev"></span></summary>
            <div class="row"><label class="label" for="layout-select">${esc(t.layout)}</label>
              <select id="layout-select" data-action="layout" ${ro}>
                ${["all", "weekday_weekend", "daily"].map((l) => `<option value="${l}" ${profile.layout === l ? "selected" : ""}>${esc(t["layout_" + l])}</option>`).join("")}
              </select></div>
            <div class="row"><div class="label" id="enabled-label">${esc(t.enabled)}</div>
              <label class="switch"><input type="checkbox" data-action="enabled-switch" aria-labelledby="enabled-label" ${s.data.enabled ? "checked" : ""} ${ro}><span></span></label></div>
          </details>
          <div id="save-status" class="status" role="status"></div>`;
      }
      this.shadowRoot.innerHTML = `<style>${STYLE}</style>
        <ha-card>
          ${this._heroHtml(title)}
          ${body}
        </ha-card>${this._modalHtml()}`;
      this._updateLive();
      this._updateSaveStatus();
      this._ensureDay();

      const root = this.shadowRoot;
      if (this._modal) {
        // Fenêtre ouverte : focus sur le premier champ modifiable.
        const first = root.querySelector(".modal input:not([disabled])");
        if (first && !(active && active.closest && active.closest(".modal"))) first.focus();
      } else if (focus) {
        const el = root.querySelector(focus);
        if (el) el.focus();
      }
    }

    // -- panneau du jour (historique) ------------------------------------------
    /** Panneau affiché : option show_history, ligne d'aujourd'hui sélectionnée, onglet du mode actif. */
    _dayShown(selKey) {
      const s = this._state;
      if (!s || !selKey || (this._config && this._config.show_history === false)) return false;
      if (!this._hass || typeof this._hass.callWS !== "function" || this._profile !== s.effective_mode) return false;
      return gridRows(s.data.profiles[this._profile].layout, weekdayOf(new Date())).some((r) => r.key === selKey && r.today);
    }

    /** Jour affiché : { off, start, end, key } (bornes à minuit, heure locale). */
    _dayInfo() {
      const n = new Date();
      const start = new Date(n.getFullYear(), n.getMonth(), n.getDate() - this._dayOff);
      const end = new Date(n.getFullYear(), n.getMonth(), n.getDate() - this._dayOff + 1);
      return { off: this._dayOff, start, end, key: `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}` };
    }

    /** Capteur « Consigne » de la zone (registre d'entités du frontend), ou null. */
    _targetSensor() {
      const h = this._hass;
      return h && this._state ? findTargetSensor(h.entities, h.devices, this._state.entry_id) : null;
    }

    /** Charge l'historique du jour affiché s'il manque ; aujourd'hui (ou après une erreur) : toutes les 5 min. */
    _ensureDay() {
      if (!this.shadowRoot.getElementById("day-panel")) return;
      const info = this._dayInfo();
      const h = this._hist[info.key];
      if (h && (h.loading || Date.now() - h.at < 300000 || (info.off > 0 && !h.error))) return;
      this._fetchDay(info);
    }

    async _fetchDay(info) {
      const climate = this._state.climate_entity;
      const target = this._targetSensor();
      const prev = this._hist[info.key] || {};
      this._hist[info.key] = { ...prev, loading: true };
      const today = info.off === 0;
      let entry;
      try {
        const res = await this._hass.callWS({
          type: "history/history_during_period",
          start_time: info.start.toISOString(),
          end_time: (today ? new Date() : info.end).toISOString(),
          entity_ids: [climate, target].filter(Boolean),
          include_start_time_state: true,
          significant_changes_only: false,
          minimal_response: false,
          no_attributes: false,
        });
        entry = { climate: (res && res[climate]) || [], target: target ? (res && res[target]) || [] : null, at: Date.now() };
      } catch (err) {
        entry = { ...prev, error: (err && err.message) || true, at: Date.now() };
      }
      this._hist[info.key] = entry;
      if (this._dayInfo().key === info.key) this._updateDayPanel();
    }

    /** Horloge (30 s) : « il est 14:40 » et rafraîchissement de l'historique du jour. */
    _tickDay() {
      const el = this.shadowRoot.getElementById("day-now");
      if (el && this._dayOff === 0) el.textContent = this.t.nowAt.replace("{time}", this._fmtTime(new Date().toISOString()));
      this._ensureDay();
    }

    /** Redessine le panneau seul (sans rendu complet), en gardant le focus. */
    _updateDayPanel(focusAction) {
      const el = this.shadowRoot.getElementById("day-panel");
      if (!el) return;
      const active = this.shadowRoot.activeElement;
      const sel = focusAction ? `[data-action="${focusAction}"]` : active && el.contains(active) ? focusSelector(active) : null;
      el.innerHTML = this._dayPanelInner();
      if (!sel) return;
      let target = el.querySelector(sel);
      if (!target || target.disabled) {
        // Bout de l'historique atteint : le focus passe à l'autre flèche.
        const other = { "day-prev": "day-next", "day-next": "day-prev" }[focusAction];
        target = other ? el.querySelector(`[data-action="${other}"]`) : null;
      }
      if (target && !target.disabled) target.focus();
    }

    /** Modèle du jour : historique + consigne à venir (et repli sur le planning) du mode actif. */
    _buildModel(info, h) {
      const s = this._state;
      const now = new Date();
      const today = info.off === 0;
      const steps = (pieces, base) => pieces.map((p) => ({ s: base + p.start, e: base + p.end, v: p.temp }));
      const nowMin = (now - info.start) / 60000;
      return dayModel({
        climate: h.climate,
        target: h.target,
        start: info.start.getTime(),
        end: info.end.getTime(),
        now: today ? now.getTime() : null,
        future: today ? steps(ribbon(s.data, s.effective_mode, s.override, now, (info.end - now) / 3600000), nowMin) : [],
        schedule: steps(ribbon(s.data, s.effective_mode, null, info.start, (info.end - info.start) / 3600000), 0),
      });
    }

    _dayName(date) {
      const name = date.toLocaleDateString(this._lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "short" });
      return name.charAt(0).toUpperCase() + name.slice(1);
    }

    /** Contenu du panneau : en-tête ‹ jour ›, graphique, légende, trois chiffres, tableau des valeurs. */
    _dayPanelInner() {
      const t = this.t;
      const info = this._dayInfo();
      const h = this._hist[info.key];
      const name = this._dayName(info.start);
      const today = info.off === 0;
      const head = `<div class="dayhead">
          <button class="nav" data-action="day-prev" aria-label="${esc(t.dayPrev)}" ${info.off >= this._histDays - 1 ? "disabled" : ""}><span aria-hidden="true">‹</span></button>
          <span class="dname" aria-live="polite">${esc(name)}</span>
          <button class="nav" data-action="day-next" aria-label="${esc(t.dayNext)}" ${today ? "disabled" : ""}><span aria-hidden="true">›</span></button>
          <span class="dnow" id="day-now">${today ? esc(t.nowAt.replace("{time}", this._fmtTime(new Date().toISOString()))) : ""}</span>
        </div>`;
      this._model = null;
      if (!h || (h.climate === undefined && !h.error)) return `${head}<div class="hmsg" role="status">${esc(t.histLoading)}</div>`;
      if (h.climate === undefined)
        return `${head}<div class="hmsg" role="alert">${esc(t.histError)}${h.error !== true ? ` (${esc(h.error)})` : ""}</div>`;

      const model = this._buildModel(info, h);
      const start = info.start.getTime();
      const at = (m) => this._fmtTime(new Date(start + m * 60000).toISOString());
      const hasMeas = model.runs.length > 0;
      const hasPlan = model.plan.some((g) => g.v !== null);
      const notes = [];
      if (!hasMeas) notes.push(h.climate.length ? t.histNoMeas : t.histEmpty);
      if (hasPlan && model.planFromSchedule) notes.push(t.planGuess);
      const noteHtml = notes.map((n) => `<div class="hmsg">${esc(n)}</div>`).join("");
      if (!hasMeas && !hasPlan) return head + noteHtml;
      this._model = model;
      this._modelStart = start;

      const svg = this._chartSvg(model, name);
      const planColor = tempColors(Math.max(...model.plan.filter((g) => g.v !== null).map((g) => g.v)), this._scale, this._dark, this._palette).bg;
      const hasLag = model.lags.some((l) => l.e - l.s >= 3);
      const sw = (inner, w = 18, hh = 10) => `<svg class="k" width="${w}" height="${hh}" aria-hidden="true">${inner}</svg>`;
      const legend = [
        hasMeas ? sw('<line x1="0" x2="18" y1="5" y2="5" stroke="currentColor" stroke-width="2.25"/>') + esc(t.lgMeas) : "",
        sw(`<line x1="3" x2="15" y1="5" y2="5" stroke="${planColor}" stroke-width="5" stroke-linecap="round"/>`) + esc(t.lgPlan),
        hasLag ? sw('<rect width="14" height="10" rx="2" fill="var(--heat)" opacity=".3"/>', 14) + esc(t.lgLag) : "",
        model.heat ? sw('<rect y="1" width="14" height="8" rx="3" fill="var(--heat)"/>', 14) + esc(t.lgHeat) : "",
      ]
        .filter(Boolean)
        .map((x) => `<span>${x}</span>`)
        .join("");

      let tiles = "";
      if (hasMeas) {
        const st = model.stats;
        const tile = (big, small) => `<div><b>${esc(big)}</b>${esc(small)}</div>`;
        const deg = (v) => `${this._fmt(v)}°`;
        const list = [];
        if (!st.lag) list.push(tile("—", t.noRise));
        else if (st.lag.reached)
          list.push(tile(fmtDuration(st.lag.e - st.lag.s, this._lang), t.reachTime.replace("{temp}", deg(st.lag.t)).replace("{time}", at(st.lag.s))));
        else list.push(tile(t.notReached, t.notReachedSub.replace("{temp}", deg(st.lag.t)).replace("{time}", at(st.lag.s))));
        if (st.heat !== null) list.push(tile(fmtDuration(st.heat, this._lang), today ? t.heatToday : t.heatDay));
        if (st.devFrom === null) list.push(tile("—", t.devNone));
        else {
          const r = st.dev === null ? null : Math.round(st.dev * 10) / 10;
          const big = r === null ? "—" : r === 0 ? "0°" : `${r > 0 ? "+" : "−"}${this._fmt(Math.abs(r))}°`;
          list.push(tile(big, st.devFrom === 0 ? (today ? t.devMidnight : t.devDay) : t.devSince.replace("{time}", at(st.devFrom))));
        }
        tiles = `<div class="tiles">${list.join("")}</div>`;
      }

      let table = "";
      if (this._tableOpen) {
        const v = (x) => (x === null || x === undefined ? "—" : `${this._fmt(x)}°`);
        const rows = valueRows(model, 60)
          .map(
            (r) =>
              `<tr><th scope="row">${esc(at(r.m))}</th><td>${v(r.room)}</td><td>${v(r.plan)}</td>${model.heat ? `<td>${r.heat === null ? "—" : r.heat}</td>` : ""}</tr>`
          )
          .join("");
        table = `<div class="vals" id="day-values" tabindex="0" role="region" aria-label="${esc(t.tblCaption.replace("{day}", name))}"><table>
            <caption>${esc(t.tblCaption.replace("{day}", name))}</caption>
            <thead><tr><th scope="col">${esc(t.thTime)}</th><th scope="col">${esc(t.thRoom)}</th><th scope="col">${esc(t.thPlan)}</th>${model.heat ? `<th scope="col">${esc(t.thHeat)}</th>` : ""}</tr></thead>
            <tbody>${rows}</tbody></table></div>`;
      }
      return `${head}${noteHtml}
        <div class="plot">${svg}<div class="tip" id="day-tip" hidden></div></div>
        <div class="lg">${legend}</div>
        ${tiles}
        <div class="tablelink"><button type="button" data-action="day-table" aria-expanded="${this._tableOpen}" aria-controls="day-values">${esc(this._tableOpen ? t.hideValues : t.showValues)}</button></div>
        ${table}`;
    }

    /** Graphique SVG du jour, à la largeur réelle de la carte (textes à leur taille). */
    _chartSvg(model, name) {
      const t = this.t;
      const W = Math.max(280, (this._width || 400) - 32);
      const L = 34;
      const R = 12;
      const T = 16;
      const PH = 150;
      const GAP = 10;
      const LANE = 14;
      const AX = 18;
      const lane = !!model.heat;
      const ly = T + PH + GAP;
      const H = T + PH + (lane ? GAP + LANE : 0) + AX + 4;
      const { lo, hi, step } = model.scale;
      const pw = W - L - R;
      const r1 = (v) => Math.round(v * 10) / 10;
      const x = (m) => r1(L + (m / model.len) * pw);
      const y = (v) => r1(T + (1 - (v - lo) / (hi - lo)) * PH);
      const nowM = model.now === null ? model.len : model.now;
      this._geo = { W, H, L, pw, T, PH, x, y };

      let grid = "";
      for (let v = lo; v <= hi; v += step)
        grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider-color)"/><text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}°</text>`;
      const hStep = pw >= 480 ? 3 : 6;
      for (let hh = 0; hh <= 24; hh += hStep) {
        const m = Math.min(model.len, hh * 60);
        grid += `<text x="${x(m)}" y="${H - 4}" text-anchor="${hh === 0 ? "start" : hh === 24 ? "end" : "middle"}">${hh}:00</text>`;
      }

      // Consigne : un trait épais par plage dans sa couleur, bordé de sa teinte contrastée (visible sur le fond), futur estompé.
      let plan = "";
      model.plan.forEach((g, i) => {
        if (g.v === null) return;
        const col = tempColors(g.v, this._scale, this._dark, this._palette);
        const c = col.bg;
        const prev = model.plan[i - 1];
        if (prev && prev.v !== null && Math.abs(prev.e - g.s) < 1e-6)
          plan += `<line x1="${x(g.s)}" x2="${x(g.s)}" y1="${y(prev.v)}" y2="${y(g.v)}" stroke="var(--secondary-text-color)" stroke-width="1" stroke-dasharray="2 2"/>`;
        [
          [g.s, Math.min(g.e, nowM), 1],
          [Math.max(g.s, nowM), g.e, 0.4],
        ].forEach(([a, b, op]) => {
          if (b <= a) return;
          plan += `<g opacity="${op}"><line x1="${x(a)}" x2="${x(b)}" y1="${y(g.v)}" y2="${y(g.v)}" stroke="${col.accent}" stroke-opacity=".55" stroke-width="7" stroke-linecap="round"/>
            <line x1="${x(a)}" x2="${x(b)}" y1="${y(g.v)}" y2="${y(g.v)}" stroke="${c}" stroke-width="5" stroke-linecap="round"/></g>`;
        });
        if (x(g.e) - x(g.s) >= 30 && (!prev || prev.v !== g.v))
          plan += `<text class="pl" x="${x(g.s) + 4}" y="${y(g.v) - 7}">${this._fmt(g.v)}°</text>`;
      });

      // Mesure : points des tracés pour l'interpolation (zones de retard).
      const pts = model.runs.flat();
      const interp = (m) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const [m0, v0] = pts[i];
          const [m1, v1] = pts[i + 1];
          if (m >= m0 && m <= m1) return m1 > m0 ? v0 + ((v1 - v0) * (m - m0)) / (m1 - m0) : v1;
        }
        return null;
      };
      let lagArea = "";
      let pills = "";
      model.lags.forEach((l) => {
        if (l.e - l.s < 3) return;
        const ms = [l.s];
        for (let m = Math.ceil(l.s / 5) * 5; m < l.e; m += 5) ms.push(m);
        ms.push(l.e);
        const bottom = ms
          .map((m) => [m, interp(m)])
          .filter(([, v]) => v !== null)
          .reverse()
          .map(([m, v]) => `L${x(m)},${y(Math.min(v, l.t))}`)
          .join(" ");
        lagArea += `<path d="M${x(l.s)},${y(l.t)} L${x(l.e)},${y(l.t)} ${bottom} Z" fill="var(--heat)" opacity=".22"/>`;
        if (!l.reached || l.e - l.s < 5) return;
        const label = `+${fmtDuration(l.e - l.s, this._lang)}`;
        const w = label.length * 6 + 14;
        const cx = Math.max(L + w / 2, Math.min(W - R - w / 2, (x(l.s) + x(l.e)) / 2));
        const startV = interp(l.s);
        const cy = Math.min(T + PH - 12, r1((y(l.t) + y(startV === null ? l.from : Math.max(startV, lo))) / 2 + 8));
        pills += `<rect x="${r1(cx - w / 2)}" y="${r1(cy - 8.5)}" width="${w}" height="17" rx="8.5" fill="var(--heat)"/>
          <text class="pill" x="${r1(cx)}" y="${r1(cy + 3.5)}" text-anchor="middle">${esc(label)}</text>`;
      });

      const meas = model.runs
        .map((run) => `<path d="${smoothPath(run.map(([m, v]) => [x(m), y(v)]))}" fill="none" stroke="var(--primary-text-color)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>`)
        .join("");

      let now = "";
      if (model.now !== null) {
        now += `<line x1="${x(model.now)}" x2="${x(model.now)}" y1="${T - 6}" y2="${T + PH}" stroke="var(--secondary-text-color)" stroke-dasharray="3 3"/>`;
        const last = model.last;
        if (last && model.now - last.m < 1) {
          const cy = y(last.t);
          const ty = cy + 20 > T + PH ? cy - 10 : cy + 20;
          const anchor = x(last.m) > W - R - 16 ? "end" : "middle";
          now += `<circle cx="${x(last.m)}" cy="${cy}" r="5.5" fill="var(--primary-text-color)" stroke="var(--card-background-color, #fff)" stroke-width="2.5"/>
            <text class="nowv" x="${x(last.m)}" y="${ty}" text-anchor="${anchor}">${this._fmt(Math.round(last.t * 10) / 10)}°</text>`;
        }
      }

      let heat = "";
      if (lane) {
        heat = `<path transform="translate(${L - 20} ${ly + 1}) scale(0.5)" fill="var(--heat)" d="M17.66 11.2c-.23-.3-.51-.56-.77-.82-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32-2.59 2.08-3.61 5.75-2.39 8.9.04.1.08.2.08.33 0 .22-.15.42-.35.5-.23.1-.47.04-.66-.12a.6.6 0 0 1-.14-.17c-1.13-1.43-1.31-3.48-.55-5.12C5.78 10 4.87 12.3 5 14.47c.06.5.12 1 .29 1.5.14.6.41 1.2.71 1.73 1.08 1.73 2.95 2.97 4.96 3.22 2.14.27 4.43-.12 6.07-1.6 1.83-1.66 2.47-4.32 1.53-6.6l-.13-.26c-.21-.46-.77-1.26-.77-1.26z"/>
          <rect x="${L}" y="${ly}" width="${pw}" height="${LANE}" rx="4" fill="var(--secondary-background-color)"/>`;
        model.heat.forEach((g) => {
          heat += `<rect x="${x(g.s)}" y="${ly + 3}" width="${Math.max(3, r1(x(g.e) - x(g.s)))}" height="${LANE - 6}" rx="3" fill="var(--heat)"/>`;
        });
      }
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t.chartAria.replace("{day}", name))}">
        ${grid}${lagArea}${plan}${meas}${pills}${now}${heat}
        <g id="hov" visibility="hidden"><line id="hov-l" y1="${T}" y2="${T + PH}" stroke="var(--primary-text-color)" stroke-opacity=".35"/>
          <circle id="hov-c" r="4" fill="var(--primary-text-color)" stroke="var(--card-background-color, #fff)" stroke-width="2"/></g>
      </svg>`;
    }

    /** Bulle au survol / toucher : heure, pièce, prévu, chauffe. */
    _onPlotPointer(e) {
      const plot = e.target.closest && e.target.closest(".plot");
      if (!plot) {
        if (e.type === "pointerdown") this._hideTip();
        return;
      }
      const model = this._model;
      const g = this._geo;
      const svg = plot.querySelector("svg");
      const tip = plot.querySelector("#day-tip");
      if (!model || !g || !svg || !tip) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const px = ((e.clientX - rect.left) * g.W) / rect.width;
      const m = Math.max(0, Math.min(model.len, ((px - g.L) / g.pw) * model.len));
      const p = pointAt(model, m);
      const t = this.t;
      const hov = svg.querySelector("#hov");
      const xm = g.x(m);
      svg.querySelector("#hov-l").setAttribute("x1", xm);
      svg.querySelector("#hov-l").setAttribute("x2", xm);
      const c = svg.querySelector("#hov-c");
      c.setAttribute("cx", xm);
      c.setAttribute("cy", p.room === null ? -99 : g.y(p.room));
      c.setAttribute("visibility", p.room === null ? "hidden" : "visible");
      hov.setAttribute("visibility", "visible");
      const lines = [`<div class="h">${esc(this._fmtTime(new Date(this._modelStart + m * 60000).toISOString()))}</div>`];
      const sw = (inner, hh) => `<svg class="k" width="14" height="${hh}" aria-hidden="true">${inner}</svg>`;
      if (p.room !== null)
        lines.push(`<div>${sw('<line x1="0" x2="14" y1="2" y2="2" stroke="currentColor" stroke-width="2.25"/>', 4)}${esc(t.tipRoom)} <b>${this._fmt(Math.round(p.room * 10) / 10)}°</b></div>`);
      if (p.plan !== null) {
        const col = tempColors(p.plan, this._scale, this._dark, this._palette).bg;
        lines.push(`<div>${sw(`<line x1="3" x2="11" y1="3" y2="3" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`, 6)}${esc(t.tipPlan)} <b>${this._fmt(p.plan)}°</b></div>`);
      }
      if (p.heating !== null)
        lines.push(
          `<div>${sw(`<rect y="1" width="14" height="6" rx="2" fill="${p.heating ? "var(--heat)" : "var(--secondary-background-color)"}"/>`, 8)}${esc(p.heating ? t.tipHeatOn : t.tipHeatOff)}</div>`
        );
      tip.innerHTML = lines.join("");
      tip.hidden = false;
      const left = (xm / g.W) * 100;
      tip.style.left = `${left}%`;
      tip.style.top = `${((g.T + g.PH * 0.45) / g.H) * rect.height}px`;
      tip.style.transform = `translate(${left > 55 ? "calc(-100% - 12px)" : "12px"}, -50%)`;
    }

    _hideTip() {
      const tip = this.shadowRoot.getElementById("day-tip");
      if (tip) tip.hidden = true;
      const hov = this.shadowRoot.getElementById("hov");
      if (hov) hov.setAttribute("visibility", "hidden");
    }

    // -- interactions ------------------------------------------------------
    /** Droit de modifier le planning (envoyé par le serveur ; absent = ancien serveur). */
    _canEdit() {
      return !this._state || this._state.can_edit !== false;
    }

    _profileData(name) {
      return this._state.data.profiles[name];
    }

    _closeModal() {
      const m = this._modal;
      this._modal = null;
      if (m && m.returnFocus) this._returnFocus = m.returnFocus;
      this._render();
    }

    _resetCopy() {
      this._copyOpen = false;
      this._copySel = new Set();
    }

    _onChange(e) {
      const el = e.target.closest("[data-action]");
      if (!el || !this._state) return;
      const action = el.dataset.action;
      if (EDIT_ACTIONS.has(action) && !this._canEdit()) return this._render();
      if (action === "layout") {
        seedLayout(this._profileData(this._profile), el.value);
        this._resetCopy();
        this._commit();
      } else if (action === "enabled-switch") {
        this._state.data.enabled = el.checked;
        this._commit();
      } else if (action === "copy-pick") {
        // Sans nouveau rendu : on garde le focus sur la case.
        if (el.checked) this._copySel.add(el.dataset.target);
        else this._copySel.delete(el.dataset.target);
        const apply = this.shadowRoot.querySelector('[data-action="copy-apply"]');
        if (apply) apply.disabled = !this._copySel.size;
      } else if (action === "away-switch") {
        const mode = el.checked ? "away" : "home";
        this._state.data.manual_mode = mode;
        this._ws({ type: "thermostat_planner/set_mode", mode }).catch(() => {
          this._status = "error";
          this._updateSaveStatus();
        });
      } else if (action === "zone-away-switch") {
        this._ws({ type: "thermostat_planner/set_zone_away", away: el.checked }).catch((err) => {
          this._status = "error";
          this._error = (err && err.message) || "";
          this._updateSaveStatus();
        });
      }
    }

    _onClick(e) {
      const el = e.target.closest("[data-action]");
      if (!el || !this._state) return;
      const a = el.dataset.action;
      if (EDIT_ACTIONS.has(a) && !this._canEdit()) return;
      const profile = el.dataset.profile;
      const key = el.dataset.key;

      if (a === "ovr-step") {
        this._stepOverride(Number(el.dataset.dir));
      } else if (a === "ovr-clear") {
        clearTimeout(this._ovrTimer);
        this._ovrValue = null;
        this._ws({ type: "thermostat_planner/clear_override" }).catch((err) => {
          this._status = "error";
          this._error = (err && err.message) || "";
          this._updateSaveStatus();
        });
      } else if (a === "day-prev" || a === "day-next") {
        const off = this._dayOff + (a === "day-prev" ? 1 : -1);
        if (off < 0 || off > this._histDays - 1) return;
        this._dayOff = off;
        this._updateDayPanel(a);
        this._ensureDay();
      } else if (a === "day-table") {
        this._tableOpen = !this._tableOpen;
        this._updateDayPanel(a);
      } else if (a === "planning-open") {
        this._expanded = true;
        this._returnFocus = '[data-action="planning-close"]';
        this._render();
      } else if (a === "planning-close") {
        this._expanded = false;
        this._modal = null;
        this._resetCopy();
        this._returnFocus = '[data-action="planning-open"]';
        this._render();
      } else if (a === "tab") {
        this._profile = profile;
        this._resetCopy();
        this._render();
      } else if (a === "select") {
        // Toucher la ligne choisie la referme.
        this._sel[this._profile] = this._selKey(this._profile) === key ? null : key;
        this._resetCopy();
        this._render();
      } else if (a === "copy-open") {
        const open = !this._copyOpen;
        this._resetCopy();
        this._copyOpen = open;
        this._render();
      } else if (a === "copy-cancel") {
        this._resetCopy();
        this._returnFocus = '[data-action="copy-open"]';
        this._render();
      } else if (a === "copy-apply") {
        const src = { profile: this._profile, key: this._selKey(this._profile) };
        if (!src.key) return;
        // Seules les destinations encore proposées (le layout a pu changer).
        const valid = new Set(copyTargets(this._state.data, src).flatMap((g) => g.keys.map((k) => `${g.profile}:${k}`)));
        const targets = [...this._copySel]
          .filter((id) => valid.has(id))
          .map((id) => {
            const [p, k] = id.split(":");
            return { profile: p, key: k };
          });
        this._resetCopy();
        this._returnFocus = '[data-action="copy-open"]';
        if (!targets.length) return this._render();
        this._state.data = copyTo(this._state.data, src, targets);
        this._commit();
      } else if (a === "edit") {
        const i = Number(el.dataset.index);
        const iv = intervals(this._profileData(profile).schedules[key])[i];
        this._modal = { kind: "edit", profile, key, index: i, s: iv.s, e: iv.e, t: iv.t, returnFocus: focusSelector(el) };
        this._render();
      } else if (a === "add") {
        const r = suggestRange(this._profileData(profile).schedules[key]);
        this._modal = { kind: "add", profile, key, s: r.s, e: r.e, t: r.t, returnFocus: focusSelector(el) };
        this._render();
      } else if (a === "step") {
        const input = this.shadowRoot.getElementById("m-temp");
        const lim = this._scheduleLimits();
        const cur = parseFloat(input.value);
        const base = Number.isNaN(cur) ? lim.min : cur;
        input.value = String(stepSetpoint(base, Number(el.dataset.dir) * lim.step, lim));
      } else if (a === "modal-cancel") {
        this._closeModal();
      } else if (a === "overlay") {
        if (e.target === el) this._closeModal();
      } else if (a === "modal-remove") {
        const m = this._modal;
        const res = removeBlock(this._profileData(m.profile).schedules[m.key], m.index);
        if (res.error) return this._modalError(res.error);
        this._profileData(m.profile).schedules[m.key] = res.segs;
        this._modal = null;
        // La plage supprimée n'existe plus : focus sur « Ajouter une plage ».
        this._returnFocus = '[data-action="add"]';
        this._commit();
      } else if (a === "modal-save") {
        this._saveModal();
      }
    }

    _modalError(code) {
      const el = this.shadowRoot.getElementById("m-err");
      if (el) el.textContent = this.t[code] || code;
    }

    _saveModal() {
      const m = this._modal;
      const root = this.shadowRoot;
      const startVal = root.getElementById("m-start").value;
      const endVal = root.getElementById("m-end").value;
      const tempRaw = parseFloat(root.getElementById("m-temp").value);
      if (Number.isNaN(tempRaw)) return this._modalError("eEmpty");
      const temp = stepSetpoint(tempRaw, 0, this._scheduleLimits());
      const profile = this._profileData(m.profile);
      const segs = profile.schedules[m.key];
      const start = startVal ? toMin(startVal) : NaN;
      const end = endVal && endVal !== "24:00" ? toMin(endVal) : endVal === "24:00" ? 1440 : NaN;

      let result;
      if (m.kind === "edit") {
        result = applyEdit(segs, m.index, start, end, temp);
      } else if (Number.isNaN(start) || Number.isNaN(end)) {
        result = { error: "eEmpty" };
      } else if (end <= start) {
        result = { error: "eOrder" };
      } else {
        result = { segs: paint(segs, start, end, temp) };
      }
      if (result.error) return this._modalError(result.error);
      profile.schedules[m.key] = result.segs;
      this._modal = null;
      // Les plages ont pu être renumérotées : focus sur « Ajouter une plage ».
      this._returnFocus = '[data-action="add"]';
      this._commit();
    }
  }

  ThermostatPlannerCard.helpers = { paint, applyEdit, removeBlock, suggestRange, seedLayout, stepSetpoint, scheduleLimits, keyFor, toMin, toStr, tempColors, parseScale, fmtTemp, targetAt, upcoming, targetOf, withTarget, defaultTitle, subscribeErrorKey, zoneAwayDisplay, gridRows, selectedRow, copyTargets, copyTo, fmtDuration, focusSelector, cardFormat, ribbon, ribbonTicks, paletteOf, PALETTES, historyDays, findTargetSensor, histStates, holdSteps, valueAt, resample, measRuns, smoothPath, heatLags, meanDeviation, niceScale, dayModel, pointAt, valueRows };

  if (!customElements.get("thermostat-planner-card")) {
    customElements.define("thermostat-planner-card", ThermostatPlannerCard);
  }
  // Accès aux helpers depuis node (tests/test_card.js) ; sans effet dans le navigateur.
  if (typeof module !== "undefined" && module.exports) module.exports = ThermostatPlannerCard;
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "thermostat-planner-card",
    name: "Thermostat Planner",
    description: "Planning de chauffage par plages horaires, modes Maison / Absent.",
  });
})();
