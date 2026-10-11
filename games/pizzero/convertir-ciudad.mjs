/* Descompone sprites/mapa_gigante.png en piezas sueltas de ciudad.
 *
 * Antes se copiaban manzanas enteras de 22x22 tal cual. Ahora las manzanas
 * son de cualquier tamaño, así que hace falta el material por separado:
 * banqueta, asfalto, pasto, árboles, cerca, casas y la pizzería. Todo sale
 * del dibujo, nada está inventado.
 *
 * El dibujo tiene 5x4 manzanas de 22x22 casillas separadas por calzada de 2,
 * y dentro de cada manzana:
 *     filas  0- 1  banqueta (anillo)
 *     filas  2- 7  pasto con árboles y arbustos
 *     filas  8- 9  cerca
 *     filas 10-15  dos casas, en las columnas 2-7 y 10-15
 *     filas 16-19  patio delantero de cada casa
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

const TAM = 16, CALZADA = 2, MANZANA = 22, UNIDAD = CALZADA + MANZANA;
const BANQUETA_DIBUJO = 2;        // lo que mide el anillo en el dibujo

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

const columnas = Math.round((Math.floor(img.w / TAM) - CALZADA) / UNIDAD);
const filas = Math.round((Math.floor(img.h / TAM) - CALZADA) / UNIDAD);
console.log(`dibujo: ${img.w}x${img.h} px · ${columnas}x${filas} manzanas de ${MANZANA}x${MANZANA}`);

/* ───────── casillas ───────── */

const piezas = [];               // 32 bytes cada una
const porFirma = new Map();

function bitsDe(tx, ty) {
  const b = Buffer.alloc(32);
  for (let y = 0; y < TAM; y++) {
    for (let x = 0; x < TAM; x++) {
      if (!claro[(ty * TAM + y) * img.w + tx * TAM + x]) continue;
      const i = y * TAM + x;
      b[i >> 3] |= 128 >> (i & 7);
    }
  }
  return b;
}

function registrar(bits) {
  const firma = bits.toString("base64");
  if (porFirma.has(firma)) return porFirma.get(firma);
  const n = piezas.length;
  piezas.push(bits);
  porFirma.set(firma, n);
  return n;
}

function casilla(tx, ty) { return registrar(bitsDe(tx, ty)); }
function unosDe(bits) { let u = 0; for (const b of bits) u += (b.toString(2).match(/1/g) || []).length; return u; }

/* coordenadas de casilla dentro de una manzana concreta */
const enManzana = (fx, fy, bx, by) =>
  [fx * UNIDAD + CALZADA + bx, fy * UNIDAD + CALZADA + by];
const enCalzada = (fx, fy, cx, cy) => [fx * UNIDAD + cx, fy * UNIDAD + cy];

/* ───────── dónde está la pizzería ───────── */

/* Es la única manzana sin cerca cruzándola. Hay que saberlo antes de
   recoger casas: si no, su local acaba repartido por la ciudad como si
   fuera una vivienda más. */
let pizzeriaFx = 0, pizzeriaFy = 0, menosCerca = Infinity;
for (let fy = 0; fy < filas; fy++) {
  for (let fx = 0; fx < columnas; fx++) {
    let n = 0;
    for (let bx = 2; bx < MANZANA - 2; bx++) {
      for (const by of [8, 9]) n += unosDe(bitsDe(...enManzana(fx, fy, bx, by)));
    }
    if (n < menosCerca) { menosCerca = n; pizzeriaFx = fx; pizzeriaFy = fy; }
  }
}

/* ───────── banqueta ───────── */

/* El anillo es un empedrado que se repite, así que con una casilla basta. */
const BANQUETA = casilla(...enManzana(0, 0, 8, 0));

/* ───────── calzada ───────── */

/* La raya de carril queda partida entre dos casillas del dibujo, porque cae
   justo en la frontera. Para una calzada de ancho impar hace falta una
   casilla con la raya centrada, así que se compone a mano. */
function mitades(aBits, bBits, vertical) {
  const salida = Buffer.alloc(32);
  for (let y = 0; y < TAM; y++) {
    for (let x = 0; x < TAM; x++) {
      const i = y * TAM + x;
      let encendido;
      if (vertical) {
        encendido = x < TAM / 2
          ? (bBits[(y * TAM + x + TAM / 2) >> 3] >> (7 - ((y * TAM + x + TAM / 2) & 7))) & 1
          : (aBits[(y * TAM + x - TAM / 2) >> 3] >> (7 - ((y * TAM + x - TAM / 2) & 7))) & 1;
      } else {
        const j = y < TAM / 2 ? (y + TAM / 2) * TAM + x : (y - TAM / 2) * TAM + x;
        const fuente = y < TAM / 2 ? bBits : aBits;
        encendido = (fuente[j >> 3] >> (7 - (j & 7))) & 1;
      }
      if (encendido) salida[i >> 3] |= 128 >> (i & 7);
    }
  }
  return salida;
}

/* busca una casilla de calzada lisa y las dos mitades de la raya */
let CALLE = -1, RAYA_V = -1, RAYA_H = -1;
{
  const vIzq = bitsDe(...enCalzada(1, 1, 0, 8));   // mitad izquierda de la raya vertical
  const vDer = bitsDe(...enCalzada(1, 1, 1, 8));
  const hArr = bitsDe(...enCalzada(1, 1, 8, 0));
  const hAba = bitsDe(...enCalzada(1, 1, 8, 1));
  RAYA_V = registrar(mitades(vIzq, vDer, true));
  RAYA_H = registrar(mitades(hArr, hAba, false));

  for (let y = 2; y < UNIDAD && CALLE === -1; y++) {
    const b = bitsDe(...enCalzada(1, 1, 0, y));
    if (unosDe(b) === 0) CALLE = registrar(b);
  }
  if (CALLE === -1) CALLE = registrar(Buffer.alloc(32));
}

/* ───────── pasto, árboles y cerca ───────── */

const pasto = new Set(), cerca = new Set();

for (let fy = 0; fy < filas; fy++) {
  for (let fx = 0; fx < columnas; fx++) {
    /* franja de pasto: filas 2 a 7 de la manzana */
    for (let by = 2; by <= 7; by++) {
      for (let bx = 2; bx < MANZANA - 2; bx++) {
        const b = bitsDe(...enManzana(fx, fy, bx, by));
        if (unosDe(b) <= 14) pasto.add(registrar(b));
      }
    }
    if (fx === pizzeriaFx && fy === pizzeriaFy) continue;
    /* cerca: filas 8 y 9 */
    for (let bx = 2; bx < MANZANA - 2; bx++) {
      for (const by of [8, 9]) {
        const b = bitsDe(...enManzana(fx, fy, bx, by));
        if (unosDe(b) > 14) cerca.add(registrar(b));
      }
    }
  }
}

/* Árboles, arbustos y flores ENTEROS. Antes se recortaban trozos de 2x2
   a ciegas y salían medio cortados; ahora se busca cada mancha conectada
   de dibujo y se toma su caja completa. */
const arboles = [];
const vistosArbol = new Set();

for (let fy = 0; fy < filas; fy++) {
  for (let fx = 0; fx < columnas; fx++) {
    const px0 = (fx * UNIDAD + CALZADA + 2) * TAM, px1 = (fx * UNIDAD + CALZADA + MANZANA - 2) * TAM;
    const py0 = (fy * UNIDAD + CALZADA + 2) * TAM, py1 = (fy * UNIDAD + CALZADA + 8) * TAM;
    const visto = new Set();

    for (let y = py0; y < py1; y++) {
      for (let x = px0; x < px1; x++) {
        const i = y * img.w + x;
        if (!claro[i] || visto.has(i)) continue;
        const cola = [i]; visto.add(i);
        let minX = x, maxX = x, minY = y, maxY = y, n = 0;
        while (cola.length) {
          const p = cola.pop(); n++;
          const qx = p % img.w, qy = (p / img.w) | 0;
          if (qx < minX) minX = qx;
          if (qx > maxX) maxX = qx;
          if (qy < minY) minY = qy;
          if (qy > maxY) maxY = qy;
          for (const d of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
            const nx = qx + d[0], ny = qy + d[1];
            if (nx < px0 || ny < py0 || nx >= px1 || ny >= py1) continue;
            const q = ny * img.w + nx;
            if (claro[q] && !visto.has(q)) { visto.add(q); cola.push(q); }
          }
        }
        if (n < 25) continue;                    // un punto suelto de pasto

        /* la caja, ajustada a casillas enteras */
        const tx0 = Math.floor(minX / TAM), ty0 = Math.floor(minY / TAM);
        const tx1 = Math.floor(maxX / TAM), ty1 = Math.floor(maxY / TAM);
        const w = tx1 - tx0 + 1, h = ty1 - ty0 + 1;
        if (w > 4 || h > 4) continue;            // eso ya no es un arbolito

        const sello = [];
        for (let ty = ty0; ty <= ty1; ty++) {
          for (let tx = tx0; tx <= tx1; tx++) sello.push(casilla(tx, ty));
        }
        const firma = w + "x" + h + ":" + sello.join(",");
        if (vistosArbol.has(firma)) continue;
        vistosArbol.add(firma);
        arboles.push({ w: w, h: h, t: sello });
      }
    }
  }
}

/* ───────── casas ───────── */

/* Cada casa son 6x6 casillas (filas 10-15) más su patio de 4 filas. */
const ALTO_CASA = 10, ANCHO_CASA = 6;
const casas = [];
const vistasCasa = new Set();

for (let fy = 0; fy < filas; fy++) {
  for (let fx = 0; fx < columnas; fx++) {
    if (fx === pizzeriaFx && fy === pizzeriaFy) continue;   // el local no es una casa
    for (const bx of [2, 10]) {
      const sello = [];
      let total = 0;
      for (let dy = 0; dy < ALTO_CASA; dy++) {
        for (let dx = 0; dx < ANCHO_CASA; dx++) {
          const b = bitsDe(...enManzana(fx, fy, bx + dx, 10 + dy));
          total += unosDe(b);
          sello.push(registrar(b));
        }
      }
      if (total < 600) continue;                 // ahí no había casa
      const firma = sello.join(",");
      if (vistasCasa.has(firma)) continue;
      vistasCasa.add(firma);
      /* Qué casillas estorban de verdad: las del cuerpo que tienen dibujo.
         Una casilla vacía del sello no puede tener caja de choque. */
      const macizo = sello.map(function (n, k) {
        return (k < 6 * ANCHO_CASA && unosDe(piezas[n]) >= 30) ? 1 : 0;
      });
      casas.push({ t: sello, m: macizo });
    }
  }
}

/* ───────── el local de la pizzería ───────── */

const ANCHO_PIZZERIA = 10;
const pizzeria = [];
for (let dy = 0; dy < ALTO_CASA; dy++) {
  for (let dx = 0; dx < ANCHO_PIZZERIA; dx++) {
    pizzeria.push(casilla(...enManzana(pizzeriaFx, pizzeriaFy, 2 + dx, 10 + dy)));
  }
}
const pizzeriaMacizo = pizzeria.map(function (n, k) {
  return (k < 6 * ANCHO_PIZZERIA && unosDe(piezas[n]) >= 30) ? 1 : 0;
});

console.log(`piezas distintas: ${piezas.length} (${piezas.length * 32} bytes)`);
console.log(`pasto: ${pasto.size} · cerca: ${cerca.size} · adornos: ${arboles.length} · casas: ${casas.length}`);
console.log('tamaños de adorno: ' + [...new Set(arboles.map(a => a.w + 'x' + a.h))].join(' '));
console.log(`pizzería: manzana ${pizzeriaFx + 1},${pizzeriaFy + 1}`);

/* ───────── salida ───────── */

const bits = Buffer.concat(piezas);
const bloque =
  `${INICIO}\n` +
  `// Generado por convertir-ciudad.mjs desde sprites/mapa_gigante.png — no editar a mano.\n` +
  `const P_BITS = "${bits.toString("base64")}";\n` +
  `const P_BANQUETA = ${BANQUETA};\n` +
  `const P_CALLE = ${CALLE};\n` +
  `const P_RAYA_V = ${RAYA_V};\n` +
  `const P_RAYA_H = ${RAYA_H};\n` +
  `const P_PASTO = ${JSON.stringify([...pasto])};\n` +
  `const P_CERCA = ${JSON.stringify([...cerca])};\n` +
  `const P_ARBOLES = ${JSON.stringify(arboles)};\n` +
  `const P_CASA_ANCHO = ${ANCHO_CASA};\n` +
  `const P_CASA_ALTO = ${ALTO_CASA};\n` +
  `const P_CASAS = ${JSON.stringify(casas)};\n` +
  `const P_PIZZERIA_ANCHO = ${ANCHO_PIZZERIA};\n` +
  `const P_PIZZERIA = ${JSON.stringify(pizzeria)};\n` +
  `const P_PIZZERIA_MACIZO = ${JSON.stringify(pizzeriaMacizo)};
` +
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
