"""Arma las 2 pantallas (arriba pseudo-3D, abajo mapa) usando solo los .json de esta carpeta.
Uso: python3 render_ejemplo.py [pos_camara] [curva]   (necesita Pillow)"""
import json, os, sys
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
J = lambda n: json.load(open(os.path.join(D, n + '.json'), encoding='utf-8'))
veh, esc, mapa, ico = J('vehiculos_3d'), J('escenario_3d'), J('mapa'), J('iconos_mapa')
C = {k: tuple(int(v['hex'][i:i+2], 16) for i in (1, 3, 5)) for k, v in veh['paleta'].items()}
W, H, HOR, LINES = 256, 192, 72, 120

def transparente(rows):
    """0 conectado al borde = transparente."""
    h, w = len(rows), len(rows[0]); t = set()
    pila = [(y, x) for y in range(h) for x in range(w) if (y in (0, h-1) or x in (0, w-1)) and rows[y][x] == '0']
    while pila:
        y, x = pila.pop()
        if (y, x) in t or not (0 <= y < h and 0 <= x < w) or rows[y][x] != '0': continue
        t.add((y, x)); pila += [(y+1, x), (y-1, x), (y, x+1), (y, x-1)]
    return t

def blit(img, rows, ox, oy, opaco=False):
    t = set() if opaco else transparente(rows)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if (y, x) not in t and 0 <= ox+x < img.width and 0 <= oy+y < img.height:
                img.putpixel((ox+x, oy+y), C[c])

def tam(s):
    return 'grande' if s >= 0.55 else 'mediano' if s >= 0.22 else 'chico' if s >= 0.03 else None

def pantalla_arriba(pos_camara=0.0, curva=0.6, jugador_x=0):
    img = Image.new('RGB', (W, H), C['0']); T = esc['texturas_4x4']
    for x, y in ((30, 14), (170, 26)): blit(img, esc['fondo']['nube'], x, y)
    off = int(-curva * 40) % 64
    for tx in range(-64, W + 64, 64): blit(img, esc['fondo']['montanas'], tx + off, HOR - 24, opaco=True)
    centro = {}
    for i in range(1, LINES + 1):
        y = HOR + i - 1; s = i / LINES; z = 1 / s
        cx = W / 2 + curva * 90 * (1 - s) ** 2 - jugador_x * s; centro[y] = cx
        medio = 105 * s; borde = max(1, medio * 0.13); linea = max(1, medio * 0.04)
        par = int((z + pos_camara) * 3) % 2 == 0
        for x in range(W):
            d = abs(x + 0.5 - cx)
            t = (('linea' if par else 'asfalto') if d < linea else 'asfalto' if d < medio else
                 ('borde_a' if par else 'borde_b') if d < medio + borde else ('pasto_a' if par else 'pasto_b'))
            img.putpixel((x, y), C[T[t][y % 4][x % 4]])
    def objeto(z, lado, sprites):           # sprites = {'grande':..,'mediano':..,'chico':..}
        s = 1 / z; k = tam(s); i = round(s * LINES)
        if not k or i < 2: return
        y = HOR + i - 1; x = centro[y] + lado * 105 * s; spr = sprites[k]
        blit(img, spr, round(x - len(spr[0]) / 2), y - len(spr) + 1)
    dec = esc['decoracion']; V = veh['sprites']
    deco = lambda n: {t: dec[f'{n}_{t}'] for t in ('grande', 'mediano', 'chico')}
    auto = lambda n: {t: V[n][f'{t}_recto'] for t in ('grande', 'mediano', 'chico')}
    escena = [(18, -1.4, deco('pino')), (12, 1.3, deco('cartel_der')), (9, -1.5, deco('pino')),
              (5, 1.35, deco('cartel_der')), (4, -0.35, auto('moto')), (3.2, -1.35, deco('pino')),
              (2.6, 0.4, auto('coche')), (1.6, 1.45, deco('llantas'))]
    for z, lado, spr in escena: objeto(z, lado, spr)   # de lejos a cerca
    blit(img, V['f1']['grande_giro_der'], W // 2 - 16, H - 26)  # jugador
    return img

def pantalla_abajo(posiciones):
    img = Image.new('RGB', (W, H)); ley = mapa['leyenda']
    for y, fila in enumerate(mapa['mapa']):
        for x, c in enumerate(fila): blit(img, mapa['tiles'][ley[c]], x * 16, y * 16, opaco=True)
    dirs = {'E': 'derecha', 'S': 'abajo', 'O': 'izquierda', 'N': 'arriba'}
    for nombre, paso in posiciones:
        r = mapa['recorrido'][paso]; (x, y) = r['tile']
        blit(img, ico['sprites'][nombre][dirs[r['dir']]], x * 16 + 4, y * 16 + 4)
    return img

if __name__ == '__main__':
    pos = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
    cur = float(sys.argv[2]) if len(sys.argv) > 2 else 0.6
    out = Image.new('RGB', (W, H * 2 + 8), C['1'])
    out.paste(pantalla_arriba(pos, cur), (0, 0))
    out.paste(pantalla_abajo([('f1', 4), ('coche', 12), ('moto', 16)]), (0, H + 8))
    out.resize((W * 3, (H * 2 + 8) * 3), Image.NEAREST).save(os.path.join(D, 'pantallas_ejemplo.png'))
    print('pantallas_ejemplo.png listo')
