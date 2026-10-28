/* Thermostat Planner card — v0.1.0
 * Carte Lovelace sans dépendance : planning par plages horaires,
 * modes Maison / Absent, 3 modes de programmation des jours.
 */
(() => {
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const MIN_T = 5;
  const MAX_T = 35;
  const STEP = 0.5;

  const I18N = {
    fr: {
      title: "Planning chauffage",
      home: "Maison",
      away: "Absent",
      activeBadge: "Mode actif",
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
      addBlock: "Ajouter une plage",
      editBlock: "Modifier la plage",
      newBlock: "Nouvelle plage",
      start: "Début",
      end: "Fin",
      temp: "Température",
      save: "Enregistrer",
      cancel: "Annuler",
      remove: "Supprimer",
      copy: "Copier ce jour",
      paste: "Coller",
      saving: "Enregistrement…",
      saved: "Enregistré",
      copied: "Copié",
      error: "Échec de l'enregistrement",
      connecting: "Connexion…",
      notLoaded: "Intégration Thermostat Planner non chargée. Vérifie qu'elle est ajoutée dans Paramètres › Appareils et services.",
      target: "Consigne",
      next: "prochain changement",
      room: "pièce",
      off: "Planification en pause",
      eEmpty: "Renseigne une heure valide.",
      eOrder: "L'heure de fin doit être après l'heure de début.",
      eEraseBefore: "Le début doit rester après le début de la plage précédente.",
      eEraseAfter: "La fin doit rester avant la fin de la plage suivante.",
      eLast: "Il faut garder au moins une plage.",
    },
    en: {
      title: "Heating schedule",
      home: "Home",
      away: "Away",
      activeBadge: "Active mode",
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
      addBlock: "Add a time block",
      editBlock: "Edit time block",
      newBlock: "New time block",
      start: "Start",
      end: "End",
      temp: "Temperature",
      save: "Save",
      cancel: "Cancel",
      remove: "Delete",
      copy: "Copy this day",
      paste: "Paste",
      saving: "Saving…",
      saved: "Saved",
      copied: "Copied",
      error: "Could not save",
      connecting: "Connecting…",
      notLoaded: "Thermostat Planner integration is not loaded. Make sure it is added under Settings › Devices & services.",
      target: "Target",
      next: "next change",
      room: "room",
      off: "Scheduling paused",
      eEmpty: "Enter a valid time.",
      eOrder: "End time must be after start time.",
      eEraseBefore: "Start must stay after the previous block's start.",
      eEraseAfter: "End must stay before the next block's end.",
      eLast: "At least one block is required.",
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
  const fromIntervals = (ivs) =>
    ivs.slice().sort((a, b) => a.s - b.s).map((iv) => ({ start: toStr(iv.s), temp: iv.t }));

  /** Peint [s, e[ avec la température t, en découpant les plages existantes. */
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

  /** Bleu-vert (froid) → ambre (chaud). */
  function tempColors(t) {
    const r = Math.max(0, Math.min(1, (t - 10) / 14));
    const h = Math.round(192 - r * 150);
    return {
      bg: `hsl(${h} 46% 30%)`,
      fg: `hsl(${h} 85% 78%)`,
      accent: `hsl(${h} 65% 50%)`,
      tint: `hsl(${h} 60% 50% / 0.14)`,
    };
  }

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- Styles -----------------------------------------------------------
  const STYLE = `
    :host { display: block; }
    ha-card { display: block; padding: 16px; overflow: hidden; }
    * { box-sizing: border-box; }
    button { font: inherit; color: inherit; cursor: pointer; }
    button:focus-visible, select:focus-visible, input:focus-visible, summary:focus-visible {
      outline: 2px solid var(--primary-color); outline-offset: 2px;
    }
    .head { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
    .title { font-size: 1.25rem; font-weight: 500; color: var(--primary-text-color); }
    .live { font-size: .875rem; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
    .live b { color: var(--primary-text-color); font-weight: 500; }

    .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px;
      background: var(--secondary-background-color); border-radius: 999px; margin-bottom: 12px; }
    .tab { border: 0; background: transparent; padding: 10px 12px; border-radius: 999px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      color: var(--secondary-text-color); font-weight: 500; }
    .tab.on { background: var(--card-background-color, #fff); color: var(--primary-text-color);
      box-shadow: 0 1px 3px rgba(0,0,0,.28); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary-color); }

    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 14px; background: var(--secondary-background-color); border-radius: 14px; margin-bottom: 8px; }
    .row .label { color: var(--primary-text-color); }
    .row .hint { font-size: .8125rem; color: var(--secondary-text-color); margin-top: 2px; }
    select { font: inherit; color: var(--primary-text-color); background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color); border-radius: 10px; padding: 8px 10px; max-width: 55%; }

    .switch { position: relative; width: 46px; height: 28px; flex: none; }
    .switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; width: 100%; height: 100%; z-index: 1; }
    .switch span { position: absolute; inset: 0; border-radius: 999px; background: var(--disabled-text-color, #8a8a8a); transition: background .15s; }
    .switch span::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px;
      border-radius: 50%; background: #fff; transition: transform .15s; }
    .switch input:checked + span { background: var(--primary-color); }
    .switch input:checked + span::after { transform: translateX(18px); }
    .switch input:focus-visible + span { outline: 2px solid var(--primary-color); outline-offset: 2px; }

    .section { background: var(--secondary-background-color); border-radius: 16px; margin-top: 12px; overflow: hidden; }
    .sec-head { width: 100%; display: flex; align-items: center; justify-content: space-between;
      border: 0; background: transparent; padding: 14px 16px 10px; text-align: left; }
    .sec-name { font-size: 1.0625rem; color: var(--primary-text-color); }
    .sec-name small { margin-left: 8px; font-size: .75rem; color: var(--primary-color); }
    .chev { width: 10px; height: 10px; border-right: 2px solid var(--secondary-text-color);
      border-bottom: 2px solid var(--secondary-text-color); transform: rotate(45deg); transition: transform .15s; margin-right: 4px; }
    .section.open .chev { transform: rotate(-135deg); }

    .bar-wrap { padding: 0 16px; }
    .bar { position: relative; display: flex; gap: 3px; height: 44px; }
    .seg { min-width: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;
      background: var(--bg); color: var(--fg); font-size: .875rem; font-weight: 600;
      font-variant-numeric: tabular-nums; border-radius: 3px; }
    .seg:first-child { border-radius: 10px 3px 3px 10px; }
    .seg:last-child { border-radius: 3px 10px 10px 3px; }
    .seg:only-child { border-radius: 10px; }
    .now { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--primary-text-color); border-radius: 1px; pointer-events: none; }
    .axis { position: relative; height: 22px; margin-top: 6px; font-size: .75rem; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
    .axis span { position: absolute; top: 0; transform: translateX(-50%); }
    .axis span:first-child { transform: none; }
    .axis span:last-child { transform: translateX(-100%); }

    .blocks { display: none; padding: 6px 16px 4px; }
    .section.open .blocks { display: block; }
    .block { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;
      text-align: left; border: 0; border-left: 4px solid var(--accent); background: var(--tint);
      border-radius: 4px 14px 14px 4px; padding: 12px 14px; margin-bottom: 8px; }
    .block .range, .block .deg { display: block; }
    .block .range { font-size: 1.0625rem; font-weight: 500; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
    .block .deg { font-size: .9375rem; color: var(--accent); font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 2px; }
    .block::after { content: ""; width: 8px; height: 8px; border-right: 2px solid var(--secondary-text-color);
      border-top: 2px solid var(--secondary-text-color); transform: rotate(45deg); flex: none; }
    .tools { display: none; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 16px 14px;
      border-top: 1px solid var(--divider-color); margin: 4px 16px 0; padding-left: 0; padding-right: 0; }
    .section.open .tools { display: flex; }
    .btn { border: 1px solid var(--divider-color); background: transparent; border-radius: 10px; padding: 8px 12px; color: var(--primary-text-color); }
    .btn.primary { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
    .btn.danger { color: var(--error-color, #db4437); }
    .btn[disabled] { opacity: .45; cursor: default; }
    .link { border: 0; background: transparent; color: var(--primary-color); font-weight: 500; padding: 8px 4px; }
    .tool-group { display: flex; gap: 8px; }

    .foot { margin-top: 12px; }
    .status { text-align: right; font-size: .8125rem; color: var(--secondary-text-color); min-height: 1.2em; margin-top: 8px; }
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
      padding: 9px 10px; width: 140px; font-variant-numeric: tabular-nums; }
    .field input[disabled] { opacity: .55; }
    .stepper { display: flex; align-items: center; gap: 8px; }
    .stepper button { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--divider-color);
      background: var(--secondary-background-color); font-size: 1.25rem; line-height: 1; }
    .stepper input { width: 76px; text-align: center; font: inherit; font-size: 1.125rem; font-weight: 600;
      color: var(--primary-text-color); background: transparent; border: 0; border-bottom: 2px solid var(--primary-color);
      padding: 4px; font-variant-numeric: tabular-nums; }
    .modal .err { color: var(--error-color, #db4437); min-height: 1.3em; font-size: .875rem; margin-bottom: 8px; }
    .actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .actions .right { display: flex; gap: 8px; margin-left: auto; }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  `;

  // ---- Carte -------------------------------------------------------------
  class ThermostatPlannerCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._state = null;
      this._profile = "home";
      this._open = {};
      this._modal = null;
      this._clipboard = null;
      this._pending = false;
      this._flushing = false;
      this._status = "";
      this._error = "";
      this._timer = null;
      this._unsub = null;
      this._subscribing = false;
      this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
      this.shadowRoot.addEventListener("change", (e) => this._onChange(e));
    }

    static getStubConfig() {
      return {};
    }

    setConfig(config) {
      this._config = { ...config };
      this._render();
    }

    getCardSize() {
      return 8;
    }

    set hass(hass) {
      this._hass = hass;
      const lang = (hass.locale && hass.locale.language) || hass.language || "en";
      this._lang = String(lang).toLowerCase().startsWith("fr") ? "fr" : "en";
      if (!this._unsub && !this._subscribing) this._subscribe();
      this._updateLive();
    }

    connectedCallback() {
      if (this._hass && !this._unsub && !this._subscribing) this._subscribe();
    }

    disconnectedCallback() {
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
        this._unsub = await this._hass.connection.subscribeMessage((ev) => this._onState(ev), {
          type: "thermostat_planner/subscribe",
        });
        this._loadError = false;
      } catch (err) {
        this._loadError = true;
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
        await this._hass.callWS({ type: "thermostat_planner/save", data: this._state.data });
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
      const s = Number.isInteger(t) ? String(t) : t.toFixed(1);
      return this._lang === "fr" ? s.replace(".", ",") : s;
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

    _liveHtml() {
      const s = this._state;
      if (!s) return "";
      const t = this.t;
      if (!s.data.enabled) return esc(t.off);
      const parts = [`<b>${esc(t[s.effective_mode])}</b>`, `${esc(t.target)} <b>${this._fmt(s.target)}°</b>`];
      const climate = this._hass && this._hass.states[s.climate_entity];
      const current = climate && climate.attributes.current_temperature;
      if (current !== undefined && current !== null) parts.push(`${this._fmt(Number(current))}° ${esc(t.room)}`);
      if (s.next_change) parts.push(`${esc(t.next)} ${esc(this._fmtTime(s.next_change))}`);
      return parts.join(" · ");
    }

    _updateLive() {
      const el = this.shadowRoot.getElementById("live");
      if (el) el.innerHTML = this._liveHtml();
    }

    _updateSaveStatus() {
      const el = this.shadowRoot.getElementById("save-status");
      if (!el) return;
      const t = this.t;
      const text = { saving: t.saving, saved: t.saved, error: t.error, copied: t.copied }[this._status] || "";
      el.textContent = text + (this._status === "error" && this._error ? ` (${this._error})` : "");
      el.className = "status" + (this._status === "error" ? " err" : "");
    }

    _sections(layout) {
      const t = this.t;
      const today = (new Date().getDay() + 6) % 7;
      if (layout === "all") return [{ key: "all", label: t.all, today: true }];
      if (layout === "weekday_weekend")
        return [
          { key: "weekdays", label: t.weekdays, today: today < 5 },
          { key: "weekend", label: t.weekend, today: today >= 5 },
        ];
      return DAYS.map((d, i) => ({ key: d, label: t.days[d], today: i === today }));
    }

    _sectionHtml(profileName, sec) {
      const t = this.t;
      const s = this._state;
      const segs = s.data.profiles[profileName].schedules[sec.key];
      const ivs = intervals(segs);
      const id = `${profileName}:${sec.key}`;
      const expandToday = !this._config || this._config.expand_today !== false;
      const open = this._open[id] !== undefined ? this._open[id] : sec.today && expandToday;
      const showNow = sec.today && profileName === s.effective_mode;
      const nowDate = new Date();
      const nowPct = ((nowDate.getHours() * 60 + nowDate.getMinutes()) / 1440) * 100;

      const bar = ivs
        .map((iv) => {
          const w = ((iv.e - iv.s) / 1440) * 100;
          const c = tempColors(iv.t);
          return `<div class="seg" style="width:${w}%;--bg:${c.bg};--fg:${c.fg}">${w >= 9 ? this._fmt(iv.t) + "°" : ""}</div>`;
        })
        .join("");
      const blocks = ivs
        .map((iv, i) => {
          const c = tempColors(iv.t);
          return `<button class="block" data-action="edit" data-profile="${profileName}" data-key="${sec.key}" data-index="${i}" style="--accent:${c.accent};--tint:${c.tint}">
            <span><span class="range">${toStr(iv.s)} – ${toStr(iv.e)}</span><span class="deg">${this._fmt(iv.t)}°</span></span></button>`;
        })
        .join("");

      return `<div class="section ${open ? "open" : ""}">
        <button class="sec-head" data-action="toggle" data-id="${id}" aria-expanded="${open}">
          <span class="sec-name">${esc(sec.label)}${sec.today && s.data.profiles[profileName].layout === "daily" ? `<small>${this._lang === "fr" ? "aujourd'hui" : "today"}</small>` : ""}</span>
          <span class="chev"></span>
        </button>
        <div class="bar-wrap">
          <div class="bar">${bar}${showNow ? `<div class="now" style="left:${nowPct}%"></div>` : ""}</div>
          <div class="axis"><span style="left:0">0:00</span><span style="left:33.333%">8:00</span><span style="left:66.667%">16:00</span><span style="left:100%">24:00</span></div>
        </div>
        <div class="blocks">${blocks}</div>
        <div class="tools">
          <div class="tool-group">
            <button class="btn" data-action="copy" data-profile="${profileName}" data-key="${sec.key}">${esc(t.copy)}</button>
            <button class="btn" data-action="paste" data-profile="${profileName}" data-key="${sec.key}" ${this._clipboard ? "" : "disabled"}>${esc(t.paste)}</button>
          </div>
          <button class="link" data-action="add" data-profile="${profileName}" data-key="${sec.key}">${esc(t.addBlock)}</button>
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
      const timeField = (id, label, value, disabled) =>
        disabled
          ? `<div class="field"><label>${esc(label)}</label><input type="text" id="${id}" value="${esc(value)}" disabled></div>`
          : `<div class="field"><label for="${id}">${esc(label)}</label><input type="time" id="${id}" value="${esc(value)}" step="60"></div>`;
      return `<div class="overlay" data-action="overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(m.kind === "edit" ? t.editBlock : t.newBlock)}">
          <h3>${esc(m.kind === "edit" ? t.editBlock : t.newBlock)}</h3>
          ${timeField("m-start", t.start, toStr(m.s), first)}
          ${timeField("m-end", t.end, toStr(m.e), last)}
          <div class="field"><label for="m-temp">${esc(t.temp)}</label>
            <div class="stepper">
              <button data-action="step" data-delta="-${STEP}" aria-label="-${STEP}">−</button>
              <input id="m-temp" type="number" inputmode="decimal" min="${MIN_T}" max="${MAX_T}" step="${STEP}" value="${m.t}">
              <button data-action="step" data-delta="${STEP}" aria-label="+${STEP}">+</button>
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
      const t = this.t;
      const title = (this._config && this._config.title) || t.title;
      let body;
      if (this._loadError && !this._state) {
        body = `<div class="msg">${esc(t.notLoaded)}</div>`;
      } else if (!this._state) {
        body = `<div class="msg">${esc(t.connecting)}</div>`;
      } else {
        const s = this._state;
        const profile = s.data.profiles[this._profile];
        const tab = (name) =>
          `<button class="tab ${this._profile === name ? "on" : ""}" data-action="tab" data-profile="${name}">${esc(t[name])}${s.effective_mode === name ? `<span class="dot" title="${esc(t.activeBadge)}"></span>` : ""}</button>`;
        const forced = s.forced_by_entity
          ? `<div class="hint">${esc(t.forcedBy)} ${esc(s.away_entity)}</div>`
          : "";
        body = `
          <div class="tabs" role="tablist">${tab("home")}${tab("away")}</div>
          <div class="row"><div><div class="label">${esc(t.manualAway)}</div>${forced}</div>
            <label class="switch"><input type="checkbox" data-action="away-switch" ${s.data.manual_mode === "away" ? "checked" : ""}><span></span></label></div>
          <div class="row"><div class="label">${esc(t.layout)}</div>
            <select data-action="layout">
              ${["all", "weekday_weekend", "daily"].map((l) => `<option value="${l}" ${profile.layout === l ? "selected" : ""}>${esc(t["layout_" + l])}</option>`).join("")}
            </select></div>
          ${this._sections(profile.layout).map((sec) => this._sectionHtml(this._profile, sec)).join("")}
          <div class="row" style="margin-top:12px"><div class="label">${esc(t.enabled)}</div>
            <label class="switch"><input type="checkbox" data-action="enabled-switch" ${s.data.enabled ? "checked" : ""}><span></span></label></div>
          <div id="save-status" class="status"></div>`;
      }
      this.shadowRoot.innerHTML = `<style>${STYLE}</style>
        <ha-card>
          <div class="head"><div class="title">${esc(title)}</div><div class="live" id="live">${this._liveHtml()}</div></div>
          ${body}
        </ha-card>${this._modalHtml()}`;
      this._updateSaveStatus();
    }

    // -- interactions ------------------------------------------------------
    _profileData(name) {
      return this._state.data.profiles[name];
    }

    _closeModal() {
      this._modal = null;
      this._render();
    }

    _onChange(e) {
      const el = e.target.closest("[data-action]");
      if (!el || !this._state) return;
      const action = el.dataset.action;
      if (action === "layout") {
        seedLayout(this._profileData(this._profile), el.value);
        this._commit();
      } else if (action === "enabled-switch") {
        this._state.data.enabled = el.checked;
        this._commit();
      } else if (action === "away-switch") {
        const mode = el.checked ? "away" : "home";
        this._state.data.manual_mode = mode;
        this._hass.callWS({ type: "thermostat_planner/set_mode", mode }).catch(() => {
          this._status = "error";
          this._updateSaveStatus();
        });
      }
    }

    _onClick(e) {
      const el = e.target.closest("[data-action]");
      if (!el || !this._state) return;
      const a = el.dataset.action;
      const profile = el.dataset.profile;
      const key = el.dataset.key;

      if (a === "tab") {
        this._profile = profile;
        this._render();
      } else if (a === "toggle") {
        const section = el.closest(".section");
        this._open[el.dataset.id] = !section.classList.contains("open");
        section.classList.toggle("open");
        el.setAttribute("aria-expanded", String(this._open[el.dataset.id]));
      } else if (a === "copy") {
        this._clipboard = clone(this._profileData(profile).schedules[key]);
        this._status = "copied";
        this._render();
      } else if (a === "paste" && this._clipboard) {
        this._profileData(profile).schedules[key] = clone(this._clipboard);
        this._commit();
      } else if (a === "edit") {
        const i = Number(el.dataset.index);
        const iv = intervals(this._profileData(profile).schedules[key])[i];
        this._modal = { kind: "edit", profile, key, index: i, s: iv.s, e: iv.e, t: iv.t };
        this._render();
      } else if (a === "add") {
        const r = suggestRange(this._profileData(profile).schedules[key]);
        this._modal = { kind: "add", profile, key, s: r.s, e: r.e, t: r.t };
        this._render();
      } else if (a === "step") {
        const input = this.shadowRoot.getElementById("m-temp");
        const v = Math.max(MIN_T, Math.min(MAX_T, (parseFloat(input.value) || 0) + Number(el.dataset.delta)));
        input.value = String(Math.round(v * 2) / 2);
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
      const temp = Math.round(Math.max(MIN_T, Math.min(MAX_T, tempRaw)) * 2) / 2;
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
      this._commit();
    }
  }

  ThermostatPlannerCard.helpers = { paint, applyEdit, removeBlock, suggestRange, seedLayout, keyFor, toMin, toStr, tempColors };

  if (!customElements.get("thermostat-planner-card")) {
    customElements.define("thermostat-planner-card", ThermostatPlannerCard);
  }
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "thermostat-planner-card",
    name: "Thermostat Planner",
    description: "Planning de chauffage par plages horaires, modes Maison / Absent.",
  });
})();
