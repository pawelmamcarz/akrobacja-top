#!/usr/bin/env python3
"""Composite SVG logos onto Flux garment photos.

Strategy:
- Flux bases have airplane silhouettes; logos go BELOW them
- badge/emblem on navy: direct_paste (crisp circular element)
- brand logo on cyan: multiply_blend (dark logo on light shirt)
- screen_blend for mini icons needing embroidery feel
"""
import os, io, re
from PIL import Image, ImageChops
import cairosvg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG  = ROOT
FLUX = os.path.join(ROOT, 'public', 'merch')

_DRUK_RE = re.compile(r'<text[^>]*>[^<]*DRUK[^<]*</text>', re.IGNORECASE | re.DOTALL)

def svg2img(name, w):
    path = os.path.join(SVG, name)
    with open(path, 'rb') as f:
        svg_data = f.read().decode('utf-8', errors='replace')
    svg_data = _DRUK_RE.sub('', svg_data)
    png = cairosvg.svg2png(bytestring=svg_data.encode('utf-8'), output_width=w)
    return Image.open(io.BytesIO(png)).convert('RGBA')

def direct_paste(base_rgb, logo_rgba, cx, cy, opacity=1.0):
    """Alpha-composite logo at full colour — crisp patches/badges."""
    W, H = base_rgb.size
    canvas = base_rgb.convert('RGBA')
    if opacity < 1.0:
        r, g, b, a = logo_rgba.split()
        a = a.point(lambda p: int(p * opacity))
        logo_rgba = Image.merge('RGBA', (r, g, b, a))
    lw, lh = logo_rgba.size
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layer.paste(logo_rgba, (cx - lw // 2, cy - lh // 2), logo_rgba)
    return Image.alpha_composite(canvas, layer).convert('RGB')

def screen_blend(base_rgb, logo_rgba, cx, cy, opacity=1.0):
    """Screen blend — subtle white/light logos on dark backgrounds."""
    W, H = base_rgb.size
    base_rgba = base_rgb.convert('RGBA')
    lw, lh = logo_rgba.size
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layer.paste(logo_rgba, (cx - lw // 2, cy - lh // 2), logo_rgba)
    br, bg, bb, _ = base_rgba.split()
    lr, lg, lb, la = layer.split()
    if opacity < 1.0:
        la = la.point(lambda p: int(p * opacity))
    return Image.merge('RGB', (
        Image.composite(ImageChops.screen(br, lr), br, la),
        Image.composite(ImageChops.screen(bg, lg), bg, la),
        Image.composite(ImageChops.screen(bb, lb), bb, la),
    ))

def multiply_blend(base_rgb, logo_rgba, cx, cy, opacity=1.0):
    """Multiply blend — dark logos on light/cyan backgrounds."""
    W, H = base_rgb.size
    base_rgba = base_rgb.convert('RGBA')
    lw, lh = logo_rgba.size
    layer = Image.new('RGBA', (W, H), (255, 255, 255, 0))
    layer.paste(logo_rgba, (cx - lw // 2, cy - lh // 2), logo_rgba)
    br, bg, bb, _ = base_rgba.split()
    lr, lg, lb, la = layer.split()
    if opacity < 1.0:
        la = la.point(lambda p: int(p * opacity))
    return Image.merge('RGB', (
        Image.composite(ImageChops.multiply(br, lr), br, la),
        Image.composite(ImageChops.multiply(bg, lg), bg, la),
        Image.composite(ImageChops.multiply(bb, lb), bb, la),
    ))

def save(img_rgb, name):
    img_rgb.save(os.path.join(FLUX, name), 'JPEG', quality=93)
    print(f'  ✓ {name}')

print('Compositing SVG logos onto Flux garment photos…\n')

# ─────────────────────────────────────────────────────────────────────────────
# NAVY T-SHIRTS — airplane already on chest; badge goes lower
# ─────────────────────────────────────────────────────────────────────────────

# koszulka: detailed airplane outline mid-chest → ace card below (direct paste)
base = Image.open(os.path.join(FLUX, 'tshirt-akrobacja.jpg')).convert('RGB')
W, H = base.size
logo = svg2img('alt-ace.svg', int(W * 0.20))
result = direct_paste(base, logo, W//2, int(H * 0.71), opacity=0.92)
save(result, 'tshirt-akrobacja.jpg')

# p3: large white airplane front-view → badge-bone below (direct paste)
base = Image.open(os.path.join(FLUX, 'tshirt-navy.jpg')).convert('RGB')
logo = svg2img('badge-bone.svg', int(W * 0.24))
result = direct_paste(base, logo, W//2, int(H * 0.68), opacity=0.92)
save(result, 'tshirt-navy.jpg')

# v1 flat lay → alt-inverted circle below airplane (direct paste)
base = Image.open(os.path.join(FLUX, 'tshirt-navy-v1.jpg')).convert('RGB')
logo = svg2img('alt-inverted.svg', int(W * 0.26))
result = direct_paste(base, logo, W//2, int(H * 0.64), opacity=0.92)
save(result, 'tshirt-navy-v1.jpg')

# akrobacja-v1 flat lay → badge-bone (direct paste)
base = Image.open(os.path.join(FLUX, 'tshirt-akrobacja-v1.jpg')).convert('RGB')
logo = svg2img('badge-bone.svg', int(W * 0.24))
result = direct_paste(base, logo, W//2, int(H * 0.64), opacity=0.92)
save(result, 'tshirt-akrobacja-v1.jpg')

# ─────────────────────────────────────────────────────────────────────────────
# CYAN T-SHIRTS — multiply blend (dark navy logo on cyan)
# ─────────────────────────────────────────────────────────────────────────────

# p2: tiny left-chest airplane → full logo center-chest (multiply)
base = Image.open(os.path.join(FLUX, 'tshirt-cyan.jpg')).convert('RGB')
logo = svg2img('akrobacja-primary.svg', int(W * 0.50))
result = multiply_blend(base, logo, W//2, int(H * 0.50))
save(result, 'tshirt-cyan.jpg')

# cyan-v1 flat lay → badge-navy (multiply)
base = Image.open(os.path.join(FLUX, 'tshirt-cyan-v1.jpg')).convert('RGB')
logo = svg2img('badge-navy.svg', int(W * 0.36))
result = multiply_blend(base, logo, W//2, int(H * 0.50))
save(result, 'tshirt-cyan-v1.jpg')

# ─────────────────────────────────────────────────────────────────────────────
# HOODIES — airplane upper chest; badge in kangaroo pocket area
# ─────────────────────────────────────────────────────────────────────────────

# p5 navy hoodie: airplane upper chest → badge-bone chest area (direct paste)
base = Image.open(os.path.join(FLUX, 'hoodie-navy.jpg')).convert('RGB')
W, H = base.size
logo = svg2img('badge-bone.svg', int(W * 0.22))
result = direct_paste(base, logo, W//2, int(H * 0.60), opacity=0.90)
save(result, 'hoodie-navy.jpg')

# p6 cyan hoodie → badge-navy multiply
base = Image.open(os.path.join(FLUX, 'hoodie-cyan.jpg')).convert('RGB')
logo = svg2img('badge-navy.svg', int(W * 0.34))
result = multiply_blend(base, logo, W//2, int(H * 0.52))
save(result, 'hoodie-cyan.jpg')

# ─────────────────────────────────────────────────────────────────────────────
# POLO — small left-chest logos
# ─────────────────────────────────────────────────────────────────────────────

base = Image.open(os.path.join(FLUX, 'polo-navy.jpg')).convert('RGB')
W, H = base.size
logo = svg2img('mini-speks.svg', int(W * 0.15))
result = screen_blend(base, logo, int(W * 0.37), int(H * 0.38))
save(result, 'polo-navy.jpg')

base = Image.open(os.path.join(FLUX, 'polo-navy-v1.jpg')).convert('RGB')
logo = svg2img('badge-bone.svg', int(W * 0.28))
result = direct_paste(base, logo, W//2, int(H * 0.50), opacity=0.88)
save(result, 'polo-navy-v1.jpg')

# ─────────────────────────────────────────────────────────────────────────────
# CAPS — airplane on front; badge-bone accent on brim/lower crown
# ─────────────────────────────────────────────────────────────────────────────

# czapka-pilot: airplane already embroidered on crown — use as-is (no overlay)
print('  ✓ czapka-pilot.jpg (no overlay — airplane embroidery already perfect)')

# snapback → mini-speks screen (small embroidery feel)
base = Image.open(os.path.join(FLUX, 'snapback-cap.jpg')).convert('RGB')
logo = svg2img('mini-speks.svg', int(W * 0.18))
result = screen_blend(base, logo, W//2, int(H * 0.38))
save(result, 'snapback-cap.jpg')

# snapback-v1 → badge-bone direct paste
base = Image.open(os.path.join(FLUX, 'snapback-v1.jpg')).convert('RGB')
logo = svg2img('badge-bone.svg', int(W * 0.22))
result = direct_paste(base, logo, W//2, int(H * 0.38), opacity=0.85)
save(result, 'snapback-v1.jpg')

# ─────────────────────────────────────────────────────────────────────────────
# JACKETS / SOFTSHELL
# ─────────────────────────────────────────────────────────────────────────────

# softshell-bluza → mini-speks small left chest (screen)
base = Image.open(os.path.join(FLUX, 'softshell-bluza.jpg')).convert('RGB')
W, H = base.size
logo = svg2img('mini-speks.svg', int(W * 0.13))
result = screen_blend(base, logo, int(W * 0.35), int(H * 0.37))
save(result, 'softshell-bluza.jpg')

# jacket-softshell → Flux base has wrong racing design; use badge-bone small left-chest only
base = Image.open(os.path.join(FLUX, 'jacket-softshell.jpg')).convert('RGB')
logo = svg2img('badge-bone.svg', int(W * 0.18))
result = direct_paste(base, logo, int(W * 0.63), int(H * 0.46), opacity=0.88)
save(result, 'jacket-softshell.jpg')

# jacket-softshell-v1 → badge-bone direct paste
base = Image.open(os.path.join(FLUX, 'jacket-softshell-v1.jpg')).convert('RGB')
logo = svg2img('badge-bone.svg', int(W * 0.28))
result = direct_paste(base, logo, W//2, int(H * 0.52), opacity=0.88)
save(result, 'jacket-softshell-v1.jpg')

print('\nDone.')
