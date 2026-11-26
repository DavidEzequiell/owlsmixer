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
  }

  updateMasterMeter() {
    const m = store.masterStats;
    const target = LUFS_TARGETS[store.settings.lufsTarget]?.targetLufs ?? -10;

    if (!m.connected || !Number.isFinite(m.shortTermLufs) || m.shortTermLufs < -55) {
      this.valMasterLufs.textContent = "-- LUFS";
      this.valMasterLufs.style.color = "";
      this.valMasterLufs.title = "Sin señal en el Master";
    } else {
      this.valMasterLufs.textContent = `${m.shortTermLufs.toFixed(1)} LUFS`;
      const diff = m.shortTermLufs - target;
      // Verde cerca del target, ámbar si pasa +1.5 dB, rojo si pasa +3.5 dB
      this.valMasterLufs.style.color =
        diff > 3.5 ? "var(--danger)" : diff > 1.5 ? "var(--warn)" : "var(--ok)";

      const peakStr = Number.isFinite(m.peakDb) ? `${m.peakDb.toFixed(1)} dBFS` : "-∞ dBFS";
      const sign = diff >= 0 ? "+" : "";
      this.valMasterLufs.title = `Peak: ${peakStr} · Objetivo: ${target} LUFS (Δ ${sign}${diff.toFixed(1)} LU)`;
    }

    this.badgeClip.classList.toggle("hidden", !m.clipping);
  }

  updateAnalysis() {
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

    // Lista clicable de colisiones ("Solar Eclipse", Visual 23) + alertas mono graves
    if (this.collisionList.matches(":hover")) return;
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

      const actions = document.createElement("div");
      actions.className = "collision-actions";

      const makeCarveBtn = (winner, loser) => {
        const b = document.createElement("button");
        const isSug = winner.id === c.suggestedWinnerId;
        const plan = computeCarvePlan(winner, loser, c);
        b.className = "mini-btn carve-btn" + (isSug ? " suggested" : "");
        b.disabled = Boolean(loser.locked);
        b.title = loser.locked
          ? `${loser.name} está bloqueada`
          : `Recorta ${plan.gainDb} dB @ ${formatFreq(plan.freqHz)} en ${loser.name} para abrir lugar a ${winner.name}`;
        b.textContent = `✂ Priorizar ${winner.name}`;
        b.addEventListener("click", async (e) => {
          e.stopPropagation();
          b.blur();
          await abletonService.carveCollision(winner, loser, c);
        });
        return b;
      };

      actions.append(makeCarveBtn(c.a, c.b), makeCarveBtn(c.b, c.a));
      card.append(headerBtn, actions);
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