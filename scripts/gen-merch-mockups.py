#!/usr/bin/env python3
"""Composite real SVG logos onto product mockup silhouettes."""
import os, io, math, subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import cairosvg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = ROOT  # SVGs sit in project root
OUT = os.path.join(ROOT, 'public', 'merch')
os.makedirs(OUT, exist_ok=True)

W = H = 1000

# Brand palette
NAVY       = (10,  47, 124)
DARK_NAVY  = (6,   28,  76)
CYAN       = (0,  210, 230)
WHITE      = (255, 255, 255)
OFF_WHITE  = (248, 248, 248)
LIGHT_GRAY = (230, 230, 230)
MUG_WHITE  = (252, 252, 252)

# ── SVG → PIL ────────────────────────────────────────────────────────────────

def svg2img(name, w=None, h=None):
    path = os.path.join(SVG, name)
    kw = {}
    if w: kw['output_width']  = w
    if h: kw['output_height'] = h
    return Image.open(io.BytesIO(cairosvg.svg2png(url=path, **kw))).convert('RGBA')

# ── Shape helpers ─────────────────────────────────────────────────────────────

def tshirt_mask(size=(W,H), sleeve_len=0.20):
    """Returns RGBA mask of a crew-neck t-shirt."""
    w, h = size
    img = Image.new('L', size, 0)
    d   = ImageDraw.Draw(img)
    # proportions
    bx, bw = w*0.21, w*0.58          # body left, body width
    by, bh = h*0.24, h*0.67          # body top (collar), body height
    sl = bw * sleeve_len             # sleeve horizontal extent
    sh = bh * 0.22                   # sleeve vertical drop
    nw = bw * 0.26                   # neck width
    nh = bh * 0.075                  # neck depth
    sd = bh * 0.04                   # shoulder drop

    pts = [
        (bx,         by+sd),          # L shoulder outer
        (bx-sl,      by+sd+sh*0.28),  # L sleeve tip top
        (bx-sl+sl*0.12, by+sd+sh),    # L sleeve tip bot
        (bx+bw*0.09, by+sd+sh*0.42),  # L armhole
        (bx,         by+bh),          # bot-L
        (bx+bw,      by+bh),          # bot-R
        (bx+bw-bw*0.09, by+sd+sh*0.42),
        (bx+bw+sl-sl*0.12, by+sd+sh),
        (bx+bw+sl,   by+sd+sh*0.28),
        (bx+bw,      by+sd),
        (bx+bw-nw,   by),             # collar-R
        (bx+bw/2,    by+nh),          # collar-center
        (bx+nw,      by),             # collar-L
    ]
    d.polygon(pts, fill=255)
    return img

def hoodie_mask(size=(W,H)):
    """Returns RGBA mask of a pullover hoodie."""
    w, h = size
    img = Image.new('L', size, 0)
    d   = ImageDraw.Draw(img)
    bx, bw = w*0.19, w*0.62
    by, bh = h*0.20, h*0.72
    sl = bw * 0.26
    sh = bh * 0.26
    sd = bh * 0.05
    nw = bw * 0.20
    nh = bh * 0.16

    # hood triangle above collar
    hood_pts = [
        (bx+nw,      by),
        (bx+bw/2,    by - nh*1.8),
        (bx+bw-nw,   by),
    ]
    d.polygon(hood_pts, fill=255)

    pts = [
        (bx,         by+sd),
        (bx-sl,      by+sd+sh*0.28),
        (bx-sl+sl*0.10, by+sd+sh),
        (bx+bw*0.08, by+sd+sh*0.40),
        (bx,         by+bh),
        (bx+bw,      by+bh),
        (bx+bw-bw*0.08, by+sd+sh*0.40),
        (bx+bw+sl-sl*0.10, by+sd+sh),
        (bx+bw+sl,   by+sd+sh*0.28),
        (bx+bw,      by+sd),
        (bx+bw-nw,   by),
        (bx+bw/2,    by+nh*0.6),
        (bx+nw,      by),
    ]
    d.polygon(pts, fill=255)

    # kangaroo pocket
    pk_x = bx+bw*0.25
    pk_y = by+bh*0.60
    pk_w = bw*0.50
    pk_h = bh*0.18
    d.rectangle([pk_x, pk_y, pk_x+pk_w, pk_y+pk_h], fill=200)  # slightly darker

    return img

def cap_mask(size=(W,H)):
    """6-panel baseball cap viewed from 3/4 front."""
    w, h = size
    img = Image.new('L', size, 0)
    d   = ImageDraw.Draw(img)
    cx, cy = w*0.50, h*0.46
    # crown (ellipse-ish)
    d.ellipse([w*0.14, h*0.14, w*0.86, h*0.68], fill=255)
    # brim
    brim_pts = [
        (w*0.18, h*0.62),
        (w*0.82, h*0.62),
        (w*0.90, h*0.76),
        (w*0.10, h*0.76),
    ]
    d.polygon(brim_pts, fill=255)
    # squircle top
    d.ellipse([w*0.30, h*0.10, w*0.70, h*0.30], fill=255)
    return img

def mug_mask(size=(W,H)):
    """White ceramic mug viewed from 3/4 angle."""
    w, h = size
    img = Image.new('L', size, 0)
    d   = ImageDraw.Draw(img)
    # body
    mx, mw = w*0.20, w*0.57
    my, mh = h*0.22, h*0.56
    d.rounded_rectangle([mx, my, mx+mw, my+mh], radius=int(w*0.04), fill=255)
    # handle (C-shape approximation)
    hx = mx + mw
    hy = my + mh*0.15
    hw = w*0.16
    hh = mh*0.55
    d.ellipse([hx, hy, hx+hw*2, hy+hh], fill=255)
    d.ellipse([hx+hw*0.3, hy+hh*0.2, hx+hw*1.7, hy+hh*0.8], fill=0)
    # rim oval
    d.ellipse([mx, my-int(h*0.025), mx+mw, my+int(h*0.025)], fill=255)
    return img

# ── Shading / depth ───────────────────────────────────────────────────────────

def shade(base_color, mask, highlights=True):
    """Apply gradient shading to a garment shape."""
    w, h = mask.size
    img = Image.new('RGBA', (w,h), (*base_color, 0))
    # fill with color where mask is white
    colored = Image.new('RGBA', (w,h), (*base_color, 255))
    img.paste(colored, mask=mask)

    # left-edge shadow
    shadow = Image.new('RGBA', (w,h), (0,0,0,0))
    for i in range(80):
        alpha = int(55 * (1 - i/80)**1.6)
        sd = ImageDraw.Draw(shadow)
        sd.line([(i, 0),(i, h)], fill=(0,0,0,alpha))
    img = Image.alpha_composite(img, shadow)

    # right-edge shadow (mirror)
    shadow_r = shadow.transpose(Image.FLIP_LEFT_RIGHT)
    img = Image.alpha_composite(img, shadow_r)

    if highlights:
        # chest highlight
        hi = Image.new('RGBA', (w,h), (0,0,0,0))
        hid = ImageDraw.Draw(hi)
        hid.ellipse([w*0.28, h*0.26, w*0.68, h*0.52], fill=(255,255,255,22))
        img = Image.alpha_composite(img, hi)

    return img

# ── Logo placement ────────────────────────────────────────────────────────────

def place_logo(product_img, logo_img, cx_frac, cy_frac, logo_w_frac, angle=0):
    """Place logo centred at (cx_frac, cy_frac), sized logo_w_frac × product width."""
    pw, ph = product_img.size
    lw_target = int(pw * logo_w_frac)
    ratio = lw_target / logo_img.width
    lh_target = int(logo_img.height * ratio)
    logo_r = logo_img.resize((lw_target, lh_target), Image.LANCZOS)
    if angle:
        logo_r = logo_r.rotate(angle, expand=True, resample=Image.BICUBIC)
    x = int(pw * cx_frac - logo_r.width  / 2)
    y = int(ph * cy_frac - logo_r.height / 2)
    product_img.paste(logo_r, (x, y), logo_r)

# ── Canvas builder ────────────────────────────────────────────────────────────

def make_canvas(bg=(255,255,255)):
    """White studio background with subtle shadow."""
    canvas = Image.new('RGB', (W,H), bg)
    # subtle vignette
    vign = Image.new('RGBA', (W,H), (0,0,0,0))
    vd = ImageDraw.Draw(vign)
    for r in range(500, 0, -4):
        a = int(18 * (1 - r/500)**2)
        vd.ellipse([W//2-r, H//2-r, W//2+r, H//2+r], fill=(0,0,0,a))
    canvas.paste(Image.new('RGB',(W,H),(0,0,0)), mask=vign.split()[3])
    return canvas

def drop_shadow(layer, offset=(8,12), blur=14, opacity=80):
    """Add soft drop shadow below a garment."""
    alpha = layer.split()[3]
    shadow = Image.new('RGBA', (W,H), (0,0,0,0))
    shadow.paste(Image.new('RGBA',(W,H),(0,0,0,opacity)), mask=alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    shifted = Image.new('RGBA', (W,H), (0,0,0,0))
    shifted.paste(shadow, offset)
    return shifted

# ── Product builder ───────────────────────────────────────────────────────────

def build(out_name, mask_fn, garment_color, logo_name,
          cx=0.50, cy=0.48, lw=0.36, angle=0, bg=OFF_WHITE,
          logo_resize_w=None):
    canvas = make_canvas(bg)
    mask   = mask_fn()
    garment = shade(garment_color, mask)
    shadow  = drop_shadow(garment)
    base = Image.new('RGBA', (W,H), (0,0,0,0))
    base = Image.alpha_composite(base, shadow)
    base = Image.alpha_composite(base, garment)
    logo = svg2img(logo_name, w=logo_resize_w or int(W*lw))
    # composite logo onto garment
    place_logo(base, logo, cx, cy, lw, angle)
    # mask again so logo doesn't bleed outside garment
    final = Image.new('RGBA', (W,H), (*bg,255))
    final = Image.alpha_composite(final, base)
    final.convert('RGB').save(os.path.join(OUT, out_name), 'JPEG', quality=92)
    print(f'  ✓ {out_name}')

# ── Generate all products ─────────────────────────────────────────────────────

print('Generating mockups from real SVG logos…\n')

# ── T-SHIRTS ─────────────────────────────────────────────────────────────────
# koszulka — navy + ACE OF SP-EKS card centered
build('koszulka.jpg',        tshirt_mask, NAVY,  'alt-ace.svg',
      cx=0.50, cy=0.50, lw=0.40)

# tshirt-akrobacja-v1 — navy + primary logo (logo fits above mid-chest)
build('tshirt-akrobacja-v1.jpg', tshirt_mask, NAVY,  'akrobacja-primary.svg',
      cx=0.50, cy=0.50, lw=0.50)

# tshirt-cyan-v1 — cyan + badge-navy
build('tshirt-cyan-v1.jpg',  tshirt_mask, CYAN,  'badge-navy.svg',
      cx=0.50, cy=0.48, lw=0.36)

# tshirt-navy-v1 — navy + inverted club
build('tshirt-navy-v1.jpg',  tshirt_mask, NAVY,  'alt-inverted.svg',
      cx=0.50, cy=0.50, lw=0.40)

# p2 — cyan + akrobacja-primary (works on light bg)
build('tshirt-cyan.jpg',     tshirt_mask, CYAN,  'akrobacja-primary.svg',
      cx=0.50, cy=0.50, lw=0.50)

# p3 — navy + badge-bone (light badge pops on dark)
build('tshirt-navy.jpg',     tshirt_mask, NAVY,  'badge-bone.svg',
      cx=0.50, cy=0.48, lw=0.36)

# ── HOODIES ──────────────────────────────────────────────────────────────────
# p5 — navy hoodie + primary logo
build('hoodie-navy.jpg',     hoodie_mask, NAVY,  'akrobacja-primary.svg',
      cx=0.50, cy=0.52, lw=0.46)

# p6 — cyan hoodie + badge-navy
build('hoodie-cyan.jpg',     hoodie_mask, CYAN,  'badge-navy.svg',
      cx=0.50, cy=0.50, lw=0.38)

# ── POLO ─────────────────────────────────────────────────────────────────────
# p1 — navy polo + mini-speks (left chest embroidery style)
build('polo-navy.jpg',       tshirt_mask, NAVY,  'mini-speks.svg',
      cx=0.38, cy=0.40, lw=0.18)

# polo-navy-v1 — navy polo + badge-bone
build('polo-navy-v1.jpg',    tshirt_mask, NAVY,  'badge-bone.svg',
      cx=0.50, cy=0.48, lw=0.32)

# ── CAPS ─────────────────────────────────────────────────────────────────────
# czapka — navy cap + badge-bone front panel
build('czapka-pilot.jpg',    cap_mask,   NAVY,  'badge-bone.svg',
      cx=0.50, cy=0.42, lw=0.38)

# snapback-v1 — navy cap + mini-speks
build('snapback-v1.jpg',     cap_mask,   NAVY,  'mini-speks.svg',
      cx=0.50, cy=0.42, lw=0.28)

# p7 — navy snapback + akrobacja-onnavy
build('snapback-cap.jpg',    cap_mask,   DARK_NAVY, 'akrobacja-onnavy.svg',
      cx=0.50, cy=0.42, lw=0.40)

# ── SOFTSHELL / JACKET ───────────────────────────────────────────────────────
# bluza + p4 — navy softshell + primary logo left-chest + full
build('softshell-bluza.jpg', tshirt_mask, DARK_NAVY, 'mini-speks.svg',
      cx=0.37, cy=0.40, lw=0.18)

build('jacket-softshell.jpg', tshirt_mask, DARK_NAVY, 'akrobacja-primary.svg',
      cx=0.50, cy=0.50, lw=0.46)

# jacket-softshell-v1
build('jacket-softshell-v1.jpg', tshirt_mask, DARK_NAVY, 'badge-bone.svg',
      cx=0.50, cy=0.48, lw=0.34)

# ── MUG ──────────────────────────────────────────────────────────────────────
# Nowy produkt: biały kubek + primary logo
build('kubek-akrobacja.jpg', mug_mask, MUG_WHITE, 'akrobacja-primary.svg',
      cx=0.36, cy=0.50, lw=0.34, bg=(245,245,245))

# kubek + badge-navy
build('kubek-badge.jpg',     mug_mask, MUG_WHITE, 'badge-navy.svg',
      cx=0.36, cy=0.50, lw=0.28, bg=(245,245,245))

# ── ACCESSORIES already handled by Flux — skip aluchain / zawieszka / stickers ─

print('\nDone.')
