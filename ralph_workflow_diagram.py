#!/usr/bin/env python3
"""Generate Ralph's Development Workflow poster as SVG — v2 with refined layout."""

W, H = 1600, 1330

# ── Palette ────────────────────────────────────────────────────────
C = {
    "bg":           "#FFFFFF",
    "title":        "#1A237E",
    "subtitle":     "#546E7A",
    "section_hdr":  {1:"#1565C0", 2:"#2E7D32", 3:"#6A1B9A", 4:"#E65100", 5:"#C62828"},
    "section_bg":   {1:"#E3F2FD", 2:"#E8F5E9", 3:"#F3E5F5", 4:"#FFF3E0", 5:"#FFEBEE"},
    "box_fill":     "#FAFAFA",
    "box_stroke":   "#BDBDBD",
    "decision_fill":"#FFFDE7",
    "decision_stroke":"#F9A825",
    "state_fill":   "#ECEFF1",
    "state_stroke": "#90A4AE",
    "arrow":        "#757575",
    "arrow_loop":   "#C62828",
    "text":         "#212121",
    "text_light":   "#757575",
    "white":        "#FFFFFF",
    "sidebar_bg":   "#F5F5F5",
    "sidebar_stroke":"#E0E0E0",
    "legend_bg":    "#FAFAFA",
    "principles_bg":"#E8EAF6",
    "footer_bg":    "#EEEEEE",
}

# ── Helpers ────────────────────────────────────────────────────────
parts = []
def add(s): parts.append(s)

def shadow_filter():
    return (
        '<defs>\n'
        '  <filter id="sh" x="-8%" y="-8%" width="120%" height="120%">'
        '<feDropShadow dx="1" dy="2" stdDeviation="3" flood-opacity="0.10"/></filter>\n'
        '  <filter id="shLg" x="-8%" y="-8%" width="120%" height="120%">'
        '<feDropShadow dx="2" dy="4" stdDeviation="5" flood-opacity="0.12"/></filter>\n'
        '  <marker id="ah" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">'
        '<polygon points="0 0, 10 3.5, 0 7" fill="#757575"/></marker>\n'
        '  <marker id="ahRed" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">'
        '<polygon points="0 0, 10 3.5, 0 7" fill="#C62828"/></marker>\n'
        '</defs>'
    )

def bx(x, y, w, h, rx=6, fill=C["box_fill"], stroke=C["box_stroke"], sw=1.5, sh="sh"):
    f = f' filter="url(#{sh})"' if sh else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{f}/>'

def dm(cx, cy, w, h, fill=C["decision_fill"], stroke=C["decision_stroke"], sw=1.5):
    hw, hh = w/2, h/2
    return f'<polygon points="{cx},{cy-hh} {cx+hw},{cy} {cx},{cy+hh} {cx-hw},{cy}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" filter="url(#sh)"/>'

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

def tx(x, y, content, size=12, color=C["text"], anchor="middle", bold=False):
    b = ' font-weight="bold"' if bold else ''
    return f'<text x="{x}" y="{y}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="{size}" fill="{color}" text-anchor="{anchor}"{b}>{esc(str(content))}</text>'

def ar(x1, y1, x2, y2, color=C["arrow"], sw=1.8, dash=None, marker="url(#ah)"):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}"{d} marker-end="{marker}"/>'

def pa(d, color=C["arrow"], sw=1.8, dash=None, marker=None, fill="none"):
    ds = f' stroke-dasharray="{dash}"' if dash else ''
    ms = f' marker-end="{marker}"' if marker else ''
    return f'<path d="{d}" fill="{fill}" stroke="{color}" stroke-width="{sw}"{ds}{ms}/>'

def sec_hdr(x, y, w, num, title):
    c = C["section_hdr"][num]
    add(f'<rect x="{x}" y="{y}" width="{w}" height="34" rx="0" fill="{c}" stroke="{c}"/>')
    # top-left rounded corners on the section box itself are done at box level;
    # header overrides top part
    add(f'<rect x="{x}" y="{y}" width="{w}" height="34" rx="8" fill="{c}" stroke="{c}"/>')
    add(f'<rect x="{x}" y="{y+20}" width="{w}" height="14" rx="0" fill="{c}" stroke="{c}"/>')
    add(tx(x+16, y+22, f"SECTION {num}: {title}", size=14, color=C["white"], anchor="start", bold=True))


# ═══════════════════════════════════════════════════════════════════
# LAYOUT CONSTANTS
# ═══════════════════════════════════════════════════════════════════

LEFT_X, LEFT_W   = 16, 180
RIGHT_X          = W - 16 - 180
RIGHT_W          = 180
MX               = 210                        # main area left
MW               = W - 420                    # main area width (~1180)
SEC_Y            = 88                         # first section y
SEC_H            = 190                        # each section height
SEC_GAP          = 10                         # gap between sections

# ── SVG start ──────────────────────────────────────────────────────
add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
add(shadow_filter())
add(f'<rect width="{W}" height="{H}" fill="{C["bg"]}"/>')

# Title
add(tx(W/2, 36, "Ralph's Development Workflow", size=26, color=C["title"], bold=True))
add(tx(W/2, 60, "Current engineering workflow from Jira ticket to production maintenance", size=13, color=C["subtitle"]))
add(f'<line x1="{W/2-320}" y1="72" x2="{W/2+320}" y2="72" stroke="{C["box_stroke"]}" stroke-width="1"/>')

# ═══════════════════════════════════════════════════════════════════
# SIDEBARS
# ═══════════════════════════════════════════════════════════════════

def sidebar(x, y, w, h, title, items, bottom_label):
    add(bx(x, y, w, h, rx=10, fill=C["sidebar_bg"], stroke=C["sidebar_stroke"], sh="shLg"))
    add(tx(x+w/2, y+24, title, size=13, color=C["text"], bold=True))
    add(f'<line x1="{x+12}" y1="{y+36}" x2="{x+w-12}" y2="{y+36}" stroke="{C["sidebar_stroke"]}" stroke-width="1"/>')
    for i, it in enumerate(items):
        add(tx(x+14, y+54+i*17, f"• {it}", size=10, color=C["text"], anchor="start"))
    # bottom label bar
    add(f'<rect x="{x}" y="{y+h-26}" width="{w}" height="26" rx="0" fill="{C["state_stroke"]}" stroke="{C["state_stroke"]}"/>')
    add(f'<rect x="{x}" y="{y+h-26}" width="{w}" height="26" rx="8" fill="{C["state_stroke"]}" stroke="{C["state_stroke"]}"/>')
    add(f'<rect x="{x}" y="{y+h-18}" width="{w}" height="18" rx="0" fill="{C["state_stroke"]}" stroke="{C["state_stroke"]}"/>')
    add(tx(x+w/2, y+h-9, bottom_label, size=10, color=C["white"], bold=True))

sidebar_h = 350
sidebar(LEFT_X, SEC_Y, LEFT_W, sidebar_h,
    "External Inputs",
    ["Jira Ticket", "Bug Report", "Crashlytics", "UI Designs",
     "Screenshots", "Videos", "Logs", "Product Discussion"],
    "Outside the workflow")

sidebar(RIGHT_X, SEC_Y, RIGHT_W, sidebar_h,
    "Outputs",
    ["Code merged", "MR approved", "Updated Documentation",
     "Updated Jira Ticket", "Release Build", "Changelog",
     "Production Monitoring", "New Jira Issues"],
    "Outside the workflow")

# ═══════════════════════════════════════════════════════════════════
# SECTIONS
# ═══════════════════════════════════════════════════════════════════

def section_y(n):
    return SEC_Y + (n-1)*(SEC_H + SEC_GAP)

def add_section_box(n):
    sy = section_y(n)
    cbg = C["section_bg"][n]
    add(bx(MX, sy, MW, SEC_H, rx=10, fill=C["white"], stroke=cbg, sw=2.5, sh="shLg"))

def add_state_cylinder(n, sy, items):
    """State cylinder in top-left of section."""
    cx = MX+14
    cy = sy+50
    cw, ch = 125, max(60, len(items)*16+20)
    add(bx(cx, cy, cw, ch, rx=8, fill=C["state_fill"], stroke=C["state_stroke"], sw=1.5, sh=None))
    # top ellipse
    add(f'<ellipse cx="{cx+cw/2}" cy="{cy}" rx="{cw/2}" ry="7" fill="{C["state_stroke"]}" opacity="0.25"/>')
    add(tx(cx+cw/2, cy-14, "State", size=10, color=C["text_light"], bold=True))
    for i, it in enumerate(items):
        add(tx(cx+10, cy+20+i*14, f"• {it}", size=9, color=C["text"], anchor="start"))
    return cx + cw  # right edge, for positioning next elements

def add_small_label(x, y, text, color_hint):
    """Small label next to decision branch."""
    add(tx(x, y, text, size=9, color=color_hint, bold=True, anchor="start"))

# ── Section 1: Analysis ───────────────────────────────────────────
add_section_box(1)
sy1 = section_y(1)
sec_hdr(MX, sy1, MW, 1, "Analysis")
state_end = add_state_cylinder(1, sy1,
    ["Jira ticket", "Acceptance criteria", "Bug details",
     "Supporting media", "Stack traces", "Reproduction status"])

# Row of process boxes (upper)
bx_h = 52
bx_y = sy1 + 48
px = state_end + 18

# Box 1: Analyze Jira ticket
bw1 = 120
add(bx(px, bx_y, bw1, bx_h, rx=7))
add(tx(px+bw1/2, bx_y+20, "Analyze", size=12, bold=True))
add(tx(px+bw1/2, bx_y+38, "Jira Ticket", size=11))
add(ar(px+bw1, bx_y+bx_h/2, px+bw1+26, bx_y+bx_h/2))
px += bw1 + 26

# Box 2: Clarification
bw2 = 120
add(bx(px, bx_y, bw2, bx_h, rx=7))
add(tx(px+bw2/2, bx_y+18, "Clarification", size=12, bold=True))
add(tx(px+bw2/2, bx_y+38, "& Discussion", size=11))
add(ar(px+bw2, bx_y+bx_h/2, px+bw2+26, bx_y+bx_h/2))
px += bw2 + 26

# Box 3: Collect supporting data (taller)
bw3 = 150
bh3 = 68
bx_y3 = sy1 + 40
add(bx(px, bx_y3, bw3, bh3, rx=7))
add(tx(px+bw3/2, bx_y3+18, "Collect", size=12, bold=True))
add(tx(px+bw3/2, bx_y3+34, "Supporting Data", size=11))
add(tx(px+bw3/2, bx_y3+54, "Crashlytics, screenshots, recordings, logs, UI refs", size=8, color=C["text_light"]))
add(ar(px+bw3, bx_y3+bh3/2, px+bw3+26, bx_y3+bh3/2))
px += bw3 + 26

# Decision: sufficient info?
dm_x = px + 52
dm_y = bx_y3 + bh3/2
dm_w, dm_h = 90, 56
add(dm(dm_x, dm_y, dm_w, dm_h))
add(tx(dm_x, dm_y-4, "Info", size=11, bold=True))
add(tx(dm_x, dm_y+10, "sufficient?", size=10))

# YES → down then process boxes below
add(ar(dm_x, dm_y+dm_h/2, dm_x, sy1+148))
add_small_label(dm_x-24, dm_y+dm_h/2+22, "YES", "#2E7D32")

# Lower row process boxes
lo_y = sy1 + 138
lopx = dm_x - 130
bw_lo = 125
bh_lo = 42

add(bx(lopx, lo_y, bw_lo, bh_lo, rx=7))
add(tx(lopx+bw_lo/2, lo_y+16, "Reproduce Issue", size=11, bold=True))
add(tx(lopx+bw_lo/2, lo_y+32, "(for bugs)", size=9, color=C["text_light"]))
add(ar(lopx+bw_lo, lo_y+bh_lo/2, lopx+bw_lo+24, lo_y+bh_lo/2))
lopx += bw_lo + 24

add(bx(lopx, lo_y, bw_lo, bh_lo, rx=7))
add(tx(lopx+bw_lo/2, lo_y+14, "Assign Ticket", size=11, bold=True))
add(tx(lopx+bw_lo/2, lo_y+30, "to Yourself", size=10))
add(ar(lopx+bw_lo, lo_y+bh_lo/2, lopx+bw_lo+24, lo_y+bh_lo/2))
lopx += bw_lo + 24

add(bx(lopx, lo_y, 140, bh_lo, rx=7, fill="#E3F2FD"))
add(tx(lopx+70, lo_y+14, "Move to In Progress", size=11, bold=True))
add(tx(lopx+70, lo_y+30, "(Jira)", size=10))

# NO branch from decision → Request more info, loop back
no_x = dm_x + dm_w/2 + 8
no_y = dm_y
add(ar(dm_x+dm_w/2, dm_y, no_x+26, no_y))
add_small_label(dm_x+dm_w/2+4, dm_y-6, "NO", "#C62828")
add(bx(no_x+26, bx_y, 130, bx_h, rx=7, fill="#FFEBEE"))
add(tx(no_x+26+65, bx_y+20, "Request More", size=11, bold=True))
add(tx(no_x+26+65, bx_y+38, "Information", size=11))
# loop back
add(pa(f"M {no_x+156} {bx_y+10} Q {no_x+180} {sy1+20} {state_end+18} {sy1+20} Q {state_end} {sy1+20} {state_end} {bx_y+10}",
       color=C["arrow_loop"], sw=1.8, dash="6,4", marker="url(#ahRed)"))

# ── Section 2: Development ────────────────────────────────────────
add_section_box(2)
sy2 = section_y(2)
sec_hdr(MX, sy2, MW, 2, "Development")
state_end2 = add_state_cylinder(2, sy2,
    ["Git branch", "Code changes", "Tests", "Review notes"])

bx_y2 = sy2 + 48
px = state_end2 + 18

# Boxes in sequence
steps2 = [
    ("Checkout", "New Branch", 110, 52),
    ("Implementation", None, 120, 52),
    ("Testing", "Unit, Manual,\nLow-end, Snapshots", 135, 64),
    ("Run lint", "& detekt", 100, 52),
    ("Self Review", None, 100, 52),
]
for label, sub, bw, bh in steps2:
    by = bx_y2 if bh <= 54 else sy2 + 40
    add(bx(px, by, bw, bh, rx=7))
    if sub:
        add(tx(px+bw/2, by+16, label, size=11, bold=True))
        lines = sub.split("\n")
        for li, ln in enumerate(lines):
            add(tx(px+bw/2, by+32+li*14, ln, size=10))
    else:
        add(tx(px+bw/2, by+20, label, size=12, bold=True))
    add(ar(px+bw, by+bh/2, px+bw+22, by+bh/2))
    px += bw + 22

# Decision: looks good?
dm2_x = px + 45
dm2_y = bx_y2 + 26
add(dm(dm2_x, dm2_y, 78, 50))
add(tx(dm2_x, dm2_y-4, "Looks", size=11, bold=True))
add(tx(dm2_x, dm2_y+10, "good?", size=10))

# YES → down
add(ar(dm2_x, dm2_y+25, dm2_x, sy2+145))
add_small_label(dm2_x-20, dm2_y+25+20, "YES", "#2E7D32")

# Lower row
lo_y2 = sy2 + 138
lopx2 = dm2_x - 120
steps2_lo = [
    ("Commit", "Conventional Commits", 130),
    ("Push", None, 70),
    ("Create MR", "reviewers, labels, checklist", 145),
]
for label, sub, bw in steps2_lo:
    bh = 50 if sub else 42
    add(bx(lopx2, lo_y2, bw, bh, rx=7))
    add(tx(lopx2+bw/2, lo_y2+16, label, size=11, bold=True))
    if sub:
        add(tx(lopx2+bw/2, lo_y2+34, sub, size=9, color=C["text_light"]))
    add(ar(lopx2+bw, lo_y2+bh/2, lopx2+bw+22, lo_y2+bh/2))
    lopx2 += bw + 22

# NO branch
no2_x = dm2_x + 39
add(ar(dm2_x+39, dm2_y, no2_x+26, dm2_y))
add_small_label(dm2_x+40, dm2_y-6, "NO", "#C62828")
# loop back to Implementation (3rd box back)
# path from no2_x+26 to ~px-200
loop2_end_x = state_end2 + 18 + 110 + 22 + 120 + 11  # middle of Implementation box
add(pa(f"M {no2_x+26} {dm2_y} Q {no2_x+70} {sy2+20} {loop2_end_x} {sy2+20} Q {loop2_end_x-30} {sy2+20} {loop2_end_x} {bx_y2}",
       color=C["arrow_loop"], sw=1.8, dash="6,4", marker="url(#ahRed)"))

# ── Section 3: Documentation ──────────────────────────────────────
add_section_box(3)
sy3 = section_y(3)
sec_hdr(MX, sy3, MW, 3, "Documentation")
add_state_cylinder(3, sy3, ["KDoc", "Jira ticket", "MR description", "Screenshots"])

bx_y3s = sy3 + 58
px = state_end + 18  # same offset as section 1

steps3 = [
    ("Update KDoc", 130),
    ("Improve Jira Ticket", 140),
    ("Improve MR Description", 150),
    ("Attach Screenshots", 145),
]
for i, (label, bw) in enumerate(steps3):
    by = bx_y3s
    bh = 52
    add(bx(px, by, bw, bh, rx=7))
    add(tx(px+bw/2, by+20, label, size=11, bold=True))
    if i == 3:
        add(tx(px+bw/2, by+36, "(if needed)", size=9, color=C["text_light"]))
    if i < len(steps3)-1:
        add(ar(px+bw, by+bh/2, px+bw+24, by+bh/2))
        px += bw + 24

# ── Section 4: Publishing ─────────────────────────────────────────
add_section_box(4)
sy4 = section_y(4)
sec_hdr(MX, sy4, MW, 4, "Publishing")
add_state_cylinder(4, sy4, ["Version bump", "Changelog", "Release notes"])

bx_y4 = sy4 + 58
px = state_end + 18

steps4 = [
    ("Bump Version", 130),
    ("Generate Changelog", 145),
    ("Prepare Release Notes", 155),
]
for i, (label, bw) in enumerate(steps4):
    add(bx(px, bx_y4, bw, 52, rx=7))
    add(tx(px+bw/2, bx_y4+20, label, size=11, bold=True))
    if i == 2:
        add(tx(px+bw/2, bx_y4+36, "(optional)", size=9, color=C["text_light"]))
    if i < len(steps4)-1:
        add(ar(px+bw, bx_y4+26, px+bw+24, bx_y4+26))
        px += bw + 24

# ── Section 5: Maintenance ────────────────────────────────────────
add_section_box(5)
sy5 = section_y(5)
sec_hdr(MX, sy5, MW, 5, "Maintenance")
state_end5 = add_state_cylinder(5, sy5,
    ["Crash Free Rate", "ANR metrics", "Production logs", "Dashboards"])

bx_y5 = sy5 + 48
px = state_end5 + 18

# Monitor box (taller)
bw5_1 = 135
bh5_1 = 62
add(bx(px, sy5+40, bw5_1, bh5_1, rx=7))
add(tx(px+bw5_1/2, sy5+56, "Monitor", size=12, bold=True))
add(tx(px+bw5_1/2, sy5+76, "Crash Free Rate, ANRs", size=9, color=C["text_light"]))
add(ar(px+bw5_1, sy5+40+bh5_1/2, px+bw5_1+24, sy5+40+bh5_1/2))
px += bw5_1 + 24

# Investigate box
bw5_2 = 155
bh5_2 = 62
add(bx(px, sy5+40, bw5_2, bh5_2, rx=7))
add(tx(px+bw5_2/2, sy5+54, "Investigate", size=12, bold=True))
add(tx(px+bw5_2/2, sy5+74, "Production Crashes", size=11))
add(tx(px+bw5_2/2, sy5+90, "Logs, traces, repro", size=9, color=C["text_light"]))
add(ar(px+bw5_2, sy5+40+bh5_2/2, px+bw5_2+24, sy5+40+bh5_2/2))
px += bw5_2 + 24

# Decision: New issue?
dm5_x = px + 42
dm5_y = sy5 + 40 + bh5_2/2
add(dm(dm5_x, dm5_y, 78, 50))
add(tx(dm5_x, dm5_y-4, "New", size=11, bold=True))
add(tx(dm5_x, dm5_y+10, "issue?", size=10))

# NO → Monitoring continues
add(ar(dm5_x+39, dm5_y, dm5_x+39+24, dm5_y))
add_small_label(dm5_x+40, dm5_y-6, "NO", C["text_light"])
add(bx(dm5_x+39+24, bx_y5, 145, 52, rx=7, fill="#EEEEEE"))
add(tx(dm5_x+39+24+72, bx_y5+20, "Monitoring", size=11, bold=True))
add(tx(dm5_x+39+24+72, bx_y5+36, "Continues", size=10))

# YES → Create new Jira ticket
add(ar(dm5_x, dm5_y+25, dm5_x, sy5+140))
add_small_label(dm5_x-20, dm5_y+25+20, "YES", "#C62828")
add(bx(dm5_x-85, sy5+140, 170, 42, rx=7, fill="#FFEBEE"))
add(tx(dm5_x, sy5+156, "Create New Jira Ticket", size=12, bold=True))
add(tx(dm5_x, sy5+174, "Loop back to Analysis", size=9, color=C["arrow_loop"]))

# ── Big loop arrow on right side ──────────────────────────────────
# From bottom of section 5 (Create New Jira Ticket box) back up to section 1
loop_x = MX + MW - 16
loop_bottom = sy5 + 182
loop_top = section_y(1) + SEC_H/2
add(pa(f"M {loop_x} {loop_bottom} L {MX+MW+40} {loop_bottom} "
       f"Q {MX+MW+60} {loop_bottom} {MX+MW+60} {loop_bottom-400} "
       f"L {MX+MW+60} {loop_top+400} "
       f"Q {MX+MW+60} {loop_top} {MX+MW+40} {loop_top} "
       f"L {MX+MW-16} {loop_top}",
       color=C["arrow_loop"], sw=2.5, dash="8,5", marker="url(#ahRed)"))
add(tx(MX+MW+65, (loop_top+loop_bottom)/2-10, "Feedback", size=10, color=C["arrow_loop"], bold=True, anchor="start"))
add(tx(MX+MW+65, (loop_top+loop_bottom)/2+8, "Loop", size=10, color=C["arrow_loop"], bold=True, anchor="start"))

# ═══════════════════════════════════════════════════════════════════
# LEGEND + PRINCIPLES + FOOTER
# ═══════════════════════════════════════════════════════════════════

BOT_Y = section_y(5) + SEC_H + 14
BOT_H = 152

# Legend (left)
lx, lw = LEFT_X, 370
add(bx(lx, BOT_Y, lw, BOT_H-22, rx=8, fill=C["legend_bg"], stroke=C["box_stroke"], sh=None))
add(tx(lx+lw/2, BOT_Y+20, "Legend", size=12, color=C["text"], bold=True))

items = [
    ("box", "Process"),
    ("diamond", "Decision"),
    ("state", "State carried through workflow"),
    ("start", "Start / End"),
]
for i, (kind, label) in enumerate(items):
    iy = BOT_Y + 38 + i*22
    if kind == "box":
        add(bx(lx+14, iy, 50, 16, rx=4))
    elif kind == "diamond":
        add(dm(lx+39, iy+8, 40, 14, sw=1))
    elif kind == "state":
        add(bx(lx+14, iy, 50, 16, rx=8, fill=C["state_fill"], stroke=C["state_stroke"]))
    elif kind == "start":
        add(bx(lx+14, iy, 50, 16, rx=10, fill=C["white"], stroke=C["box_stroke"], sw=2))
    add(tx(lx+120, iy+11, label, size=10, color=C["text"], anchor="start"))

# Arrow legends
iy5 = BOT_Y + 38 + 4*22
add(ar(lx+14, iy5+8, lx+64, iy5+8, sw=2))
add(tx(lx+120, iy5+8, "Normal flow", size=10, color=C["text"], anchor="start"))
iy6 = BOT_Y + 38 + 5*22
add(ar(lx+14, iy6+8, lx+64, iy6+8, sw=2, dash="6,4", color=C["arrow_loop"], marker="url(#ahRed)"))
add(tx(lx+120, iy6+8, "Feedback loop", size=10, color=C["text"], anchor="start"))

# Key Principles (right of legend)
px_pr = lx + lw + 14
pw_pr = RIGHT_X + RIGHT_W - px_pr
add(bx(px_pr, BOT_Y, pw_pr, BOT_H-22, rx=8, fill=C["principles_bg"], stroke=C["box_stroke"], sh=None))
add(tx(px_pr+pw_pr/2, BOT_Y+20, "Key Principles", size=12, color=C["text"], bold=True))

principles = [
    "Clarify before coding.",
    "Reproduce before fixing.",
    "Test before review.",
    "Review before merge.",
    "Document while developing.",
    "Production monitoring is part of development.",
    "Every production issue becomes a new Jira task.",
]
for i, p in enumerate(principles):
    col = i % 2
    row = i // 2
    ptx = px_pr + 18 + col * (pw_pr/2 - 10)
    pty = BOT_Y + 40 + row * 24
    add(tx(ptx, pty, f"• {p}", size=10, color=C["text"], anchor="start"))

# Footer
fy = BOT_Y + BOT_H - 4 + 4
fw = RIGHT_X + RIGHT_W - LEFT_X
add(bx(LEFT_X, fy, fw, 56, rx=8, fill=C["footer_bg"], stroke=C["box_stroke"], sh=None))
add(tx(W/2, fy+20, "Current Reality", size=11, color=C["text"], bold=True))
add(tx(W/2, fy+40,
    "This workflow represents Ralph's actual engineering process. It is not the company's complete SDLC. "
    "It focuses on the work performed by a developer from receiving a Jira ticket through implementation, "
    "release preparation, and production monitoring.",
    size=8.5, color=C["text_light"]))

add('</svg>')
print("\n".join(parts))