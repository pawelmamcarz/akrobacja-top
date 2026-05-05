#!/usr/bin/env python3
"""Generate product mockup images for akrobacja.com merch store."""
import os, subprocess, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'merch')
os.makedirs(OUT, exist_ok=True)

W, H = 600, 600
BG1  = (10, 22, 50)    # dark navy
BG2  = (18, 38, 72)    # slightly lighter navy
CYAN = (0, 229, 255)
WHITE= (255, 255, 255)
NAVY = (14, 28, 56)
RED  = (200, 30, 30)
GOLD = (200, 165, 60)
GRAY = (80, 100, 130)

def make_base(glow_color=CYAN):
    img = Image.new('RGB', (W, H), BG1)
    d = ImageDraw.Draw(img)
    # radial-ish gradient background
    for r in range(320, 0, -2):
        alpha = int(40 * (1 - r/320))
        col = tuple(min(255, BG2[i] + int((glow_color[i]-BG2[i]) * alpha/120)) for i in range(3))
        d.ellipse([W//2-r, H//2-r, W//2+r, H//2+r], fill=col)
    # subtle grid lines
    for x in range(0, W, 60):
        d.line([(x, 0), (x, H)], fill=(255,255,255,8), width=1)
    for y in range(0, H, 60):
        d.line([(0, y), (W, y)], fill=(255,255,255,8), width=1)
    return img

def draw_extra300_silhouette(d, cx, cy, size=90, color=CYAN, alpha=180):
    """Draw a simplified Extra 300 aircraft silhouette."""
    s = size / 90
    pts_fuselage = [
        (cx - 80*s, cy + 8*s),
        (cx - 50*s, cy + 5*s),
        (cx + 60*s, cy + 2*s),
        (cx + 85*s, cy - 2*s),
        (cx + 60*s, cy - 6*s),
        (cx - 50*s, cy - 8*s),
        (cx - 80*s, cy - 4*s),
    ]
    d.polygon(pts_fuselage, fill=(*color, alpha))
    # main wing
    pts_wing = [
        (cx - 10*s, cy + 4*s),
        (cx + 20*s, cy + 4*s),
        (cx + 15*s, cy + 45*s),
        (cx - 25*s, cy + 48*s),
        (cx - 35*s, cy + 12*s),
    ]
    d.polygon(pts_wing, fill=(*color, alpha))
    # tail fin vertical
    pts_vtail = [
        (cx - 55*s, cy - 6*s),
        (cx - 35*s, cy - 6*s),
        (cx - 40*s, cy - 32*s),
        (cx - 65*s, cy - 28*s),
    ]
    d.polygon(pts_vtail, fill=(*color, alpha))
    # tail horizontal
    pts_htail = [
        (cx - 55*s, cy - 2*s),
        (cx - 35*s, cy - 2*s),
        (cx - 38*s, cy + 20*s),
        (cx - 70*s, cy + 18*s),
    ]
    d.polygon(pts_htail, fill=(*color, alpha))

def draw_shirt(d, cx, cy, fill_color, size=1.0, collar='round'):
    """Draw a flat-lay shirt/tshirt shape."""
    s = size
    if collar == 'polo':
        body = [
            (cx-110*s, cy-60*s), (cx-150*s, cy-120*s),
            (cx-100*s, cy-140*s), (cx-65*s, cy-100*s),
            (cx-55*s, cy-110*s), (cx-40*s, cy-130*s),
            (cx+40*s, cy-130*s), (cx+55*s, cy-110*s),
            (cx+65*s, cy-100*s), (cx+100*s, cy-140*s),
            (cx+150*s, cy-120*s), (cx+110*s, cy-60*s),
            (cx+120*s, cy+130*s), (cx-120*s, cy+130*s),
        ]
    else:
        body = [
            (cx-110*s, cy-60*s), (cx-155*s, cy-120*s),
            (cx-105*s, cy-140*s), (cx-65*s, cy-90*s),
            (cx-45*s, cy-105*s), (cx-30*s, cy-125*s),
            (cx-15*s, cy-130*s), (cx+15*s, cy-130*s),
            (cx+30*s, cy-125*s), (cx+45*s, cy-105*s),
            (cx+65*s, cy-90*s), (cx+105*s, cy-140*s),
            (cx+155*s, cy-120*s), (cx+110*s, cy-60*s),
            (cx+120*s, cy+130*s), (cx-120*s, cy+130*s),
        ]
    d.polygon(body, fill=fill_color)
    # shadow on sides
    for i in range(8):
        shade = tuple(max(0, c - i*4) for c in fill_color)
        d.line([(cx+118*s - i, cy-40*s), (cx+118*s - i, cy+128*s)], fill=shade, width=1)
        d.line([(cx-118*s + i, cy-40*s), (cx-118*s + i, cy+128*s)], fill=shade, width=1)
    # collar highlight
    d.line([(cx-15*s, cy-130*s), (cx+15*s, cy-130*s)], fill=(*fill_color[:3], 200), width=2)

def draw_hoodie(d, cx, cy, fill_color):
    body = [
        (cx-115, cy-55), (cx-165, cy-110),
        (cx-115, cy-145), (cx-75, cy-100),
        (cx-60, cy-115), (cx-50, cy-135),
        (cx+50, cy-135), (cx+60, cy-115),
        (cx+75, cy-100), (cx+115, cy-145),
        (cx+165, cy-110), (cx+115, cy-55),
        (cx+125, cy+140), (cx-125, cy+140),
    ]
    d.polygon(body, fill=fill_color)
    # hood
    hood = [
        (cx-50, cy-135), (cx-60, cy-165), (cx-30, cy-185),
        (cx, cy-190), (cx+30, cy-185), (cx+60, cy-165), (cx+50, cy-135),
    ]
    d.polygon(hood, fill=fill_color)
    # center pocket
    pocket = [(cx-50, cy+30), (cx+50, cy+30), (cx+52, cy+100), (cx-52, cy+100)]
    d.polygon(pocket, fill=tuple(max(0, c-20) for c in fill_color))
    # center seam
    d.line([(cx, cy-135), (cx, cy+138)], fill=tuple(max(0,c-30) for c in fill_color), width=2)
    for i in range(6):
        shade = tuple(max(0, c - i*4) for c in fill_color)
        d.line([(cx+123-i, cy-40), (cx+123-i, cy+138)], fill=shade, width=1)
        d.line([(cx-123+i, cy-40), (cx-123+i, cy+138)], fill=shade, width=1)

def draw_jacket(d, cx, cy, fill_color):
    body = [
        (cx-110, cy-50), (cx-160, cy-115),
        (cx-108, cy-148), (cx-70, cy-105),
        (cx-52, cy-120), (cx-40, cy-140), (cx-10, cy-148),
        (cx+10, cy-148), (cx+40, cy-140), (cx+52, cy-120),
        (cx+70, cy-105), (cx+108, cy-148),
        (cx+160, cy-115), (cx+110, cy-50),
        (cx+122, cy+140), (cx-122, cy+140),
    ]
    d.polygon(body, fill=fill_color)
    # collar
    collar = [(cx-40, cy-140), (cx+40, cy-140), (cx+50, cy-110), (cx-50, cy-110)]
    d.polygon(collar, fill=tuple(min(255, c+20) for c in fill_color))
    # center zip line
    d.line([(cx, cy-148), (cx, cy+140)], fill=(*CYAN[:3], 120), width=2)
    for i in range(6):
        d.line([(cx+120-i, cy-40), (cx+120-i, cy+138)], fill=tuple(max(0,c-i*4) for c in fill_color), width=1)
        d.line([(cx-120+i, cy-40), (cx-120+i, cy+138)], fill=tuple(max(0,c-i*4) for c in fill_color), width=1)

def draw_cap(d, cx, cy, fill_color):
    # crown (dome)
    d.ellipse([cx-100, cy-140, cx+100, cy+20], fill=fill_color)
    d.ellipse([cx-100, cy-10, cx+100, cy+80], fill=tuple(max(0,c-25) for c in fill_color))
    # brim
    brim = [(cx-110, cy+50), (cx+140, cy+50), (cx+145, cy+80), (cx-108, cy+80)]
    d.polygon(brim, fill=tuple(max(0,c-35) for c in fill_color))
    # panel seams
    for angle in [0, 60, 120]:
        a = math.radians(angle)
        x2 = cx + int(100 * math.sin(a))
        y2 = cy - 140 + int(90 * (1 - math.cos(a)))
        d.line([(cx, cy+20), (x2, y2)], fill=tuple(max(0,c-15) for c in fill_color), width=1)
    # snapback back strap
    d.rectangle([cx-20, cy+58, cx+20, cy+76], fill=tuple(max(0,c-40) for c in fill_color))
    d.rectangle([cx-10, cy+62, cx+10, cy+72], fill=tuple(min(255,c+30) for c in fill_color))

def draw_softshell(d, cx, cy, fill_color):
    """Softshell jacket - similar to jacket but with texture hint."""
    draw_jacket(d, cx, cy, fill_color)
    # add texture lines
    for y in range(-120, 140, 12):
        d.line([(cx-80, cy+y), (cx+80, cy+y)], fill=tuple(min(255, c+8) if i==1 else max(0,c-3) for i,c in enumerate(fill_color)), width=1)

def draw_keychain_aluchain(d, cx, cy):
    # Aluminum tag
    d.rounded_rectangle([cx-80, cy-40, cx+80, cy+40], radius=8, fill=(160, 175, 190))
    # metal gradient effect
    for i in range(20):
        luma = 140 + i*3
        d.line([(cx-78, cy-38+i*4), (cx+78, cy-38+i*4)], fill=(luma, luma+10, luma+20), width=4)
    # engraved aircraft
    d.line([(cx-50, cy), (cx+50, cy)], fill=(100, 110, 120), width=1)  # wing
    d.line([(cx, cy-25), (cx, cy+15)], fill=(100, 110, 120), width=1)  # fuselage
    d.polygon([(cx-50, cy), (cx+50, cy), (cx, cy-25)], outline=(90,100,115), fill=None)
    # keyring hole
    d.ellipse([cx-8, cy-58, cx+8, cy-42], outline=(140,150,160), width=3)
    d.ellipse([cx-6, cy-56, cx+6, cy-44], fill=(80, 90, 110))

def draw_zawieszka(d, cx, cy):
    # Red tag — "Remove Before Aerobatic"
    tag = [(cx-40, cy-90), (cx+40, cy-90), (cx+40, cy+90), (cx-40, cy+90)]
    d.polygon(tag, fill=RED)
    # highlight
    d.polygon([(cx-40, cy-90), (cx, cy-90), (cx, cy+90), (cx-40, cy+90)], fill=(210, 40, 40))
    # white text strip
    d.rectangle([cx-35, cy-20, cx+35, cy+20], fill=(230, 220, 210))
    # tassle
    tassel = [(cx-15, cy+90), (cx+15, cy+90), (cx+20, cy+150), (cx-20, cy+150)]
    d.polygon(tassel, fill=RED)
    # ring loop
    d.ellipse([cx-10, cy-110, cx+10, cy-90], outline=GRAY, width=3)

def draw_sticker_pack(d, cx, cy):
    """Four sticker arrangement."""
    positions = [(cx-75, cy-75), (cx+75, cy-75), (cx-75, cy+75), (cx+75, cy+75)]
    shapes = ['diamond', 'circle', 'hexagon', 'rect']
    colors = [CYAN, (0, 200, 230), (0, 180, 210), CYAN]
    for (px, py), shape, col in zip(positions, shapes, colors):
        if shape == 'circle':
            d.ellipse([px-45, py-45, px+45, py+45], fill=(20, 40, 80))
            d.ellipse([px-43, py-43, px+43, py+43], outline=col, width=2)
        elif shape == 'diamond':
            pts = [(px, py-45), (px+45, py), (px, py+45), (px-45, py)]
            d.polygon(pts, fill=(20, 40, 80))
            d.polygon(pts, outline=col, width=2)
        elif shape == 'hexagon':
            r = 44
            pts = [(px + int(r * math.sin(math.radians(60*i))), py + int(r * math.cos(math.radians(60*i)))) for i in range(6)]
            d.polygon(pts, fill=(20, 40, 80))
            d.polygon(pts, outline=col, width=2)
        else:
            d.rounded_rectangle([px-42, py-35, px+42, py+35], radius=6, fill=(20,40,80))
            d.rounded_rectangle([px-40, py-33, px+40, py+33], radius=5, outline=col, width=2)
        # mini aircraft on each
        d.polygon([(px-15, py+5), (px+20, py), (px+20, py-5), (px-15, py-5)], fill=col)
        d.polygon([(px+3, py-5), (px+3, py-20), (px-8, py-18), (px+3, py-5)], fill=col)

def draw_branding(d, cx, cy, text='AKROBACJA.COM', sub='Extra 300L SP-EKS', color=CYAN):
    """Draw brand text overlay on product."""
    try:
        # Try to find a system font
        font_paths = [
            '/System/Library/Fonts/Helvetica.ttc',
            '/System/Library/Fonts/Arial.ttf',
            '/Library/Fonts/Arial.ttf',
        ]
        font = None
        for fp in font_paths:
            if os.path.exists(fp):
                try:
                    font = ImageFont.truetype(fp, 16)
                    font_sm = ImageFont.truetype(fp, 11)
                    break
                except:
                    pass
        if not font:
            font = ImageFont.load_default()
            font_sm = font
    except:
        font = ImageFont.load_default()
        font_sm = font

    # Draw semi-transparent label at bottom
    d.rectangle([20, H-55, W-20, H-15], fill=(0, 0, 0, 140))
    d.text((cx, H-43), text, font=font, fill=color, anchor='mm')
    d.text((cx, H-25), sub, font=font_sm, fill=(150, 170, 200), anchor='mm')

PRODUCTS = [
    {
        'id': 'p1', 'file': 'polo-navy.jpg',
        'name': 'Technical Performance Polo', 'sub': 'Polo premium · 199 PLN',
        'draw': lambda d, cx, cy: (draw_shirt(d, cx, cy, (18, 40, 90), collar='polo'), draw_extra300_silhouette(d, cx, cy-10, 65, CYAN)),
    },
    {
        'id': 'koszulka', 'file': 'tshirt-akrobacja.jpg',
        'name': 'Koszulka akrobacja.com', 'sub': 'T-Shirt · 149 PLN',
        'draw': lambda d, cx, cy: (draw_shirt(d, cx, cy, (20, 45, 95)), draw_extra300_silhouette(d, cx, cy-10, 70, CYAN)),
    },
    {
        'id': 'p2', 'file': 'tshirt-cyan.jpg',
        'name': 'Technical T-Shirt Cyan', 'sub': 'T-Shirt · 149 PLN',
        'draw': lambda d, cx, cy: (draw_shirt(d, cx, cy, (0, 190, 215)), draw_extra300_silhouette(d, cx, cy-10, 70, NAVY)),
        'glow': (0, 180, 210),
    },
    {
        'id': 'czapka', 'file': 'czapka-pilot.jpg',
        'name': 'Czapka Pilot', 'sub': 'Cap · 79 PLN',
        'draw': lambda d, cx, cy: (draw_cap(d, cx, cy, (18, 40, 90)), draw_extra300_silhouette(d, cx, cy-80, 45, CYAN)),
    },
    {
        'id': 'p3', 'file': 'tshirt-navy.jpg',
        'name': 'Technical T-Shirt Navy', 'sub': 'T-Shirt · 149 PLN',
        'draw': lambda d, cx, cy: (draw_shirt(d, cx, cy, (15, 30, 75)), draw_extra300_silhouette(d, cx, cy-10, 65, (80, 120, 180))),
    },
    {
        'id': 'bluza', 'file': 'softshell-bluza.jpg',
        'name': 'Bluza Softshell', 'sub': 'Softshell · 379 PLN',
        'draw': lambda d, cx, cy: (draw_softshell(d, cx, cy, (12, 28, 68)), draw_extra300_silhouette(d, cx, cy-10, 60, CYAN)),
    },
    {
        'id': 'p4', 'file': 'jacket-softshell.jpg',
        'name': 'Pilot Softshell Jacket', 'sub': 'Kurtka · 349 PLN',
        'draw': lambda d, cx, cy: (draw_jacket(d, cx, cy, (10, 22, 55)), draw_extra300_silhouette(d, cx, cy-10, 62, CYAN)),
    },
    {
        'id': 'zawieszka', 'file': 'zawieszka-remove.jpg',
        'name': 'Zawieszka Remove Before Aerobatic', 'sub': 'Akcesoria · 39 PLN',
        'draw': lambda d, cx, cy: draw_zawieszka(d, cx, cy),
        'glow': (180, 20, 20),
    },
    {
        'id': 'p5', 'file': 'hoodie-navy.jpg',
        'name': 'Hoodie Akrobacja Navy', 'sub': 'Bluza · 249 PLN',
        'draw': lambda d, cx, cy: (draw_hoodie(d, cx, cy, (15, 32, 78)), draw_extra300_silhouette(d, cx, cy-15, 72, CYAN)),
    },
    {
        'id': 'p6', 'file': 'hoodie-cyan.jpg',
        'name': 'Hoodie Akrobacja Cyan', 'sub': 'Bluza · 249 PLN',
        'draw': lambda d, cx, cy: (draw_hoodie(d, cx, cy, (0, 175, 200)), draw_extra300_silhouette(d, cx, cy-15, 72, NAVY)),
        'glow': (0, 160, 190),
    },
    {
        'id': 'p7', 'file': 'snapback-cap.jpg',
        'name': 'Premium Snapback Cap', 'sub': 'Czapka · 89 PLN',
        'draw': lambda d, cx, cy: (draw_cap(d, cx, cy, (16, 36, 82)), draw_extra300_silhouette(d, cx, cy-90, 48, CYAN)),
    },
    {
        'id': 'p8', 'file': 'aluchain.jpg',
        'name': 'Laser-Engraved Aluchain', 'sub': 'Brelok · 49 PLN',
        'draw': lambda d, cx, cy: draw_keychain_aluchain(d, cx, cy),
        'glow': (150, 165, 185),
    },
    {
        'id': 'p9', 'file': 'sticker-pack.jpg',
        'name': 'Extra 300 Sticker Pack', 'sub': 'Naklejki · 29 PLN',
        'draw': lambda d, cx, cy: draw_sticker_pack(d, cx, cy),
    },
]

updates = []
for p in PRODUCTS:
    glow = p.get('glow', CYAN)
    img = make_base(glow_color=glow)
    d = ImageDraw.Draw(img, 'RGBA')

    cx, cy = W // 2, H // 2 - 25
    p['draw'](d, cx, cy)

    # Slight vignette
    vignette = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    for r in range(300, 0, -5):
        alpha = max(0, int(80 * (1 - r/300)))
        vd.ellipse([W//2-r, H//2-r, W//2+r, H//2+r], fill=(0,0,0,alpha))
    vignette_inv = Image.new('RGBA', (W, H), (0,0,0,0))
    full_vignette = Image.new('RGBA', (W, H), (0,0,0,80))
    mask = Image.new('L', (W, H), 255)
    md = ImageDraw.Draw(mask)
    md.ellipse([60, 60, W-60, H-60], fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(40))
    full_vignette.putalpha(mask)
    img = Image.alpha_composite(img.convert('RGBA'), full_vignette).convert('RGB')

    d2 = ImageDraw.Draw(img)
    draw_branding(d2, W//2, H//2, p['name'].upper(), p['sub'], glow)

    # Subtle glow border
    for thickness in range(3, 0, -1):
        alpha = 60 - thickness * 15
        border_col = tuple(min(255, int(c * alpha/60)) for c in glow)
        d2.rectangle([thickness, thickness, W-thickness, H-thickness], outline=border_col, width=1)

    out_path = os.path.join(OUT, p['file'])
    img.save(out_path, 'JPEG', quality=88)
    print(f"✓ {p['id']} → {p['file']}")
    updates.append((p['id'], f"/merch/{p['file']}"))

print(f'\nUpdating D1 ({len(updates)} products)...')
for pid, url in updates:
    sql = f"UPDATE products SET image_url='{url}' WHERE id='{pid}'"
    result = subprocess.run(
        ['wrangler', 'd1', 'execute', 'akrobacja-db', '--remote', '--command', sql],
        capture_output=True, text=True, cwd=ROOT
    )
    if 'success' in result.stdout.lower() or result.returncode == 0:
        print(f'  ✓ {pid} → {url}')
    else:
        print(f'  ✗ {pid}: {result.stderr[:100]}')

print('\nDone!')
