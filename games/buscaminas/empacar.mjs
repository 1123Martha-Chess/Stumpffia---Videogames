/* Mete sprites/campo.json dentro de index.html.
 *
 * Aquí no se empaquetan a bits como en los otros juegos: los dibujos tienen
 * tres estados (marino, claro y transparente), y además hace falta poder
 * retocarlos leyéndolos. Son 15 sprites de 16x16, unos 4 KB de texto muy
 * repetido que el gzip del servidor deja en nada.
 *
 * Uso:  node games/buscaminas/empacar.mjs
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DESTINO = path.join(AQUI, "index.html");
const INICIO = "/* DATOS-INICIO */";
const FIN = "/* DATOS-FIN */";

/* El orden manda: así se colocan en la hoja de sprites. */
const ORDEN = ["cerrado", "abierto",
  "num_1", "num_2", "num_3", "num_4", "num_5", "num_6", "num_7", "num_8",
  "bandera", "mina", "pala", "seleccionado", "marco_cursor"];

const json = JSON.parse(fs.readFileSync(path.join(AQUI, "sprites", "campo.json"), "utf8"));
const LADO = json.ancho;

let dibujos = "{\n";
ORDEN.forEach((nombre, i) => {
  const filas = json.sprites[nombre];
  if (!filas) { console.error(`Falta el sprite "${nombre}" en campo.json`); process.exit(1); }
  if (filas.length !== LADO || filas.some((f) => f.length !== LADO)) {
    console.error(`El sprite "${nombre}" no es de ${LADO}x${LADO}`); process.exit(1);
  }
  const malas = filas.join("").replace(/[01.]/g, "");
  if (malas) { console.error(`El sprite "${nombre}" tiene signos raros: ${malas}`); process.exit(1); }
  dibujos += `  ${nombre}: [\n`;
  for (let k = 0; k < LADO; k += 4) {
    dibujos += "    " + filas.slice(k, k + 4).map((f) => JSON.stringify(f)).join(",") +
               (k + 4 < LADO ? "," : "") + "\n";
  }
  dibujos += `  ]${i < ORDEN.length - 1 ? "," : ""}\n`;
});
dibujos += "}";

const bloque = `${INICIO}\n` +
  `/* Generado por empacar.mjs desde sprites/campo.json — no editar a mano. */\n` +
  `const DIBUJOS = ${dibujos};\n` +
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
console.log(`${ORDEN.length} sprites de ${LADO}x${LADO}`);
console.log(`index.html: ${(Buffer.byteLength(nuevo) / 1024).toFixed(1)} KB · servido con gzip: ${(comprimido / 1024).toFixed(1)} KB`);
