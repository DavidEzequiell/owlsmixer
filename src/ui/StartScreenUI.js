import { APP_VERSION } from "../store.js";

const SKIP_START_KEY = "owls3d_skip_start_v1";
const WELCOMED_KEY = "owls3d_welcomed_v1";

const HERO_SVG = `
<svg viewBox="0 0 420 230" class="start-hero-svg" role="img" aria-label="Virtual Mixer 3D — The Art of Mixing">
  <defs>
    <linearGradient id="sm-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#13203b"/>
      <stop offset="65%" stop-color="#0d1527"/>
      <stop offset="100%" stop-color="#090e1a"/>
    </linearGradient>
    <radialGradient id="sm-vox" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#ff8fb8"/>
      <stop offset="55%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#831843"/>
    </radialGradient>
    <radialGradient id="sm-bass" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#6ee7b7"/>
      <stop offset="55%" stop-color="#16a34a"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </radialGradient>
    <radialGradient id="sm-gtr" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#7dd3fc"/>
      <stop offset="60%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </radialGradient>
    <radialGradient id="sm-hh" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="60%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#854d0e"/>
    </radialGradient>
  </defs>
  <rect width="420" height="230" rx="10" fill="url(#sm-bg)"/>

  <!-- Caja perspectiva 3D -->
  <polygon points="95,46 325,46 365,198 55,198" fill="rgba(59,130,246,0.06)" stroke="rgba(148,163,184,0.32)" stroke-width="1.2"/>
  <rect x="95" y="46" width="230" height="106" fill="rgba(15,23,42,0.45)" stroke="rgba(148,163,184,0.35)" stroke-width="1.2"/>
  <line x1="95" y1="152" x2="55" y2="198" stroke="rgba(148,163,184,0.35)" stroke-width="1.2"/>
  <line x1="325" y1="152" x2="365" y2="198" stroke="rgba(148,163,184,0.35)" stroke-width="1.2"/>
  <line x1="210" y1="152" x2="210" y2="198" stroke="rgba(56,189,248,0.45)" stroke-dasharray="4 3" stroke-width="1"/>
  <line x1="80" y1="172" x2="340" y2="172" stroke="rgba(148,163,184,0.18)" stroke-width="1"/>
  <line x1="68" y1="185" x2="352" y2="185" stroke="rgba(148,163,184,0.18)" stroke-width="1"/>

  <!-- Parlantes Left / Right -->
  <g fill="#1e293b" stroke="#64748b" stroke-width="1.2">
    <rect x="20" y="54" width="32" height="58" rx="4"/>
    <circle cx="36" cy="70" r="5" fill="#38bdf8" stroke="none"/>
    <circle cx="36" cy="92" r="9.5" fill="#0f172a" stroke="#475569"/>
    <rect x="368" y="54" width="32" height="58" rx="4"/>
    <circle cx="384" cy="70" r="5" fill="#38bdf8" stroke="none"/>
    <circle cx="384" cy="92" r="9.5" fill="#0f172a" stroke="#475569"/>
  </g>
  <text x="36" y="47" fill="#93c5fd" font-size="9" font-weight="700" text-anchor="middle" font-family="sans-serif">LEFT</text>
  <text x="384" y="47" fill="#93c5fd" font-size="9" font-weight="700" text-anchor="middle" font-family="sans-serif">RIGHT</text>

  <!-- Cubo de Reverb translúcido -->
  <rect x="165" y="64" width="90" height="62" rx="3" fill="rgba(168,85,247,0.12)" stroke="rgba(192,132,252,0.55)" stroke-dasharray="3 2" stroke-width="1"/>

  <!-- Esferas & Elipsoides -->
  <ellipse cx="210" cy="184" rx="42" ry="8" fill="rgba(0,0,0,0.45)"/>
  <circle cx="210" cy="144" r="34" fill="url(#sm-bass)" opacity="0.88"/>
  <ellipse cx="136" cy="112" rx="38" ry="12" fill="url(#sm-gtr)" opacity="0.84"/>
  <ellipse cx="284" cy="110" rx="38" ry="12" fill="url(#sm-gtr)" opacity="0.84"/>
  <circle cx="210" cy="108" r="24" fill="url(#sm-vox)"/>
  <circle cx="122" cy="64" r="10" fill="url(#sm-hh)"/>
  <circle cx="298" cy="68" r="9" fill="url(#sm-hh)" opacity="0.85"/>

  <!-- Etiquetas -->
  <text x="210" y="111" fill="#fff" font-size="9" font-weight="800" text-anchor="middle" font-family="sans-serif">VOCAL</text>
  <text x="210" y="156" fill="#dcfce7" font-size="8.5" font-weight="700" text-anchor="middle" font-family="sans-serif">BASS / KICK</text>
  <text x="136" y="115" fill="#e0f2fe" font-size="8" font-weight="700" text-anchor="middle" font-family="sans-serif">GTR L</text>
  <text x="284" y="113" fill="#e0f2fe" font-size="8" font-weight="700" text-anchor="middle" font-family="sans-serif">GTR R</text>
  <text x="122" y="48" fill="#fef08a" font-size="7.5" font-weight="700" text-anchor="middle" font-family="sans-serif">HI-HAT</text>

  <!-- Leyenda de ejes -->
  <text x="210" y="218" fill="#94a3b8" font-size="9.5" text-anchor="middle" font-family="sans-serif">X: Paneo L–R  ·  Y: Frecuencia 20 Hz–20 kHz  ·  Z: Volumen / Profundidad</text>
</svg>
`;

const WELCOME_STEPS = [
  {
    badge: "Paso 1 de 3 · Bienvenida",
    title: "Bienvenido a Owls 3D Mixer",
    body: `
      <p>Este proyecto traduce tu mezcla de <b>Ableton Live</b> a un espacio 3D en tiempo real basado en el <i>Virtual Mixer Concept</i> de <b>David Gibson</b> (<i>The Art of Mixing</i>), combinado con cálculos psicoacústicos reales (ITU-R BS.1770, bandas críticas Bark/ERB y relación Directo/Reverberante).</p>
      <div class="welcome-callout">
        <b>Tip inicial:</b> Si entraste en <b>Modo Demo</b>, podés mover esferas, probar Presets, editar EQ Window y comparar Bancos A/B/C/D libremente sin necesitar Ableton Live abierto.
      </div>
    `,
  },
  {
    badge: "Paso 2 de 3 · Los 3 Ejes",
    title: "Cómo se lee y controla la caja 3D",
    body: `
      <div class="welcome-axes-grid">
        <div class="welcome-axis-card">
          <span class="axis-pill axis-x">Eje X</span>
          <b>Paneo (L ↔ R)</b>
          <p>Arrastrá a izquierda o derecha para ubicar la fuente entre los parlantes.</p>
        </div>
        <div class="welcome-axis-card">
          <span class="axis-pill axis-y">Eje Y</span>
          <b>Frecuencia (20 Hz – 20 kHz)</b>
          <p>Graves abajo, agudos arriba. Con <b>Shift + Arrastrar</b> aplicás <b>Tilt EQ real</b> si la pista tiene EQ Eight.</p>
        </div>
        <div class="welcome-axis-card">
          <span class="axis-pill axis-z">Eje Z</span>
          <b>Volumen y Profundidad</b>
          <p>Adelante = más fuerte / presente. <b>Rueda del mouse</b> ajusta Reverb (Send A) y agranda el cubo translúcido.</p>
        </div>
      </div>
    `,
  },
  {
    badge: "Paso 3 de 3 · Flujo rápido",
    title: "Herramientas clave para mezclar",
    body: `
      <ul class="welcome-list">
        <li><b>🎛 Presets + PDF:</b> probá configuraciones por género basadas en los diagramas del libro.</li>
        <li><b>📊 Espacio &amp; LUFS (en 🪟 Ventanas):</b> mide ocupación de la caja 3D, Short-Term LUFS y detecta choques de frecuencias con botón <b>✂ Priorizar</b>.</li>
        <li><b>Bancos A / B / C / D + DRY:</b> compará hasta 4 mezclas distintas al instante.</li>
        <li><b>Atajos clave:</b> <code>Space</code> Play/Pause · <code>E</code> EQ Window · <code>Ctrl+F</code> Buscar pista · <code>Ctrl+Z</code> Deshacer.</li>
      </ul>
    `,
  },
];

export class StartScreenUI {
  constructor() {
    this.startEl = null;
    this.welcomeEl = null;
    this.welcomeStep = 0;
    this._buildStartScreen();
    this._buildWelcomeModal();
  }

  shouldSkipStart() {
    return localStorage.getItem(SKIP_START_KEY) === "1";
  }

  hasSeenWelcome() {
    return localStorage.getItem(WELCOMED_KEY) === "1";
  }

  _buildStartScreen() {
    const el = document.createElement("div");
    el.id = "start-screen-overlay";
    el.className = "start-overlay hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML = `
      <div class="start-card">
        <div class="start-top-meta">
          <span class="start-pill">VIRTUAL MIXER 3D</span>
          <span class="start-version">v${APP_VERSION}</span>
        </div>

        <div class="start-hero-frame">
          <img
            id="start-hero-photo"
            class="start-hero-photo hidden"
            src="./assets/david_gibson.jpg"
            alt="Homenaje a David Gibson — The Art of Mixing"
          />
          <div id="start-hero-fallback" class="start-hero-fallback">${HERO_SVG}</div>
        </div>

        <div class="start-title-block">
          <h1 class="start-title">Owls 3D Mixer</h1>
          <p class="start-subtitle">Mezclador espacial en tiempo real para Ableton Live · Inspirado en <i>The Art of Mixing</i> de David Gibson.</p>
        </div>

        <div class="start-actions">
          <button type="button" id="btn-start-live" class="primary start-btn">🎚 Conectar a Ableton Live</button>
          <button type="button" id="btn-start-demo" class="start-btn">🎛 Entrar en Modo Demo</button>
        </div>

        <div class="start-footer">
          <label class="start-skip-label">
            <input type="checkbox" id="chk-skip-start" />
            <span>No volver a mostrar esta pantalla al inicio</span>
          </label>
          <span id="start-env-hint" class="start-env-hint"></span>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this.startEl = el;

    const img = el.querySelector("#start-hero-photo");
    const fallback = el.querySelector("#start-hero-fallback");
    img.addEventListener("load", () => {
      img.classList.remove("hidden");
      fallback.classList.add("hidden");
    });
    img.addEventListener("error", () => {
      img.classList.add("hidden");
      fallback.classList.remove("hidden");
    });
  }

  _buildWelcomeModal() {
    const el = document.createElement("div");
    el.id = "welcome-modal";
    el.className = "modal-backdrop hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML = `
      <div class="modal-card welcome-card">
        <div class="modal-header">
          <h2 id="welcome-badge">Paso 1 de 3</h2>
          <button type="button" id="btn-close-welcome" class="mini-btn" title="Cerrar">✕</button>
        </div>
        <div class="modal-body welcome-body">
          <h3 id="welcome-title" class="welcome-title"></h3>
          <div id="welcome-content" class="welcome-content"></div>
        </div>
        <div class="welcome-footer">
          <div id="welcome-dots" class="welcome-dots"></div>
          <div class="welcome-nav">
            <button type="button" id="btn-welcome-prev" class="mini-btn">← Anterior</button>
            <button type="button" id="btn-welcome-next" class="primary">Siguiente →</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this.welcomeEl = el;

    this.welcomeBadge = el.querySelector("#welcome-badge");
    this.welcomeTitle = el.querySelector("#welcome-title");
    this.welcomeContent = el.querySelector("#welcome-content");
    this.welcomeDots = el.querySelector("#welcome-dots");
    this.btnPrev = el.querySelector("#btn-welcome-prev");
    this.btnNext = el.querySelector("#btn-welcome-next");

    el.querySelector("#btn-close-welcome").addEventListener("click", () => this.closeWelcome());
    el.addEventListener("click", (e) => {
      if (e.target === el) this.closeWelcome();
    });

    this.btnPrev.addEventListener("click", () => {
      if (this.welcomeStep > 0) {
        this.welcomeStep--;
        this._renderWelcomeStep();
      }
    });

    this.btnNext.addEventListener("click", () => {
      if (this.welcomeStep < WELCOME_STEPS.length - 1) {
        this.welcomeStep++;
        this._renderWelcomeStep();
      } else {
        this.closeWelcome();
      }
    });
  }

  openStartScreen({ preferDemo = false } = {}) {
    return new Promise((resolve) => {
      const btnLive = this.startEl.querySelector("#btn-start-live");
      const btnDemo = this.startEl.querySelector("#btn-start-demo");
      const chkSkip = this.startEl.querySelector("#chk-skip-start");
      const envHint = this.startEl.querySelector("#start-env-hint");

      chkSkip.checked = this.shouldSkipStart();
      btnLive.classList.toggle("primary", !preferDemo);
      btnDemo.classList.toggle("primary", preferDemo);

      envHint.textContent = preferDemo
        ? "Modo web detectado: recomendado iniciar en Modo Demo."
        : "Entorno local detectado: asegurate de tener Ableton Live + AbletonJS activos.";

      this.startEl.classList.remove("hidden");
      this.startEl.classList.remove("fade-out");

      const finish = (choice) => {
        if (chkSkip.checked) localStorage.setItem(SKIP_START_KEY, "1");
        else localStorage.removeItem(SKIP_START_KEY);

        document.removeEventListener("keydown", onKey);
        btnLive.onclick = null;
        btnDemo.onclick = null;

        this.startEl.classList.add("fade-out");
        setTimeout(() => {
          this.startEl.classList.add("hidden");
          this.startEl.classList.remove("fade-out");
          resolve(choice);
        }, 180);
      };

      const onKey = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(preferDemo ? "demo" : "live");
        }
      };

      btnLive.onclick = () => finish("live");
      btnDemo.onclick = () => finish("demo");
      document.addEventListener("keydown", onKey);
    });
  }

  openWelcome(force = false) {
    if (!force && this.hasSeenWelcome()) return;
    this.welcomeStep = 0;
    this._renderWelcomeStep();
    this.welcomeEl.classList.remove("hidden");
  }

  closeWelcome() {
    localStorage.setItem(WELCOMED_KEY, "1");
    this.welcomeEl?.classList.add("hidden");
  }

  isWelcomeOpen() {
    return Boolean(this.welcomeEl && !this.welcomeEl.classList.contains("hidden"));
  }

  _renderWelcomeStep() {
    const step = WELCOME_STEPS[this.welcomeStep];
    this.welcomeBadge.textContent = step.badge;
    this.welcomeTitle.textContent = step.title;
    this.welcomeContent.innerHTML = step.body;

    this.btnPrev.disabled = this.welcomeStep === 0;
    const isLast = this.welcomeStep === WELCOME_STEPS.length - 1;
    this.btnNext.textContent = isLast ? "Empezar a mezclar" : "Siguiente →";

    this.welcomeDots.innerHTML = "";
    WELCOME_STEPS.forEach((_, idx) => {
      const dot = document.createElement("span");
      dot.className = "welcome-dot" + (idx === this.welcomeStep ? " active" : "");
      this.welcomeDots.appendChild(dot);
    });
  }
}