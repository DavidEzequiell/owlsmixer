# 🦉 Owls 3D Mixer (`v0.0.8`)

Mezclador visual 3D en tiempo real para **Ableton Live** basado en *The Art of Mixing* y el *Virtual Mixer Concept* de David Gibson. Corre localmente vía **AbletonJS** o directamente en el navegador en **Modo Demo / Sandbox** (compatible con GitHub Pages).


---

## ✨ Novedades en `v0.0.8`

- **Motor psicoacústico calibrado:**
  - **K-Weighting exacto (ITU-R BS.1770-4)** por respuesta analítica de biquads en cascada.
  - **Enmascaramiento direccional asimétrico (Terhardt / BS.1387 + ERB de Glasberg & Moore):** distingue quién enmascara a quién (`→` / `↔`), calcula desenmascaramiento binaural (BMLD) por paneo y pérdida de separación por reverb (DRR).
  - **Alertas de compatibilidad mono (`<150 Hz` fuera de centro)**, balance espectral en 4 bandas y `computeCarvePlan()` calibrado con ERB.
- **Presets recalibrados a mezcla real + Sincronización rápida:**
  - Presets calibrados alrededor de **Unity Gain (`0 dB`)** para conservar pegada y audibilidad en pistas reales e instrumentos virtuales.
  - Cambios de **Bancos A/B/C/D**, **DRY** y **Presets** acelerados con pool paralelo, diff mínimo en EQ, auto-pausa inteligente en operaciones pesadas y spinner con progreso.
- **Buscador de pistas (`Ctrl+F`) + Autoguardado por sesión:**
  - Filtro instantáneo por nombre, rol o grupo + chips (**Todas · EQ · Activas**).
  - Autoguardado automático en `localStorage` por huella de proyecto (conserva roles, alturas Y, formas, bloqueos, grupos virtuales, bancos y escenas sin pisar los faders de Ableton).
- **Calidad gráfica 3D + Saneo WebGL:**
  - Perfiles en vivo (**Rendimiento 30 FPS**, **Balanceado**, **Studio Ultra**) con geometrías compartidas, pausa de render en pestaña oculta y limpieza de recursos GPU.
  - `Auto-Size` movido a `⚙ Opciones` para despejar el Dock inferior.
- **Modo Demo / Sandbox + Pantalla de Inicio + Bienvenida:**
  - Proyecto de prueba interactivo (12 pistas + 2 buses, medidores reactivos a 112 BPM, EQ Eight pre-bindeado, Master LUFS y Escenas) sin necesitar Ableton Live abierto.
  - Pantalla inicial homenaje a *The Art of Mixing* (soporta imagen local opcional en `assets/david_gibson.jpg` con fallback SVG 3D), guía de bienvenida en 3 pasos y diagrama SVG técnico de ejes en *Instrucciones*.
- **Nuevos adapters de EQ y Dinámica:**
  - Soporte para **Ableton EQ Eight**, **FabFilter Pro-Q 3/4** y **Ableton EQ Three** (incluyendo Tilt EQ en Eje Y).
  - Detección de **Compressor** (con badge **SC** cuando hay Sidechain activo), **Glue Compressor**, **FabFilter Pro-C**, **Multiband Dynamics** y **Limiter**.

---

## 🎛️ Funcionalidades clave

- **Escenario 3D calibrado (X / Y / Z):**
  - **X:** Paneo (`L ↔ R`).
  - **Y:** Frecuencia (`20 Hz – 20 kHz`) con Tilt EQ en vivo.
  - **Z:** 3 modos — *Gibson* (6 niveles logarítmicos en dB), *True Depth* y *Espacial* (Send A).
- **EQ Window 3D (`E`) & Quick EQ:** Edición visual de bandas directamente sobre Ableton + recetas base por rol.
- **Ventanas modulares (`🪟 Ventanas ▾`):** *Espacio & LUFS*, *Return A · Reverb 3D*, *Escenas / Timeline* y *Presets* flotantes con posición guardada.
- **5 Skins completos:** *Gibson Dark*, *Art of Mixing '97 (Win98/SGI)*, *Winamp 2.91 Classic*, *Ableton Live 12 (Dark)* y *Macintosh Classic*.

---

## 🚀 Uso rápido

### Con Ableton Live (local vía AbletonJS)
1. Activá el Remote Script **AbletonJS** en Ableton Live (`Preferencias → Link, Tempo & MIDI`).
2. Copiá esta carpeta dentro de `AbletonJS/static/owlsmixer/`.
3. Abrí tu proyecto en Live y entrá desde el navegador a la URL local servida por AbletonJS (ej. `http://localhost:9001/owlsmixer/`).
4. *(Opcional)* Colocá tu PDF en `assets/art_of_mixing.pdf` y/o una imagen de portada en `assets/david_gibson.jpg`.

### Modo Demo / Web (GitHub Pages o sin Ableton)
- Abrí `index.html` desde un servidor estático o GitHub Pages y elegí **Entrar en Modo Demo** (o agregá `?demo=1` a la URL).

---

## 🗺️ Roadmap

### `v0.0.9` — Precisión real, estabilidad y pulido funcional
- Calibración exacta de la curva `output_meter` de Ableton Live vs. medidor LUFS de referencia.
- Auditoría completa bidireccional de `Eje Z: True Depth` (nivel + DRR).
- Presets en modo **Relativo** (conservar volumen promedio del proyecto).
- QA de bordes en `Undo/Redo`, `A/B/C/D`, `DRY`, `EQ Window` y `Autoguardado`.
- Compactación de `styles.css` y QA visual en los 5 skins.

### `v0.1.0` — Vista Macro/Micro y Audio Web
- Modo **Micro | Macro** con nubes envolventes 3D por grupo para *Top-Down Mixing*.
- Modo Demo con audio real en el navegador vía **Web Audio API**.
- Despliegue oficial en GitHub Pages con conexión opcional a bridge local.