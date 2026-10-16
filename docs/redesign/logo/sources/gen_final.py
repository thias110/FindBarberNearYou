import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen2 import *
from symbols import B_parts, B_geom, pin_d

# --- Concept 1 « Nuque » : capitale B dont la panse inférieure s'efface en paliers
def c1(S, c, idp):
    g = B_geom(S); up, lo, right = B_parts(**g)
    clip, solid_end = bands_positive(S, g['bot'], [2, 3] if S == 32 else [2, 3, 5])
    defs = f'<clipPath id="{idp}"><path d="{clip}"/></clipPath>'
    body = (f'<g fill="{c["cobalt"]}" fill-rule="evenodd" clip-path="url(#{idp})">'
            f'<path d="{up}"/><path d="{lo}"/></g>')
    return defs, body, right

# --- Concept 2 « Repère » : épingle de carte dont la pointe s'efface
def c2(S, c, idp):
    # la pointe géométrique descend sous la dernière ligne pour que celle-ci garde ~3 unités de large
    if S == 32: cx, cy, r, tip, last, hl, gaps = 16, 11.5, 10, 32.5, 31, 3.5, [2, 3]
    else: cx, cy, r, tip, last, hl, gaps = 20, 13, 12, 41, 39, 4.5, [2, 3, 5]
    d = pin_d(cx, cy, r, tip, hl)
    clip, _ = bands_positive(S, last, gaps)
    defs = f'<clipPath id="{idp}"><path d="{clip}"/></clipPath>'
    body = f'<path fill="{c["cobalt"]}" fill-rule="evenodd" clip-path="url(#{idp})" d="{d}"/>'
    return defs, body, cx + r

# --- Concept 3 « Peigne » : peigne vertical, dents fines puis larges (le dégradé)
def c3(S, c, idp):
    if S == 32: x0, top, tl, sw, gaps = 7, 1, 13, 5, [2, 2, 2, 2, 3, 5]
    else: x0, top, tl, sw, gaps = 2, 2, 16, 6, [2, 2, 2, 3, 5, 8]
    ys = [top]
    for gp in gaps: ys.append(ys[-1] + 2 + gp)
    bot = ys[-1] + 2; xs = x0 + tl; xr = xs + sw; r = 2
    spine = (f'M{n(xs)} {n(top)}H{n(xr-r)}A{r} {r} 0 0 1 {n(xr)} {n(top+r)}V{n(bot-r)}'
             f'A{r} {r} 0 0 1 {n(xr-r)} {n(bot)}H{n(xs)}Z')
    # même sens de parcours que le dos (horaire) : pas de trou à la jonction en nonzero
    teeth = ''.join(f'M{n(x0+1)} {n(y)}H{n(xs+0.5)}V{n(y+2)}H{n(x0+1)}A1 1 0 0 1 {n(x0+1)} {n(y)}Z' for y in ys)
    return '', f'<path fill="{c["brass"]}" d="{spine}{teeth}"/>', xr

CONCEPTS = [(1, 'nuque', c1), (2, 'repere', c2), (3, 'peigne', c3)]
CAPH, GAP = 17, 11

def build():
    files = []
    for num, slug, fn in CONCEPTS:
        for c in (LIGHT, DARK):
            m = c['mode']; idp = f'fb{num}{m[0]}'
            defs, body, _ = fn(32, c, idp + 'i')
            nm = f'concept-{num}-{slug}-icon-{m}.svg'
            open(os.path.join(OUT, nm), 'w').write(svg(32, 32, body, defs)); files.append(nm)
            defs, body, right = fn(40, c, idp + 'f')
            wm, end = wordmark(right + GAP, 20 + CAPH / 2, CAPH)
            body += f'<path fill="{c["fg"]}" d="{wm}"/>'
            nm = f'concept-{num}-{slug}-full-{m}.svg'
            open(os.path.join(OUT, nm), 'w').write(svg(math.ceil(end + 1), 40, body, defs)); files.append(nm)
    return files

if __name__ == '__main__':
    for f in build(): print(f, os.path.getsize(os.path.join(OUT, f)))
