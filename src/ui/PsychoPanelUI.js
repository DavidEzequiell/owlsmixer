import { LUFS_TARGETS, formatFreq, computeCarvePlan } from "../engine/psychoacoustics.js";
import { store } from "../store.js";
import { abletonService } from "../services/abletonService.js";

export class PsychoPanelUI {
  constructor() {
    this.selTarget = document.getElementById("sel-lufs-target");
    this.valMasterLufs = document.getElementById("val-master-lufs");
    this.badgeClip = document.getElementById("badge-clip");
    this.valSpacePct = document.getElementById("val-space-pct");
    this.badgeZone = document.getElementById("badge-density-zone");
    this.barSpaceFill = document.getElementById("bar-space-fill");
    this.valLowEnd = document.getElementById("val-lowend-pct");
    this.collisionList = document.getElementById("collision-list");

    this._forceRenderUntil = 0;
    this._feedbackTimer = null;

    // Banner inline de feedback inmediato tras aplicar Priorizar / Pan / Duck
    this.feedbackEl = document.createElement("div");
    this.feedbackEl.className = "carve-feedback hidden";
    this.feedbackEl.style.cssText =
      "margin-bottom:6px;padding:6px 8px;border-radius:6px;font-size:11px;line-height:1.35;" +
      "border:1px solid var(--ok, #22c55e);background:rgba(34,197,94,0.12);color:var(--text, inherit);" +
      "display:flex;align-items:flex-start;justify-content:space-between;gap:6px;";
    if (this.collisionList?.parentElement) {
      this.collisionList.parentElement.insertBefore(this.feedbackEl, this.collisionList);
    }

    Object.entries(LUFS_TARGETS).forEach(([key, cfg]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = cfg.label;
      if (key === store.settings.lufsTarget) opt.selected = true;
      this.selTarget.appendChild(opt);
    });

    this.selTarget.addEventListener("change", () => {
      this.selTarget.blur();
      store.updateSettings({ lufsTarget: this.selTarget.value });
    });

    // Refresco inmediato ante cualquier recorte aplicado
    store.on("carve-applied", (res) => {
      this._forceRenderUntil = performance.now() + 1600;
      this.showCarveFeedback(res);
    });
  }

  showCarveFeedback(res) {
    if (!res || !this.feedbackEl) return;
    clearTimeout(this._feedbackTimer);

    const isOk = Boolean(res.ok);
    this.feedbackEl.classList.remove("hidden");
    this.feedbackEl.style.borderColor = isOk ? "var(--ok, #22c55e)" : "var(--warn, #f59e0b)";
    this.feedbackEl.style.background = isOk ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.14)";
    this.feedbackEl.innerHTML = "";

    const body = document.createElement("div");
    const mainLine = document.createElement("div");
    mainLine.style.fontWeight = "600";
    mainLine.textContent = `${isOk ? "✓" : "⚠"} ${res.summary}`;
    body.appendChild(mainLine);

    if (res.hint) {
      const hintLine = document.createElement("div");
      hintLine.style.cssText = "opacity:0.82;font-size:10px;margin-top:2px;";
      hintLine.textContent = res.hint;
      body.appendChild(hintLine);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.title = "Ocultar aviso";
    closeBtn.style.cssText =
      "background:transparent;border:none;color:inherit;cursor:pointer;font-size:11px;padding:0 2px;opacity:0.75;";
    closeBtn.addEventListener("click", () => {
      this.feedbackEl.classList.add("hidden");
    });

    this.feedbackEl.append(body, closeBtn);
    this._feedbackTimer = setTimeout(() => {
      this.feedbackEl.classList.add("hidden");
    }, 8000);
  }

  updateMasterMeter() {
    const m = store.masterStats;
    const target = LUFS_TARGETS[store.settings.lufsTarget]?.targetLufs ?? -10;

    if (!m.connected || !Number.isFinite(m.shortTermLufs) || m.shortTermLufs < -55) {
      this.valMasterLufs.textContent = "-- LUFS";
      this.valMasterLufs.style.color = "";
      this.valMasterLufs.title = "Sin señal en el Master · Estimación por envolvente del vúmetro de Live (sin PCM)";
    } else {
      this.valMasterLufs.textContent = `~${m.shortTermLufs.toFixed(1)} LUFS`;
      const diff = m.shortTermLufs - target;
      // Verde cerca del target, ámbar si pasa +1.5 LU, rojo si pasa +3.5 LU
      this.valMasterLufs.style.color =
        diff > 3.5 ? "var(--danger)" : diff > 1.5 ? "var(--warn)" : "var(--ok)";

      const peakStr = Number.isFinite(m.peakDb) ? `${m.peakDb.toFixed(1)} dBFS` : "-∞ dBFS";
      const rawStr = typeof m.rawMeterMax === "number" ? m.rawMeterMax.toFixed(2) : "--";
      const crestStr = typeof m.crestEstimateDb === "number" ? `${m.crestEstimateDb.toFixed(1)} dB` : "--";
      const sign = diff >= 0 ? "+" : "";
      this.valMasterLufs.title =
        `Estimación por envolvente Live (sin PCM)\n` +
        `Peak est.: ${peakStr} (vúmetro Live: ${rawStr}) · Dinámica: ${crestStr}\n` +
        `Objetivo: ${target} LUFS (Δ ${sign}${diff.toFixed(1)} LU)`;
    }

    this.badgeClip.classList.toggle("hidden", !m.clipping);
  }

  updateAnalysis(force = false) {
    const a = store.mixAnalysis;
    this.selTarget.value = store.settings.lufsTarget;

    this.valSpacePct.textContent = `${a.occupancyPct}%`;
    this.badgeZone.textContent = a.densityZone;
    this.badgeZone.className = `pill-info ${a.densityClass}`;

    this.barSpaceFill.style.width = `${Math.min(100, a.occupancyPct)}%`;
    this.barSpaceFill.className = `space-bar-fill ${a.densityClass}`;

    this.valLowEnd.textContent = `${a.lowEndPct}%`;
    this.valLowEnd.style.color = a.lowEndPct > 45 ? "var(--warn)" : "";
    if (a.spectralBalance) {
      const sb = a.spectralBalance;
      this.valLowEnd.title =
        `Balance espectral (energía aparente): ` +
        `Graves ${sb.low}% · Med-Graves ${sb.lowMid}% · Presencia ${sb.highMid}% · Aire ${sb.high}%`;
    }

    // Permitir refresco inmediato tras click aunque el cursor siga en :hover
    const allowWhileHover = force || performance.now() < this._forceRenderUntil;
    if (!allowWhileHover && this.collisionList.matches(":hover")) return;
    this.collisionList.innerHTML = "";

    const collisions = a.collisions || [];
    const lowStereo = a.lowEndStereoWarnings || [];

    if (collisions.length === 0 && lowStereo.length === 0) {
      const ok = document.createElement("div");
      ok.className = "collision-ok";
      ok.textContent = "✓ Sin enmascaramiento crítico detectado";
      this.collisionList.appendChild(ok);
      return;
    }

    collisions.slice(0, 4).forEach((c) => {
      const card = document.createElement("div");
      card.className = "collision-card" + (c.isLowMud ? " is-mud" : "");

      const masker = c.maskerId === c.a.id ? c.a : c.b;
      const masked = c.maskerId === c.a.id ? c.b : c.a;
      const arrow = c.isMutual ? "↔" : "→";

      const headerBtn = document.createElement("button");
      headerBtn.className = "collision-item";
      headerBtn.title = c.isMutual
        ? "Enmascaramiento mutuo. Clic para seleccionar ambas pistas en el 3D"
        : `${masker.name} enmascara a ${masked.name} (+${c.maskingDb} dB). Clic para seleccionar ambas pistas`;

      const tags = [];
      if (c.isLowMud) tags.push("Barro");
      else if (c.isUpward) tags.push("Upward");
      if (c.isReverbMud) tags.push("Reverb");
      const tagStr = tags.length > 0 ? ` · ${tags.join("/")}` : "";

      const namesSpan = document.createElement("span");
      namesSpan.className = "col-names";
      namesSpan.textContent = `⚠ ${masker.name} ${arrow} ${masked.name}`;

      const metaSpan = document.createElement("span");
      metaSpan.className = "col-meta";
      const dbTag = Number.isFinite(c.maskingDb) ? `+${c.maskingDb}dB` : `${c.overlapPct}%`;
      metaSpan.textContent = `${dbTag} · ${formatFreq(c.avgHz)}${tagStr}`;

      headerBtn.append(namesSpan, metaSpan);
      headerBtn.addEventListener("click", () => {
        headerBtn.blur();
        store.setSelection([c.a.id, c.b.id]);
      });

      card.appendChild(headerBtn);

      // Mostrar si ya existe recorte EQ o Ducking aplicado en esta colisión
      if (Array.isArray(c.appliedCuts) && c.appliedCuts.length > 0) {
        const appliedEl = document.createElement("div");
        appliedEl.className = "col-applied-badge";
        appliedEl.style.cssText = "font-size:10px;opacity:0.82;padding:2px 6px 0;color:var(--ok, #22c55e);";
        const parts = c.appliedCuts.slice(0, 2).map((ac) =>
          ac.isDuck
            ? `⬇ ${ac.trackName} (${ac.hasSidechain ? "SC" : "Comp"} ×${ac.steps})`
            : `✂ ${ac.trackName} ${ac.gainDb} dB @ ${formatFreq(ac.freqHz)}`
        );
        const reliefStr = c.reliefDb > 0 ? ` (−${c.reliefDb} dB alivio)` : "";
        appliedEl.textContent = `${parts.join(" · ")}${reliefStr}`;
        card.appendChild(appliedEl);
      }

      const runAction = async (btn, winner, loser, strategy) => {
        btn.blur();
        const prevTxt = btn.textContent;
        btn.disabled = true;
        btn.textContent = "⏳...";
        this._forceRenderUntil = performance.now() + 1800;
        try {
          const res = await abletonService.carveCollision(winner, loser, c, strategy);
          if (res && !res.ok) this.showCarveFeedback(res);
          // Forzar re-render local mientras entra el próximo análisis
          store.emit("request-mix-analysis");
        } finally {
          btn.textContent = prevTxt;
          btn.disabled = Boolean(loser.locked);
        }
      };

      const actions = document.createElement("div");
      actions.className = "collision-actions";

      const makeCarveBtn = (winner, loser) => {
        const b = document.createElement("button");
        const isSug = winner.id === c.suggestedWinnerId;
        const plan = computeCarvePlan(winner, loser, c);
        b.className = "mini-btn carve-btn" + (isSug ? " suggested" : "");
        b.disabled = Boolean(loser.locked);

        if (loser.locked) {
          b.title = `${loser.name} está bloqueada`;
        } else if (loser.eq?.hasDevice) {
          b.title = `Recorta ${plan.gainDb} dB @ ${formatFreq(plan.freqHz)} en ${loser.name} para abrir lugar a ${winner.name}`;
        } else if (plan.freqHz < 160) {
          b.title = loser.dynamics?.canDuck
            ? `${loser.name} sin EQ (<160 Hz): aplica Compressor para dar lugar a ${winner.name}`
            : `${loser.name} sin EQ (<160 Hz): atenúa -1.5 dB para cuidar graves mono`;
        } else {
          b.title = `${loser.name} sin EQ: separa en Pan para abrir lugar a ${winner.name}`;
        }

        b.textContent = `✂ Priorizar ${winner.name}`;
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          runAction(b, winner, loser, "auto");
        });
        return b;
      };

      actions.append(makeCarveBtn(c.a, c.b), makeCarveBtn(c.b, c.a));
      card.appendChild(actions);

      // Acciones complementarias (Separar Pan / Duck Compressor) cuando aportan valor real
      const sugWinner = c.suggestedWinnerId === c.a.id ? c.a : c.b;
      const sugLoser = c.suggestedWinnerId === c.a.id ? c.b : c.a;
      const panDist = Math.abs((c.a.pan ?? 0) - (c.b.pan ?? 0));
      const canPanSep = c.avgHz >= 160 && panDist < 0.75 && !sugLoser.locked;
      const canDuck = Boolean(sugLoser.dynamics?.canDuck) && !sugLoser.locked;

      if (canPanSep || canDuck) {
        const extraRow = document.createElement("div");
        extraRow.className = "collision-actions";
        extraRow.style.marginTop = "4px";

        if (canPanSep) {
          const panBtn = document.createElement("button");
          panBtn.className = "mini-btn carve-btn";
          panBtn.textContent = `↔ Pan ${sugLoser.name}`;
          panBtn.title = `Separa a ${sugLoser.name} en el panorama estéreo (BMLD) respecto a ${sugWinner.name}`;
          panBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            runAction(panBtn, sugWinner, sugLoser, "pan");
          });
          extraRow.appendChild(panBtn);
        }

        if (canDuck) {
          const duckBtn = document.createElement("button");
          duckBtn.className = "mini-btn carve-btn";
          const scTag = sugLoser.dynamics?.hasSidechain ? "+SC" : "Comp";
          duckBtn.textContent = `⬇ Duck ${sugLoser.name} (${scTag})`;
          duckBtn.title = sugLoser.dynamics?.hasSidechain
            ? `Baja Threshold del ${sugLoser.dynamics.adapterName} con Sidechain activo en ${sugLoser.name}`
            : `Baja Threshold del ${sugLoser.dynamics.adapterName} en ${sugLoser.name} para controlar dinámica`;
          duckBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            runAction(duckBtn, sugWinner, sugLoser, "duck");
          });
          extraRow.appendChild(duckBtn);
        }

        card.appendChild(extraRow);
      }

      this.collisionList.appendChild(card);
    });

    // Aviso de compatibilidad mono si hay pistas < 150 Hz paneadas afuera del centro
    if (lowStereo.length > 0) {
      const card = document.createElement("div");
      card.className = "collision-card";

      const btn = document.createElement("button");
      btn.className = "collision-item";
      btn.title = "Graves por debajo de 150 Hz fuera del centro pueden perder fuerza al sumar en mono. Clic para seleccionar.";

      const namesSpan = document.createElement("span");
      namesSpan.className = "col-names";
      namesSpan.textContent = `⚠ Graves estéreo (<150 Hz): ${lowStereo.map((w) => w.name).join(", ")}`;

      const metaSpan = document.createElement("span");
      metaSpan.className = "col-meta";
      metaSpan.textContent = "Riesgo mono";

      btn.append(namesSpan, metaSpan);
      btn.addEventListener("click", () => {
        btn.blur();
        store.setSelection(lowStereo.map((w) => w.id));
      });

      card.appendChild(btn);
      this.collisionList.appendChild(card);
    }
  }
}