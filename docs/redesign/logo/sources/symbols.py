import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen2 import *

def B_parts(x0, top, bot, stem, bar, mid0, xs_u, xs_l):
    mid1 = mid0 + bar
    ru = (mid1 - top) / 2; rl = (bot - mid0) / 2
    rui = ru - bar; rli = rl - bar
    upper = f'M{n(x0)} {n(top)}H{n(xs_u)}A{n(ru)} {n(ru)} 0 0 1 {n(xs_u)} {n(mid1)}H{n(x0)}Z'
    cu = f'M{n(x0+stem)} {n(top+bar)}V{n(mid0)}H{n(xs_u)}A{n(rui)} {n(rui)} 0 0 0 {n(xs_u)} {n(top+bar)}Z'
    lower = f'M{n(x0)} {n(mid0)}H{n(xs_l)}A{n(rl)} {n(rl)} 0 0 1 {n(xs_l)} {n(bot)}H{n(x0)}Z'
    cl = f'M{n(x0+stem)} {n(mid1)}V{n(bot-bar)}H{n(xs_l)}A{n(rli)} {n(rli)} 0 0 0 {n(xs_l)} {n(mid1)}Z'
    return upper + cu, lower + cl, xs_l + rl

def B_geom(S):
    if S == 32: return dict(x0=7, top=3, bot=29, stem=6, bar=4, mid0=13, xs_u=16, xs_l=17)
    return dict(x0=3, top=2, bot=38, stem=8, bar=5, mid0=17, xs_u=17, xs_l=17.5)

def concept1(S, c, idp, mode='pos', gaps=None):
    g = B_geom(S); up, lo, right = B_parts(**g)
    if mode == 'pos':
        clip, _ = bands_positive(S, g['bot'], gaps or ([2, 3] if S == 32 else [2, 3, 5]))
    else:
        clip, _ = bands_negative(S, g['bot'], gaps or [2, 3, 5])
    defs = f'<clipPath id="{idp}"><path d="{clip}"/></clipPath>'
    # each bowl = outer minus counter (evenodd); the two bowls overlap → draw as two paths
    body = (f'<g clip-path="url(#{idp})" fill="{c["cobalt"]}" fill-rule="evenodd">'
            f'<path d="{up}"/><path d="{lo}"/></g>')
    return defs, body, right

def pin_d(cx, cy, r, tipy, hole=None):
    dd = tipy - cy; a = math.asin(r / dd)
    tx = r * math.cos(a); ty = r * math.sin(a)
    d = (f'M{n(cx)} {n(tipy)}L{n(cx-tx)} {n(cy+ty)}A{n(r)} {n(r)} 0 1 1 {n(cx+tx)} {n(cy+ty)}Z')
    if hole:
        h = hole
        d += f'M{n(cx)} {n(cy-h)}A{n(h)} {n(h)} 0 1 0 {n(cx)} {n(cy+h)}A{n(h)} {n(h)} 0 1 0 {n(cx)} {n(cy-h)}Z'
    return d

def concept2(S, c, idp, solids=None, hole=True):
    if S == 32: cx, cy, r, tip, hl = 16, 11.5, 10, 31, 3.5
    else: cx, cy, r, tip, hl = 20, 13, 12, 39, 4.5
    d = pin_d(cx, cy, r, tip, hl if hole else None)
    clip, cuts = bands_negative(S, tip, solids or ([2, 3, 5] if S == 32 else [2, 3, 5, 8]))
    defs = f'<clipPath id="{idp}"><path d="{clip}"/></clipPath>'
    body = f'<path clip-path="url(#{idp})" fill-rule="evenodd" fill="{c["cobalt"]}" d="{d}"/>'
    return defs, body, cx + r

def concept3(S, c, idp, gaps=None, orient='h'):
    col = c['brass_s'] if c['mode'] == 'light' else c['brass']
    if S == 32: x0, top, sh, tl, gaps_ = 2, 7, 7, 14, [2, 3, 5, 8]
    else: x0, top, sh, tl, gaps_ = 2, 9, 9, 18, [2, 3, 5, 8]
    gaps = gaps or gaps_
    xs = [x0 + 1]
    for gp in gaps: xs.append(xs[-1] + 2 + gp)
    right = xs[-1] + 2 + 1
    r = 2.5 if S == 32 else 3
    spine = (f'M{n(x0)} {n(top+sh)}V{n(top+r)}A{r} {r} 0 0 1 {n(x0+r)} {n(top)}H{n(right-r)}'
             f'A{r} {r} 0 0 1 {n(right)} {n(top+r)}V{n(top+sh)}Z')
    teeth = ''.join(f'M{n(x)} {n(top+sh-0.5)}H{n(x+2)}V{n(top+sh+tl-1)}A1 1 0 0 1 {n(x)} {n(top+sh+tl-1)}Z' for x in xs)
    body = f'<path fill="{col}" d="{spine}{teeth}"/>'
    return '', body, right
