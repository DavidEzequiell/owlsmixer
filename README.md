# 🦉 Owls 3D Mixer (`v0.0.7`)

Mezclador visual 3D en tiempo real para **Ableton Live** basado en los principios de *The Art of Mixing* de David Gibson. Corre en el navegador vía **AbletonJS** y sincroniza bidireccionalmente paneo, volumen, envíos, EQ, colores, nombres y transporte con tu sesión de Live.

---

## ✨ Novedades principales en `v0.0.7`

- **Sistema de Ventanas Modulares (`🪟 Ventanas ▾`):** *Espacio & LUFS*, *Return A · Reverb 3D*, *Escenas / Timeline* y *Presets* ahora son ventanas flotantes arrastrables e independientes con posición y visibilidad guardadas automáticamente. También podés ocultar *Grupos* o *Inspector* en la sidebar.
- **HUD superior en 1 línea y Dock compacto (`👁 Capas ▾`):** Skins movidos a `⚙ Opciones`; capas visuales agrupadas en un menú desplegable que incluye toggles nuevos para apagar **Sombras en el piso** y **Líneas y aros guía**.
- **Eje Y inteligente con Tilt EQ real:** Si la pista tiene **EQ Eight**, mover el Eje Y (slider o `Shift + Arrastrar`) aplica un **Tilt EQ tonal real en vivo** en Ableton (Low-Shelf 220 Hz + High-Shelf 3.5 kHz). Si no hay EQ Eight, queda en **solo lectura** con aviso y badge `EQ` en la lista de pistas.
- **DRY neutro real + Preset `Default / Neutro`:** `DRY` lleva temporalmente las pistas al estado inicial de Ableton (`Pan C · 0.0 dB · Reverb 0% · EQ OFF`) y restaura exacto al volver; también disponible como preset permanente con `Ctrl+Z`.
- **Color por clic derecho & Doble clic estilo Ableton:** Clic derecho sobre el punto de color de cualquier pista abre el selector sincronizado con Ableton. Doble clic en cualquier slider lo devuelve a su valor neutro (`C`, `0.0 dB`, `0%`, `1.00x`).
- **5 Skins completos:** *Gibson Dark*, *Art of Mixing '97 (Win98/SGI)*, *Winamp 2.91 Classic*, *Ableton Live 12 (Dark)* y nuevo **Macintosh Classic (System 7 / OS 8)**.
- **Crash / Error Recovery Handler:** Captura global de errores de carga, escaneo, JSON o WebGL con botones de reintentar, resetear preferencias y copiar log.

---

## 🎛️ Funcionalidades clave

- **Escenario 3D calibrado (X / Y / Z):**
  - **X:** Paneo (`L ↔ R`).
  - **Y:** Frecuencia (`20 Hz – 20 kHz`) con Tilt EQ en vivo sobre EQ Eight.
  - **Z:** 3 modos conmutables — *Gibson* (6 niveles logarítmicos en dB), *True Depth* (Volumen + Reverb inverso + Aire High-Shelf) y *Espacial* (Send A).
- **EQ Window 3D (`E`) & Quick EQ:** Edición visual de las 7 franjas de Gibson directamente sobre Ableton EQ Eight + recetas base por rol.
- **Motor Psicoacústico (Espacio, LUFS & Carve):** Medidor Short-Term LUFS del Master, ocupación real de la caja 3D, detección de enmascaramiento (*Solar Eclipse* en escala Bark) y botón **✂ Priorizar** para recortar automáticamente el choque en EQ Eight.
- **Bancos `A / B / C / D`, Escenas / Timeline y Snapshots `.json`:** Guardá hasta 4 mezclas, automatizá cambios por compás/Locators de Ableton y exportá o cargá sesiones completas.
- **Auto-Size & ⚡ Flash:** Escala dinámica por Crest Factor + recortes `<300 Hz`, con congelado instantáneo para posicionar con precisión.

---

## 🚀 Instalación rápida (AbletonJS)

1. Instalá y activá el Remote Script **AbletonJS** en Ableton Live (`Preferencias → Link, Tempo & MIDI`).
2. Copiá esta carpeta dentro de `AbletonJS/static/owlsmixer/`.
3. Abrí tu proyecto en Ableton Live y entrá desde el navegador a la URL local servida por AbletonJS (ej. `http://localhost:9001/owlsmixer/`).
4. *(Opcional)* Si querés usar las referencias de página de los Presets, colocá tu PDF en `owlsmixer/assets/art_of_mixing.pdf`.

---

## 🗺️ Rumbo a `v0.1.0`

- Tutorial interactivo paso a paso + diagrama visual en *Instrucciones*.
- Más adapters de EQ y dinámica (*FabFilter Pro-Q*, *EQ Three*, *Compressor Sidechain*).
- Buscador de pistas y autoguardado por sesión.
- Modo Demo / Sandbox sin Ableton para probar en el navegador.
- Selector de calidad gráfica (*Rendimiento* vs *Studio Ultra*).