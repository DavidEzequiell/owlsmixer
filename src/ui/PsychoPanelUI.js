import { LUFS_TARGETS, formatFreq } from "../engine/psychoacoustics.js";
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
    } else {
      this.valMasterLufs.textContent = `${m.shortTermLufs.toFixed(1)} LUFS`;
      const diff = m.shortTermLufs - target;
      // Verde cerca del target, ámbar si pasa +2 dB, rojo si pasa +4 dB
      this.valMasterLufs.style.color =
        diff > 3.5 ? "var(--danger)" : diff > 1.5 ? "var(--warn)" : "var(--ok)";
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
    this.valLowEnd.style.color = a.lowEndPct > 48 ? "var(--warn)" : "";

    // Lista clicable de colisiones ("Solar Eclipse", Visual 23)
    if (this.collisionList.matches(":hover")) return;
    this.collisionList.innerHTML = "";
    if (a.collisions.length === 0) {
      this.collisionList.innerHTML = `<div class="collision-ok">✓ Sin enmascaramiento crítico detectado</div>`;
      return;
    }

    a.collisions.slice(0, 4).forEach((c) => {
      const card = document.createElement("div");
      card.className = "collision-card" + (c.isLowMud ? " is-mud" : "");

      const headerBtn = document.createElement("button");
      headerBtn.className = "collision-item";
      headerBtn.title = "Clic para seleccionar ambas pistas en el 3D";
      const mudTag = c.isLowMud ? " · Barro" : "";
      headerBtn.innerHTML =
        `<span class="col-names">⚠ ${c.a.name} ↔ ${c.b.name}</span>` +
        `<span class="col-meta">${c.overlapPct}% · ${formatFreq(c.avgHz)}${mudTag}</span>`;
      headerBtn.addEventListener("click", () => {
        headerBtn.blur();
        store.setSelection([c.a.id, c.b.id]);
      });

      const actions = document.createElement("div");
      actions.className = "collision-actions";

      const makeCarveBtn = (winner, loser) => {
        const b = document.createElement("button");
        const isSug = winner.id === c.suggestedWinnerId;
        b.className = "mini-btn carve-btn" + (isSug ? " suggested" : "");
        b.disabled = Boolean(loser.locked);
        b.title = loser.locked
          ? `${loser.name} está bloqueada`
          : `Recorta EQ en ${loser.name} para abrir lugar a ${winner.name}`;
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
  }
}