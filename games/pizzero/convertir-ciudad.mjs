/* Convierte sprites/mapa_gigante.png en las piezas de ciudad del juego.
 *
 * El dibujo son 5x4 manzanas separadas por calles de 2 casillas. Cada
 * "unidad" de 24x24 casillas lleva su calle arriba y a la izquierda más la
 * manzana de 22x22, así que la ciudad se construye repitiendo unidades.
 *
 * Saca tres cosas:
 *   - el juego de casillas distintas que aparecen en el dibujo
 *   - las 20 unidades, como índices a esas casillas
 *   - dónde está la puerta de cada casa, para poder entregar ahí
 *
 * Uso:  node games/pizzero/convertir-ciudad.mjs
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ORIGEN = path.join(AQUI, "sprites", "mapa_gigante.png");
const DESTINO = path.join(AQUI, "index.html");
const INICIO = "/* CIUDAD-INICIO */";
const FIN = "/* CIUDAD-FIN */";

const TAM = 16;        // lado de una casilla
const CALLE = 2;       // ancho de la calzada, en casillas
const MANZANA = 22;    // lado de una manzana, en casillas
const UNIDAD = CALLE + MANZANA;

/* ───────── leer el PNG ───────── */

function decodificar(buf) {
  let off = 8, idat = [], w = 0, h = 0, ct = 0;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), tipo = buf.slice(off + 4, off + 8).toString("ascii");
    const dato = buf.slice(off + 8, off + 8 + len);
    if (tipo === "IHDR") { w = dato.readUInt32BE(0); h = dato.readUInt32BE(4); ct = dato[9]; }
    if (tipo === "IDAT") idat.push(dato);
    if (tipo === "IEND") break;
    off += 12 + len;
  }
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1;
  const crudo = zlib.inflateSync(Buffer.concat(idat));
  const paso = w * ch, px = Buffer.alloc(w * h * 4);
  let previa = Buffer.alloc(paso);
  for (let y = 0; y < h; y++) {
    const filtro = crudo[y * (paso + 1)];
    const linea = Buffer.from(crudo.slice(y * (paso + 1) + 1, (y + 1) * (paso + 1)));
    for (let i = 0; i < paso; i++) {
      const a = i >= ch ? linea[i - ch] : 0, b = previa[i], c = i >= ch ? previa[i - ch] : 0;
      if (filtro === 1) linea[i] = (linea[i] + a) & 255;
      else if (filtro === 2) linea[i] = (linea[i] + b) & 255;
      else if (filtro === 3) linea[i] = (linea[i] + ((a + b) >> 1)) & 255;
      else if (filtro === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        linea[i] = (linea[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 0; x < w; x++) {
      const s = x * ch, d = (y * w + x) * 4;
      px[d] = linea[s]; px[d+1] = linea[s + (ch > 2 ? 1 : 0)]; px[d+2] = linea[s + (ch > 2 ? 2 : 0)];
    }
    previa = linea;
  }
  return { w, h, px };
}

const img = decodificar(fs.readFileSync(ORIGEN));
const claro = new Uint8Array(img.w * img.h);
for (let i = 0; i < img.w * img.h; i++) {
  const l = 0.299 * img.px[i*4] + 0.587 * img.px[i*4+1] + 0.114 * img.px[i*4+2];
  claro[i] = l > 110 ? 1 : 0;
}

const anchoCasillas = Math.floor(img.w / TAM), altoCasillas = Math.floor(img.h / TAM);
const columnas = Math.round((anchoCasillas - CALLE) / UNIDAD);
const filas = Math.round((altoCasillas - CALLE) / UNIDAD);
console.log(`dibujo: ${img.w}x${img.h} px = ${anchoCasillas}x${altoCasillas} casillas`);
console.log(`unidades: ${columnas}x${filas} de ${UNIDAD}x${UNIDAD} casillas`);

/* ───────── casillas distintas ───────── */

const casillas = [];           // cada una, 32 bytes de bits
const porFirma = new Map();

function casillaEn(tx, ty) {
  const bits = Buffer.alloc(32);
  for (let y = 0; y < TAM; y++) {
    for (let x = 0; x < TAM; x++) {
      if (!claro[(ty * TAM + y) * img.w + tx * TAM + x]) continue;
      const i = y * TAM + x;
      bits[i >> 3] |= 128 >> (i & 7);
    }
  }
  const firma = bits.toString("base64");
  if (porFirma.has(firma)) return porFirma.get(firma);
  const n = casillas.length;
  casillas.push(bits);
  porFirma.set(firma, n);
  return n;
}

/* ───────── unidades ───────── */

const unidades = [];
const casas = [];              // por unidad: columnas donde hay puerta
const cercas = [];             // cuánta cerca cruza cada manzana
let pizzeria = -1;

for (let fy = 0; fy < filas; fy++) {
  for (let fx = 0; fx < columnas; fx++) {
    const ox = fx * UNIDAD, oy = fy * UNIDAD;
    const rejilla = [];
    for (let y = 0; y < UNIDAD; y++) {
      const fila = [];
      for (let x = 0; x < UNIDAD; x++) fila.push(casillaEn(ox + x, oy + y));
      rejilla.push(fila);
    }
    unidades.push(rejilla);

    /* Las dos casas de cada manzana: en la banda donde están los tejados,
       se mide cuánto claro hay por columna y se buscan los dos montes. */
    const bandaY0 = oy + 13, bandaY1 = oy + 18;
    const densidad = [];
    for (let x = 0; x < MANZANA; x++) {
      let n = 0;
      for (let py = bandaY0 * TAM; py < bandaY1 * TAM; py++) {
        for (let px = (ox + CALLE + x) * TAM; px < (ox + CALLE + x + 1) * TAM; px++) {
          if (claro[py * img.w + px]) n++;
        }
      }
      densidad.push(n);
    }
    const tope = Math.max(...densidad) * 0.30;
    const montes = [];
    let dentro = false, desde = 0;
    densidad.forEach((v, x) => {
      if (v >= tope && !dentro) { dentro = true; desde = x; }
      if ((v < tope || x === MANZANA - 1) && dentro) {
        dentro = false;
        if (x - desde >= 3) montes.push(Math.round((desde + x - 1) / 2));
      }
    });
    casas.push(montes);

    /* La pizzería es la única manzana sin cerca cruzándola. */
    cercas.push(densidadCerca(ox, oy));
  }
}

/* Cuánto claro hay en la franja donde todas las manzanas tienen su cerca. */
function densidadCerca(ox, oy) {
  let n = 0;
  for (let py = (oy + 10) * TAM; py < (oy + 12) * TAM; py++) {
    for (let px = (ox + CALLE + 2) * TAM; px < (ox + UNIDAD - CALLE) * TAM; px++) {
      if (claro[py * img.w + px]) n++;
    }
  }
  return n;
}

pizzeria = cercas.indexOf(Math.min(...cercas));
console.log("cerca por unidad:", cercas.map((c, i) => (i === pizzeria ? "[" + c + "]" : c)).join(" "));

console.log(`casillas distintas: ${casillas.length} (${casillas.length * 32} bytes)`);
console.log(`pizzería: unidad ${pizzeria} (fila ${Math.floor(pizzeria / columnas) + 1}, columna ${pizzeria % columnas + 1})`);
console.log(`puertas por unidad: ${casas.map((c) => c.length).join(" ")}`);

/* ───────── qué se puede pisar ───────── */

/* La calzada siempre; de la manzana, solo el anillo de banqueta. Se mide
   mirando cuántas casillas claras seguidas hay desde el borde hacia dentro. */
function unosDe(n) {
  let u = 0;
  for (const b of casillas[n]) u += (b.toString(2).match(/1/g) || []).length;
  return u;
}

function grosorBanqueta(rejilla) {
  let grosor = 0;
  for (let d = 0; d < 8; d++) {
    let claras = 0, total = 0;
    for (let i = 0; i < MANZANA; i++) {
      for (const [x, y] of [[CALLE + i, CALLE + d], [CALLE + i, CALLE + MANZANA - 1 - d],
                            [CALLE + d, CALLE + i], [CALLE + MANZANA - 1 - d, CALLE + i]]) {
        total++;
        if (unosDe(rejilla[y][x]) >= 170) claras++;   // dos tercios de la casilla
      }
    }
    if (claras < total * 0.9) break;
    grosor = d + 1;
  }
  return grosor;
}
const banqueta = Math.min(...unidades.map(grosorBanqueta));
console.log(`banqueta: ${banqueta} casillas de ancho`);

/* ───────── salida ───────── */

const bits = Buffer.concat(casillas);
const bloque =
  `${INICIO}\n` +
  `// Generado por convertir-ciudad.mjs desde sprites/mapa_gigante.png — no editar a mano.\n` +
  `const CIUDAD_CALLE = ${CALLE};\n` +
  `const CIUDAD_MANZANA = ${MANZANA};\n` +
  `const CIUDAD_BANQUETA = ${banqueta};\n` +
  `const CIUDAD_PIZZERIA = ${pizzeria};\n` +
  `const CIUDAD_CASILLAS = "${bits.toString("base64")}";\n` +
  `const CIUDAD_UNIDADES = ${JSON.stringify(unidades.map((u) => u.map((f) => f.join(",")).join(";")))};\n` +
  `const CIUDAD_PUERTAS = ${JSON.stringify(casas)};\n` +
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
console.log(`index.html: ${(Buffer.byteLength(nuevo) / 1024).toFixed(1)} KB · servido con gzip: ${(comprimido / 1024).toFixed(1)} KB`);
