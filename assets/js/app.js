/* Stumpffia — lógica de la portada. Sin dependencias, sin peticiones externas. */
(function () {
  "use strict";

  var datos = window.STUMPFFIA || { juegos: [], donaciones: [], apk: null };

  /* ---------- Tarjetas de juegos ---------- */

  function tarjeta(j) {
    var disponible = !j.pronto;
    var el = document.createElement(disponible ? "a" : "div");
    el.className = "tarjeta" + (disponible ? "" : " tarjeta-pronto");

    if (disponible) {
      el.href = "/games/" + j.id + "/";
    } else {
      el.setAttribute("aria-disabled", "true");
    }

    var arte = document.createElement("div");
    arte.className = "tarjeta-arte";
    arte.setAttribute("aria-hidden", "true");
    arte.textContent = j.emoji || "🐸";

    var cuerpo = document.createElement("div");
    cuerpo.className = "tarjeta-cuerpo";

    var h3 = document.createElement("h3");
    h3.textContent = j.nombre;

    var p = document.createElement("p");
    p.textContent = j.desc;

    var datosFila = document.createElement("div");
    datosFila.className = "tarjeta-datos";

    if (j.peso) {
      var peso = document.createElement("span");
      peso.className = "dato-peso";
      peso.textContent = j.peso;
      datosFila.appendChild(peso);

      var sep = document.createElement("span");
      sep.className = "separador";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "·";
      datosFila.appendChild(sep);
    }

    /* El estado va en texto, no solo en el color del emoji. */
    var estado = document.createElement("span");
    estado.className = "dato-estado";
    estado.textContent = disponible ? "Jugar" : "Próximamente";
    datosFila.appendChild(estado);

    cuerpo.appendChild(h3);
    cuerpo.appendChild(p);
    cuerpo.appendChild(datosFila);
    el.appendChild(arte);
    el.appendChild(cuerpo);
    return el;
  }

  var lista = document.getElementById("games-list");
  if (lista) {
    var frag = document.createDocumentFragment();
    datos.juegos.forEach(function (j) { frag.appendChild(tarjeta(j)); });
    lista.appendChild(frag);
  }

  /* ---------- Donaciones ---------- */

  var modal = document.getElementById("modal-donar");
  var btnDonar = document.getElementById("btn-donar");

  if (datos.donaciones && datos.donaciones.length) {
    var cont = document.getElementById("donar-links");
    cont.innerHTML = "";
    datos.donaciones.forEach(function (d) {
      var a = document.createElement("a");
      a.href = d.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = d.nombre;
      cont.appendChild(a);
    });
  }

  if (btnDonar && modal) {
    btnDonar.addEventListener("click", function () {
      if (typeof modal.showModal === "function") modal.showModal();
      else modal.setAttribute("open", "");
    });
  }

  /* ---------- Enlace del APK ---------- */

  if (datos.apk && datos.apk.url) {
    var nota = document.getElementById("apk-nota");
    if (nota) {
      nota.innerHTML = "";
      var a = document.createElement("a");
      a.href = datos.apk.url;
      a.className = "boton boton-verde";
      a.textContent = "Descargar APK" +
        (datos.apk.version ? " v" + datos.apk.version : "") +
        (datos.apk.peso ? " · " + datos.apk.peso : "");
      nota.appendChild(a);
    }
  }

  /* ---------- Instalación del PWA ---------- */

  var promesaInstalar = null;
  var btnInstalar = document.getElementById("btn-instalar");

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    promesaInstalar = e;
    if (btnInstalar) btnInstalar.hidden = false;
  });

  if (btnInstalar) {
    btnInstalar.addEventListener("click", function () {
      if (!promesaInstalar) return;
      promesaInstalar.prompt();
      promesaInstalar.userChoice.then(function () {
        promesaInstalar = null;
        btnInstalar.hidden = true;
      });
    });
  }

  window.addEventListener("appinstalled", function () {
    if (btnInstalar) btnInstalar.hidden = true;
  });

  /* ---------- Service worker (modo sin internet) ---------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {
        /* sin service worker la página sigue funcionando igual, solo que online */
      });
    });
  }
})();
