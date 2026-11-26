import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SKINS } from "../data/skins.js";
import { store, HALF_W, HALF_H, HALF_D } from "../store.js";
import { TrackOrb, makeTextSprite, disposeUnusedOrbGeometryPools } from "./TrackOrb.js";
import { EqWindow3D } from "./EqWindow3D.js";

const CAM_VIEWS = {
  iso:   { pos: [0, 4.4, 13.8], target: [0, -0.1, 0] },
  front: { pos: [0, 0, 14.8],   target: [0, 0, 0] },
  top:   { pos: [0, 15.8, 0.1], target: [0, 0, 0] },
};

export const GRAPHICS_QUALITY_PRESETS = {
  performance: {
    label: "Rendimiento (30 FPS · Ligero)",
    maxDpr: 1,
    targetFps: 30,
    fog: false,
    backLight: false,
    rimLight: false,
    toneMapping: false,
    anisotropy: 1,
  },
  balanced: {
    label: "Balanceado (60 FPS · Recomendado)",
    maxDpr: 1.5,
    targetFps: 60,
    fog: true,
    backLight: true,
    rimLight: false,
    toneMapping: false,
    anisotropy: 4,
  },
  ultra: {
    label: "Studio Ultra (60 FPS · Alta definición)",
    maxDpr: 2,
    targetFps: 60,
    fog: true,
    backLight: true,
    rimLight: true,
    toneMapping: true,
    anisotropy: 16,
  },
};

export class Stage3D {
  constructor(viewportEl) {
    this.viewportEl = viewportEl;
    this.orbs = new Map();
    this.stageTextures = [];
    this._activeQuality = null;
    this._frameIntervalMs = 0;
    this._lastFrameTime = 0;

    const skin = SKINS[store.settings.skin] || SKINS.gibson_dark;
    this._skinFogDensity = skin.scene.fogDensity;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(skin.scene.bg);
    this.scene.fog = new THREE.FogExp2(skin.scene.bg, skin.scene.fogDensity);

    this.camera = new THREE.PerspectiveCamera(48, viewportEl.clientWidth / viewportEl.clientHeight, 0.1, 100);
    this.camera.position.set(...CAM_VIEWS.iso.pos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(viewportEl.clientWidth, viewportEl.clientHeight);
    viewportEl.appendChild(this.renderer.domElement);

    this.onLiveMixTick = null;
    this.lastLiveAnalysis = 0;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.target.set(...CAM_VIEWS.iso.target);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    this.dirLight.position.set(6, 12, 10);
    this.scene.add(this.dirLight);

    this.backLight = new THREE.PointLight(skin.scene.accentLight, 0.85, 34);
    this.backLight.position.set(0, 2, -7);
    this.scene.add(this.backLight);

    // Luz de relleno de estudio (solo activa en Studio Ultra)
    this.rimLight = new THREE.HemisphereLight(0xc7dcff, 0x1e293b, 0.42);
    this.rimLight.visible = false;
    this.scene.add(this.rimLight);

    this.stageRefs = {};
    this.buildStage(skin.scene);
    this.buildRetro90sSkyRoom();
    this.buildClusterVisuals(skin.scene);

    this.savedMixCam = null;
    this.eqWindow = new EqWindow3D(this.scene);

    this.applyQuality(store.settings.graphicsQuality || "balanced");

    store.on("settings", (s) => {
      const nextQ = s?.graphicsQuality || "balanced";
      if (nextQ !== this._activeQuality) this.applyQuality(nextQ);
    });

    window.addEventListener("resize", () => this.resize());
    this.startLoop();
  }

  applyQuality(qualityKey = "balanced") {
    const key = GRAPHICS_QUALITY_PRESETS[qualityKey] ? qualityKey : "balanced";
    const preset = GRAPHICS_QUALITY_PRESETS[key];
    this._activeQuality = key;
    this._frameIntervalMs = preset.targetFps < 50 ? 1000 / preset.targetFps : 0;

    const dpr = Math.min(window.devicePixelRatio || 1, preset.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.toneMapping = preset.toneMapping ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = preset.toneMapping ? 1.08 : 1.0;

    this.backLight.visible = preset.backLight;
    this.rimLight.visible = preset.rimLight;
    this.ambientLight.intensity = preset.rimLight ? 0.56 : 0.72;
    this.scene.fog.density = preset.fog ? this._skinFogDensity : 0;

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy?.() || 1;
    const targetAniso = Math.min(preset.anisotropy, maxAniso);
    for (const tex of this.stageTextures) {
      if (tex.anisotropy !== targetAniso) {
        tex.anisotropy = targetAniso;
        tex.needsUpdate = true;
      }
    }

    this.orbs.forEach((orb) => orb.applyQuality(key));
    disposeUnusedOrbGeometryPools(key);
    this.resize();
  }

  // Genera textura procedural de nubes 90s estilo Silicon Graphics / The Art of Mixing
  createCloudsTexture(withYellowHorizon = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    if (withYellowHorizon) {
      grad.addColorStop(0.0, "#4ea5df");
      grad.addColorStop(0.55, "#8fd0f5");
      grad.addColorStop(0.84, "#dff4e8");
      grad.addColorStop(1.0, "#fff2a8");
    } else {
      grad.addColorStop(0.0, "#4ca1dc");
      grad.addColorStop(0.6, "#87c9f0");
      grad.addColorStop(1.0, "#c8eafb");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    let seed = withYellowHorizon ? 42 : 17;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let c = 0; c < 18; c++) {
      const cx = rand() * 512;
      const cy = rand() * (withYellowHorizon ? 330 : 440);
      const puffs = 4 + Math.floor(rand() * 5);
      for (let p = 0; p < puffs; p++) {
        const px = cx + (rand() - 0.5) * 110;
        const py = cy + (rand() - 0.5) * 40;
        const r = 28 + rand() * 48;
        const cg = ctx.createRadialGradient(px, py - r * 0.2, 4, px, py, r);
        cg.addColorStop(0, "rgba(255, 255, 255, 0.72)");
        cg.addColorStop(0.6, "rgba(240, 249, 255, 0.35)");
        cg.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    this.stageTextures.push(tex);
    return tex;
  }

  // Cuarto clásico 1997 (Paredes con nubes, cielo arriba, horizonte amarillo atrás, piso azul)
  buildRetro90sSkyRoom() {
    const group = new THREE.Group();
    const sideTex = this.createCloudsTexture(false);
    const backTex = this.createCloudsTexture(true);

    const sideMat = new THREE.MeshBasicMaterial({ map: sideTex, side: THREE.FrontSide, transparent: true, opacity: 0.92 });
    const backMat = new THREE.MeshBasicMaterial({ map: backTex, side: THREE.FrontSide });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, HALF_H * 2), backMat);
    backWall.position.set(0, 0, -HALF_D - 0.03);
    group.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(HALF_D * 2, HALF_H * 2), sideMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-HALF_W - 0.02, 0, 0);
    group.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(HALF_D * 2, HALF_H * 2), sideMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(HALF_W + 0.02, 0, 0);
    group.add(rightWall);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2), sideMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, HALF_H + 0.02, 0);
    group.add(ceiling);

    const fCanvas = document.createElement("canvas");
    fCanvas.width = 512;
    fCanvas.height = 512;
    const fctx = fCanvas.getContext("2d");
    const fGrad = fctx.createLinearGradient(0, 0, 0, 512);
    fGrad.addColorStop(0, "#7ea7e8");
    fGrad.addColorStop(0.5, "#4667bd");
    fGrad.addColorStop(1, "#2f4799");
    fctx.fillStyle = fGrad;
    fctx.fillRect(0, 0, 512, 512);

    const floorTex = new THREE.CanvasTexture(fCanvas);
    this.stageTextures.push(floorTex);
    const floorBase = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2),
      new THREE.MeshBasicMaterial({ map: floorTex, side: THREE.FrontSide })
    );
    floorBase.rotation.x = -Math.PI / 2;
    floorBase.position.y = -HALF_H - 0.015;
    group.add(floorBase);

    group.visible = false;
    this.scene.add(group);
    this.stageRefs.retroRoom = group;
  }

  buildFloorLevelsOverlay() {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    const levels = [
      "VOL LVL 6 (-36 a -29 dB) · Subliminal / Whispers",
      "VOL LVL 5 (-29 a -22 dB) · Distant FX / Fondo",
      "VOL LVL 4 (-22 a -15 dB) · Pads / Camas / Alt Vox",
      "VOL LVL 3 (-15 a -8 dB) · Base Rítmica / Rock Vox",
      "VOL LVL 2 (-8 a -1 dB) · Lead Vocals / Solos",
      "VOL LVL 1 (-1 a +6 dB) · Frente Extremo / 808",
    ];
    const rowH = canvas.height / 6;

    levels.forEach((txt, idx) => {
      const y = idx * rowH;
      ctx.fillStyle = idx % 2 === 0 ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.04)";
      ctx.fillRect(0, y, canvas.width, rowH);
      ctx.strokeStyle = "rgba(226, 232, 240, 0.28)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(241, 245, 249, 0.65)";
      ctx.font = "700 28px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, canvas.width - 28, y + rowH * 0.52);
    });

    const tex = new THREE.CanvasTexture(canvas);
    this.stageTextures.push(tex);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -HALF_H + 0.008;
    this.scene.add(mesh);
    return mesh;
  }

  buildFreqBandsOverlay() {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");

    const bands = [
      { label: "HI-HIGHS  > 8,000 Hz",   color: "rgba(250, 204, 21, 0.08)" },
      { label: "HIGHS  5,000 – 8,000 Hz", color: "rgba(74, 222, 128, 0.07)" },
      { label: "MIDRANGE  800 – 5,000 Hz", color: "rgba(56, 189, 248, 0.07)" },
      { label: "LOW MIDS (Oohzone)  100 – 800 Hz", color: "rgba(168, 85, 247, 0.07)" },
      { label: "BASS  40 – 100 Hz",       color: "rgba(244, 63, 94, 0.08)" },
      { label: "LOW BASS  < 40 Hz",       color: "rgba(239, 68, 68, 0.10)" },
    ];
    const rowH = canvas.height / bands.length;

    bands.forEach((b, idx) => {
      const y = idx * rowH;
      ctx.fillStyle = b.color;
      ctx.fillRect(0, y, canvas.width, rowH);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(241, 245, 249, 0.68)";
      ctx.font = "700 22px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, 22, y + rowH * 0.52);
    });

    const tex = new THREE.CanvasTexture(canvas);
    this.stageTextures.push(tex);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, HALF_H * 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    mesh.position.z = -HALF_D + 0.01;
    this.scene.add(mesh);
    return mesh;
  }

  rebuildGrids(s) {
    const disposeHelper = (obj) => {
      if (!obj) return;
      this.scene.remove(obj);
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material?.dispose();
    };
    disposeHelper(this.stageRefs.floorGrid);
    disposeHelper(this.stageRefs.backGrid);

    const floorGrid = new THREE.GridHelper(HALF_W * 2, 10, s.floorMain, s.floorSub);
    floorGrid.scale.z = HALF_D / HALF_W;
    floorGrid.position.y = -HALF_H;
    this.scene.add(floorGrid);
    this.stageRefs.floorGrid = floorGrid;

    const backGrid = new THREE.GridHelper(HALF_W * 2, 10, s.backMain, s.backSub);
    backGrid.rotation.x = Math.PI / 2;
    backGrid.scale.z = HALF_H / HALF_W;
    backGrid.position.z = -HALF_D;
    this.scene.add(backGrid);
    this.stageRefs.backGrid = backGrid;
  }

  buildStage(s) {
    const boxGeo = new THREE.BoxGeometry(HALF_W * 2, HALF_H * 2, HALF_D * 2);
    this.stageRefs.boxLinesMat = new THREE.LineBasicMaterial({ color: s.boxLines, transparent: true, opacity: 0.75 });
    this.scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), this.stageRefs.boxLinesMat));
    boxGeo.dispose();

    this.rebuildGrids(s);
    this.stageRefs.floorLevels = this.buildFloorLevelsOverlay();
    this.stageRefs.freqBands = this.buildFreqBandsOverlay();

    const centerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -HALF_H, HALF_D),
      new THREE.Vector3(0, -HALF_H, -HALF_D),
    ]);
    this.stageRefs.centerLineMat = new THREE.LineBasicMaterial({ color: s.centerLine, opacity: 0.5, transparent: true });
    this.stageRefs.centerLine = new THREE.Line(centerGeo, this.stageRefs.centerLineMat);
    this.scene.add(this.stageRefs.centerLine);

    this.stageRefs.spkCabMat = new THREE.MeshStandardMaterial({ color: s.spkCab, roughness: 0.55, metalness: 0.25 });
    this.stageRefs.spkConeMat = new THREE.MeshStandardMaterial({ color: s.spkCone, roughness: 0.4 });
    this.stageRefs.spkRimMat = new THREE.MeshBasicMaterial({ color: s.spkRim });

    const spkBoxGeo = new THREE.BoxGeometry(1.1, 2.2, 0.9);
    const wooferGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.08, 24);
    const tweeterGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 24);

    [-HALF_W - 0.85, HALF_W + 0.85].forEach((xPos, idx) => {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(spkBoxGeo, this.stageRefs.spkCabMat));

      const woofer = new THREE.Mesh(wooferGeo, this.stageRefs.spkConeMat);
      woofer.rotation.x = Math.PI / 2;
      woofer.position.set(0, -0.38, 0.45);
      grp.add(woofer);

      const tweeter = new THREE.Mesh(tweeterGeo, this.stageRefs.spkRimMat);
      tweeter.rotation.x = Math.PI / 2;
      tweeter.position.set(0, 0.48, 0.45);
      grp.add(tweeter);

      grp.position.set(xPos, 1.35, HALF_D + 0.15);
      grp.rotation.y = idx === 0 ? 0.22 : -0.22;
      this.scene.add(grp);
    });

    const addAxisLabel = (txt, pos, col) => {
      const spr = makeTextSprite(txt, col, 22, false);
      spr.position.copy(pos);
      this.scene.add(spr);
    };
    addAxisLabel("LEFT", new THREE.Vector3(-HALF_W - 0.8, 2.8, HALF_D + 0.15), "#93c5fd");
    addAxisLabel("RIGHT", new THREE.Vector3(HALF_W + 0.8, 2.8, HALF_D + 0.15), "#93c5fd");
  }

  buildClusterVisuals(s) {
    this.clusterLineMat = new THREE.LineBasicMaterial({ color: s.clusterLine, transparent: true, opacity: 0.72 });
    this.clusterLines = new THREE.LineSegments(new THREE.BufferGeometry(), this.clusterLineMat);
    this.clusterLines.visible = false;
    this.scene.add(this.clusterLines);

    this.centroidMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
    );
    this.centroidMarker.visible = false;
    this.scene.add(this.centroidMarker);

    // Detector visual de colisiones / enmascaramiento (geometría y materiales reutilizados)
    this.collisionLineMat = new THREE.LineBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.85 });
    this.collisionLines = new THREE.LineSegments(new THREE.BufferGeometry(), this.collisionLineMat);
    this.collisionLines.visible = false;
    this.scene.add(this.collisionLines);

    this._colMarkerGeo = new THREE.OctahedronGeometry(1, 0);
    this._colMatMud = new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true, transparent: true, opacity: 0.9 });
    this._colMatWarn = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true, transparent: true, opacity: 0.9 });

    this.collisionMarkers = new THREE.Group();
    this.scene.add(this.collisionMarkers);
  }

  applySkin(skinKey) {
    const skin = SKINS[skinKey];
    if (!skin) return;

    document.body.dataset.skin = skinKey;
    Object.entries(skin.ui).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));

    const s = skin.scene;
    const preset = GRAPHICS_QUALITY_PRESETS[this._activeQuality] || GRAPHICS_QUALITY_PRESETS.balanced;
    this._skinFogDensity = s.fogDensity;

    this.scene.background.setHex(s.bg);
    this.scene.fog.color.setHex(s.bg);
    this.scene.fog.density = preset.fog ? s.fogDensity : 0;
    this.backLight.color.setHex(s.accentLight);
    this.stageRefs.boxLinesMat.color.setHex(s.boxLines);
    this.stageRefs.centerLineMat.color.setHex(s.centerLine);
    this.stageRefs.spkCabMat.color.setHex(s.spkCab);
    this.stageRefs.spkConeMat.color.setHex(s.spkCone);
    this.stageRefs.spkRimMat.color.setHex(s.spkRim);
    this.clusterLineMat.color.setHex(s.clusterLine);
    this.stageRefs.retroRoom.visible = Boolean(s.skyClouds);
    this.rebuildGrids(s);

    this.orbs.forEach((orb) => orb.applySkin(s));
  }

  applyStageSettings() {
    const isMix = store.viewMode === "mix";
    this.stageRefs.floorLevels.visible = isMix && store.settings.showVolLevels;
    this.stageRefs.freqBands.visible = isMix && store.settings.showFreqBands;
    if (this.stageRefs.centerLine) this.stageRefs.centerLine.visible = isMix;
    this.updateAllOrbs();
  }

  applyViewMode(mode) {
    const isEq = mode === "eq";
    this.eqWindow.group.visible = isEq;

    if (isEq) {
      this.savedMixCam = {
        pos: this.camera.position.clone(),
        target: this.controls.target.clone(),
      };
      this.camera.position.set(0, 0, 12.6);
      this.controls.target.set(0, 0, 0);
      this.controls.enableRotate = false;
      this.controls.update();
    } else {
      this.controls.enableRotate = true;
      if (this.savedMixCam) {
        this.camera.position.copy(this.savedMixCam.pos);
        this.controls.target.copy(this.savedMixCam.target);
        this.controls.update();
      }
    }

    this.applyStageSettings();
    this.updateCollisions(store.mixAnalysis?.collisions || []);
    this.eqWindow.sync();
  }

  rebuildOrbs() {
    this.orbs.forEach((orb) => {
      this.scene.remove(orb.group);
      orb.dispose();
    });
    this.orbs.clear();

    const skinScene = (SKINS[store.settings.skin] || SKINS.gibson_dark).scene;
    const qualityKey = this._activeQuality || store.settings.graphicsQuality || "balanced";
    store.tracks.forEach((item) => {
      const orb = new TrackOrb(item, skinScene, qualityKey);
      this.scene.add(orb.group);
      this.orbs.set(item.id, orb);
    });
    this.updateAllOrbs();
  }

  updateOrb(item) {
    const orb = this.orbs.get(item.id);
    if (orb) orb.sync(this.camera);
    this.updateCluster();
  }

  rebuildOrbLabel(item) {
    const orb = this.orbs.get(item.id);
    if (orb) {
      orb.rebuildLabel();
      orb.sync(this.camera);
    }
  }

  updateOrbColor(item) {
    const orb = this.orbs.get(item.id);
    if (orb) orb.updateColor(item.colorHex);
  }

  updateAllOrbs() {
    const anySolo = store.tracks.some((t) => t.solo);
    this.orbs.forEach((orb) => orb.sync(this.camera, anySolo));
    this.updateCluster();
    if (store.viewMode === "eq") this.eqWindow.sync();
  }

  updateCluster() {
    if (store.viewMode !== "mix") {
      this.clusterLines.visible = false;
      this.centroidMarker.visible = false;
      return;
    }

    const selOrbs = store
      .getSelectedTracks()
      .map((t) => this.orbs.get(t.id))
      .filter((o) => o && o.group.visible);

    if (selOrbs.length < 2) {
      this.clusterLines.visible = false;
      this.centroidMarker.visible = false;
      return;
    }

    const center = new THREE.Vector3();
    selOrbs.forEach((o) => center.add(o.mesh.position));
    center.divideScalar(selOrbs.length);

    const pts = [];
    selOrbs.forEach((o) => {
      pts.push(center.x, center.y, center.z, o.mesh.position.x, o.mesh.position.y, o.mesh.position.z);
    });

    this.clusterLines.geometry.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.clusterLines.geometry = geo;
    this.clusterLines.visible = true;

    this.centroidMarker.position.copy(center);
    this.centroidMarker.visible = true;
  }

  updateCollisions(collisions = []) {
    while (this.collisionMarkers.children.length > 0) {
      this.collisionMarkers.remove(this.collisionMarkers.children[0]);
    }

    if (store.viewMode !== "mix" || !store.settings.showCollisions || collisions.length === 0) {
      this.collisionLines.visible = false;
      this.collisionMarkers.visible = false;
      return;
    }

    const pts = [];
    collisions.forEach((c) => {
      pts.push(c.posA.x, c.posA.y, c.posA.z, c.posB.x, c.posB.y, c.posB.z);
      const mid = c.posA.clone().add(c.posB).multiplyScalar(0.5);
      const baseScale = 0.14 + c.severity * 0.14;
      const marker = new THREE.Mesh(
        this._colMarkerGeo,
        c.isLowMud ? this._colMatMud : this._colMatWarn
      );
      marker.position.copy(mid);
      marker.userData.baseScale = baseScale;
      marker.scale.setScalar(baseScale);
      this.collisionMarkers.add(marker);
    });

    this.collisionLines.geometry.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.collisionLines.geometry = geo;
    this.collisionLines.visible = true;
    this.collisionMarkers.visible = true;
  }

  getPickableMeshes() {
    const list = [];
    this.orbs.forEach((orb) => {
      if (orb.group.visible && !orb.item.locked) list.push(orb.mesh);
    });
    return list;
  }

  setCameraView(viewKey) {
    const v = CAM_VIEWS[viewKey];
    if (!v) return;
    this.camera.position.set(...v.pos);
    this.controls.target.set(...v.target);
    this.controls.update();
  }

  attachContextLossHandler(onLost) {
    this.contextLost = false;
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.contextLost = true;
      onLost?.(new Error("Se perdió el contexto WebGL de la tarjeta gráfica."));
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => {
      this.contextLost = false;
      this.resize();
    });
  }

  resize() {
    const w = this.viewportEl.clientWidth;
    const h = this.viewportEl.clientHeight;
    if (w < 2 || h < 2) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  startLoop() {
    const tick = (now = performance.now()) => {
      requestAnimationFrame(tick);
      if (this.contextLost || document.hidden) return;

      if (this._frameIntervalMs > 0) {
        if (now - this._lastFrameTime < this._frameIntervalMs) return;
        this._lastFrameTime = now;
      }

      this.controls.update();
      if (this.centroidMarker.visible) this.centroidMarker.rotation.y += 0.02;

      if (this.collisionMarkers.visible && this.collisionMarkers.children.length > 0) {
        const pulse = 1 + Math.sin(now * 0.007) * 0.18;
        for (let i = 0; i < this.collisionMarkers.children.length; i++) {
          const m = this.collisionMarkers.children[i];
          m.rotation.y -= 0.03;
          m.scale.setScalar((m.userData.baseScale || 0.18) * pulse);
        }
      }

      let anyMoving = false;
      const anySolo = store.tracks.some((t) => t.solo);
      for (const item of store.tracks) {
        if (!store.flashFreeze) {
          const m = item.meter || 0;
          item.smoothMeter += (m - item.smoothMeter) * 0.25;
          item.peakEnv = m > (item.peakEnv || 0)
            ? item.peakEnv + (m - item.peakEnv) * 0.60
            : (item.peakEnv || 0) * 0.94;
          item.rmsEnv = (item.rmsEnv || 0) + (m - (item.rmsEnv || 0)) * 0.05;

          const crestRatio = item.rmsEnv > 0.015 ? Math.max(1, Math.min(5, item.peakEnv / item.rmsEnv)) : 2.0;
          const targetCrest = item.peakEnv > 0.04
            ? Math.max(0.80, Math.min(1.32, 1.34 - Math.log2(crestRatio) * 0.24))
            : 1.0;
          item.crestScale = (item.crestScale ?? 1.0) + (targetCrest - (item.crestScale ?? 1.0)) * 0.08;
        }

        if (item.smoothMeter > 0.002 || item.meter > 0.002 || Math.abs((item.crestScale ?? 1) - 1) > 0.01 || item.locked) {
          const orb = this.orbs.get(item.id);
          if (orb && orb.group.visible) orb.sync(this.camera, anySolo);
          if (item.meter > 0.01) anyMoving = true;
        }
      }

      if (anyMoving && store.settings.autoSize && !store.flashFreeze && store.viewMode === "mix" && now - this.lastLiveAnalysis > 1500) {
        this.lastLiveAnalysis = now;
        this.onLiveMixTick?.();
      }

      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }
}