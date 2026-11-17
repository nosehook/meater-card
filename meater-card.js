/*
 * meater-card  v1.1.1
 * Lovelace card for MEATER probes (core Home Assistant "meater" integration),
 * styled after custom:appliance-washer-card. Three nested 3/4 rings
 * (internal / target / ambient, scale 0–100) in the MEATER app colours,
 * time to go in the centre and the cook state in the header.
 *
 *   type: custom:meater-card
 *   name: Meater                 # optional
 *   device_id: abc123…           # optional, picks a specific probe (default: first MEATER probe found)
 *   min: 0                       # optional ring scale
 *   max: 100
 *   # optional explicit entities (override auto-discovery):
 *   internal: sensor.meater_probe_xxxx_internal_temperature
 *   ambient: sensor.meater_probe_xxxx_ambient_temperature
 *   target: sensor.meater_probe_xxxx_target_temperature
 *   cook_state: sensor.meater_probe_xxxx_cook_state
 *   remaining: sensor.meater_probe_xxxx_time_remaining     # timestamp sensor
 *   elapsed: sensor.meater_probe_xxxx_time_elapsed         # timestamp sensor (optional)
 *   cook_name: sensor.meater_probe_xxxx_cooking            # optional
 *   peak: sensor.meater_probe_xxxx_peak_temperature        # optional
 */
(() => {
  const VERSION = "1.1.1";
  const KEYS = {
    internal: "internal", ambient: "ambient", target: "cook_target_temp", cook_state: "cook_state",
    remaining: "cook_time_remaining", elapsed: "cook_time_elapsed", cook_name: "cook_name", peak: "cook_peak_temp",
  };
  const COLORS = { internal: "#d81fd8", target: "#16a9ee", ambient: "#20c05c" };

  const L = {
    nl: {
      internal: "Intern", target: "Doel", ambient: "Omgeving", remaining: "resterend", ready_at: "Klaar om",
      offline: "Niet verbonden", idle: "Geen kooksessie", elapsed: "Bezig", peak: "Piek",
      not_started: "Niet gestart", configured: "Ingesteld", started: "Bezig", ready_for_resting: "Klaar om te rusten",
      resting: "Rusten", slightly_underdone: "Bijna gaar", finished: "Klaar", slightly_overdone: "Iets te gaar",
      overcooked: "Te gaar!", no_probe: "Geen MEATER-probe gevonden",
    },
    en: {
      internal: "Internal", target: "Target", ambient: "Ambient", remaining: "remaining", ready_at: "Ready at",
      offline: "Offline", idle: "No active cook", elapsed: "Running", peak: "Peak",
      not_started: "Not started", configured: "Configured", started: "Started", ready_for_resting: "Ready for resting",
      resting: "Resting", slightly_underdone: "Slightly underdone", finished: "Finished", slightly_overdone: "Slightly overdone",
      overcooked: "Overcooked!", no_probe: "No MEATER probe found",
    },
  };

  const BAD = new Set(["unavailable", "unknown", "none", "", undefined, null]);
  const num = (s) => (s && !BAD.has(s.state) && !isNaN(parseFloat(s.state)) ? parseFloat(s.state) : null);
  const ts = (s) => {
    if (!s || BAD.has(s.state)) return null;
    const t = Date.parse(s.state);
    return isNaN(t) ? null : t;
  };

  // 3/4 ring: from 135° (bottom-left) clockwise through the top to 45° (bottom-right)
  const arc = (r, cx = 60, cy = 60) => {
    const a0 = (135 * Math.PI) / 180, a1 = (405 * Math.PI) / 180;
    const p = (a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    return `M ${p(a0)} A ${r} ${r} 0 1 1 ${p(a1)}`;
  };
  const pointAt = (r, frac, cx = 60, cy = 60) => {
    const a = ((135 + 270 * frac) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const RINGS = [
    { k: "internal", r: 53 },
    { k: "target", r: 43 },
    { k: "ambient", r: 33 },
  ];

  const CSS = `
    :host {
      --ac-active: var(--appliance-active-color, var(--state-active-color, var(--primary-color)));
      --ac-alert: var(--appliance-alert-color, var(--error-color, #db4437));
      --ac-ok: var(--appliance-ok-color, var(--success-color, #43a047));
      --mt-internal: ${COLORS.internal}; --mt-target: ${COLORS.target}; --mt-ambient: ${COLORS.ambient};
      display: block; height: 100%;
    }
    [hidden] { display: none !important; }
    ha-card { display: flex; flex-direction: column; justify-content: safe center; height: 100%;
      cursor: pointer; overflow: hidden; container-type: inline-size; }
    .wrap { padding: 14px; display: flex; flex-direction: column; gap: 12px; --c: var(--ac-active); }
    .wrap.st-resting, .wrap.st-ready_for_resting { --c: #f5a623; }
    .wrap.st-finished { --c: var(--ac-ok); }
    .wrap.alert { --c: var(--ac-alert); }
    .top { display: grid; grid-template-columns: auto minmax(0,1fr);
      grid-template-areas: "illus head" "illus stats"; gap: 10px 14px; align-items: start; min-width: 0; }
    .illus { grid-area: illus; width: var(--appliance-illustration-size, 116px); aspect-ratio: 120/140;
      border-radius: 16px; padding: 4px; box-sizing: content-box;
      background: radial-gradient(circle at 50% 40%, rgba(127,127,127,.1), rgba(127,127,127,.03) 70%); }
    .illus svg { width: 100%; height: 100%; display: block; }
    .st-offline .illus, .st-no_probe .illus { opacity: .55; filter: grayscale(.8); }
    .led { fill: #3a2a1a; }
    .online .led { fill: #3ddc84; filter: drop-shadow(0 0 1.5px #3ddc84); }
    .active .led { animation: led 2s ease-in-out infinite; }
    @keyframes led { 50% { opacity: .35; } }
    .probe-out { opacity: 0; transition: opacity .6s; }
    .active .probe-out { opacity: 1; }
    .active .probe-in { opacity: .0; }
    .probe-in { transition: opacity .6s; }
    .rings { width: var(--meater-ring-size, 118px); aspect-ratio: 1; flex: none; }
    .rings svg { width: 100%; height: 100%; display: block; overflow: visible; }
    .st-offline .rings { opacity: .5; filter: grayscale(1); }
    .head { grid-area: head; display: flex; gap: 8px; align-items: flex-start; min-width: 0; }
    .info { flex: 1 1 0%; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .name { font-size: 16px; font-weight: 600; color: var(--primary-text-color);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--secondary-text-color); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--disabled-text-color, #888); flex: none; }
    .active .dot { background: var(--c); animation: ac-ping 1.8s infinite; }
    .cookname { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .alert-line { font-size: 12px; font-weight: 600; color: var(--ac-alert); }
    .stats { grid-area: stats; display: flex; align-items: center; gap: 10px; min-width: 0; }
    .bubs { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .bub { display: flex; align-items: center; gap: 7px; min-width: 0; cursor: pointer; }
    .bub .circle { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; flex: none;
      color: #fff; font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums;
      background: var(--bc); box-shadow: 0 2px 8px color-mix(in srgb, var(--bc) 45%, transparent); }
    .bub.na .circle { background: rgba(127,127,127,.18); color: var(--secondary-text-color); box-shadow: none; }
    .bub .lbl { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; }
    .foot { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--secondary-text-color); }
    .foot b { color: var(--primary-text-color); font-weight: 600; }
    .track { fill: none; stroke-width: 7.5; stroke-linecap: round; opacity: .16; }
    .val { fill: none; stroke-width: 7.5; stroke-linecap: round; transition: stroke-dasharray .8s ease; }
    .tip { stroke: var(--card-background-color, #1c1c1c); stroke-width: 1.4; transition: cx .8s, cy .8s; }
    .ctr-big { font: 500 21px/1 var(--ha-font-family-body, Roboto, sans-serif); fill: var(--primary-text-color); }
    .ctr-small { font: 400 8.5px/1 var(--ha-font-family-body, Roboto, sans-serif); fill: var(--secondary-text-color); }
    .scale { font: 500 6px/1 sans-serif; fill: var(--secondary-text-color); opacity: .7; }
    .st-finished .ctr-big { fill: var(--ac-ok); }
    @keyframes ac-ping { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 60%, transparent); }
      80%,100% { box-shadow: 0 0 0 6px transparent; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  `;

  const ILLUS = `
  <svg viewBox="0 0 120 140" aria-hidden="true">
    <defs>
      <linearGradient id="mt-wood" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#c99a52"/><stop offset=".45" stop-color="#e2b977"/>
        <stop offset=".75" stop-color="#d4a660"/><stop offset="1" stop-color="#b98942"/>
      </linearGradient>
      <linearGradient id="mt-wood2" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#d8ad68"/><stop offset="1" stop-color="#c79a55"/>
      </linearGradient>
      <linearGradient id="mt-steel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#8a9197"/><stop offset=".35" stop-color="#f1f4f6"/>
        <stop offset=".6" stop-color="#c3c9ce"/><stop offset="1" stop-color="#7c848a"/>
      </linearGradient>
      <linearGradient id="mt-bar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e9edf0"/><stop offset="1" stop-color="#9aa2a8"/>
      </linearGradient>
    </defs>
    <!-- block -->
    <rect x="37" y="5" width="46" height="131" rx="2" fill="url(#mt-wood)"/>
    <g stroke="#a87a38" stroke-opacity=".28" stroke-width=".5" fill="none">
      <path d="M41 8 V133"/><path d="M57 8 V133"/><path d="M64 8 V133"/><path d="M73 8 V133"/><path d="M79 8 V133"/>
      <path d="M48 20 q1 30 0 60 t0 50"/><path d="M69 15 q-1 40 0 70"/>
    </g>
    <!-- top steel bar -->
    <rect x="38" y="7.5" width="44" height="3.2" rx=".8" fill="url(#mt-bar)"/>
    <!-- probe slot -->
    <rect x="40.5" y="11" width="13" height="113" rx="1.5" fill="#9b7034" opacity=".55"/>
    <!-- probe (docked) -->
    <g class="probe-in">
      <rect x="44.6" y="11.5" width="4.8" height="88" fill="url(#mt-steel)"/>
      <rect x="44.6" y="99" width="4.8" height="2.4" fill="#151515"/>
      <path d="M44.6 101.4 h4.8 l.8 18 h-6.4 Z" fill="url(#mt-steel)"/>
      <rect x="43.2" y="119" width="7.6" height="2.6" rx=".6" fill="#a9b0b5"/>
    </g>
    <!-- probe out: empty slot shadow + heat glow -->
    <g class="probe-out">
      <rect x="44.6" y="12" width="4.8" height="108" rx="2" fill="#7d5a28" opacity=".55"/>
    </g>
    <!-- right raised panel -->
    <rect x="57" y="11" width="24" height="96" rx="1" fill="url(#mt-wood2)"/>
    <path d="M57 11 V107" stroke="#9b7034" stroke-opacity=".5" stroke-width=".6"/>
    <path d="M57 107 H81" stroke="#9b7034" stroke-opacity=".45" stroke-width=".6"/>
    <circle class="led" cx="73.5" cy="96" r="1.5"/>
    <!-- base -->
    <path d="M37 123 H83" stroke="#9b7034" stroke-opacity=".45" stroke-width=".7"/>
    <text x="60" y="132" text-anchor="middle" style="font:500 7.4px var(--ha-font-family-body,Roboto,sans-serif);fill:#2b1f12;letter-spacing:.2px">MEATER+</text>
  </svg>`;

  class MeaterCard extends HTMLElement {
    static getStubConfig() { return { name: "Meater" }; }

    static getConfigForm() {
      const ent = { entity: { domain: "sensor", integration: "meater" } };
      return {
        schema: [
          { name: "name", selector: { text: {} } },
          { name: "device_id", selector: { device: { integration: "meater" } } },
          { type: "grid", name: "", flatten: true, schema: [
            { name: "min", selector: { number: { min: -20, max: 100, step: 5, mode: "box", unit_of_measurement: "°" } } },
            { name: "max", selector: { number: { min: 50, max: 400, step: 10, mode: "box", unit_of_measurement: "°" } } },
          ] },
          { name: "language", selector: { select: { mode: "dropdown", options: [{ value: "nl", label: "Nederlands" }, { value: "en", label: "English" }] } } },
          { type: "expandable", name: "", title: "Sensoren handmatig kiezen (optioneel)", icon: "mdi:thermometer-probe", flatten: true, schema: [
            { type: "grid", name: "", flatten: true, schema: [
              { name: "internal", selector: ent }, { name: "target", selector: ent }, { name: "ambient", selector: ent },
              { name: "peak", selector: ent }, { name: "cook_state", selector: ent }, { name: "cook_name", selector: ent },
              { name: "remaining", selector: ent }, { name: "elapsed", selector: ent },
            ] },
          ] },
        ],
        computeLabel: (s) => ({
          name: "Naam", device_id: "MEATER-probe", min: "Schaal minimum", max: "Schaal maximum", language: "Taal",
          internal: "Interne temperatuur", target: "Doeltemperatuur", ambient: "Omgevingstemperatuur", peak: "Piektemperatuur",
          cook_state: "Cook state", cook_name: "Gerecht", remaining: "Resterende tijd", elapsed: "Verstreken tijd",
        }[s.name] ?? s.name),
        computeHelper: (s) => ({
          device_id: "Leeg = eerste MEATER-probe die gevonden wordt.",
          max: "Ringen lopen van minimum tot maximum; standaard 0–100°.",
        }[s.name]),
      };
    }

    setConfig(config) {
      this._config = { name: "Meater", min: 0, max: 100, ...config };
      this._lang = (this._config.language || "nl").startsWith("en") ? "en" : "nl";
      this._built = false;
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._built) this._build();
      this._update();
    }

    connectedCallback() { this._tick = setInterval(() => this._update(), 15000); }
    disconnectedCallback() { clearInterval(this._tick); }
    getCardSize() { return 3; }
    getGridOptions() { return { columns: 12, rows: "auto", min_columns: 6 }; }

    t(k) { return L[this._lang][k] || k; }

    _resolve() {
      const c = this._config, h = this._hass, out = {};
      const ents = Object.values(h.entities || {}).filter((e) => e.platform === "meater");
      let dev = c.device_id;
      if (!dev && ents.length) {
        const devs = [...new Set(ents.map((e) => e.device_id))];
        dev = devs.find((d) => ents.some((e) => e.device_id === d && !BAD.has(h.states[e.entity_id]?.state))) || devs[0];
      }
      for (const [opt, key] of Object.entries(KEYS)) {
        out[opt] = c[opt] || ents.find((e) => e.device_id === dev && (e.translation_key === key ||
          e.unique_id?.endsWith?.(`-${key}`)))?.entity_id;
      }
      out.device = dev;
      return out;
    }

    _build() {
      const root = this.shadowRoot || this.attachShadow({ mode: "open" });
      const rings = RINGS.map(({ k, r }) => `
        <path class="track" d="${arc(r)}" stroke="var(--mt-${k})"/>
        <path class="val" id="v-${k}" d="${arc(r)}" stroke="var(--mt-${k})" pathLength="100" stroke-dasharray="0 100"/>
        <circle class="tip" id="t-${k}" r="4.2" fill="var(--mt-${k})" cx="0" cy="0" opacity="0"/>`).join("");
      root.innerHTML = `
        <style>${CSS}</style>
        <ha-card>
          <div class="wrap" id="wrap">
            <div class="top">
              <div class="illus">${ILLUS}</div>
              <div class="head"><div class="info">
                <div class="name" id="name"></div>
                <div class="status"><span class="dot"></span><span id="status"></span></div>
                <div class="cookname" id="cookname"></div>
              </div></div>
              <div class="stats">
                <div class="rings"><svg viewBox="0 0 120 120" aria-hidden="true">
                  ${rings}
                  <text class="scale" x="${pointAt(53, 0)[0] + 2}" y="${pointAt(53, 0)[1] + 9}" text-anchor="middle" id="smin"></text>
                  <text class="scale" x="${pointAt(53, 1)[0] - 2}" y="${pointAt(53, 1)[1] + 9}" text-anchor="middle" id="smax"></text>
                  <text class="ctr-big" id="ctr" x="60" y="60" text-anchor="middle" dominant-baseline="central">—</text>
                  <text class="ctr-small" id="ctr2" x="60" y="75" text-anchor="middle"></text>
                </svg></div>
                <div class="bubs" id="stats"></div>
              </div>
            </div>
            <div class="foot" id="foot"></div>
          </div>
        </ha-card>`;
      this.$ = (id) => root.getElementById(id);
      root.querySelector("ha-card").addEventListener("click", (e) => {
        const b = e.target.closest("[data-entity]");
        const id = b?.dataset.entity || this._ents?.cook_state || this._ents?.internal;
        if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: id } }));
      });
      this._built = true;
    }

    _fmtRemaining(ms) {
      if (ms == null) return null;
      const m = Math.max(0, Math.round(ms / 60000));
      if (m < 60) return { big: `${m}m`, small: this.t("remaining") };
      return { big: `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`, small: this.t("remaining") };
    }

    _update() {
      if (!this._built || !this._hass) return;
      const h = this._hass, c = this._config;
      const e = (this._ents = this._resolve());
      const S = (k) => (e[k] ? h.states[e[k]] : undefined);
      const vals = { internal: num(S("internal")), target: num(S("target")), ambient: num(S("ambient")) };
      const stateObj = S("cook_state");
      const raw = stateObj && !BAD.has(stateObj.state) ? stateObj.state : null;
      const probeOnline = vals.internal != null || vals.ambient != null;
      const key = !e.internal && !e.cook_state ? "no_probe" : !probeOnline ? "offline" : raw || "idle";
      const active = ["started", "configured", "slightly_underdone", "ready_for_resting", "resting"].includes(key);
      const alert = ["overcooked", "slightly_overdone"].includes(key);

      this.$("wrap").className = `wrap st-${key}${active ? " active" : ""}${alert ? " alert" : ""}${probeOnline ? " online" : ""}`;
      this.$("name").textContent = c.name;
      let label = this.t(key);
      if (raw && stateObj && h.formatEntityState && this._lang === "nl" && !L.nl[raw]) label = h.formatEntityState(stateObj);
      this.$("status").textContent = label;
      const cn = S("cook_name");
      this.$("cookname").textContent = cn && !BAD.has(cn.state) ? cn.state : "";

      // rings
      const lo = Number(c.min), hi = Number(c.max);
      this.$("smin").textContent = `${lo}°`; this.$("smax").textContent = `${hi}°`;
      for (const { k, r } of RINGS) {
        const v = vals[k];
        const frac = v == null ? 0 : Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
        const vp = this.$(`v-${k}`);
        vp.setAttribute("stroke-dasharray", `${(frac * 100).toFixed(2)} 100`);
        vp.style.visibility = frac > 0 ? "visible" : "hidden";
        const tip = this.$(`t-${k}`);
        if (v == null) tip.setAttribute("opacity", "0");
        else { const [x, y] = pointAt(r, frac); tip.setAttribute("cx", x.toFixed(2)); tip.setAttribute("cy", y.toFixed(2)); tip.setAttribute("opacity", "1"); }
      }

      // centre: time to go
      const end = ts(S("remaining"));
      const rem = end != null ? end - Date.now() : null;
      const f = this._fmtRemaining(rem);
      if (key === "finished" || key === "resting" || key === "ready_for_resting") {
        this.$("ctr").textContent = vals.internal != null ? `${Math.round(vals.internal)}°` : "✓";
        this.$("ctr2").textContent = this.t(key === "finished" ? "finished" : "resting");
      } else if (f) { this.$("ctr").textContent = f.big; this.$("ctr2").textContent = f.small; }
      else if (vals.internal != null) { this.$("ctr").textContent = `${Math.round(vals.internal)}°`; this.$("ctr2").textContent = this.t("internal"); }
      else { this.$("ctr").textContent = "—"; this.$("ctr2").textContent = ""; }

      // bubbles (MEATER app style)
      const unit = S("internal")?.attributes.unit_of_measurement || "°C";
      // Bubbles and footer are built with DOM APIs (no innerHTML): units and entity
      // ids come from entity attributes / card config and must never be parsed as markup.
      const bubs = ["internal", "target", "ambient"].map((k) => {
        const v = vals[k];
        return { k, e: e[k] || "", title: v == null ? "" : `${v.toFixed(1)} ${unit}`,
          big: v == null ? "—" : `${Math.round(v)}°`, lbl: this.t(k), na: v == null };
      });
      const bsig = JSON.stringify(bubs);
      if (bsig !== this._lastStats) {
        const frag = document.createDocumentFragment();
        for (const b of bubs) {
          const bub = document.createElement("div");
          bub.className = b.na ? "bub na" : "bub";
          bub.setAttribute("data-entity", String(b.e));
          bub.style.setProperty("--bc", `var(--mt-${b.k})`);
          bub.setAttribute("title", String(b.title));
          const circle = document.createElement("div");
          circle.className = "circle";
          circle.textContent = b.big;
          const lbl = document.createElement("div");
          lbl.className = "lbl";
          lbl.textContent = String(b.lbl);
          bub.append(circle, lbl);
          frag.append(bub);
        }
        this.$("stats").replaceChildren(frag);
        this._lastStats = bsig;
      }

      // footer: ready at / elapsed / peak
      const parts = [];
      const loc = h.locale?.language || "nl";
      const hm = (t) => new Date(t).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
      if (end != null && rem > 0) parts.push([e.remaining, this.t("ready_at"), hm(end)]);
      const start = ts(S("elapsed"));
      if (start != null) {
        const m = Math.max(0, Math.round((Date.now() - start) / 60000));
        parts.push([e.elapsed, this.t("elapsed"), m >= 60 ? Math.floor(m / 60) + "u " + (m % 60) + "m" : m + " min"]);
      }
      const pk = num(S("peak"));
      if (pk != null) parts.push([e.peak, this.t("peak"), `${Math.round(pk)}°`]);
      const foot = this.$("foot");
      foot.hidden = !parts.length;
      const fsig = JSON.stringify(parts);
      if (fsig !== this._lastFoot) {
        const frag = document.createDocumentFragment();
        for (const [ent, label, value] of parts) {
          const span = document.createElement("span");
          span.setAttribute("data-entity", String(ent || ""));
          const b = document.createElement("b");
          b.textContent = String(value);
          span.append(document.createTextNode(`${label} `), b);
          frag.append(span);
        }
        foot.replaceChildren(frag);
        this._lastFoot = fsig;
      }
    }
  }

  if (!customElements.get("meater-card")) {
    customElements.define("meater-card", MeaterCard);
    window.customCards = window.customCards || [];
    window.customCards.push({ type: "meater-card", name: "MEATER Card",
      description: "MEATER probe card with nested temperature rings (washer-card style).", preview: true });
    console.info(`%c MEATER-CARD %c v${VERSION} `, "background:#111;color:#d81fd8", "background:#d81fd8;color:#fff");
  }
})();
