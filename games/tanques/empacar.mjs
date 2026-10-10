/* Empaqueta los sprites de sprites/*.json dentro de index.html.
 *
 * Cada sprite de 16x16 son 256 bits = 32 bytes. En el JSON legible eso ocupa
 * unos 290 caracteres; empaquetado en base64 ocupa 44. Los JSON siguen siendo
 * la fuente que se edita a mano: esto solo los comprime para publicar.
 *
 * Uso:  node games/tanques/empacar.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DESTINO = path.join(AQUI, "index.html");

const INICIO = "/* SPRITES-INICIO */";
const FIN = "/* SPRITES-FIN */";

/* Recorre un objeto de sprites y devuelve [nombre, filas] en orden. */
function recolectar(obj, prefijo, salida) {
  for (const clave of Object.keys(obj)) {
    const valor = obj[clave];
    const nombre = prefijo ? `${prefijo}_${clave}` : clave;
    if (Array.isArray(valor)) salida.push([nombre, valor]);
    else if (valor && typeof valor === "object") recolectar(valor, nombre, salida);
  }
  return salida;
}

const sprites = [];
for (const archivo of ["tanque", "mapa", "objetos"]) {
  const json = JSON.parse(fs.readFileSync(path.join(AQUI, "sprites", `${archivo}.json`), "utf8"));
  recolectar(json.sprites, archivo === "mapa" ? "" : archivo, sprites);
}

/* Las filas de "0" y "1" se vuelven bits, 32 bytes por sprite. */
const bytes = Buffer.alloc(sprites.length * 32);
sprites.forEach(([, filas], n) => {
  for (let y = 0; y < 16; y++) {
    const fila = filas[y] || "";
    for (let x = 0; x < 16; x++) {
      if (fila[x] === "1") {
        const i = y * 16 + x;
        bytes[n * 32 + (i >> 3)] |= 128 >> (i & 7);
      }
    }
  }
});

const nombres = sprites.map(([n]) => n);
const bloque =
  `${INICIO}\n` +
  `// Generado por empacar.mjs desde sprites/*.json — no editar a mano.\n` +
  `const NOMBRES = ${JSON.stringify(nombres)};\n` +
  `const BITS = "${bytes.toString("base64")}";\n` +
  `${FIN}`;

const html = fs.readFileSync(DESTINO, "utf8");
const desde = html.indexOf(INICIO);
const hasta = html.indexOf(FIN);
if (desde === -1 || hasta === -1) {
  console.error(`No encontré las marcas ${INICIO} / ${FIN} en index.html`);
  process.exit(1);
}

const nuevo = html.slice(0, desde) + bloque + html.slice(hasta + FIN.length);
fs.writeFileSync(DESTINO, nuevo);

const peso = Buffer.byteLength(nuevo);
const comprimido = zlib.gzipSync(Buffer.from(nuevo)).length;
console.log(`${sprites.length} sprites empacados (${bytes.length} bytes de pixeles)`);
console.log(`index.html: ${(peso / 1024).toFixed(1)} KB · servido con gzip: ${(comprimido / 1024).toFixed(1)} KB`);
