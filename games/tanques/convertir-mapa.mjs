/* Convierte el mapa dibujado a mano (mapaTanques.png) en casillas de juego.
 *
 * Cómo está dibujado el mapa:
 *   - fondo blanco          = suelo
 *   - marco rojo #880015    = borde del mundo, y ahí no caen poderes
 *   - contornos negros      = el perímetro de cada región
 *   - un punto de color dentro de cada región dice qué hay en ella
 *
 * Uso:  node games/tanques/convertir-mapa.mjs <mapa.png> [casillas]
 * Escribe mapa-generado.js, que index.html incluye tal cual.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ORIGEN = process.argv[2];
const CASILLAS = Number(process.argv[3] || 40);

/* Qué significa cada punto de color. Cambiar aquí cambia el mapa entero. */
const LEYENDA = {
  "3f48cc": "lago",
  "22b14c": "montana",
  "ff7f27": "troncos",
  "fff200": "barrera_metal",
  "a349a4": "roca"
};
const ROJO = "880015";

/* ───────── lector de PNG ───────── */

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
      px[d+3] = ch === 4 ? linea[s + 3] : 255;
    }
    previa = linea;
  }
  return { w, h, px };
}

const img = decodificar(fs.readFileSync(ORIGEN));
const hex = (i) => [img.px[i*4], img.px[i*4+1], img.px[i*4+2]]
  .map((v) => v.toString(16).padStart(2, "0")).join("");

/* ───────── clasificar píxeles ───────── */

const NEGRO = 1, ROJA = 2, LIBRE = 0;
const clase = new Uint8Array(img.w * img.h);
const semillas = new Map();          // color -> lista de píxeles sueltos

for (let i = 0; i < img.w * img.h; i++) {
  const r = img.px[i*4], g = img.px[i*4+1], b = img.px[i*4+2];
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const h = hex(i);

  if (h === ROJO || (r > 100 && r < 170 && g < 60 && b < 70)) { clase[i] = ROJA; continue; }
  if (max < 110) { clase[i] = NEGRO; continue; }                 // el contorno
  if (LEYENDA[h]) {
    if (!semillas.has(h)) semillas.set(h, []);
    semillas.get(h).push(i);
    continue;                                                     // el punto es suelo libre
  }
  if (max - min > 60) { clase[i] = NEGRO; continue; }            // borde suavizado de un punto
}

/* ───────── agrupar los puntos de color en regiones ───────── */

const puntos = [];                   // { color, x, y }
for (const [color, lista] of semillas) {
  const pendiente = new Set(lista);
  while (pendiente.size) {
    const primero = pendiente.values().next().value;
    const grupo = [], cola = [primero];
    pendiente.delete(primero);
    while (cola.length) {
      const p = cola.pop(); grupo.push(p);
      const x = p % img.w, y = (p / img.w) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const q = (y + dy) * img.w + (x + dx);
        if (pendiente.has(q)) { pendiente.delete(q); cola.push(q); }
      }
    }
    if (grupo.length < 200) continue;          // ruido suelto
    let sx = 0, sy = 0;
    for (const p of grupo) { sx += p % img.w; sy += (p / img.w) | 0; }
    puntos.push({ color, x: Math.round(sx / grupo.length), y: Math.round(sy / grupo.length) });
  }
}
console.log(`${puntos.length} regiones marcadas con un punto`);

/* ───────── rellenar cada región desde su punto ───────── */

const region = new Int16Array(img.w * img.h).fill(-1);
const LIMITE = img.w * img.h * 0.22;         // si se desborda, el contorno estaba abierto
const areas = [];

/* El trazo a mano deja huecos de uno o dos píxeles por los que el relleno se
   escapa. Engrosando la línea negra se cierran sin deformar la región. */
function engrosar(veces) {
  let muro = Uint8Array.from(clase, (c) => (c === NEGRO || c === ROJA ? 1 : 0));
  for (let paso = 0; paso < veces; paso++) {
    const siguiente = Uint8Array.from(muro);
    for (let y = 1; y < img.h - 1; y++) {
      for (let x = 1; x < img.w - 1; x++) {
        const i = y * img.w + x;
        if (muro[i]) continue;
        if (muro[i-1] || muro[i+1] || muro[i-img.w] || muro[i+img.w]) siguiente[i] = 1;
      }
    }
    muro = siguiente;
  }
  return muro;
}

const MUROS = [engrosar(0), engrosar(1), engrosar(2), engrosar(3)];

puntos.forEach((punto, n) => {
  /* Se prueba con la línea cada vez más gruesa hasta que la región cierre. */
  for (let grosor = 0; grosor < MUROS.length; grosor++) {
    const muro = MUROS[grosor];
    const inicio = punto.y * img.w + punto.x;
    if (muro[inicio]) continue;               // el punto quedó tapado por el engrosado

    /* "marcados" guarda TODO lo que se pintó, no solo lo ya procesado:
       si hay que deshacer, hay que borrarlo entero o queda una mancha. */
    const cola = [inicio], marcados = [inicio];
    region[inicio] = n;
    let fugado = false;

    while (cola.length) {
      const p = cola.pop();
      const x = p % img.w, y = (p / img.w) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h) continue;
        const q = ny * img.w + nx;
        if (region[q] !== -1 || muro[q]) continue;
        region[q] = n;
        marcados.push(q);
        cola.push(q);
      }
      if (marcados.length > LIMITE) { fugado = true; break; }
    }

    if (!fugado) {
      areas.push(marcados.length);
      if (grosor) console.log(`  · región ${n} (${LEYENDA[punto.color]}) cerrada engrosando ${grosor} px`);
      return;
    }
    for (const p of marcados) region[p] = -1;  // deshacer y probar con más grosor
  }

  /* Si el trazo no cierra ni así (suele pasar en los bordes de la hoja),
     se pinta un disco del tamaño típico de las otras regiones de ese color,
     centrado en el punto: mejor una mancha aproximada que ninguna. */
  const hermanas = puntos
    .map((p, i) => (p.color === punto.color ? areas[i] : 0))
    .filter((a) => a > 0);
  const area = hermanas.length
    ? hermanas.sort((a, b) => a - b)[hermanas.length >> 1]
    : 30000;
  const radio = Math.round(Math.sqrt(area / Math.PI));
  let pintados = 0;
  for (let dy = -radio; dy <= radio; dy++) {
    for (let dx = -radio; dx <= radio; dx++) {
      if (dx * dx + dy * dy > radio * radio) continue;
      const x = punto.x + dx, y = punto.y + dy;
      if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      const q = y * img.w + x;
      if (region[q] !== -1 || clase[q] === ROJA) continue;
      region[q] = n; pintados++;
    }
  }
  areas.push(pintados);
  console.log(`  ⚠ la región ${n} (${LEYENDA[punto.color]}) no cierra: se pinta un disco de ${radio} px`);
});

/* ───────── pasar de píxeles a casillas ───────── */

const paso = img.w / CASILLAS;
const malla = [];          // terreno por casilla
const rojas = [];

for (let ty = 0; ty < CASILLAS; ty++) {
  malla.push(new Array(CASILLAS).fill("suelo"));
  rojas.push(new Array(CASILLAS).fill(false));
  for (let tx = 0; tx < CASILLAS; tx++) {
    const votos = new Map(); let rojos = 0, total = 0;
    for (let y = Math.floor(ty * paso); y < Math.floor((ty + 1) * paso); y++) {
      for (let x = Math.floor(tx * paso); x < Math.floor((tx + 1) * paso); x++) {
        const i = y * img.w + x; total++;
        if (clase[i] === ROJA) { rojos++; continue; }
        const r = region[i];
        if (r >= 0) {
          const t = LEYENDA[puntos[r].color];
          votos.set(t, (votos.get(t) || 0) + 1);
        }
      }
    }
    if (rojos > total * 0.5) { malla[ty][tx] = "borde"; rojas[ty][tx] = true; continue; }
    let mejor = null, mejorN = total * 0.35;      // hace falta mayoría clara
    for (const [t, n] of votos) if (n > mejorN) { mejor = t; mejorN = n; }
    if (mejor) malla[ty][tx] = mejor;
  }
}

/* El marco exterior siempre es borde, pase lo que pase con el dibujo. */
for (let i = 0; i < CASILLAS; i++) {
  malla[0][i] = malla[CASILLAS-1][i] = malla[i][0] = malla[i][CASILLAS-1] = "borde";
  rojas[0][i] = rojas[CASILLAS-1][i] = rojas[i][0] = rojas[i][CASILLAS-1] = true;
}

/* ───────── las montañas se vuelven rombos ───────── */

/* Un contorno irregular no casa con los sprites de ladera; un rombo sí,
   y además se lee mucho mejor de un vistazo. */
let rombos = 0;
puntos.forEach((punto, n) => {
  if (LEYENDA[punto.color] !== "montana" || areas[n] === 0) return;

  /* Primero, hasta dónde llega esta región en casillas. Se mira todo el
     bloque de píxeles de cada casilla, no solo su centro: si no, quedan
     motas sueltas alrededor del rombo. */
  let minX = CASILLAS, maxX = -1, minY = CASILLAS, maxY = -1, celdas = 0;
  for (let ty = 0; ty < CASILLAS; ty++) for (let tx = 0; tx < CASILLAS; tx++) {
    if (malla[ty][tx] !== "montana") continue;
    let suya = false;
    for (let y = Math.floor(ty * paso); y < Math.floor((ty + 1) * paso) && !suya; y++)
      for (let x = Math.floor(tx * paso); x < Math.floor((tx + 1) * paso); x++)
        if (region[y * img.w + x] === n) { suya = true; break; }
    if (!suya) continue;
    minX = Math.min(minX, tx); maxX = Math.max(maxX, tx);
    minY = Math.min(minY, ty); maxY = Math.max(maxY, ty);
    malla[ty][tx] = "suelo";                 // se borra la mancha original
    celdas++;
  }
  if (!celdas) return;

  const cx = Math.round((minX + maxX) / 2), cy = Math.round((minY + maxY) / 2);
  const radio = Math.max(2, Math.round(Math.min(maxX - minX, maxY - minY) / 2));
  for (let dy = -radio; dy <= radio; dy++) {
    for (let dx = -radio; dx <= radio; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > radio) continue;
      const tx = cx + dx, ty = cy + dy;
      if (tx <= 0 || ty <= 0 || tx >= CASILLAS-1 || ty >= CASILLAS-1) continue;
      malla[ty][tx] = "montana";
    }
  }
  rombos++;
});
console.log(`${rombos} montañas convertidas en rombo`);

/* ───────── salida ───────── */

const CODIGOS = {
  suelo: ".", borde: "#", lago: "~", montana: "^",
  piedras: "p", troncos: "t", barrera_metal: "b", roca: "r"
};

const filas = malla.map((f) => f.map((t) => CODIGOS[t]).join(""));
const filasRojas = rojas.map((f) => f.map((v) => (v ? "1" : "0")).join(""));

const cuenta = {};
for (const f of malla) for (const t of f) cuenta[t] = (cuenta[t] || 0) + 1;
console.log("casillas por terreno:", cuenta);

const INICIO = "/* MAPA-INICIO */";
const FIN = "/* MAPA-FIN */";

const bloque =
  `${INICIO}\n` +
  `// Generado por convertir-mapa.mjs desde ${path.basename(ORIGEN)} — no editar a mano.\n` +
  `const MAPA_CODIGOS = ${JSON.stringify(CODIGOS)};\n` +
  `const MAPA_FILAS = [\n${filas.map((f) => `  "${f}"`).join(",\n")}\n];\n` +
  `const MAPA_ROJAS = [\n${filasRojas.map((f) => `  "${f}"`).join(",\n")}\n];\n` +
  `${FIN}`;

const destino = path.join(AQUI, "index.html");
const html = fs.readFileSync(destino, "utf8");
const desde = html.indexOf(INICIO), hasta = html.indexOf(FIN);
if (desde === -1 || hasta === -1) {
  console.error(`No encontré las marcas ${INICIO} / ${FIN} en index.html`);
  process.exit(1);
}
const nuevo = html.slice(0, desde) + bloque + html.slice(hasta + FIN.length);
fs.writeFileSync(destino, nuevo);

const comprimido = zlib.gzipSync(Buffer.from(nuevo)).length;
console.log(`mapa de ${CASILLAS}x${CASILLAS} casillas metido en index.html`);
console.log(`index.html: ${(Buffer.byteLength(nuevo)/1024).toFixed(1)} KB · servido con gzip: ${(comprimido/1024).toFixed(1)} KB`);
