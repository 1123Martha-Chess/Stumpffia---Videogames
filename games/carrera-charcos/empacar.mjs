/* Mete los sprites de sprites/*.json dentro de index.html.
 *
 * Aquí los dibujos no son todos del mismo tamaño (32x24, 16x12, 8x6, 4x4...),
 * así que además de los bits se guardan las medidas. Cada dibujo empieza en un
 * byte nuevo para poder recortarlo sin cuentas raras.
 *
 * Antes de esto hay que correr convertir-md.mjs, que es quien lee los .md.
 *
 * Uso:  node games/carrera-charcos/empacar.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DESTINO = path.join(AQUI, "index.html");
const json = (n) => JSON.parse(fs.readFileSync(path.join(AQUI, "sprites", n + ".json"), "utf8"));

const veh = json("vehiculos_3d");
const esc = json("escenario_3d");
const mapa = json("mapa");
const ico = json("iconos_mapa");

/* ───────────────── Los dibujos, en orden ───────────────── */

const sprites = [];
const meter = (nombre, filas) => sprites.push([nombre, filas]);

for (const [vehiculo, variantes] of Object.entries(veh.sprites)) {
  for (const [variante, filas] of Object.entries(variantes)) meter(`veh_${vehiculo}_${variante}`, filas);
}
for (const [n, filas] of Object.entries(esc.texturas_4x4)) meter(`tex_${n}`, filas);
for (const [n, filas] of Object.entries(esc.fondo)) meter(`fondo_${n}`, filas);
for (const [n, filas] of Object.entries(esc.decoracion)) meter(`deco_${n}`, filas);
for (const [n, filas] of Object.entries(mapa.tiles)) meter(`tile_${n}`, filas);
for (const [vehiculo, dirs] of Object.entries(ico.sprites)) {
  for (const [dir, filas] of Object.entries(dirs)) meter(`ico_${vehiculo}_${dir}`, filas);
}

/* ───────────────── Bits ───────────────── */

const trozos = [];
const medidas = [];
let pixeles = 0;

for (const [nombre, filas] of sprites) {
  const alto = filas.length, ancho = filas[0].length;
  for (const f of filas) {
    if (f.length !== ancho) throw new Error(`"${nombre}": filas de distinto largo`);
  }
  const bytes = Buffer.alloc(Math.ceil((ancho * alto) / 8));
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (filas[y][x] === "1") {
        const i = y * ancho + x;
        bytes[i >> 3] |= 128 >> (i & 7);
      }
    }
  }
  medidas.push(ancho, alto);
  trozos.push(bytes);
  pixeles += ancho * alto;
}

const bits = Buffer.concat(trozos);

/* ───────────────── La pista ─────────────────
   El dibujo del mapa y el orden de los tiles viajan tal cual: son 40 pasos,
   no llega ni a medio kilobyte. */

const ruta = mapa.recorrido.map((r) => `${r.tile[0]},${r.tile[1]},${r.dir}`).join(";");

/* ───────────────── A index.html ───────────────── */

function reemplazar(html, inicio, fin, bloque) {
  const desde = html.indexOf(inicio), hasta = html.indexOf(fin);
  if (desde === -1 || hasta === -1) throw new Error(`no encontré las marcas ${inicio} / ${fin} en index.html`);
  return html.slice(0, desde) + inicio + "\n" + bloque + "\n" + fin + html.slice(hasta + fin.length);
}

let html = fs.readFileSync(DESTINO, "utf8");

html = reemplazar(html, "/* SPRITES-INICIO */", "/* SPRITES-FIN */",
  "// Generado por empacar.mjs desde sprites/*.json — no editar a mano.\n" +
  `const NOMBRES = ${JSON.stringify(sprites.map(([n]) => n))};\n` +
  `const MEDIDAS = ${JSON.stringify(medidas)};\n` +
  `const BITS = "${bits.toString("base64")}";`);

html = reemplazar(html, "/* PISTA-INICIO */", "/* PISTA-FIN */",
  "// Generado por empacar.mjs desde sprites/mapa.json — no editar a mano.\n" +
  `const LEYENDA = ${JSON.stringify(mapa.leyenda)};\n` +
  `const DIBUJO_MAPA = ${JSON.stringify(mapa.mapa)};\n` +
  `const RUTA = "${ruta}";`);

fs.writeFileSync(DESTINO, html);

const peso = Buffer.byteLength(html);
console.log(`${sprites.length} dibujos empacados · ${pixeles} píxeles en ${bits.length} bytes`);
console.log(`index.html: ${(peso / 1024).toFixed(1)} KB · servido con gzip: ${(zlib.gzipSync(Buffer.from(html)).length / 1024).toFixed(1)} KB`);
