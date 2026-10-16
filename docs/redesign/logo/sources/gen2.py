import sys, math, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ttf import TTF, path_of
FONT = TTF('/mnt/skills/examples/canvas-design/canvas-fonts/BricolageGrotesque-Bold.ttf')
OUT = os.path.dirname(os.path.abspath(__file__))
LIGHT = dict(fg='#0C1428', cobalt='#2350F5', brass='#B07A22', brass_s='#8A5A12', mode='light')
DARK = dict(fg='#EDF1FA', cobalt='#7C9BFF', brass='#E2B66A', brass_s='#E2B66A', mode='dark')

def n(v, nd=2):
    s = ('%.*f' % (nd, v)).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

def wordmark(x0, baseline, capH, tracking=-0.02, text='FindBarber'):
    sx = capH / FONT.capH; x = x0; parts = []
    for ch in text:
        g = FONT.cmap[ord(ch)]
        parts.append(path_of(FONT.contours(g), sx, x, baseline, nd=1))
        x += (FONT.adv(g) + tracking * 1000) * sx
    return ''.join(parts), x - tracking * 1000 * sx

def bands_positive(W, bottom, gaps, line=2):
    """Solid above, then 2-unit lines; gaps (top->bottom) grow. Last line ends at `bottom`."""
    ys = []; y = bottom
    ys.append((y - line, y)); y -= line
    for gp in reversed(gaps[1:]):
        y -= gp; ys.append((y - line, y)); y -= line
    y -= gaps[0]
    d = f'M-1 -1H{W+1}V{n(y)}H-1Z' + ''.join(f'M-1 {n(a)}H{W+1}V{n(b)}H-1Z' for a, b in ys)
    return d, y

def bands_negative(W, bottom, solids, cut=2):
    """Solid everywhere except 2-unit cuts; solid bands (bottom->top) = solids, e.g. [2,3,5]."""
    y = bottom; cuts = []
    for s in solids:
        y -= s; cuts.append((y - cut, y)); y -= cut
    # clip = complement of cuts
    pieces = []; top = -1
    for a, b in sorted(cuts):
        pieces.append((top, a)); top = b
    pieces.append((top, bottom + 1))
    return ''.join(f'M-1 {n(a)}H{W+1}V{n(b)}H-1Z' for a, b in pieces), cuts

def svg(w, h, body, defs=''):
    d = f'<defs>{defs}</defs>' if defs else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n(w)} {n(h)}" role="img">'
            f'<title>FindBarber</title>{d}{body}</svg>\n')
