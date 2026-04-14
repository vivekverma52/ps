import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"

/* ─── Google Fonts ─────────────────────────────────────────────────────────── */
if (!document.getElementById("ms-fonts")) {
  const l = document.createElement("link")
  l.id = "ms-fonts"; l.rel = "stylesheet"
  l.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap"
  document.head.appendChild(l)
}

/* ─── Global CSS ────────────────────────────────────────────────────────────── */
if (!document.getElementById("ms-css")) {
  const s = document.createElement("style")
  s.id = "ms-css"
  s.textContent = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --cream: #f0ede6; --cream-dark: #e8e4db; --cell: #eeebe4;
  --ink: #1a1a18; --ink-mid: #4a4a44; --ink-light: #9a9a90;
  --border: rgba(0,0,0,0.09); --white: #fff;
  --teal: #0d9488; --teal-dark: #0f766e; --teal-glow: #14b8a6;
  --dark: #0a1f1e; --dark-mid: #0e2826; --dark-light: #142f2d;
  --dark-border: rgba(255,255,255,0.07);
}
html { scroll-behavior: smooth; }
body { background: var(--cream); font-family: 'DM Sans', sans-serif; overflow-x: hidden; }

/* NAV */
.ms-nav {
  position:fixed; top:0; left:0; right:0; z-index:100;
  display:flex; align-items:center; justify-content:space-between;
  padding:0 48px; height:58px;
  background:var(--cream); border-bottom:1px solid var(--border);
}
.ms-logo { display:flex; align-items:center; gap:8px; font-weight:600; font-size:14.5px; letter-spacing:-.3px; color:var(--ink); text-decoration:none; cursor:pointer; }
.ms-logo-icon { width:28px; height:28px; background:var(--ink); border-radius:7px; display:flex; align-items:center; justify-content:center; }
.ms-logo-icon span { color:#fff; font-weight:800; font-size:12px; letter-spacing:-.5px; }
.ms-nav-links { display:flex; gap:4px; list-style:none; }
.ms-nav-links a { font-size:13px; color:var(--ink-mid); text-decoration:none; padding:6px 11px; border-radius:6px; transition:background .15s; }
.ms-nav-links a:hover { background:var(--cream-dark); }
.ms-nav-actions { display:flex; gap:8px; align-items:center; }
.ms-btn-ghost { background:none; border:none; font-family:inherit; font-size:13px; font-weight:500; color:var(--ink); padding:7px 14px; border-radius:6px; cursor:pointer; transition:background .15s; }
.ms-btn-ghost:hover { background:var(--cream-dark); }
.ms-btn-solid { background:var(--ink); color:#fff; border:none; font-family:inherit; font-size:13px; font-weight:500; padding:8px 18px; border-radius:20px; cursor:pointer; transition:opacity .15s; }
.ms-btn-solid:hover { opacity:.82; }

/* HERO */
.ms-hero {
  min-height:100vh; padding-top:58px;
  display:grid; grid-template-columns:1fr 1fr;
  align-items:center; position:relative; overflow:hidden;
}
.ms-hero::before {
  content:''; position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(135deg,transparent 20%,rgba(255,255,255,.45) 30%,rgba(255,255,255,.55) 50%,rgba(255,255,255,.45) 70%,transparent 80%);
}
.ms-hero-left { padding:0 0 0 80px; position:relative; z-index:2; }
.ms-hero-eyebrow { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:500; color:var(--ink-light); letter-spacing:.6px; text-transform:uppercase; margin-bottom:18px; }
.ms-hero-eyebrow-dot { width:6px; height:6px; border-radius:50%; background:var(--teal); display:inline-block; }
.ms-hero-title { font-size:clamp(36px,4vw,54px); font-weight:500; letter-spacing:-1.8px; line-height:1.08; color:var(--ink); }
.ms-hero-title em { font-family:'Instrument Serif',serif; font-style:italic; font-weight:400; display:block; }
.ms-hero-sub { font-size:13.5px; color:var(--ink-light); line-height:1.65; margin-top:16px; max-width:256px; }
.ms-hero-ctas { display:flex; gap:12px; margin-top:28px; align-items:center; }
.ms-cta-p { background:var(--ink); color:#fff; border:none; font-family:inherit; font-size:13.5px; font-weight:500; padding:11px 22px; border-radius:8px; cursor:pointer; transition:opacity .15s; }
.ms-cta-p:hover { opacity:.82; }
.ms-cta-s { background:none; color:var(--ink); border:1.5px solid rgba(0,0,0,.2); font-family:inherit; font-size:13.5px; font-weight:500; padding:10px 22px; border-radius:8px; cursor:pointer; transition:border-color .15s; }
.ms-cta-s:hover { border-color:var(--ink); }
.ms-badges { display:flex; gap:22px; margin-top:40px; flex-wrap:wrap; }
.ms-badge-item { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--ink-light); }
.ms-badge-dot { width:7px; height:7px; border-radius:50%; border:1.5px solid var(--ink-light); }
.ms-hero-right { position:relative; height:100vh; }
.ms-hero-right canvas { width:100%; height:100%; display:block; }

/* TICKER */
.ms-ticker {
  background:var(--ink); color:#fff; height:46px;
  display:flex; align-items:center; overflow:hidden;
}
.ms-ticker-label {
  flex-shrink:0; padding:0 22px; border-right:1px solid rgba(255,255,255,.13);
  display:flex; align-items:baseline; gap:4px; font-size:11px; white-space:nowrap;
}
.ms-ticker-label strong { font-size:22px; font-weight:700; letter-spacing:-1px; line-height:1; }
.ms-ticker-label span { font-size:9px; opacity:.65; text-transform:uppercase; letter-spacing:.5px; line-height:1.2; }
.ms-ticker-track { flex:1; overflow:hidden; }
.ms-ticker-inner { display:flex; white-space:nowrap; animation:msTicker 30s linear infinite; }
.ms-ticker-item { display:inline-flex; align-items:center; gap:8px; padding:0 30px; font-size:13px; opacity:.82; border-right:1px solid rgba(255,255,255,.1); }
.ms-ticker-item::before { content:'•'; opacity:.35; font-size:10px; }
@keyframes msTicker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }

/* FEATURES */
.ms-features { min-height:100vh; padding:60px 32px 80px; display:flex; align-items:center; justify-content:center; }
.ms-frame { width:100%; max-width:980px; border:1px solid var(--border); border-radius:18px; overflow:hidden; background:var(--cell); box-shadow:0 4px 60px rgba(0,0,0,.07),0 1px 3px rgba(0,0,0,.04); }
.ms-grid { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:450px 450px; }
.ms-cell { position:relative; overflow:hidden; background:var(--cell); }
.ms-cell:nth-child(1) { border-right:1px solid var(--border); border-bottom:1px solid var(--border); }
.ms-cell:nth-child(2) { border-bottom:1px solid var(--border); }
.ms-cell:nth-child(3) { border-right:1px solid var(--border); }
.ms-cell canvas { position:absolute; top:0; left:0; width:100%; height:100%; display:block; }
.ms-pill { position:absolute; top:20px; left:20px; z-index:10; display:inline-flex; align-items:center; gap:5px; background:#fff; border:1px solid rgba(0,0,0,.1); border-radius:20px; padding:4px 11px 4px 8px; font-size:11px; font-weight:500; color:var(--ink-mid); box-shadow:0 1px 5px rgba(0,0,0,.06); }
.ms-pill svg { width:12px; height:12px; }
.ms-text { position:absolute; z-index:5; }
.ms-text h2 { font-size:clamp(22px,2.7vw,31px); font-weight:500; letter-spacing:-1px; line-height:1.12; color:var(--ink); }
.ms-text h2 em { font-family:'Instrument Serif',serif; font-style:italic; font-weight:400; display:block; }
.ms-text p { margin-top:13px; font-size:13px; line-height:1.68; color:var(--ink-light); max-width:275px; }
.ms-text-wa { top:50%; left:52px; transform:translateY(-50%); max-width:310px; }
.ms-text-team { bottom:52px; left:46px; max-width:330px; }
.ms-pagination { border-top:1px solid var(--border); height:44px; display:flex; align-items:center; justify-content:center; gap:7px; }
.ms-dot { width:6px; height:6px; border-radius:3px; background:rgba(0,0,0,.14); transition:all .25s; }
.ms-dot.active { background:var(--ink); width:20px; }

/* WORKFLOW DARK SECTION */
.ms-workflow { min-height:100vh; padding:60px 32px 80px; display:flex; align-items:center; justify-content:center; background:var(--cream); }
.ms-wf-card {
  width:100%; max-width:900px; background:var(--dark); border-radius:24px; overflow:hidden;
  position:relative; padding:48px 48px 44px;
  box-shadow:0 20px 80px rgba(10,31,30,.5),0 4px 20px rgba(10,31,30,.25);
  min-height:420px; display:flex; flex-direction:column;
}
.ms-wf-card::before {
  content:''; position:absolute; inset:0; pointer-events:none;
  background-image:radial-gradient(circle,rgba(255,255,255,0.05) 1px,transparent 1px);
  background-size:28px 28px; border-radius:24px;
}
.ms-wf-title { font-size:clamp(18px,2.2vw,24px); font-weight:500; color:#fff; letter-spacing:-.4px; position:relative; z-index:2; margin-bottom:32px; }
.ms-wf-stage { position:relative; z-index:2; flex:1; display:flex; align-items:center; }
.ms-wf-canvas-wrap { width:100%; height:220px; position:relative; }
.ms-wf-canvas-wrap canvas { position:absolute; top:0; left:0; width:100%; height:100%; display:block; }
.ms-wf-sub { position:relative; z-index:2; margin-top:28px; font-size:14px; line-height:1.7; color:rgba(255,255,255,0.45); max-width:480px; }

/* PRICING */
.ms-pricing { padding:80px 32px 100px; background:var(--cream-dark); }
.ms-pricing-inner { max-width:940px; margin:0 auto; }
.ms-pricing-header { margin-bottom:40px; }
.ms-pricing-header h2 { font-size:clamp(26px,3vw,38px); font-weight:500; letter-spacing:-1px; color:var(--ink); }
.ms-pricing-header p { font-size:13.5px; color:var(--ink-light); margin-top:8px; }
.ms-plans { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
.ms-plan { background:#fff; border:1px solid var(--border); border-radius:16px; padding:28px; }
.ms-plan.featured { background:var(--ink); border-color:var(--ink); }
.ms-plan-name { font-size:11px; font-weight:600; letter-spacing:.6px; text-transform:uppercase; color:var(--ink-light); margin-bottom:14px; }
.ms-plan.featured .ms-plan-name { color:rgba(255,255,255,.45); }
.ms-plan-price { font-size:38px; font-weight:600; letter-spacing:-1.5px; color:var(--ink); line-height:1; }
.ms-plan.featured .ms-plan-price { color:#fff; }
.ms-plan-period { font-size:12px; color:var(--ink-light); margin-top:4px; margin-bottom:20px; }
.ms-plan.featured .ms-plan-period { color:rgba(255,255,255,.4); }
.ms-plan-divider { border:none; border-top:1px solid var(--border); margin-bottom:20px; }
.ms-plan.featured .ms-plan-divider { border-color:rgba(255,255,255,.1); }
.ms-plan-feat { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; color:var(--ink-mid); margin-bottom:9px; line-height:1.5; }
.ms-plan.featured .ms-plan-feat { color:rgba(255,255,255,.7); }
.ms-plan-dot { width:5px; height:5px; border-radius:50%; background:var(--teal); flex-shrink:0; margin-top:5px; }
.ms-plan.featured .ms-plan-dot { background:rgba(255,255,255,.45); }
.ms-plan-btn { width:100%; margin-top:24px; padding:11px; border-radius:8px; font-family:inherit; font-size:13px; font-weight:500; cursor:pointer; border:none; transition:opacity .15s; background:var(--ink); color:#fff; }
.ms-plan.featured .ms-plan-btn { background:#fff; color:var(--ink); }
.ms-plan-btn:hover { opacity:.82; }

/* FOOTER */
.ms-footer { border-top:1px solid var(--border); padding:28px 48px; display:flex; align-items:center; justify-content:space-between; background:var(--cream); }
.ms-footer-logo { display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:600; color:var(--ink); }
.ms-footer-copy { font-size:12px; color:var(--ink-light); }
.ms-footer-links { display:flex; gap:20px; }
.ms-footer-links a { font-size:12px; color:var(--ink-light); text-decoration:none; }
.ms-footer-links a:hover { color:var(--ink-mid); }

/* ── MOBILE RESPONSIVE ────────────────────────────────────────────────── */
@media (max-width: 767px) {
  /* Nav */
  .ms-nav { padding:0 16px; }
  .ms-nav-links { display:none; }

  /* Hero */
  .ms-hero { grid-template-columns:1fr; min-height:auto; padding:80px 24px 48px; }
  .ms-hero-left { padding:0; }
  .ms-hero-right { display:none; }
  .ms-hero-title { font-size:clamp(30px,8vw,42px); }
  .ms-hero-sub { max-width:100%; }
  .ms-badges { gap:14px; }

  /* Ticker */
  .ms-ticker-label strong { font-size:17px; }

  /* Features */
  .ms-features { padding:40px 16px 60px; }
  .ms-grid { grid-template-columns:1fr; grid-template-rows:auto; }
  .ms-cell { min-height:280px; }
  .ms-cell canvas { position:relative; width:100%; height:280px; }
  .ms-cell:nth-child(1) { border-right:none; }
  .ms-cell:nth-child(3) { border-right:none; border-top:1px solid var(--border); }
  .ms-text-wa { top:auto; left:auto; transform:none; position:relative; padding:28px 24px; max-width:100%; }
  .ms-text-team { bottom:auto; left:auto; position:relative; padding:28px 24px; max-width:100%; }
  .ms-text h2 { font-size:clamp(19px,5vw,26px); }

  /* Workflow */
  .ms-workflow { padding:40px 16px 60px; }
  .ms-wf-card { padding:28px 20px 24px; border-radius:16px; }
  .ms-wf-canvas-wrap { height:160px; }
  .ms-wf-sub { font-size:13px; }

  /* Pricing */
  .ms-pricing { padding:48px 16px 64px; }
  .ms-plans { grid-template-columns:1fr; gap:12px; }

  /* Footer */
  .ms-footer { flex-direction:column; align-items:flex-start; gap:12px; padding:24px 16px; }
}

@media (min-width: 480px) and (max-width: 767px) {
  .ms-plans { grid-template-columns:1fr 1fr; }
}
`
  document.head.appendChild(s)
}

/* ─── Canvas helpers ─────────────────────────────────────────────────────────── */
const DPR = window.devicePixelRatio || 1

function setupCanvas(canvas: HTMLCanvasElement) {
  const { width: W, height: H } = canvas.parentElement!.getBoundingClientRect()
  canvas.width = W * DPR; canvas.height = H * DPR
  canvas.style.width = W + "px"; canvas.style.height = H + "px"
  const ctx = canvas.getContext("2d")!
  ctx.scale(DPR, DPR)
  return { ctx, W, H }
}
function makeIso(cx: number, cy: number, S: number) {
  const c = Math.cos(Math.PI / 6), sn = Math.sin(Math.PI / 6)
  return (gx: number, gy: number, gz: number): [number, number] =>
    [cx + (gx - gy) * c * S, cy + (gx + gy) * sn * S - gz * S * 0.82]
}
function isoFace(ctx: CanvasRenderingContext2D, pts: [number, number][], fill: string, sk = "rgba(0,0,0,0.13)", lw = 0.85) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill()
  if (sk) { ctx.strokeStyle = sk; ctx.lineWidth = lw; ctx.stroke() }
}
function isoBox(ctx: CanvasRenderingContext2D, p: any, gx: number, gy: number, gz: number, W: number, D: number, H: number, cT: string, cL: string, cR: string, sk = "rgba(0,0,0,0.13)") {
  const f = (x: number, y: number, z: number) => p(gx + x, gy + y, gz + z)
  isoFace(ctx, [f(0,0,0),f(0,0,H),f(0,D,H),f(0,D,0)], cL, sk)
  isoFace(ctx, [f(W,0,0),f(W,0,H),f(W,D,H),f(W,D,0)], cR, sk)
  isoFace(ctx, [f(0,0,H),f(W,0,H),f(W,D,H),f(0,D,H)], cT, sk)
}
function isoDisc(ctx: CanvasRenderingContext2D, p: any, cx: number, cy: number, cz: number, Rx: number, Ry: number, cTop: string, cSide: string): [number, number] {
  const top = p(cx, cy, cz), bot = p(cx, cy, cz - 0.07)
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(bot[0], bot[1], Rx, Ry, 0, Math.PI, 0, false)
  ctx.ellipse(top[0], top[1], Rx, Ry, 0, 0, Math.PI, false)
  ctx.fillStyle = cSide; ctx.fill(); ctx.restore()
  ctx.beginPath()
  ctx.ellipse(top[0], top[1], Rx, Ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = cTop; ctx.fill()
  ctx.strokeStyle = "rgba(0,0,0,0.14)"; ctx.lineWidth = 0.8; ctx.stroke()
  return top
}

/* ─── Medical icons for conveyor ─────────────────────────────────────────────── */
type IconFn = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => void
const MEDICAL_ICONS: IconFn[] = [
  // Rx symbol
  (ctx, x, y, r) => {
    ctx.save(); ctx.translate(x, y)
    ctx.strokeStyle = "#0d9488"; ctx.lineWidth = r * 0.13; ctx.lineCap = "round"; ctx.lineJoin = "round"
    // R stem
    ctx.beginPath(); ctx.moveTo(-r*.28, r*.38); ctx.lineTo(-r*.28, -r*.38)
    ctx.lineTo(-r*.05, -r*.38); ctx.arc(-r*.05, -r*.12, r*.26, -Math.PI/2, Math.PI/2)
    ctx.lineTo(-r*.28, r*.1); ctx.stroke()
    // R leg
    ctx.beginPath(); ctx.moveTo(-r*.08, r*.1); ctx.lineTo(r*.3, r*.38); ctx.stroke()
    // x strokes
    ctx.beginPath(); ctx.moveTo(r*.06, -r*.05); ctx.lineTo(r*.32, r*.32); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(r*.32, -r*.05); ctx.lineTo(r*.06, r*.32); ctx.stroke()
    ctx.restore()
  },
  // Pill / capsule
  (ctx, x, y, r) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4)
    const pw = r * 0.3, ph = r * 0.72
    ctx.beginPath(); (ctx as any).roundRect(-pw, -ph, pw * 2, ph, [ph, ph, 0, 0])
    ctx.fillStyle = "#0d9488"; ctx.fill()
    ctx.beginPath(); (ctx as any).roundRect(-pw, 0, pw * 2, ph, [0, 0, ph, ph])
    ctx.fillStyle = "#fff"; ctx.fill()
    ctx.beginPath(); ctx.moveTo(-pw, 0); ctx.lineTo(pw, 0)
    ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1; ctx.stroke()
    ctx.restore()
  },
  // QR code grid
  (ctx, x, y, r) => {
    ctx.save(); ctx.translate(x, y)
    const cell = r * 0.17, gap = cell * 0.25
    const pat = [[1,1,1,0,1],[1,0,1,0,1],[1,1,1,1,0],[0,1,0,0,1],[1,1,0,1,1]]
    const off = -(pat.length * (cell + gap)) / 2
    pat.forEach((row, ri) => {
      row.forEach((bit, ci) => {
        if (bit) {
          ctx.fillStyle = "#1a1a18"
          ctx.fillRect(off + ci * (cell + gap), off + ri * (cell + gap), cell, cell)
        }
      })
    })
    ctx.restore()
  },
  // WhatsApp-style phone
  (ctx, x, y, r) => {
    ctx.save(); ctx.translate(x, y)
    ctx.fillStyle = "#22c55e"
    ctx.beginPath(); (ctx as any).roundRect(-r*.38, -r*.5, r*.76, r*.98, r*.14); ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.beginPath(); (ctx as any).roundRect(-r*.25, -r*.3, r*.5, r*.32, r*.07); ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.moveTo(-r*.25, r*.02); ctx.lineTo(-r*.38, r*.18); ctx.lineTo(-r*.1, r*.02)
    ctx.fill()
    ctx.restore()
  },
]

/* ─── Hero canvas — Doctor's clinic desk ─────────────────────────────────────── */
function useHeroCanvas(ref: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    let animId: number, T = 0
    let { ctx, W, H } = setupCanvas(canvas)
    const onResize = () => { ({ ctx, W, H } = setupCanvas(canvas)) }
    window.addEventListener("resize", onResize)

    function draw() {
      ctx.clearRect(0, 0, W, H)
      const cx = W * .46, cy = H * .54, S = W * .19
      const p = makeIso(cx, cy, S)
      const DW = 2.5, DD = 1.65, DH = 0.12
      const bx = -DW / 2, by = -DD / 2

      // ── DESK ──────────────────────────────────────────────────────────
      isoBox(ctx, p, bx, by, 0, DW, DD, DH, "#dedad2", "#c4c0b8", "#b8b4ac", "rgba(0,0,0,0.12)")
      // desk mat
      isoBox(ctx, p, bx+.1, by+.1, DH, DW-.2, DD-.2, .025, "#d0cdc5", "#b4b0a8", "#aaa69e", "rgba(0,0,0,0.07)")

      // ── MONITOR ───────────────────────────────────────────────────────
      const mX = bx + 1.28, mY = by + .06
      const mW = .07, mD = .82, mH = 1.18
      // Stand base
      isoBox(ctx, p, mX+.18, mY+.22, DH+.02, .38, .22, .04, "#c0bdb6", "#a8a4a0", "#9c9896")
      // Stand neck
      isoBox(ctx, p, mX+.28, mY+.30, DH+.06, .13, .06, .26, "#b8b4ae", "#a0a09a", "#949490")
      // Screen body
      isoBox(ctx, p, mX, mY, DH+.32, mW, mD, mH, "#1e1e1c", "#141412", "#0e0e0c", "rgba(0,0,0,0.35)")

      // Draw prescription UI lines on the RIGHT face of monitor (visible to viewer)
      const sc0 = p(mX+mW, mY,    DH+.32)
      const scT = p(mX+mW, mY,    DH+.32+mH)
      const scTD= p(mX+mW, mY+mD, DH+.32+mH)
      const scD = p(mX+mW, mY+mD, DH+.32)
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(sc0[0],sc0[1]); ctx.lineTo(scT[0],scT[1])
      ctx.lineTo(scTD[0],scTD[1]); ctx.lineTo(scD[0],scD[1])
      ctx.closePath()
      ctx.fillStyle = "#101418"; ctx.fill()
      ctx.clip()
      // animated prescription form lines
      const sLines = [
        { t:.84, col:"#0d9488",             lw:1.9, len:.72, delay:0   },
        { t:.72, col:"rgba(255,255,255,.45)",lw:1.2, len:.55, delay:.18 },
        { t:.60, col:"rgba(255,255,255,.45)",lw:1.2, len:.68, delay:.32 },
        { t:.48, col:"#0d9488",             lw:1.6, len:.48, delay:.46 },
        { t:.36, col:"rgba(255,255,255,.40)",lw:1.1, len:.60, delay:.60 },
        { t:.24, col:"rgba(255,255,255,.40)",lw:1.1, len:.42, delay:.72 },
        { t:.14, col:"rgba(255,255,255,.30)",lw:1.0, len:.35, delay:.84 },
      ]
      const dxBot = scD[0]-sc0[0], dyBot = scD[1]-sc0[1]
      const dxTop = scTD[0]-scT[0], dyTop = scTD[1]-scT[1]
      sLines.forEach(({ t, col, lw, len, delay }) => {
        const prog = Math.max(0, Math.min(len, (T*1.1 - delay) * len))
        if (prog < .01) return
        const sx = sc0[0]+(scT[0]-sc0[0])*t, sy = sc0[1]+(scT[1]-sc0[1])*t
        const rdx = dxBot*(1-t)+dxTop*t, rdy = dyBot*(1-t)+dyTop*t
        const indent = .07
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "round"
        ctx.globalAlpha = Math.min(1, T*2.5)
        ctx.beginPath()
        ctx.moveTo(sx+rdx*indent, sy+rdy*indent)
        ctx.lineTo(sx+rdx*(indent+prog*(1-indent)), sy+rdy*(indent+prog*(1-indent)))
        ctx.stroke()
      })
      ctx.restore()

      // ── PRESCRIPTION PAD ──────────────────────────────────────────────
      const padX = bx+.08, padY = by+.12
      // Paper layers
      for (let i = 2; i >= 0; i--) {
        const oz = i * .016
        isoBox(ctx, p, padX+i*.007, padY+i*.007, DH+.03+oz, .88, .72, .007,
          i===0 ? "#f8f6f0" : "#f0ede6",
          i===0 ? "#e8e4da" : "#e0dcd0",
          i===0 ? "#e0dcd2" : "#d8d4c8")
      }
      // Animated text lines on pad
      const pLines = [
        { xOff:.09, yOff:.10, w:.56, col:"#1a1a18", d:0   },
        { xOff:.09, yOff:.22, w:.40, col:"#9a9a90", d:.2  },
        { xOff:.09, yOff:.34, w:.52, col:"#0d9488", d:.4  },
        { xOff:.09, yOff:.45, w:.36, col:"#9a9a90", d:.55 },
        { xOff:.09, yOff:.56, w:.48, col:"#0d9488", d:.7  },
        { xOff:.09, yOff:.66, w:.30, col:"#9a9a90", d:.85 },
      ]
      pLines.forEach(({ xOff, yOff, w, col, d }) => {
        const prog = Math.max(0, Math.min(1, T*.95 - d))
        if (prog <= 0) return
        isoBox(ctx, p, padX+xOff, padY+yOff, DH+.065, w*prog, .025, .007, col, col, col, "none")
      })
      // Rx label
      const rxPt = p(padX+.18, padY+.03, DH+.068)
      ctx.save(); ctx.globalAlpha = Math.min(1, T*2)
      ctx.font = `800 9px 'DM Sans',sans-serif`; ctx.fillStyle = "#0d9488"; ctx.textAlign = "center"
      ctx.fillText("Rx", rxPt[0], rxPt[1]); ctx.restore()

      // ── STETHOSCOPE ───────────────────────────────────────────────────
      const sc = p(bx+1.05, by+.92, DH+.04)
      ctx.save()
      // Chest piece
      ctx.beginPath(); ctx.arc(sc[0], sc[1], 8, 0, Math.PI*2)
      ctx.fillStyle = "#7a7a74"; ctx.fill()
      ctx.beginPath(); ctx.arc(sc[0], sc[1], 5, 0, Math.PI*2)
      ctx.fillStyle = "#5a5a54"; ctx.fill()
      // Tube
      ctx.strokeStyle = "#555550"; ctx.lineWidth = 2.8; ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(sc[0], sc[1]-8)
      ctx.bezierCurveTo(sc[0]-3, sc[1]-22, sc[0]-18, sc[1]-16, sc[0]-20, sc[1]-7)
      ctx.stroke()
      // Earpiece Y-split
      ctx.beginPath()
      ctx.moveTo(sc[0]-20, sc[1]-7)
      ctx.bezierCurveTo(sc[0]-22, sc[1]-14, sc[0]-28, sc[1]-14, sc[0]-29, sc[1]-9)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(sc[0]-20, sc[1]-7)
      ctx.bezierCurveTo(sc[0]-18, sc[1]-13, sc[0]-15, sc[1]-17, sc[0]-15, sc[1]-21)
      ctx.stroke()
      // Tips
      ;[[sc[0]-29, sc[1]-9],[sc[0]-15, sc[1]-21]].forEach(([ex, ey]) => {
        ctx.beginPath(); ctx.arc(ex, ey, 2.8, 0, Math.PI*2)
        ctx.fillStyle = "#3a3a38"; ctx.fill()
      })
      ctx.restore()

      // ── MEDICINE BOTTLE ───────────────────────────────────────────────
      const btX = bx+DW-.44, btY = by+DD*.50
      isoBox(ctx, p, btX, btY, DH+.03, .17, .17, .40, "#c5e6e0", "#a2cac4", "#8eb8b2")
      isoBox(ctx, p, btX+.02, btY+.02, DH+.43, .13, .13, .08, "#0d9488", "#0a6b61", "#085a52")
      const lblPt = p(btX+.085, btY+.085, DH+.19)
      ctx.save(); ctx.globalAlpha = .7
      ctx.font = `700 6px 'DM Sans',sans-serif`; ctx.fillStyle = "#085a52"; ctx.textAlign = "center"
      ctx.fillText("Rx", lblPt[0], lblPt[1]); ctx.restore()

      // ── MEDICAL CROSS ─────────────────────────────────────────────────
      const crX = bx+.06, crY = by+DD*.74
      isoBox(ctx, p, crX+.04, crY,     DH+.03, .055, .145, .007, "#0d9488", "#0a6b61", "#085a52", "none")
      isoBox(ctx, p, crX,     crY+.04, DH+.03, .145, .055, .007, "#0d9488", "#0a6b61", "#085a52", "none")

      // ── FLOATING DISCS ────────────────────────────────────────────────
      const d1z = .60+Math.sin(T*1.4)*.09
      const d1t = isoDisc(ctx, p, bx+DW*.70, by-.20, DH+d1z, S*.2, S*.10, "#d8d4cc", "#b4b0ac")
      ctx.save(); ctx.translate(d1t[0], d1t[1]-3)
      ctx.strokeStyle="#0d9488"; ctx.lineWidth=2.8; ctx.lineCap="round"
      ctx.beginPath(); ctx.moveTo(-7,0); ctx.lineTo(7,0); ctx.moveTo(0,-7); ctx.lineTo(0,7); ctx.stroke()
      ctx.restore()

      const d2z = .42+Math.sin(T*1.2+.7)*.08
      const d2t = isoDisc(ctx, p, bx-.38, by+.52, DH+d2z, S*.17, S*.085, "#c8c4bc", "#a8a4a0")
      ctx.save(); ctx.translate(d2t[0], d2t[1]-2)
      ctx.strokeStyle="#0d9488"; ctx.lineWidth=2.2; ctx.lineCap="round"; ctx.lineJoin="round"
      ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(-1,6); ctx.lineTo(8,-5); ctx.stroke()
      ctx.restore()

      // Dashed line: disc → monitor
      const dA = p(bx+DW*.70, by-.20, DH+d1z-.04)
      const dB = p(mX+mW, mY+mD*.35, DH+.32+mH*.7)
      const off = (T*50)%11
      ctx.save(); ctx.setLineDash([5,6]); ctx.lineDashOffset=-off
      ctx.strokeStyle="rgba(0,0,0,0.14)"; ctx.lineWidth=1; ctx.globalAlpha=.6
      ctx.beginPath(); ctx.moveTo(dA[0],dA[1]); ctx.lineTo(dB[0],dB[1]); ctx.stroke()
      ctx.restore()

      // ── FLOATING Rx CARD ──────────────────────────────────────────────
      const bfloat = Math.sin(T*.9)*4
      const bpt = p(-0.68, 0.88, 0.88)
      ctx.save()
      ctx.globalAlpha = .93
      ctx.shadowColor = "rgba(0,0,0,0.14)"; ctx.shadowBlur = 14
      ctx.fillStyle = "#fff"
      ctx.beginPath(); ctx.roundRect(bpt[0]-44, bpt[1]-24+bfloat, 88, 50, 9); ctx.fill()
      ctx.shadowBlur = 0
      // Teal left accent bar
      ctx.fillStyle = "#0d9488"
      ctx.beginPath(); ctx.roundRect(bpt[0]-44, bpt[1]-24+bfloat, 4, 50, [9,0,0,9]); ctx.fill()
      ctx.font = `700 13px 'DM Sans',sans-serif`; ctx.fillStyle = "#0d9488"; ctx.textAlign = "left"
      ctx.fillText("Rx", bpt[0]-34, bpt[1]-8+bfloat)
      ctx.font = `500 8px 'DM Sans',sans-serif`; ctx.fillStyle = "#4a4a44"
      ctx.fillText("Ramesh Kumar", bpt[0]-34, bpt[1]+4+bfloat)
      ctx.font = `400 7.5px 'DM Sans',sans-serif`; ctx.fillStyle = "#9a9a90"
      ctx.fillText("Amoxicillin · 500mg · 3×/day", bpt[0]-34, bpt[1]+15+bfloat)
      ctx.restore()

      T += 1/60
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize) }
  }, [])
}

/* ─── Dashboard canvas (feature cell 1) ────────────────────────────────────── */
function useDashCanvas(ref: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    let animId: number, T = 0
    let { ctx, W, H } = setupCanvas(canvas)
    const onResize = () => { ({ ctx, W, H } = setupCanvas(canvas)) }
    window.addEventListener("resize", onResize)
    function draw() {
      ctx.clearRect(0,0,W,H)
      const cx=W*.46,cy=H*.57,S=W*.173; const p=makeIso(cx,cy,S)
      const DW=2.2,DD=1.4,DH=0.12,bx=-DW/2,by=-DD/2
      isoBox(ctx,p,bx,by,0,DW,DD,DH,"#dedad2","#c4c0b8","#b8b4ac","rgba(0,0,0,0.12)")
      const si=.1; isoBox(ctx,p,bx+si,by+si,DH,DW-si*2,DD-si*2,.03,"#ccc8c0","#b8b4b0","#acacA8","rgba(0,0,0,0.09)")
      const bars=[.12,.08,.12,.08,.11,.07,.12,.08,.10,.12]; let bxo=bx+.17
      bars.forEach((bw,i)=>{ const bh=.24+(i%3===0?.08:i%3===1?.04:0)+Math.sin(T*1.8+i*.6)*.02; isoBox(ctx,p,bxo,by+.22,DH+.02,bw,.40,bh,"#1a1a18","#111","#0d0d0c","rgba(0,0,0,0.2)"); bxo+=bw+.03; })
      const prog=Math.sin(T*.85)*.5+.5; const slX=bx+.17,slY=by+.78,slW=1.08
      isoBox(ctx,p,slX,slY,DH+.02,slW,.065,.022,"#c0bcb4","#a8a4a0","#9e9a96","rgba(0,0,0,0.09)")
      if(prog>.02) isoBox(ctx,p,slX,slY,DH+.02,slW*prog,.065,.04,"#0d9488","#0a6b61","#085a52")
      isoBox(ctx,p,slX+slW*prog-.035,slY-.02,DH+.02,.07,.105,.065,"#f8f6f2","#dedad4","#cecac4","rgba(0,0,0,0.15)")
      { const tc=p(bx+DW*.38,by+DD-.1,DH+.04); ctx.save(); ctx.translate(tc[0],tc[1]); ctx.strokeStyle="rgba(0,0,0,0.22)"; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(-5,4); ctx.lineTo(0,-4); ctx.lineTo(5,4); ctx.closePath(); ctx.stroke(); ctx.restore(); }
      const bp1=.95+Math.sin(T*2.3)*.04; const B1x=bx+1.46,B1y=by+.17
      isoBox(ctx,p,B1x,B1y,DH+.02,.44*bp1,.37*bp1,.22*bp1,"#1a1a18","#111","#0d0d0c")
      { const tc=p(B1x+.22*bp1,B1y+.185*bp1,DH+.02+.22*bp1+.01); ctx.save(); ctx.translate(tc[0],tc[1]); ctx.fillStyle="rgba(255,255,255,0.82)"; const ts=5.5*bp1; ctx.beginPath(); ctx.moveTo(-ts*.7,ts); ctx.lineTo(ts*1.1,0); ctx.lineTo(-ts*.7,-ts); ctx.closePath(); ctx.fill(); ctx.restore(); }
      const bp2=.95+Math.sin(T*1.8+1.1)*.04; const B2x=bx+1.46,B2y=by+.70
      isoBox(ctx,p,B2x,B2y,DH+.02,.44*bp2,.37*bp2,.22*bp2,"#2c2c28","#1a1a18","#141410")
      { const tc=p(B2x+.22*bp2,B2y+.185*bp2,DH+.02+.22*bp2+.01); ctx.save(); ctx.translate(tc[0],tc[1]); const bs=5.5*bp2; ctx.strokeStyle="rgba(255,255,255,0.7)"; ctx.lineWidth=1.4*bp2; ctx.beginPath(); ctx.arc(0,0,bs,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
      const d1z=.55+Math.sin(T*1.4)*.09
      const d1t=isoDisc(ctx,p,bx+DW*.76,by-.13,DH+d1z,S*.195,S*.097,"#d0ccc4","#b0aca8")
      { ctx.save(); ctx.translate(d1t[0],d1t[1]-3); ctx.strokeStyle="#0d9488"; ctx.lineWidth=2.1; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.beginPath(); ctx.moveTo(-6,1); ctx.lineTo(-1,6); ctx.lineTo(7,-5); ctx.stroke(); ctx.restore(); }
      const d2z=.38+Math.sin(T*1.2+.7)*.08
      const d2t=isoDisc(ctx,p,bx-.38,by+.45,DH+d2z,S*.16,S*.08,"#c4c0b8","#a8a4a0")
      { ctx.save(); ctx.translate(d2t[0],d2t[1]-2); ctx.strokeStyle="#555"; ctx.lineWidth=1.9; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(-5,-4); ctx.lineTo(5,4); ctx.moveTo(5,-4); ctx.lineTo(-5,4); ctx.stroke(); ctx.restore(); }
      { const a=p(bx+DW*.76,by-.13,DH+d1z-.04),b=p(bx+DW*.70,by+.07,DH+.22); const off=(T*55)%11; ctx.save(); ctx.setLineDash([5,6]); ctx.lineDashOffset=-off; ctx.strokeStyle="rgba(0,0,0,0.18)"; ctx.lineWidth=1; ctx.globalAlpha=.75; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); ctx.restore(); }
      T+=1/60; animId=requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize) }
  }, [])
}

/* ─── Score / QR canvas (feature cell 4) ────────────────────────────────────── */
function useScoreCanvas(ref: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    let animId: number, T = 0
    let { ctx, W, H } = setupCanvas(canvas)
    const onResize = () => { ({ ctx, W, H } = setupCanvas(canvas)) }
    window.addEventListener("resize", onResize)
    function draw() {
      ctx.clearRect(0,0,W,H)
      const cx=W*.50,cy=H*.50,S=W*.148; const p=makeIso(cx,cy,S)
      const exp=(Math.sin(T*.65)*.5+.5),gap=exp*.38,TW=1.0,TD=1.0,TH=.095
      const Ax=-1.32,Ay=-.52
      isoBox(ctx,p,Ax,Ay,0,TW,TD,TH,"#c4c0b8","#a4a09c","#969290","rgba(0,0,0,0.11)")
      isoBox(ctx,p,Ax,Ay,TH+gap,TW,TD,TH,"#ccc8c0","#aca8a4","#9ea09a","rgba(0,0,0,0.11)")
      isoBox(ctx,p,Ax,Ay,TH*2+gap*2,TW,TD,TH,"#d8d4cc","#b4b0ac","#a8a4a0","rgba(0,0,0,0.11)")
      const atop=TH*3+gap*2+.025
      const ac1=p(Ax+.28,Ay+.5,atop),ac2=p(Ax+.72,Ay+.5,atop),acR=S*.135
      ;[ac1,ac2].forEach(([px,py])=>{ ctx.beginPath(); ctx.ellipse(px,py,acR,acR*.52,0,0,Math.PI*2); ctx.fillStyle="#1a1a18"; ctx.fill(); })
      ctx.strokeStyle="rgba(0,0,0,0.18)"; ctx.lineWidth=.9; ctx.beginPath(); ctx.moveTo(ac1[0]+acR*.9,ac1[1]); ctx.lineTo(ac2[0]-acR*.9,ac2[1]); ctx.stroke()
      const Bx=.28,By=-.52
      isoBox(ctx,p,Bx,By,0,TW,TD,TH,"#c0bcb4","#a0a09c","#969290","rgba(0,0,0,0.11)")
      isoBox(ctx,p,Bx,By,TH+gap,TW,TD,TH,"#c8c4bc","#a8a4a0","#9c9c96","rgba(0,0,0,0.11)")
      isoBox(ctx,p,Bx,By,TH*2+gap*2,TW,TD,TH,"#d0ccc4","#b0aca8","#a4a09c","rgba(0,0,0,0.11)")
      const btop=TH*3+gap*2+.025; const bc=p(Bx+.50,By+.50,btop+.02)
      // QR-like grid on top face
      ctx.save(); ctx.translate(bc[0],bc[1]); ctx.strokeStyle="rgba(0,0,0,0.22)"; ctx.lineWidth=.75
      ;[-10,-4,4,10].forEach(x=>{ ctx.beginPath(); ctx.moveTo(x,-12); ctx.lineTo(x,12); ctx.stroke(); })
      ;[-12,-6,0,6,12].forEach(y=>{ ctx.beginPath(); ctx.moveTo(-12,y); ctx.lineTo(12,y); ctx.stroke(); })
      ctx.fillStyle="#1a1a18"; ctx.fillRect(-3.5,-3.5,7,7); ctx.restore()
      { const aEnd=p(Ax+TW+.1,Ay+.5,atop+.04),bSt=p(Bx-.1,By+.5,btop+.04); const off=(T*52)%10
        ctx.save(); ctx.setLineDash([5,5]); ctx.lineDashOffset=-off; ctx.strokeStyle="rgba(0,0,0,0.25)"; ctx.lineWidth=1.1; ctx.globalAlpha=.9
        ctx.beginPath(); ctx.moveTo(aEnd[0],aEnd[1]); ctx.lineTo(bSt[0],bSt[1]); ctx.stroke()
        ctx.setLineDash([]); ctx.globalAlpha=1
        const dx=bSt[0]-aEnd[0],dy=bSt[1]-aEnd[1],ang=Math.atan2(dy,dx)
        ctx.save(); ctx.translate(bSt[0],bSt[1]); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-7,-3.5); ctx.lineTo(-7,3.5); ctx.closePath(); ctx.fillStyle="rgba(0,0,0,0.25)"; ctx.fill(); ctx.restore(); ctx.restore(); }
      // Teal floating Rx labels
      ;[{gx:.78,gy:.48,fs:22,ph:0},{gx:.60,gy:.36,fs:16,ph:.5}].forEach(({gx,gy,fs,ph})=>{ const alpha=.2+.8*((Math.sin(T*.8+ph*Math.PI*2)+1)/2); const fy=Math.sin(T*1.3+ph*Math.PI*2)*5; const [px2,py2]=p(gx,gy,.08); ctx.save(); ctx.globalAlpha=alpha; ctx.font=`700 ${fs*(S/120)}px 'DM Sans',sans-serif`; ctx.fillStyle="#0d9488"; ctx.textAlign="center"; ctx.fillText("Rx",px2,py2+fy); ctx.restore(); })
      { const [px2,py2]=p(.95,.72,.05); ctx.save(); ctx.globalAlpha=.88; ctx.font=`700 ${28*(S/120)}px 'DM Sans',sans-serif`; ctx.fillStyle="#0d9488"; ctx.textAlign="center"; ctx.fillText("Rx",px2,py2); ctx.restore(); }
      const dFloat=Math.sin(T*1.1)*.03,pz=-.62+dFloat
      isoBox(ctx,p,-.44,-.44,pz,.88,.88,.20,"#222220","#161614","#111110","rgba(255,255,255,0.05)")
      const dcp=p(0,0,pz+.22+.02),dtp=p(0,0,pz+.22+.46),dRx=S*.195,dRy=S*.097
      ctx.beginPath(); ctx.ellipse(dcp[0],dcp[1],dRx,dRy,0,0,Math.PI*2); ctx.fillStyle="#1a1a18"; ctx.fill()
      ctx.strokeStyle="rgba(255,255,255,0.07)"; ctx.lineWidth=.7; ctx.stroke()
      const tip: [number,number]=[dtp[0],dtp[1]]
      ;[0,Math.PI/3,2*Math.PI/3,Math.PI,4*Math.PI/3,5*Math.PI/3].forEach((a,i,arr)=>{ const a2=arr[(i+1)%arr.length]; const pt1: [number,number]=[dcp[0]+Math.cos(a)*dRx,dcp[1]+Math.sin(a)*dRy],pt2: [number,number]=[dcp[0]+Math.cos(a2)*dRx,dcp[1]+Math.sin(a2)*dRy]; ctx.beginPath(); ctx.moveTo(tip[0],tip[1]); ctx.lineTo(pt1[0],pt1[1]); ctx.lineTo(pt2[0],pt2[1]); ctx.closePath(); ctx.fillStyle=["#333330","#282826","#1e1e1c","#2a2a28","#222220","#191916"][i]; ctx.fill(); ctx.strokeStyle="rgba(255,255,255,0.04)"; ctx.lineWidth=.5; ctx.stroke(); })
      T+=1/60; animId=requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize) }
  }, [])
}

/* ─── Workflow / Ecosystem canvas (dark section) ─────────────────────────────── */
function useEcoCanvas(ref: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    let animId: number, T = 0
    let { ctx, W, H } = setupCanvas(canvas)
    const onResize = () => { ({ ctx, W, H } = setupCanvas(canvas)) }
    window.addEventListener("resize", onResize)

    const CONVEYOR_ICONS = [0, 1, 2, 3, 0, 1, 2, 3]
    const ICON_SPACING = 90, ICON_R = 34, SPEED = 40
    const CONVEYOR_Y_CENTER = H * 0.5, CONVEYOR_H = ICON_R * 2 + 16
    const GATE_X = W * 0.56, PROC_X = W * 0.58
    const GEAR_TOP_X = W * 0.815, GEAR_TOP_Y = H * 0.18
    const GEAR_BOT_X = W * 0.815, GEAR_BOT_Y = H * 0.78
    const GEAR_R = W * 0.075, BELT_X = W * 0.76

    function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string) {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r)
      if (fill) { ctx.fillStyle = fill; ctx.fill() }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke() }
    }
    function drawGear(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, teeth: number, rotation: number, fill: string, stroke: string) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation)
      ctx.beginPath()
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i / (teeth * 2)) * Math.PI * 2
        const r2 = i % 2 === 0 ? outerR : innerR
        i === 0 ? ctx.moveTo(Math.cos(angle)*r2, Math.sin(angle)*r2) : ctx.lineTo(Math.cos(angle)*r2, Math.sin(angle)*r2)
      }
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 0, innerR * 0.55, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 0, innerR * 0.2, 0, Math.PI * 2); ctx.fillStyle = stroke; ctx.fill()
      ctx.restore()
    }
    function drawProcessorBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
      drawRoundRect(ctx, x, y, w, h, r, "#0e2826", "rgba(13,148,136,0.25)")
      const boltR = 3.5, pad = 10
      ;[[x+pad,y+pad],[x+w-pad,y+pad],[x+w-pad,y+h-pad],[x+pad,y+h-pad]].forEach(([bx2,by2]) => {
        ctx.beginPath(); ctx.arc(bx2, by2, boltR, 0, Math.PI*2)
        ctx.fillStyle = "rgba(13,148,136,0.4)"; ctx.fill()
        ctx.strokeStyle = "rgba(13,148,136,0.5)"; ctx.lineWidth = .8; ctx.stroke()
      })
    }
    function drawCheckCircle(ctx: CanvasRenderingContext2D, cx2: number, cy2: number, r: number, glowing: boolean) {
      ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, Math.PI*2)
      ctx.strokeStyle = "rgba(13,148,136,0.4)"; ctx.lineWidth = 2; ctx.stroke()
      ctx.beginPath(); ctx.arc(cx2, cy2, r-3, 0, Math.PI*2)
      ctx.fillStyle = glowing ? "#0e4a44" : "#0a3532"; ctx.fill()
      ctx.save(); ctx.translate(cx2, cy2); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"
      ctx.beginPath(); ctx.moveTo(-r*.35, 0); ctx.lineTo(-r*.08, r*.28); ctx.lineTo(r*.35, -r*.28); ctx.stroke(); ctx.restore()
    }
    const OUTPUT_DISCS = [{ pct: 0.15, iconIdx: 4 }, { pct: 0.65, iconIdx: 5 }]

    function draw() {
      ctx.clearRect(0, 0, W, H)
      // Recompute dynamic values based on current W/H
      const convY = H * 0.5, convH2 = ICON_R * 2 + 16
      const gateX = W * 0.56
      const procX = W * 0.58, procY = H * 0.12, procW = W * 0.22, procH = H * 0.76
      const gearTopX = W * 0.815, gearTopY = H * 0.18, gearBotX = W * 0.815, gearBotY = H * 0.78
      const gearR = W * 0.075, beltX = W * 0.76

      // Feeder machine
      const feedX = W * 0.01, feedY = H * 0.18, feedW = W * 0.13, feedH = H * 0.64
      drawRoundRect(ctx, feedX, feedY, feedW, feedH, 14, "#0a3532", "rgba(13,148,136,0.3)")
      ctx.beginPath(); ctx.roundRect(feedX + feedW*0.25, feedY - 8, feedW*0.5, 14, 4)
      ctx.fillStyle = "#0d9488"; ctx.fill()
      const ledGlow = ctx.createRadialGradient(feedX+feedW*.5, feedY, 0, feedX+feedW*.5, feedY, 20)
      ledGlow.addColorStop(0, "rgba(13,148,136,0.4)"); ledGlow.addColorStop(1, "rgba(13,148,136,0)")
      ctx.fillStyle = ledGlow; ctx.beginPath(); ctx.arc(feedX+feedW*.5, feedY, 20, 0, Math.PI*2); ctx.fill()
      ;[[feedX+8,feedY+8],[feedX+feedW-8,feedY+8],[feedX+feedW-8,feedY+feedH-8],[feedX+8,feedY+feedH-8]].forEach(([bx2,by2]) => {
        ctx.beginPath(); ctx.arc(bx2, by2, 4, 0, Math.PI*2); ctx.fillStyle="rgba(13,148,136,0.5)"; ctx.fill()
      })
      for (let i = 0; i < 4; i++) {
        const ly = feedY + feedH*0.3 + i * 16
        ctx.fillStyle = `rgba(13,148,136,${0.3 + (i===1||i===2 ? 0.3 : 0)})`
        ctx.fillRect(feedX+8, ly, feedW-16, 6)
      }
      ctx.beginPath(); ctx.roundRect(feedX+feedW-6, convY-convH2/2-2, 12, convH2+4, 4)
      ctx.fillStyle = "#0a1f1e"; ctx.fill()

      // Conveyor belt
      const conveyorLeft = feedX + feedW + 4, conveyorRight = gateX
      const conveyorWidth = conveyorRight - conveyorLeft
      drawRoundRect(ctx, conveyorLeft, convY-convH2/2, conveyorWidth, convH2, 8, "#0e2826", "rgba(13,148,136,0.15)")
      const gateGrad = ctx.createLinearGradient(gateX-80, 0, gateX+20, 0)
      gateGrad.addColorStop(0, "rgba(13,148,136,0)"); gateGrad.addColorStop(0.6, "rgba(13,148,136,0.35)"); gateGrad.addColorStop(1, "rgba(13,148,136,0.5)")
      ctx.fillStyle = gateGrad; ctx.fillRect(gateX-80, convY-convH2/2, 100, convH2)
      ctx.save(); ctx.beginPath(); ctx.roundRect(conveyorLeft, convY-convH2/2, conveyorWidth, convH2, 8); ctx.clip()
      const totalWidth = ICON_SPACING * CONVEYOR_ICONS.length
      const scrollOff = (T * SPEED) % totalWidth
      CONVEYOR_ICONS.forEach((iconIdx, i) => {
        let ix = conveyorLeft + 52 + i * ICON_SPACING - scrollOff
        if (ix < conveyorLeft - ICON_R) ix += totalWidth
        if (ix > conveyorRight + ICON_R) return
        const fadeDist = 50
        let alpha = 1
        if (ix - conveyorLeft < fadeDist) alpha = (ix - conveyorLeft) / fadeDist
        if (conveyorRight - ix < fadeDist) alpha = (conveyorRight - ix) / fadeDist
        alpha = Math.max(0, Math.min(1, alpha))
        ctx.save(); ctx.globalAlpha = alpha
        ctx.beginPath(); ctx.arc(ix, convY, ICON_R, 0, Math.PI*2)
        ctx.fillStyle = ["#fff","#fff","#fff","#fff"][iconIdx % 4] || "#fff"; ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth=1; ctx.stroke()
        MEDICAL_ICONS[iconIdx % MEDICAL_ICONS.length]?.(ctx, ix, convY, ICON_R * 0.62)
        ctx.restore()
      })
      ctx.restore()

      // Processor panel
      drawProcessorBox(ctx, procX, procY, procW, procH, 12)
      const circ1Y = H * 0.35, circ2Y = H * 0.65, circR = W * 0.05
      const glow1 = 0.5 + Math.sin(T * 2.5) * 0.5, glow2 = 0.5 + Math.sin(T * 2.5 + Math.PI) * 0.5
      ;[{ y: circ1Y, g: glow1 }, { y: circ2Y, g: glow2 }].forEach(({ y, g }) => {
        const grd = ctx.createRadialGradient(procX+procW/2, y, 0, procX+procW/2, y, circR*2)
        grd.addColorStop(0, `rgba(13,148,136,${g*0.3})`); grd.addColorStop(1, "rgba(13,148,136,0)")
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(procX+procW/2, y, circR*2, 0, Math.PI*2); ctx.fill()
      })
      drawCheckCircle(ctx, procX+procW/2, circ1Y, circR, glow1 > 0.7)
      drawCheckCircle(ctx, procX+procW/2, circ2Y, circR, glow2 > 0.7)

      // Gear panel
      const gearPanelX = procX + procW
      const gearPanelW = W - gearPanelX - 4
      drawProcessorBox(ctx, gearPanelX, procY, gearPanelW, procH, 12)
      const gearRot = T * 0.8
      drawGear(ctx, gearTopX, gearTopY, gearR, gearR*0.72, 10, gearRot, "#0e2826", "rgba(13,148,136,0.5)")
      drawGear(ctx, gearBotX, gearBotY, gearR, gearR*0.72, 10, -gearRot + 0.3, "#0e2826", "rgba(13,148,136,0.5)")

      // Chain belt
      const chainLen = gearBotY - gearTopY, dotSpacing = 18
      const dotOffset = (T * 40) % dotSpacing
      const numDots = Math.ceil(chainLen / dotSpacing) + 1
      ctx.save()
      for (let i = 0; i < numDots; i++) {
        const dy = gearTopY + i * dotSpacing - dotOffset
        if (dy < gearTopY - 5 || dy > gearBotY + 5) continue
        ctx.beginPath(); ctx.arc(beltX, dy, 3, 0, Math.PI*2)
        ctx.fillStyle = "rgba(13,148,136,0.7)"; ctx.fill()
      }
      const beltRight = beltX + gearR * 0.9
      for (let i = 0; i < numDots; i++) {
        const dy = gearBotY - i * dotSpacing + dotOffset
        if (dy < gearTopY - 5 || dy > gearBotY + 5) continue
        ctx.beginPath(); ctx.arc(beltRight, dy, 3, 0, Math.PI*2)
        ctx.fillStyle = "rgba(13,148,136,0.7)"; ctx.fill()
      }
      ctx.restore()

      // Output discs
      OUTPUT_DISCS.forEach(({ pct, iconIdx }, di) => {
        const rawPct = ((pct + T * 0.08) % 1)
        let bx2: number, by2: number
        if (rawPct < 0.5) { bx2 = beltX; by2 = gearTopY + rawPct * 2 * chainLen }
        else { bx2 = beltRight; by2 = gearBotY - (rawPct - 0.5) * 2 * chainLen }
        ctx.beginPath(); ctx.arc(bx2, by2, 20, 0, Math.PI*2)
        ctx.fillStyle = "#0a3532"; ctx.fill()
        ctx.strokeStyle = "rgba(13,148,136,0.45)"; ctx.lineWidth=1.5; ctx.stroke()
        const iIdx = (iconIdx + Math.floor(T * 0.3 + di)) % MEDICAL_ICONS.length
        MEDICAL_ICONS[iIdx]?.(ctx, bx2, by2, 13)
      })

      T += 1/60
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize) }
  }, [])
}

/* ─── Data ────────────────────────────────────────────────────────────────────── */
const CLINICS = ["City Clinic", "Sharma Hospital", "Apollo Pharmacy", "MediCare Centre", "Dr. Iyer's Practice", "Wellness Hub", "Green Cross", "HealthFirst", "Prime Diagnostics"]

const plans = [
  {
    name: "Free", price: "₹0", period: "/month",
    desc: "Perfect for solo practitioners",
    features: ["10 prescriptions/month", "2 team members", "QR code access", "WhatsApp sharing"],
    featured: false, cta: "Get Started Free",
  },
  {
    name: "Pro", price: "₹999", period: "/month",
    desc: "For growing clinics",
    features: ["200 prescriptions/month", "10 team members", "Multi-language support", "Priority support"],
    featured: true, cta: "Start Pro Trial",
  },
  {
    name: "Enterprise", price: "₹2,999", period: "/month",
    desc: "For large hospitals",
    features: ["Unlimited prescriptions", "Unlimited team", "Custom integrations", "Dedicated SLA"],
    featured: false, cta: "Contact Sales",
  },
]

/* ─── Components ─────────────────────────────────────────────────────────────── */
function Ticker() {
  const items = [...CLINICS, ...CLINICS]
  return (
    <div className="ms-ticker">
      <div className="ms-ticker-label">
        <strong>500+</strong>
        <span>CLINICS<br/>TRUST US</span>
      </div>
      <div className="ms-ticker-track">
        <div className="ms-ticker-inner">
          {items.map((c, i) => <span key={i} className="ms-ticker-item">{c}</span>)}
        </div>
      </div>
    </div>
  )
}

function Navbar({ onLogin }: { onLogin: () => void }) {
  return (
    <nav className="ms-nav">
      <div className="ms-logo" onClick={onLogin}>
        <div className="ms-logo-icon"><span>Rx</span></div>
        Medi lingua vani
      </div>
      <ul className="ms-nav-links">
        {["Features", "Pricing", "About"].map(l => (
          <li key={l}><a href={`#${l.toLowerCase()}`}>{l}</a></li>
        ))}
      </ul>
      <div className="ms-nav-actions">
        <button className="ms-btn-ghost" onClick={onLogin}>Log In</button>
        <button className="ms-btn-solid" onClick={onLogin}>Start Free</button>
      </div>
    </nav>
  )
}

function HeroSection({ onLogin }: { onLogin: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useHeroCanvas(ref)
  return (
    <section className="ms-hero">
      <div className="ms-hero-left">
        <div className="ms-hero-eyebrow">
          <span className="ms-hero-eyebrow-dot" />
          Trusted by 500+ Indian Clinics
        </div>
        <h1 className="ms-hero-title">
          Digital prescriptions
          <em>for modern clinics</em>
        </h1>
        <p className="ms-hero-sub">The smart platform to create, manage and deliver prescriptions to patients via WhatsApp.</p>
        <div className="ms-hero-ctas">
          <button className="ms-cta-p" onClick={onLogin}>Start Free</button>
          <button className="ms-cta-s" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>See Features</button>
        </div>
        <div className="ms-badges">
          {["Multi-language Support", "WhatsApp Delivery", "Team Management"].map(b => (
            <div key={b} className="ms-badge-item">
              <div className="ms-badge-dot" />
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ms-hero-right"><canvas ref={ref} /></div>
    </section>
  )
}

function FeaturesSection() {
  const dashRef = useRef<HTMLCanvasElement>(null)
  const scoreRef = useRef<HTMLCanvasElement>(null)
  useDashCanvas(dashRef)
  useScoreCanvas(scoreRef)
  return (
    <section id="features" className="ms-features">
      <div className="ms-frame">
        <div className="ms-grid">
          {/* Cell 1 — canvas */}
          <div className="ms-cell"><canvas ref={dashRef} /></div>
          {/* Cell 2 — WhatsApp text */}
          <div className="ms-cell">
            <div className="ms-pill">
              <svg viewBox="0 0 12 12" fill="none">
                <path d="M10 1H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1l1.5 2L6 8h4a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
              WhatsApp Delivery
            </div>
            <div className="ms-text ms-text-wa">
              <h2>Send prescriptions to patients <em>in one tap</em></h2>
              <p>Patients receive a personalised WhatsApp message with a QR-coded link to view their full prescription on any device.</p>
            </div>
          </div>
          {/* Cell 3 — Team text */}
          <div className="ms-cell">
            <div className="ms-pill">
              <svg viewBox="0 0 12 12" fill="none">
                <path d="M8 10v-1a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="4.5" cy="4" r="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M11 10v-1a2 2 0 0 0-1.5-1.94M8 2.06A2 2 0 0 1 8 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Team Management
            </div>
            <div className="ms-text ms-text-team">
              <h2>Manage doctors and <em>pharmacists together</em></h2>
              <p>Invite your entire clinic team, assign roles, and collaborate on prescriptions — all from one admin panel.</p>
            </div>
          </div>
          {/* Cell 4 — canvas */}
          <div className="ms-cell"><canvas ref={scoreRef} /></div>
        </div>
        <div className="ms-pagination">
          <div className="ms-dot" /><div className="ms-dot active" /><div className="ms-dot" /><div className="ms-dot" />
        </div>
      </div>
    </section>
  )
}

function WorkflowSection() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEcoCanvas(ref)
  return (
    <section className="ms-workflow">
      <div className="ms-wf-card">
        <h2 className="ms-wf-title">Complete Prescription Workflow</h2>
        <div className="ms-wf-stage">
          <div className="ms-wf-canvas-wrap">
            <canvas ref={ref} />
          </div>
        </div>
        <p className="ms-wf-sub">
          Doctor uploads the prescription — pharmacist adds medicines and renders multimedia —
          patient receives it instantly on WhatsApp.
        </p>
      </div>
    </section>
  )
}

function PricingSection({ onLogin }: { onLogin: () => void }) {
  return (
    <section id="pricing" className="ms-pricing">
      <div className="ms-pricing-inner">
        <div className="ms-pricing-header">
          <h2>Simple, transparent pricing</h2>
          <p>Start free. Upgrade as your clinic grows.</p>
        </div>
        <div className="ms-plans">
          {plans.map(plan => (
            <div key={plan.name} className={`ms-plan${plan.featured ? " featured" : ""}`}>
              <div className="ms-plan-name">{plan.name}</div>
              <div className="ms-plan-price">{plan.price}</div>
              <div className="ms-plan-period">{plan.period} · {plan.desc}</div>
              <hr className="ms-plan-divider" />
              {plan.features.map(f => (
                <div key={f} className="ms-plan-feat">
                  <span className="ms-plan-dot" />
                  {f}
                </div>
              ))}
              <button className="ms-plan-btn" onClick={onLogin}>{plan.cta}</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="ms-footer">
      <div className="ms-footer-logo">
        <div className="ms-logo-icon" style={{ width: 24, height: 24 }}>
          <span style={{ fontSize: 10 }}>Rx</span>
        </div>
        Medi lingua Vani
      </div>
      <p className="ms-footer-copy">© 2024 Exato Technologies Pvt. Ltd. All rights reserved.</p>
      <div className="ms-footer-links">
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
        <a href="#">Contact</a>
      </div>
    </footer>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate()
  const goLogin = () => navigate('/login')
  return (
    <>
      <Navbar onLogin={goLogin} />
      <HeroSection onLogin={goLogin} />
      <Ticker />
      <FeaturesSection />
      <WorkflowSection />
      <PricingSection onLogin={goLogin} />
      <Footer />
    </>
  )
}
