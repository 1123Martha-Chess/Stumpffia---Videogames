# Cochecitos para el mapa (8x8, 2 colores)
Versiones chiquitas vistas desde arriba, aparte de los vehículos de la pantalla de arriba. Van encima de la pista oscura del mapa.

| Código | Color | Hex |
|---|---|---|
| `0` | Azul marino (fondo y detalles) | `#0B1A4A` |
| `1` | Azul claro | `#7EC8F2` |

**Transparencia:** el 0 conectado al borde del sprite es transparente; el 0 encerrado por 1 se pinta azul marino.  
**Colocar:** `x = col*16 + 4`, `y = fila*16 + 4` del tile donde va el vehículo (usa `recorrido` de `mapa.json`).

## f1

Fórmula 1: alerón atrás y llantas anchas.

`arriba`, `derecha`, `abajo`, `izquierda` lado a lado:

```
00011000  01100100  01111110  00100110
00011000  11100100  11011011  00100111
11011011  10111000  11111111  00011101
00111100  11101111  00100100  11110111
00100100  11101111  00111100  11110111
11111111  10111000  11011011  00011101
11011011  11100100  00011000  00100111
01111110  01100100  00011000  00100110
```

## coche

Coche de carreras: parabrisas y ventana trasera.

`arriba`, `derecha`, `abajo`, `izquierda` lado a lado:

```
00111100  00000000  00111100  00000000
01111110  01111110  01111110  01111110
01000010  11011011  01000010  11011011
01111110  11011011  01111110  11011011
01111110  11011011  01111110  11011011
01000010  11011011  01000010  11011011
01111110  01111110  01111110  01111110
00111100  00000000  00111100  00000000
```

## moto

Moto: delgada, manubrio adelante.

`arriba`, `derecha`, `abajo`, `izquierda` lado a lado:

```
00011000  00000000  00011000  00000000
01111110  00000010  00011000  01000000
00011000  00011010  00011000  01011000
00111100  11111111  00111100  11111111
00111100  11111111  00111100  11111111
00011000  00011010  00011000  01011000
00011000  00000010  01111110  01000000
00011000  00000000  00011000  00000000
```
