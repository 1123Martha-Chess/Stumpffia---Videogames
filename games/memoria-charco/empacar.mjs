/* Empaqueta sprites/ranas.json dentro de index.html.
 *
 * Los tiles del lago son de 16x16 (32 bytes cada uno) y las ranas de 32x32
 * (128 bytes). En el JSON legible eso ocupa unos 290 y 1120 caracteres; en
 * base64 bajan a 44 y 172. El JSON sigue siendo la fuente que se edita.
 *
 * Solo se empaca el cuadro de reposo de cada rana: el de hincharse no se usa,
 * porque las ranas avisan cambiando de color, no inflándose.
 *
 * Uso:  node games/memoria-charco/empacar.mjs
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DESTINO = path.join(AQUI, "index.html");
const INICIO = "/* DATOS-INICIO */";
const FIN = "/* DATOS-FIN */";

const json = JSON.parse(fs.readFileSync(path.join(AQUI, "sprites", "ranas.json"), "utf8"));

/* Convierte filas de "0" y "1" en bits, un bit por píxel. */
function empacar(sprites, lado) {
  const bytesPorSprite = (lado * lado) / 8;
  const salida = Buffer.alloc(sprites.length * bytesPorSprite);
  sprites.forEach((filas, n) => {
    for (let y = 0; y < lado; y++) {
      const fila = filas[y] || "";
      for (let x = 0; x < lado; x++) {
        if (fila[x] !== "1") continue;
        const i = y * lado + x;
        salida[n * bytesPorSprite + (i >> 3)] |= 128 >> (i & 7);
      }
    }
  });
  return salida;
}

/* --- tiles del lago, 16x16 --- */
const nombresTile = Object.keys(json.tiles.sprites);
const bitsTile = empacar(nombresTile.map((n) => json.tiles.sprites[n]), 16);

/* --- ranas, 32x32, solo el cuadro de reposo --- */
const especies = Object.keys(json.ranas.especies);
const bitsRana = empacar(especies.map((n) => json.ranas.sprites[n + "_1"]), 32);

/* --- el tablero --- */
const mapa = json.mapa_ejemplo;
const porCodigo = {};
for (const [nombre, codigo] of Object.entries(json.tiles.codigos_mapa)) porCodigo[codigo] = nombre;

const bloque =
  `${INICIO}\n` +
  `// Generado por empacar.mjs desde sprites/ranas.json — no editar a mano.\n` +
  `const TILES = ${JSON.stringify(nombresTile)};\n` +
  `const TILES_BITS = "${bitsTile.toString("base64")}";\n` +
  `const CODIGOS = ${JSON.stringify(porCodigo)};\n` +
  `const ESPECIES = ${JSON.stringify(especies)};\n` +
  `const RANAS_BITS = "${bitsRana.toString("base64")}";\n` +
  `const MAPA = ${JSON.stringify(mapa.filas)};\n` +
  `const PUESTOS = ${JSON.stringify(mapa.ranas.map((r) => ({
     e: especies.indexOf(r.sprite), x: r.x, y: r.y })))};\n` +
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
console.log(`${nombresTile.length} tiles (${bitsTile.length} B) y ${especies.length} ranas (${bitsRana.length} B)`);
console.log(`index.html: ${(Buffer.byteLength(nuevo) / 1024).toFixed(1)} KB · servido con gzip: ${(comprimido / 1024).toFixed(1)} KB`);
