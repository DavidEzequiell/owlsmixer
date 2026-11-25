import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SKINS } from "../data/skins.js";
import { store, HALF_W, HALF_H, HALF_D } from "../store.js";
import { TrackOrb, makeTextSprite } from "./TrackOrb.js";
import { EqWindow3D } from "./EqWindow3D.js";

const CAM_VIEWS = {
  iso:   { pos: [0, 4.4, 13.8], target: [0, -0.1, 0] },
  front: { pos: [0, 0, 14.8],   target: [0, 0, 0] },
  top:   { pos: [0, 15.8, 0.1], target: [0, 0, 0] },
};

export class Stage3D {
  constructor(viewportEl) {
    this.viewportEl = viewportEl;
    this.orbs = new Map();

    const skin = SKINS[store.settings.skin] || SKINS.gibson_dark;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(skin.scene.bg);
    this.scene.fog = new THREE.FogExp2(skin.scene.bg, skin.scene.fogDensity);

    this.camera = new THREE.PerspectiveCamera(48, viewportEl.clientWidth / viewportEl.clientHeight, 0.1, 100);
    this.camera.position.set(...CAM_VIEWS.iso.pos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(viewportEl.clientWidth, viewportEl.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    viewportEl.appendChild(this.renderer.domElement);

    this.onLiveMixTick = null;
    this.lastLiveAnalysis = 0;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.target.set(...CAM_VIEWS.iso.target);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(6, 12, 10);
    this.scene.add(dirLight);
    this.backLight = new THREE.PointLight(skin.scene.accentLight, 0.85, 34);
    this.backLight.position.set(0, 2, -7);
    this.scene.add(this.backLight);

    this.stageRefs = {};
    this.buildStage(skin.scene);
    this.buildRetro90sSkyRoom();
    this.buildClusterVisuals(skin.scene);

    this.savedMixCam = null;
    this.eqWindow = new EqWindow3D(this.scene);

    window.addEventListener("resize", () => this.resize());
    this.startLoop();
  }

  // Genera textura procedural de nubes 90s estilo Silicon Graphics / The Art of Mixing!
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

    // Nubes esponjosas retro
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
    return tex;
  }

  // Cuarto clásico 1997 (Paredes con nubes, cielo arriba, horizonte amarillo atrás, piso azul)
  buildRetro90sSkyRoom() {
    const group = new THREE.Group();
    const sideTex = this.createCloudsTexture(false);
    const backTex = this.createCloudsTexture(true);

    const sideMat = new THREE.MeshBasicMaterial({ map: sideTex, side: THREE.FrontSide, transparent: true, opacity: 0.92 });
    const backMat = new THREE.MeshBasicMaterial({ map: backTex, side: THREE.FrontSide });

    // Pared trasera (horizonte amarillo)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, HALF_H * 2), backMat);
    backWall.position.set(0, 0, -HALF_D - 0.03);
    group.add(backWall);

    // Pared izquierda y derecha (nubes translúcidas)
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(HALF_D * 2, HALF_H * 2), sideMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-HALF_W - 0.02, 0, 0);
    group.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(HALF_D * 2, HALF_H * 2), sideMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(HALF_W + 0.02, 0, 0);
    group.add(rightWall);

    // Techo de nubes
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2), sideMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, HALF_H + 0.02, 0);
    group.add(ceiling);

    // Piso azul clásico de Gibson (degradé azul fuerte adelante -> celeste atrás)
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
    const floorBase = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fCanvas), side: THREE.FrontSide })
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
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, HALF_H * 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    mesh.position.z = -HALF_D + 0.01;
    this.scene.add(mesh);
    return mesh;
  }

  rebuildGrids(s) {
    if (this.stageRefs.floorGrid) this.scene.remove(this.stageRefs.floorGrid);
    if (this.stageRefs.backGrid) this.scene.remove(this.stageRefs.backGrid);

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

    [-HALF_W - 0.85, HALF_W + 0.85].forEach((xPos, idx) => {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.9), this.stageRefs.spkCabMat));

      const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 24), this.stageRefs.spkConeMat);
      woofer.rotation.x = Math.PI / 2;
      woofer.position.set(0, -0.38, 0.45);
      grp.add(woofer);

      const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 24), this.stageRefs.spkRimMat);
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
    // Detector visual de colisiones / enmascaramiento ("Solar Eclipse", Visual 23)
    this.collisionLineMat = new THREE.LineBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.85 });
    this.collisionLines = new THREE.LineSegments(new THREE.BufferGeometry(), this.collisionLineMat);
    this.collisionLines.visible = false;
    this.scene.add(this.collisionLines);

    this.collisionMarkers = new THREE.Group();
    this.scene.add(this.collisionMarkers);
  }

  applySkin(skinKey) {
    const skin = SKINS[skinKey];
    if (!skin) return;

    // Activa estilos especiales por skin (ej. Windows 98 para gibson_90s)
    document.body.dataset.skin = skinKey;
    Object.entries(skin.ui).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));

    const s = skin.scene;
    this.scene.background.setHex(s.bg);
    this.scene.fog.color.setHex(s.bg);
    this.scene.fog.density = s.fogDensity;
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
    store.tracks.forEach((item) => {
      const orb = new TrackOrb(item, skinScene);
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
    this.orbs.forEach((orb) => orb.sync(this.camera));
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
      const m = this.collisionMarkers.children[0];
      m.geometry.dispose();
      m.material.dispose();
      this.collisionMarkers.remove(m);
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
      const colHex = c.isLowMud ? 0xef4444 : 0xf59e0b;
      const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14 + c.severity * 0.14, 0),
        new THREE.MeshBasicMaterial({ color: colHex, wireframe: true, transparent: true, opacity: 0.9 })
      );
      marker.position.copy(mid);
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

  resize() {
    this.camera.aspect = this.viewportEl.clientWidth / this.viewportEl.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.viewportEl.clientWidth, this.viewportEl.clientHeight);
  }

  startLoop() {
    const tick = () => {
      requestAnimationFrame(tick);
      this.controls.update();
      if (this.centroidMarker.visible) this.centroidMarker.rotation.y += 0.02;

      if (this.collisionMarkers.visible && this.collisionMarkers.children.length > 0) {
        const pulse = 1 + Math.sin(performance.now() * 0.007) * 0.18;
        this.collisionMarkers.children.forEach((m) => {
          m.rotation.y -= 0.03;
          m.scale.setScalar(pulse);
        });
      }

      let anyMoving = false;
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
          if (orb && orb.group.visible) orb.sync(this.camera);
          if (item.meter > 0.01) anyMoving = true;
        }
      }

      const now = performance.now();
      if (anyMoving && store.settings.autoSize && !store.flashFreeze && store.viewMode === "mix" && now - this.lastLiveAnalysis > 1500) {
        this.lastLiveAnalysis = now;
        this.onLiveMixTick?.();
      }

      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }
}