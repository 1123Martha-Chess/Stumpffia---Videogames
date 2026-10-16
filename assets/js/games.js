/* Catálogo de Stumpffia.
   Para publicar un juego: crea games/<id>/index.html y cambia su "pronto" a false. */

window.STUMPFFIA = {

  /* Pon aquí tus enlaces de donación. Si lo dejas vacío, el modal muestra un aviso. */
  donaciones: [
    // { nombre: "Ko-fi",    url: "https://ko-fi.com/tu-usuario" },
    // { nombre: "PayPal",   url: "https://paypal.me/tu-usuario" },
    // { nombre: "Mercado Pago", url: "https://..." },
  ],

  /* Cuando publiques el APK, pon aquí la URL y aparecerá el botón de descarga. */
  apk: null, // p. ej. { url: "/descargas/stumpffia.apk", version: "1.0", peso: "2.4 MB" }

  juegos: [
    {
      id: "pizzero",
      nombre: "Pizzero",
      emoji: "🍕",
      desc: "Reparte pizzas por una ciudad que crece contigo. Primero a pie, luego en moto, luego en auto.",
      peso: "15 KB",
      pronto: false
    },
    {
      id: "tanques",
      nombre: "Tanques",
      emoji: "💥",
      desc: "Tú eliges cuántos tanques y si peleas solo o con gente de tu lado.",
      peso: "17 KB",
      pronto: false
    },
    {
      id: "salta-rana",
      nombre: "Salta, Rana",
      emoji: "🐸",
      desc: "Toca para saltar de hoja en hoja. Un dedo, un botón, cero excusas.",
      peso: "12 KB",
      pronto: true
    },
    {
      id: "memoria-charco",
      nombre: "Memoria del Charco",
      emoji: "🐸",
      desc: "Las ranas croan por turnos y cambian de color. Repite el orden, ronda tras ronda.",
      peso: "8 KB",
      pronto: false
    },
    {
      id: "atrapa-mosca",
      nombre: "Atrapa la Mosca",
      emoji: "🪰",
      desc: "Reflejos puros: saca la lengua en el momento exacto.",
      peso: "11 KB",
      pronto: true
    },
    {
      id: "renacuajo",
      nombre: "Renacuajo",
      emoji: "🪸",
      desc: "La serpiente de siempre, pero es un renacuajo. Charca a tu medida y siete modos que se mezclan.",
      peso: "8 KB",
      pronto: false
    },
    {
      id: "buscaminas",
      nombre: "Buscaminas",
      emoji: "🚩",
      desc: "El de toda la vida, con mando: mueves la casilla y decides, banderín o pala.",
      peso: "11 KB",
      pronto: false
    },
    {
      id: "piedras-lirios",
      nombre: "Piedras y Lirios",
      emoji: "🪷",
      desc: "Rompecabezas de lógica por turnos. Tranquilo, sin reloj.",
      peso: "16 KB",
      pronto: true
    },
    {
      id: "coro-nocturno",
      nombre: "Coro Nocturno",
      emoji: "🎵",
      desc: "Repite la melodía de las ranas. Cada ronda, una nota más.",
      peso: "13 KB",
      pronto: true
    },
    {
      id: "lluvia-gotas",
      nombre: "Lluvia",
      emoji: "🌧️",
      desc: "Esquiva las gotas y aguanta lo más posible bajo la tormenta.",
      peso: "10 KB",
      pronto: true
    },
    {
      id: "sopa-de-letras",
      nombre: "Sopa de Ranas",
      emoji: "🔤",
      desc: "Encuentra palabras escondidas en la charca de letras.",
      peso: "18 KB",
      pronto: true
    },
    {
      id: "equilibrio",
      nombre: "Equilibrio",
      emoji: "⚖️",
      desc: "Apila ranitas sin que la torre se venga abajo.",
      peso: "15 KB",
      pronto: true
    },
    {
      id: "carrera-charcos",
      nombre: "Carrera de Charcos",
      emoji: "🏁",
      desc: "Dos jugadores en el mismo teléfono. El primero en llegar gana.",
      peso: "17 KB",
      pronto: true
    }
  ]
};
