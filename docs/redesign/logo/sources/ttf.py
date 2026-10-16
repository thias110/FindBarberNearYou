# Minimal TrueType outline reader (glyf/loca/cmap4/hmtx) -> SVG path data.
import struct
class TTF:
    def __init__(s, path):
        d = s.d = open(path, 'rb').read()
        n = struct.unpack('>H', d[4:6])[0]
        s.t = {}
        for i in range(n):
            tag, cs, off, ln = struct.unpack('>4sIII', d[12+16*i:28+16*i])
            s.t[tag.decode()] = (off, ln)
        h = s.t['head'][0]
        s.upm = struct.unpack('>H', d[h+18:h+20])[0]
        s.locfmt = struct.unpack('>h', d[h+50:h+52])[0]
        m = s.t['maxp'][0]; s.ng = struct.unpack('>H', d[m+4:m+6])[0]
        hh = s.t['hhea'][0]; s.nhm = struct.unpack('>H', d[hh+34:hh+36])[0]
        s.asc, s.desc = struct.unpack('>hh', d[hh+4:hh+8])
        o2 = s.t['OS/2'][0]
        s.capH = struct.unpack('>h', d[o2+88:o2+90])[0]
        s.xH = struct.unpack('>h', d[o2+86:o2+88])[0]
        s._cmap()
    def _cmap(s):
        d = s.d; c = s.t['cmap'][0]
        n = struct.unpack('>H', d[c+2:c+4])[0]
        s.cmap = {}
        for i in range(n):
            pid, eid, off = struct.unpack('>HHI', d[c+4+8*i:c+12+8*i])
            o = c+off
            if struct.unpack('>H', d[o:o+2])[0] == 4 and pid == 3:
                segx2 = struct.unpack('>H', d[o+6:o+8])[0]; seg = segx2//2
                ends = struct.unpack('>%dH' % seg, d[o+14:o+14+segx2])
                st = o+16+segx2
                starts = struct.unpack('>%dH' % seg, d[st:st+segx2])
                deltas = struct.unpack('>%dh' % seg, d[st+segx2:st+2*segx2])
                ro = st+2*segx2
                ranges = struct.unpack('>%dH' % seg, d[ro:ro+segx2])
                for k in range(seg):
                    for ch in range(starts[k], ends[k]+1):
                        if ch == 0xFFFF: continue
                        if ranges[k] == 0: g = (ch+deltas[k]) & 0xFFFF
                        else:
                            a = ro+2*k+ranges[k]+2*(ch-starts[k])
                            g = struct.unpack('>H', s.d[a:a+2])[0]
                            if g: g = (g+deltas[k]) & 0xFFFF
                        s.cmap[ch] = g
                return
    def adv(s, g):
        h = s.t['hmtx'][0]; i = min(g, s.nhm-1)
        return struct.unpack('>H', s.d[h+4*i:h+4*i+2])[0]
    def _loc(s, g):
        l = s.t['loca'][0]
        if s.locfmt == 0:
            a, b = struct.unpack('>HH', s.d[l+2*g:l+2*g+4]); return a*2, b*2
        return struct.unpack('>II', s.d[l+4*g:l+4*g+8])
    def contours(s, g, dx=0, dy=0):
        a, b = s._loc(g)
        if a == b: return []
        o = s.t['glyf'][0]+a; d = s.d
        nc = struct.unpack('>h', d[o:o+2])[0]
        if nc < 0:
            res = []; p = o+10
            while True:
                fl, gi = struct.unpack('>HH', d[p:p+4]); p += 4
                if fl & 1: x, y = struct.unpack('>hh', d[p:p+4]); p += 4
                else: x, y = struct.unpack('>bb', d[p:p+2]); p += 2
                if fl & 8: p += 2
                elif fl & 0x40: p += 4
                elif fl & 0x80: p += 8
                res += s.contours(gi, dx+x, dy+y)
                if not fl & 0x20: break
            return res
        ends = struct.unpack('>%dH' % nc, d[o+10:o+10+2*nc])
        p = o+10+2*nc; il = struct.unpack('>H', d[p:p+2])[0]; p += 2+il
        npts = ends[-1]+1; flags = []
        while len(flags) < npts:
            f = d[p]; p += 1; flags.append(f)
            if f & 8:
                r = d[p]; p += 1; flags += [f]*r
        xs = []; v = 0
        for f in flags:
            if f & 2: dv = d[p]; p += 1; v += dv if f & 16 else -dv
            elif not f & 16: v += struct.unpack('>h', d[p:p+2])[0]; p += 2
            xs.append(v)
        ys = []; v = 0
        for f in flags:
            if f & 4: dv = d[p]; p += 1; v += dv if f & 32 else -dv
            elif not f & 32: v += struct.unpack('>h', d[p:p+2])[0]; p += 2
            ys.append(v)
        out = []; st = 0
        for e in ends:
            out.append([(xs[i]+dx, ys[i]+dy, flags[i] & 1) for i in range(st, e+1)]); st = e+1
        return out
def path_of(contours, sx, ox, oy, nd=2):
    """scale sx, x offset ox, baseline oy (y down)."""
    def P(x, y): return (round(ox+x*sx, nd), round(oy-y*sx, nd))
    def f(v): 
        s_ = ('%.*f' % (nd, v)).rstrip('0').rstrip('.')
        return s_ if s_ not in ('-0', '') else '0'
    cmds = []
    for c in contours:
        n = len(c)
        if not n: continue
        # find start on-curve
        k = next((i for i in range(n) if c[i][2]), None)
        if k is None:
            a, b = c[0], c[1]; start = ((a[0]+b[0])/2, (a[1]+b[1])/2, 1); pts = c[1:]+c[:1]
        else:
            start = c[k]; pts = c[k+1:]+c[:k]
        pts = pts+[start]
        x, y = P(start[0], start[1]); cmds.append('M%s %s' % (f(x), f(y)))
        ctrl = None
        for q in pts:
            if q[2]:
                X, Y = P(q[0], q[1])
                if ctrl: cmds.append('Q%s %s %s %s' % (f(ctrl[0]), f(ctrl[1]), f(X), f(Y))); ctrl = None
                else: cmds.append('L%s %s' % (f(X), f(Y)))
            else:
                if ctrl:
                    mx, my = (ctrl[0]+P(q[0], q[1])[0])/2, (ctrl[1]+P(q[0], q[1])[1])/2
                    cmds.append('Q%s %s %s %s' % (f(ctrl[0]), f(ctrl[1]), f(mx), f(my)))
                ctrl = P(q[0], q[1])
        cmds.append('Z')
    return ''.join(cmds)
