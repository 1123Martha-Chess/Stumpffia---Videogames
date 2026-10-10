/* Empaqueta los sprites de sprites/*.md dentro de index.html.
 *
 * Los .md traen los sprites como rejillas de 16x16 puestas lado a lado:
 * cada carácter es un píxel, 0 azul marino y 1 azul claro. Aquí se leen,
 * se vuelven bits (32 bytes por sprite) y se meten en el juego en base64.
 *
 * Los sprites "estacionada/estacionado" no se empacan: en esta versión el
 * pizzero va siempre montado en lo que tenga desbloqueado, así que no hay
 * vehículos aparcados que dibujar.
 *
 * Uso:  node games/pizzero/empacar.mjs
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DESTINO = path.join(AQUI, "index.html");
const INICIO = "/* SPRITES-INICIO */";
const FIN = "/* SPRITES-FIN */";

/* ───────── leer un .md de sprites ───────── */

function leer(archivo) {
  const texto = fs.readFileSync(path.join(AQUI, "sprites", archivo), "utf8");
  const lineas = texto.split(/\r?\n/);
  const salida = [];

  let seccion = null, nombres = null, dentro = false, filas = [];

  for (const linea of lineas) {
    const cabecera = /^###\s+(\S+)/.exec(linea);
    if (cabecera) { seccion = cabecera[1]; nombres = null; continue; }

    if (!dentro && seccion && linea.includes("`") && linea.includes("lado a lado")) {
      nombres = [...linea.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      continue;
    }

    if (linea.trim() === "```") {
      if (dentro) {                       // se cierra el bloque: volcarlo
        if (nombres && filas.length === 16) {
          nombres.forEach((nombre, n) => {
            const prefijo = seccion.split("_").slice(0, -1).join("_");
            const completo = nombre.startsWith(prefijo) ? nombre : prefijo + "_" + nombre;
            salida.push([completo, filas.map((grupos) => grupos[n])]);
          });
        }
        dentro = false; filas = []; nombres = null;
      } else if (nombres) {
        dentro = true;
      }
      continue;
    }

    if (dentro) {
      const grupos = linea.trim().split(/\s+/).filter((g) => /^[01]{16}$/.test(g));
      if (grupos.length) filas.push(grupos);
    }
  }
  return salida;
}

const todos = [...leer("pizzero.md"), ...leer("vehiculos.md")]
  .filter(([n]) => !/estacionad/.test(n));

/* ───────── comprobaciones ───────── */

const esperados = [];
for (const carga of ["sin_pizza", "con_pizza"]) {
  for (const dir of ["abajo", "arriba", "izquierda", "derecha"]) {
    for (const paso of ["quieto", "paso_1", "paso_2"]) esperados.push(`${carga}_${dir}_${paso}`);
  }
}
for (const veh of ["moto", "auto"]) {
  for (const dir of ["abajo", "arriba", "izquierda", "derecha"]) {
    for (const paso of ["quieta", "quieto", "mov_1", "mov_2"]) {
      esperados.push(`${veh}_${dir}_con_pizzero_${paso}`);
    }
  }
}

const hay = new Set(todos.map(([n]) => n));
const faltan = esperados.filter((n) => !hay.has(n));
/* "quieta" para la moto y "quieto" para el auto: solo debe faltar uno de cada par */
const faltanDeVerdad = faltan.filter((n) => {
  const pareja = n.replace(/_quiet[ao]$/, (m) => (m === "_quieta" ? "_quieto" : "_quieta"));
  return !hay.has(pareja);
});

if (faltanDeVerdad.length) {
  console.error("Faltan sprites en los .md:\n  " + faltanDeVerdad.join("\n  "));
  process.exit(1);
}

/* ───────── empacar ───────── */

const bytes = Buffer.alloc(todos.length * 32);
todos.forEach(([, filas], n) => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (filas[y][x] !== "1") continue;
      const i = y * 16 + x;
      bytes[n * 32 + (i >> 3)] |= 128 >> (i & 7);
    }
  }
});

const bloque =
  `${INICIO}\n` +
  `// Generado por empacar.mjs desde sprites/*.md — no editar a mano.\n` +
  `const NOMBRES = ${JSON.stringify(todos.map(([n]) => n))};\n` +
  `const BITS = "${bytes.toString("base64")}";\n` +
  `${FIN}`;

const html = fs.readFileSync(DESTINO, "utf8");
const desde = html.indexOf(INICIO), hasta = html.indexOf(FIN);
if (desde === -1 || hasta === -1) {
  console.error(`No encontré las marcas ${INICIO} / ${FIN} en index.html`);
  process.exit(1);
}
const nuevo = html.slice(0, desde) + bloque + html.slice(hasta + FIN.length);
fs.writeFileSync(DESTINO, nuevo);

const comprimido = zlib.gzipSync(Buffer.from(nuevo)).length;
console.log(`${todos.length} sprites empacados (${bytes.length} bytes de píxeles)`);
console.log(`index.html: ${(Buffer.byteLength(nuevo) / 1024).toFixed(1)} KB · servido con gzip: ${(comprimido / 1024).toFixed(1)} KB`);
