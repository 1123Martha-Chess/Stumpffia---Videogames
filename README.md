# Stumpffia

> **Ranas Chiquitas = Juegos Chiquitos**

Sitio estático con minijuegos de menos de 1 MB. Sin anuncios, sin costo, sin cuentas y sin
recolectar ningún dato del usuario. Se financia solo con donaciones voluntarias.

- **Web:** https://stumpffia.com
- **PWA:** la misma página, instalable y jugable sin internet
- **APK:** versión única de Android para quien prefiera un archivo descargable

## Cómo se ve por dentro

```
index.html                 portada (catálogo + textos de información)
offline.html               pantalla cuando no hay internet
manifest.webmanifest       datos del PWA
sw.js                      service worker (caché para jugar sin internet)
assets/css/styles.css      estilos de la portada
assets/css/fuente.css      los @font-face, compartidos con los juegos
assets/fonts/              Nunito variable (SIL OFL 1.1) alojada aquí mismo
assets/js/games.js         CATÁLOGO: aquí se agregan juegos y enlaces de donación
assets/js/app.js           arma las tarjetas, el modal y el botón de instalar
assets/img/                logo, íconos e imagen para compartir
assets/img/origen/         el logo original tal como lo entregaste
games/<id>/index.html      un juego = una carpeta = un archivo
games/_plantilla/          punto de partida para un juego nuevo
_headers                   cabeceras de seguridad y caché (Cloudflare Pages)
```

Sin build, sin npm, sin dependencias. Lo que está en el repo es exactamente lo que se publica.

## Probar en tu computadora

```sh
npx serve .
# o
python -m http.server 8080
```

Abre `http://localhost:8080`. El service worker solo funciona en `localhost` o con HTTPS.

## Agregar un juego nuevo

1. `cp -r games/_plantilla games/mi-juego`
2. Cambia el título, el `ID` del script y el juego en sí.
3. En `assets/js/games.js`, pon ese `id` y cambia `pronto: true` → `false`.
4. Sube el número de versión en `sw.js` (`stumpffia-v1` → `v2`) para que la gente reciba el cambio.

Reglas de la casa: un juego es **un solo archivo HTML**, sin librerías externas, sin peticiones
de red, y guarda lo que necesite en `localStorage` con la llave `stumpffia:<id>`.

## Publicar en Cloudflare Pages

1. Sube este repo a GitHub.
2. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** y elige el repo.
3. Configuración de build:
   - Framework preset: **None**
   - Build command: *(vacío)*
   - Build output directory: `/`
4. **Save and Deploy.** Queda en `stumpffia.pages.dev`.
5. Para el dominio propio: pestaña **Custom domains → Set up a domain → `stumpffia.com`**,
   y agrega también `www.stumpffia.com`. Si compraste el dominio fuera de Cloudflare, cambia
   los *nameservers* del registrador a los que Cloudflare te indique.

Cada `git push` a la rama principal vuelve a publicar el sitio solo.

## Tipografía y licencias

La página usa **Nunito** (variable, pesos 400–900), alojada en el propio sitio: no se pide nada a
Google Fonts ni a ningún otro servidor. Está bajo la SIL Open Font License 1.1, que permite el uso
comercial y la redistribución; el texto completo está en `assets/fonts/OFL.txt`.

El código del sitio es MIT (ver `LICENSE`). El logo de la rana es tuyo y no entra en esa licencia.

## Privacidad

No hay analítica, ni cookies, ni almacenamiento en servidor, ni formularios. Los récords se
guardan en `localStorage` del propio dispositivo y nunca se envían a ninguna parte.
