/* Thermostat Planner card — v0.6.0
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

  /**
   * Palier configuré (premier qui correspond), sinon échelle par défaut adaptée au thème,
   * sans passer par le vert : bleu ardoise (froid) qui se désature jusqu'à 18 °C,
   * puis sable → corail (confort) qui se sature jusqu'à 22 °C.
   * Thème clair : fonds clairs et texte foncé ; thème sombre : fonds sombres et texte clair.
   */
  function tempColors(t, scale, dark) {
    const hit =
      scale &&
      scale.find((c) => (c.min === undefined || t >= c.min) && (c.max === undefined || t <= c.max));
    if (hit) return hit;
    const r = Math.max(0, Math.min(1, (t - 14) / 8)); // 14 °C → 22 °C
    const cold = r < 0.5;
    const k = cold ? 1 - r * 2 : (r - 0.5) * 2; // intensité 1 → 0 → 1
    const h = Math.round(cold ? 214 : 40 - k * 26);
    const sat = Math.round(14 + k * (cold ? 46 : 66));
    const l = (x) => Math.round(x);
    return dark
      ? {
          bg: `hsl(${h} ${sat}% ${l(27 + k * 9)}%)`,
          fg: `hsl(${h} 80% 90%)`,
          accent: `hsl(${h} ${sat + 10}% 68%)`,
          tint: `hsl(${h} ${sat}% 50% / 0.16)`,
        }
      : {
          bg: `hsl(${h} ${sat + 6}% ${l(86 - k * 18)}%)`,
          fg: `hsl(${h} 60% 18%)`,
          accent: `hsl(${h} ${sat + 10}% 36%)`,
          tint: `hsl(${h} ${sat + 6}% 60% / 0.16)`,
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
      this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
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
      this._clock = setInterval(() => this._updateLive(), 30000);
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
          const c = tempColors(p.temp, this._scale, this._dark);
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
              const c = tempColors(iv.t, this._scale, this._dark);
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
          const c = tempColors(iv.t, this._scale, this._dark);
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
        body = `
          <div class="row"><div><div class="label" id="away-label">${esc(t.manualAway)}</div>${forced}</div>
            <label class="switch"><input type="checkbox" data-action="away-switch" aria-labelledby="away-label" ${s.data.manual_mode === "away" ? "checked" : ""}><span></span></label></div>
          ${zoneAway}
          <div class="tabs" role="tablist">${tab("home")}${tab("away")}</div>
          ${editable ? "" : `<div class="ro-note"><ha-icon icon="mdi:lock-outline"></ha-icon><span>${esc(t.readOnly)}</span></div>`}
          ${this._weekHtml(this._profile, selKey)}
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

  ThermostatPlannerCard.helpers = { paint, applyEdit, removeBlock, suggestRange, seedLayout, stepSetpoint, scheduleLimits, keyFor, toMin, toStr, tempColors, parseScale, fmtTemp, targetAt, upcoming, targetOf, withTarget, defaultTitle, subscribeErrorKey, zoneAwayDisplay, gridRows, selectedRow, copyTargets, copyTo, fmtDuration, focusSelector, cardFormat, ribbon, ribbonTicks };

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
