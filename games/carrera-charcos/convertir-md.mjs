/* Pasa los sprites dibujados a mano (sprites/*.md) a sprites/*.json.
 *
 * Los .md son la fuente: ahí se dibuja con ceros y unos y se lee de corrido.
 * Los .json son lo que leen el empacador y render_ejemplo.py, así que se
 * vuelven a generar cada vez que se retoca un dibujo. No se editan a mano.
 *
 * Uso:  node games/carrera-charcos/convertir-md.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.join(path.dirname(fileURLToPath(import.meta.url)), "sprites");

const PALETA = {
  "0": { nombre: "azul marino", hex: "#0B1A4A" },
  "1": { nombre: "azul claro", hex: "#7EC8F2" }
};

/* ───────────────── Lectura de los .md ─────────────────
   De cada archivo salen los bloques entre ``` con el título bajo el que
   viven y los nombres que los anuncian ("`a`, `b`, `c` lado a lado:"). */

function bloques(texto) {
  const lineas = texto.split(/\r?\n/);
  const salida = [];
  let h2 = "", h3 = "", nombres = [], dentro = false, actual = null;

  for (const linea of lineas) {
    if (linea.startsWith("```")) {
      if (dentro) { salida.push(actual); dentro = false; actual = null; }
      else { dentro = true; actual = { h2, h3, nombres, lineas: [] }; }
      continue;
    }
    if (dentro) { actual.lineas.push(linea.replace(/\s+$/, "")); continue; }

    if (linea.startsWith("### ")) { h3 = linea.slice(4).trim(); nombres = []; }
    else if (linea.startsWith("## ")) { h2 = linea.slice(3).trim(); h3 = ""; nombres = []; }

    /* La línea que anuncia un bloque trae los nombres entre comillas simples
       inclinadas. Las tablas también llevan comillas, pero empiezan con "|". */
    if (!linea.startsWith("|")) {
      const marcas = [...linea.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      if (marcas.length) nombres = marcas;
    }
  }
  return salida;
}

/* Un bloque es un dibujo si solo tiene ceros, unos y espacios. */
function esDibujo(b) {
  return b.lineas.some((l) => l.trim()) &&
         b.lineas.every((l) => !l.trim() || /^[01 ]+$/.test(l));
}

/* Los dibujos van lado a lado, separados por dos espacios o más. Los de menos
   alto (el "chico" de 8x6) simplemente dejan de aparecer en las filas de abajo. */
function separar(b, nombres) {
  const columnas = [];
  for (const linea of b.lineas) {
    if (!linea.trim()) continue;
    const trozos = linea.split(/ {2,}/).filter((t) => t !== "");
    trozos.forEach((t, i) => {
      if (!columnas[i]) columnas[i] = [];
      columnas[i].push(t);
    });
  }
  if (columnas.length !== nombres.length) {
    throw new Error(`"${b.h2} / ${b.h3}": ${columnas.length} dibujos para ${nombres.length} nombres (${nombres.join(", ")})`);
  }
  const salida = {};
  columnas.forEach((filas, i) => {
    const ancho = filas[0].length;
    for (const f of filas) {
      if (f.length !== ancho) {
        throw new Error(`"${nombres[i]}": una fila mide ${f.length} y otra ${ancho}`);
      }
    }
    salida[nombres[i]] = filas;
  });
  return salida;
}

/* Nombre limpio para los bloques que se anuncian con el título: "### nube (24x8)". */
function nombreDeTitulo(h3) { return h3.replace(/\s*\(.*$/, "").trim(); }

function leer(archivo) { return bloques(fs.readFileSync(path.join(AQUI, archivo), "utf8")); }

function escribir(archivo, datos) {
  fs.writeFileSync(path.join(AQUI, archivo), JSON.stringify(datos, null, 1) + "\n");
  const cuenta = (o) => Object.values(o).reduce((n, v) => n + (Array.isArray(v) ? 1 : cuenta(v)), 0);
  console.log(`${archivo}: ${cuenta(datos.sprites || datos.tiles || {})} dibujos`);
}

/* ───────────────── vehiculos_3d.json e iconos_mapa.json ─────────────────
   Los dos se arman igual: cada "## nombre" es un vehículo. */

function porVehiculo(archivo, salida, extra) {
  const sprites = {};
  for (const b of leer(archivo)) {
    if (!esDibujo(b)) continue;
    const vehiculo = b.h2.split(/\s+—\s+/)[0].trim();
    sprites[vehiculo] = Object.assign(sprites[vehiculo] || {}, separar(b, b.nombres));
  }
  escribir(salida, Object.assign({ paleta: PALETA }, extra, { sprites }));
  return sprites;
}

porVehiculo("vehiculos_3d.md", "vehiculos_3d.json", {
  tamanos: { grande: [32, 24], mediano: [16, 12], chico: [8, 6] },
  /* el mismo corte que usa el juego para elegir tamaño */
  cortes: { grande: 0.55, mediano: 0.22, chico: 0.03 },
  ancla: "centro de la fila de abajo"
});

porVehiculo("iconos_mapa.md", "iconos_mapa.json", { tamanos: { todos: [8, 8] } });

/* ───────────────── escenario_3d.json ───────────────── */

(function escenario() {
  const datos = { paleta: PALETA, texturas_4x4: {}, fondo: {}, decoracion: {} };
  for (const b of leer("escenario_3d.md")) {
    if (!esDibujo(b)) continue;                 /* el bloque del pseudocódigo se cae aquí */
    if (b.h2.startsWith("Texturas")) Object.assign(datos.texturas_4x4, separar(b, b.nombres));
    else if (b.h2 === "Fondo") Object.assign(datos.fondo, separar(b, [nombreDeTitulo(b.h3)]));
    else Object.assign(datos.decoracion, separar(b, b.nombres));
  }
  fs.writeFileSync(path.join(AQUI, "escenario_3d.json"), JSON.stringify(datos, null, 1) + "\n");
  console.log(`escenario_3d.json: ${Object.keys(datos.texturas_4x4).length} texturas, ` +
              `${Object.keys(datos.fondo).length} de fondo, ${Object.keys(datos.decoracion).length} de decoración`);
})();

/* ───────────────── mapa.json ─────────────────
   Además de los tiles, aquí se calcula el recorrido: se entra en la meta
   rodando hacia la derecha y se sigue la pista tile por tile. */

(function mapa() {
  const texto = fs.readFileSync(path.join(AQUI, "mapa.md"), "utf8");

  /* la leyenda sale de la tabla "| `.` | `pasto` |" */
  const leyenda = {};
  for (const m of texto.matchAll(/^\|\s*`(.)`\s*\|\s*`([a-z_]+)`\s*\|/gm)) leyenda[m[1]] = m[2];

  const tiles = {};
  let rejilla = null;
  for (const b of bloques(texto)) {
    if (esDibujo(b)) { Object.assign(tiles, separar(b, b.nombres)); continue; }
    if (b.h2.startsWith("Mapa")) rejilla = b.lineas.filter((l) => l.trim());
  }
  if (!rejilla) throw new Error("no encontré la rejilla del mapa");

  /* Por dónde se abre cada tile. Con eso basta para seguir la pista: se entra
     por un lado y se sale por el otro. */
  const BOCAS = {
    pista_h: "EO", meta: "EO", pista_v: "NS",
    curva_abajo_der: "SE", curva_abajo_izq: "SO",
    curva_arriba_der: "NE", curva_arriba_izq: "NO"
  };
  const PASO = { E: [1, 0], O: [-1, 0], N: [0, -1], S: [0, 1] };
  const CONTRARIA = { E: "O", O: "E", N: "S", S: "N" };
  const RELOJ = ["N", "E", "S", "O"];

  const tile = (x, y) => leyenda[(rejilla[y] || "")[x]] || "pasto";

  let salida = null;
  rejilla.forEach((fila, y) => {
    [...fila].forEach((c, x) => { if (leyenda[c] === "meta") salida = [x, y]; });
  });
  if (!salida) throw new Error("el mapa no tiene meta");

  const recorrido = [];
  let [x, y] = salida, dir = "E";
  do {
    const bocas = BOCAS[tile(x, y)];
    if (!bocas) throw new Error(`la pista se sale del asfalto en ${x},${y}`);
    const anterior = dir;
    dir = [...bocas].find((b) => b !== CONTRARIA[dir]);
    if (!dir) throw new Error(`no se puede entrar a ${x},${y} viniendo hacia ${anterior}`);
    /* +1 a la derecha, -1 a la izquierda, 0 de frente */
    let giro = RELOJ.indexOf(dir) - RELOJ.indexOf(anterior);
    if (giro === 3) giro = -1; else if (giro === -3) giro = 1;
    recorrido.push({ tile: [x, y], dir, giro });
    x += PASO[dir][0]; y += PASO[dir][1];
  } while (!(x === salida[0] && y === salida[1]) && recorrido.length < 500);

  if (x !== salida[0] || y !== salida[1]) throw new Error("la pista no cierra en la meta");

  const vueltas = recorrido.reduce((n, r) => n + r.giro, 0);
  fs.writeFileSync(path.join(AQUI, "mapa.json"),
    JSON.stringify({ paleta: PALETA, tile: 16, ancho: 16, alto: 12,
                     leyenda, mapa: rejilla, tiles, recorrido }, null, 1) + "\n");
  console.log(`mapa.json: ${Object.keys(tiles).length} tiles, ` +
              `${recorrido.length} tiles de pista, giro total ${vueltas * 90}°`);
})();
