"""Genera icons/icon-192.png e icon-512.png sin dependencias externas.

Fondo full-bleed #0f0f1a, cruz de salud #6C8EF5 centrada dentro de la safe-zone
maskable. Supersampling 4x para antialias. Emite PNG RGBA válido con la stdlib
(zlib + struct). Uso: `python scripts/gen-icons.py` desde la raíz del repo.
"""
import zlib, struct, os

BG   = (0x0f, 0x0f, 0x1a)   # #0f0f1a
FG   = (0x6c, 0x8e, 0xf5)   # #6C8EF5
SS   = 4                    # supersampling

def scanlines(px, w, h):
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filtro None por scanline
        for x in range(w):
            r, g, b, a = px[y*w + x]
            raw += bytes((r, g, b, a))
    return bytes(raw)

def chunk(tag, data):
    c = tag + data
    return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

def write_png(path, w, h, px):
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(scanlines(px, w, h), 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))

def render(size):
    # Full-bleed: fondo opaco hasta el borde (sin esquinas transparentes) para
    # que funcione como "maskable" — el launcher aplica su propia forma/recorte.
    # La cruz queda dentro de la safe-zone (brazos a ~0.32·mitad < 0.40).
    S = size * SS
    out = [(0, 0, 0, 0)] * (size * size)
    cx = cy = S / 2
    arm = S * 0.32      # medio-largo del brazo
    thick = S * 0.105   # medio-grosor de la barra

    def in_cross(x, y):
        vx = abs(x - cx); vy = abs(y - cy)
        vertical   = vx <= thick and vy <= arm
        horizontal = vy <= thick and vx <= arm
        return vertical or horizontal

    for oy in range(size):
        for ox in range(size):
            fg_hits = 0
            for sy in range(SS):
                for sx in range(SS):
                    X = ox*SS + sx + 0.5
                    Y = oy*SS + sy + 0.5
                    if in_cross(X, Y):
                        fg_hits += 1
            t = fg_hits / (SS*SS)   # fracción de cruz en el pixel
            r = round(FG[0]*t + BG[0]*(1-t))
            g = round(FG[1]*t + BG[1]*(1-t))
            b = round(FG[2]*t + BG[2]*(1-t))
            out[oy*size + ox] = (r, g, b, 255)   # fondo siempre opaco
    return out

repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dest = os.path.join(repo_root, "icons")
for sz in (192, 512):
    write_png(os.path.join(dest, f"icon-{sz}.png"), sz, sz, render(sz))
    print(f"icons/icon-{sz}.png OK")
