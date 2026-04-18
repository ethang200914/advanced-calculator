import React from 'react';

import { useState, useEffect, useRef, useCallback } from "react";
import * as math from "mathjs";

const C = {
  bg: "#0d0f14", surface: "#13161f", card: "#181c28", border: "#252a3a",
  accent: "#8b7cf6", accentDim: "#1e1a40", text: "#dde1f0", muted: "#5a6080",
  dim: "#3a3f58", success: "#5eead4", warn: "#fbbf24", danger: "#f87171", grid: "#1e2235",
};
const font = "'Georgia','Times New Roman',serif";
const mono = "'Courier New',monospace";

const S = {
  wrap: { background: C.bg, minHeight: "100vh", color: C.text, fontFamily: font, display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem 1rem" },
  title: { fontSize: 26, fontWeight: 400, color: C.text, letterSpacing: "0.08em", textAlign: "center", fontFamily: font, marginBottom: "1.5rem" },
  tabRow: { display: "flex", gap: 4, flexWrap: "wrap", marginBottom: "1.5rem", justifyContent: "center", maxWidth: 760 },
  tab: a => ({ padding: "5px 13px", borderRadius: 4, fontSize: 12, cursor: "pointer", border: `1px solid ${a ? C.accent : C.border}`, background: a ? C.accentDim : "transparent", color: a ? C.accent : C.muted, fontFamily: mono, letterSpacing: "0.04em", transition: "all 0.15s" }),
  main: { width: "100%", maxWidth: 740 },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "1.4rem", marginBottom: "1rem" },
  label: { fontSize: 11, color: C.muted, marginBottom: 4, display: "block", fontFamily: mono, letterSpacing: "0.06em", textTransform: "uppercase" },
  input: { width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "7px 11px", color: C.text, fontSize: 13, fontFamily: mono, outline: "none" },
  btn: sm => ({ background: "transparent", color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 4, padding: sm ? "4px 12px" : "7px 18px", fontSize: sm ? 12 : 13, cursor: "pointer", fontFamily: mono, letterSpacing: "0.04em" }),
  row: { display: "flex", gap: 10, flexWrap: "wrap" },
  col: { flex: 1, minWidth: 140 },
  sep: { borderTop: `1px solid ${C.border}`, margin: "14px 0" },
  sh: { fontSize: 11, color: C.muted, fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 },
  result: ok => ({ background: ok ? "#0a1a18" : "#1a0c0c", border: `1px solid ${ok ? "#2a5048" : "#5a2222"}`, borderRadius: 4, padding: "10px 14px", marginTop: 10, fontSize: 13, color: ok ? C.success : C.danger, whiteSpace: "pre-wrap", fontFamily: mono }),
  btnRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 },
};

function Result({ val, err }) {
  if (!val && !err) return null;
  return <div style={S.result(!err)}>{err ? `error: ${err}` : val}</div>;
}
function Field({ label, value, onChange, placeholder }) {
  return <div><label style={S.label}>{label}</label><input style={S.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></div>;
}
function useCalc() {
  const [r, setR] = useState({ val: "", err: "" });
  const run = useCallback(fn => { try { setR({ val: String(fn()), err: "" }); } catch (e) { setR({ val: "", err: e.message }); } }, []);
  return [r, run];
}

// ── Interactive Graph ──
function InteractiveGraph({ fns = [], fnLabels = [], xMin: xMinProp = -7, xMax: xMaxProp = 7, yMin: yMinProp = -5, yMax: yMaxProp = 5, height = 380 }) {
  const cvRef = useRef(), containerRef = useRef();
  const stateRef = useRef({ xMin: xMinProp, xMax: xMaxProp, yMin: yMinProp, yMax: yMaxProp, dragging: false, lastX: 0, lastY: 0, mouseX: null, mouseY: null, pinchDist: null });
  const [tooltip, setTooltip] = useState(null);
  const [clickInfo, setClickInfo] = useState(null);
  const animRef = useRef();

  const draw = useCallback(() => {
    const cv = cvRef.current; if (!cv) return;
    const { xMin, xMax, yMin, yMax, mouseX, mouseY } = stateRef.current;
    const W = cv.width, H = cv.height;
    const ctx = cv.getContext("2d");
    const tx = x => ((x - xMin) / (xMax - xMin)) * W;
    const ty = y => H - ((y - yMin) / (yMax - yMin)) * H;
    const fx = px => xMin + (px / W) * (xMax - xMin);
    const fy = py => yMin + ((H - py) / H) * (yMax - yMin);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.surface; ctx.fillRect(0, 0, W, H);

    // grid
    const xStep = niceStep((xMax - xMin) / 8), yStep = niceStep((yMax - yMin) / 6);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) { ctx.beginPath(); ctx.moveTo(tx(x), 0); ctx.lineTo(tx(x), H); ctx.stroke(); }
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) { ctx.beginPath(); ctx.moveTo(0, ty(y)); ctx.lineTo(W, ty(y)); ctx.stroke(); }

    // axes
    ctx.strokeStyle = C.dim; ctx.lineWidth = 1.2;
    if (yMin < 0 && yMax > 0) { ctx.beginPath(); ctx.moveTo(0, ty(0)); ctx.lineTo(W, ty(0)); ctx.stroke(); }
    if (xMin < 0 && xMax > 0) { ctx.beginPath(); ctx.moveTo(tx(0), 0); ctx.lineTo(tx(0), H); ctx.stroke(); }

    // labels
    ctx.fillStyle = C.muted; ctx.font = `10px ${mono}`; ctx.textAlign = "center";
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
      if (Math.abs(x) < xStep * 0.1) continue;
      const lx = tx(x), ly = Math.min(Math.max(ty(0) + 14, 14), H - 4);
      ctx.fillText(x.toFixed(Math.abs(x) < 1 ? 2 : 1), lx, ly);
    }
    ctx.textAlign = "right";
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
      if (Math.abs(y) < yStep * 0.1) continue;
      const lx = Math.min(Math.max(tx(0) - 4, 4), W - 4), ly = ty(y) + 4;
      ctx.fillText(y.toFixed(Math.abs(y) < 1 ? 2 : 1), lx, ly);
    }

    // functions
    const cols = ["#8b7cf6", "#5eead4", "#fbbf24", "#f87171", "#60a5fa", "#f97316"];
    fns.forEach((fn, fi) => {
      ctx.strokeStyle = cols[fi % cols.length]; ctx.lineWidth = 1.8; ctx.beginPath();
      let first = true;
      for (let px = 0; px < W; px++) {
        const x = fx(px);
        try { const y = fn(x); if (!isFinite(y) || Math.abs(y) > 1e6) { first = true; continue; } first ? ctx.moveTo(px, ty(y)) : ctx.lineTo(px, ty(y)); first = false; } catch { first = true; }
      }
      ctx.stroke();
    });

    // crosshair
    if (mouseX !== null && mouseY !== null) {
      const mx = mouseX, my = mouseY;
      ctx.strokeStyle = "#ffffff22"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(W, my); ctx.stroke();
      ctx.setLineDash([]);
      const wx = fx(mx);
      fns.forEach((fn, fi) => {
        try {
          const wy = fn(wx); if (!isFinite(wy)) return;
          const py = ty(wy);
          ctx.fillStyle = cols[fi % cols.length]; ctx.beginPath(); ctx.arc(mx, py, 4, 0, 2 * Math.PI); ctx.fill();
        } catch { }
      });
    }
  }, [fns]);

  useEffect(() => {
    const s = stateRef.current;
    s.xMin = xMinProp; s.xMax = xMaxProp; s.yMin = yMinProp; s.yMax = yMaxProp;
    draw();
  }, [fns, xMinProp, xMaxProp, yMinProp, yMaxProp, draw]);

  const getMousePos = e => {
    const rect = cvRef.current.getBoundingClientRect();
    const scaleX = cvRef.current.width / rect.width;
    const scaleY = cvRef.current.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };
  const getTouchPos = (t, i = 0) => {
    const rect = cvRef.current.getBoundingClientRect();
    const scaleX = cvRef.current.width / rect.width;
    const scaleY = cvRef.current.height / rect.height;
    return { x: (t.touches[i].clientX - rect.left) * scaleX, y: (t.touches[i].clientY - rect.top) * scaleY };
  };

  const onMouseMove = e => {
    const s = stateRef.current;
    const { x, y } = getMousePos(e);
    const W = cvRef.current.width, H = cvRef.current.height;
    const fx = px => s.xMin + (px / W) * (s.xMax - s.xMin);
    const fy = py => s.yMin + ((H - py) / H) * (s.yMax - s.yMin);
    s.mouseX = x; s.mouseY = y;
    const wx = fx(x), wy = fy(y);
    const vals = fns.map((fn, i) => { try { return { i, y: fn(wx) }; } catch { return null; } }).filter(Boolean);
    setTooltip({ x: wx, y: wy, vals });
    if (s.dragging) {
      const dx = (x - s.lastX) / W * (s.xMax - s.xMin);
      const dy = (y - s.lastY) / H * (s.yMax - s.yMin);
      s.xMin -= dx; s.xMax -= dx; s.yMin += dy; s.yMax += dy;
      s.lastX = x; s.lastY = y;
    }
    draw();
  };
  const onMouseDown = e => { const { x, y } = getMousePos(e); const s = stateRef.current; s.dragging = true; s.lastX = x; s.lastY = y; };
  const onMouseUp = () => { stateRef.current.dragging = false; };
  const onMouseLeave = () => { stateRef.current.mouseX = null; stateRef.current.mouseY = null; setTooltip(null); draw(); };
  const onWheel = e => {
    e.preventDefault();
    const s = stateRef.current; const { x, y } = getMousePos(e);
    const W = cvRef.current.width, H = cvRef.current.height;
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    const wx = s.xMin + (x / W) * (s.xMax - s.xMin);
    const wy = s.yMin + ((H - y) / H) * (s.yMax - s.yMin);
    s.xMin = wx + (s.xMin - wx) * factor; s.xMax = wx + (s.xMax - wx) * factor;
    s.yMin = wy + (s.yMin - wy) * factor; s.yMax = wy + (s.yMax - wy) * factor;
    draw();
  };
  const onClick = e => {
    const s = stateRef.current; const { x } = getMousePos(e);
    const W = cvRef.current.width;
    const wx = s.xMin + (x / W) * (s.xMax - s.xMin);
    const cols = ["#8b7cf6", "#5eead4", "#fbbf24", "#f87171", "#60a5fa"];
    const info = fns.map((fn, i) => {
      try {
        const y = fn(wx);
        // find zeros near click
        const zeros = [];
        for (let tx2 = s.xMin; tx2 < s.xMax; tx2 += (s.xMax - s.xMin) / 500) {
          try { const ya = fn(tx2), yb = fn(tx2 + (s.xMax - s.xMin) / 500); if (isFinite(ya) && isFinite(yb) && ya * yb < 0) zeros.push(((tx2 + tx2 + (s.xMax - s.xMin) / 500) / 2).toFixed(4)); } catch { }
        }
        // local extrema near click (crude)
        const samples = 300; const xs = Array.from({ length: samples }, (_, k) => s.xMin + k * (s.xMax - s.xMin) / samples);
        const ys = xs.map(x => { try { return fn(x); } catch { return NaN; } });
        let localMin = Infinity, localMax = -Infinity, minX = null, maxX = null;
        for (let k = 1; k < samples - 1; k++) {
          if (!isFinite(ys[k])) continue;
          if (ys[k] < ys[k - 1] && ys[k] < ys[k + 1]) { if (ys[k] < localMin) { localMin = ys[k]; minX = xs[k]; } }
          if (ys[k] > ys[k - 1] && ys[k] > ys[k + 1]) { if (ys[k] > localMax) { localMax = ys[k]; maxX = xs[k]; } }
        }
        return { i, color: cols[i % cols.length], label: fnLabels[i] || `f${i + 1}`, y: y.toFixed(5), zeros: zeros.slice(0, 5), localMin: minX ? `(${minX.toFixed(4)}, ${localMin.toFixed(4)})` : "—", localMax: maxX ? `(${maxX.toFixed(4)}, ${localMax.toFixed(4)})` : "—" };
      } catch { return null; }
    }).filter(Boolean);
    setClickInfo({ x: wx.toFixed(4), info });
  };

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [fns]);

  return (
    <div ref={containerRef} style={{ position: "relative", marginTop: 12 }}>
      <canvas ref={cvRef} width={700} height={height}
        style={{ width: "100%", borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface, display: "block", cursor: "crosshair" }}
        onMouseMove={onMouseMove} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} onClick={onClick}
      />
      {tooltip && (
        <div style={{ position: "absolute", top: 8, left: 8, background: "#0d1020ee", border: `1px solid ${C.border}`, borderRadius: 4, padding: "6px 10px", fontFamily: mono, fontSize: 11, color: C.text, pointerEvents: "none", minWidth: 140 }}>
          <div style={{ color: C.muted, marginBottom: 3 }}>x = {tooltip.x.toFixed(4)}</div>
          {tooltip.vals.map(v => <div key={v.i} style={{ color: ["#8b7cf6", "#5eead4", "#fbbf24", "#f87171"][v.i % 4] }}>f{v.i + 1}(x) = {isFinite(v.y) ? v.y.toFixed(5) : "undef"}</div>)}
        </div>
      )}
      {clickInfo && (
        <div style={{ marginTop: 8, background: "#0d1020", border: `1px solid ${C.border}`, borderRadius: 4, padding: "10px 14px", fontFamily: mono, fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: C.muted }}>analysis at x = {clickInfo.x}</span>
            <button style={{ ...S.btn(true), padding: "2px 8px", fontSize: 11 }} onClick={() => setClickInfo(null)}>×</button>
          </div>
          {clickInfo.info.map(inf => (
            <div key={inf.i} style={{ marginBottom: 8, borderLeft: `2px solid ${inf.color}`, paddingLeft: 10 }}>
              <div style={{ color: inf.color, marginBottom: 4 }}>{inf.label}</div>
              <div style={{ color: C.text }}>f(x) = {inf.y}</div>
              <div style={{ color: C.muted }}>zeros (visible): {inf.zeros.length ? inf.zeros.join(", ") : "none found"}</div>
              <div style={{ color: C.muted }}>local min: {inf.localMin}</div>
              <div style={{ color: C.muted }}>local max: {inf.localMax}</div>
            </div>
          ))}
          <div style={{ color: C.dim, fontSize: 10, marginTop: 4 }}>drag to pan · scroll to zoom · click for analysis</div>
        </div>
      )}
    </div>
  );
}

function niceStep(raw) {
  const exp = Math.floor(Math.log10(raw));
  const frac = raw / Math.pow(10, exp);
  const nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  return nice * Math.pow(10, exp);
}

// ── ARITHMETIC ──
function ArithmeticTab() {
  const [expr, setExpr] = useState(""); const [r, run] = useCalc();
  return (
    <div style={S.card}>
      <div style={S.sh}>Expression evaluator</div>
      <Field label="Expression" value={expr} onChange={setExpr} placeholder="(3^4 + sqrt(2)) / sin(pi/6)" />
      <div style={S.btnRow}><button style={S.btn()} onClick={() => run(() => math.format(math.evaluate(expr), { precision: 12 }))}>Evaluate</button></div>
      <Result {...r} />
      <div style={S.sep} />
      <div style={{ fontSize: 11, color: C.muted, fontFamily: mono, lineHeight: 1.8 }}>sin cos tan asin acos atan · log(x,b) log2 log10 · sqrt cbrt · factorial · complex: 2+3i · units: 100 cm to m</div>
    </div>
  );
}

// ── GRAPHING ──
function GraphingTab() {
  const [f1, setF1] = useState("sin(x)");
  const [f2, setF2] = useState("cos(x)");
  const [f3, setF3] = useState("");
  const [fns, setFns] = useState([x => Math.sin(x), x => Math.cos(x)]);
  const [labels, setLabels] = useState(["sin(x)", "cos(x)"]);
  const [err, setErr] = useState("");

  const plot = () => {
    const compiled = [], lbs = [];
    setErr("");
    for (const [s, lbl] of [[f1, f1], [f2, f2], [f3, f3]]) {
      if (!s.trim()) continue;
      try { const c = math.compile(s); compiled.push(x => c.evaluate({ x })); lbs.push(lbl); }
      catch (e) { setErr(e.message); return; }
    }
    setFns(compiled); setLabels(lbs);
  };

  return (
    <div style={S.card}>
      <div style={S.sh}>Function grapher</div>
      <div style={S.row}>
        <div style={S.col}><Field label="f₁(x)" value={f1} onChange={setF1} placeholder="sin(x)" /></div>
        <div style={S.col}><Field label="f₂(x)" value={f2} onChange={setF2} placeholder="cos(x)" /></div>
        <div style={S.col}><Field label="f₃(x)" value={f3} onChange={setF3} placeholder="optional" /></div>
      </div>
      <div style={S.btnRow}><button style={S.btn()} onClick={plot}>Plot</button></div>
      {err && <div style={S.result(false)}>error: {err}</div>}
      <InteractiveGraph fns={fns} fnLabels={labels} height={420} />
      <div style={{ fontSize: 11, color: C.muted, fontFamily: mono, marginTop: 8 }}>
        {labels.map((l, i) => <span key={i} style={{ marginRight: 12 }}><span style={{ color: ["#8b7cf6","#5eead4","#fbbf24"][i] }}>■</span> {l}</span>)}
      </div>
    </div>
  );
}

// ── CALCULUS ──
function CalculusTab() {
  const [expr, setExpr] = useState("x^3 - 3*x");
  const [intA, setIntA] = useState("0"); const [intB, setIntB] = useState("3");
  const [nTerms, setNTerms] = useState("6"); const [taylorAt, setTaylorAt] = useState("0");
  const [dr, runD] = useCalc(); const [d2r, runD2] = useCalc();
  const [ir, runI] = useCalc(); const [lr, runL] = useCalc(); const [tr, runT] = useCalc();
  const [graphFns, setGraphFns] = useState([]);
  const [graphLabels, setGraphLabels] = useState([]);
  const [showGraph, setShowGraph] = useState(false);

  const plotDerivs = () => {
    try {
      const f = math.compile(expr);
      const df = math.compile(math.derivative(expr, "x").toString());
      const d2f = math.compile(math.derivative(math.derivative(expr, "x").toString(), "x").toString());
      setGraphFns([x => f.evaluate({ x }), x => df.evaluate({ x }), x => d2f.evaluate({ x })]);
      setGraphLabels([expr, `f'`, `f''`]);
      setShowGraph(true);
    } catch { }
  };

  return (
    <div style={S.card}>
      <div style={S.sh}>Calculus</div>
      <Field label="f(x)" value={expr} onChange={setExpr} placeholder="x^3 - 3*x" />
      <div style={S.btnRow}>
        <button style={S.btn(true)} onClick={() => runD(() => "f'(x) = " + math.derivative(expr, "x").toString())}>f′(x)</button>
        <button style={S.btn(true)} onClick={() => runD2(() => "f''(x) = " + math.derivative(math.derivative(expr, "x").toString(), "x").toString())}>f″(x)</button>
        <button style={S.btn(true)} onClick={plotDerivs}>Plot f, f′, f″</button>
      </div>
      <Result {...dr} /><Result {...d2r} />
      {showGraph && <InteractiveGraph fns={graphFns} fnLabels={graphLabels} yMin={-10} yMax={10} height={380} />}
      <div style={S.sep} />
      <div style={S.sh}>Definite integral (Simpson)</div>
      <div style={S.row}>
        <div style={S.col}><Field label="a" value={intA} onChange={setIntA} placeholder="0" /></div>
        <div style={S.col}><Field label="b" value={intB} onChange={setIntB} placeholder="3" /></div>
      </div>
      <div style={S.btnRow}><button style={S.btn(true)} onClick={() => runI(() => {
        const f = math.compile(expr), n = 10000, a = +intA, b = +intB, h = (b - a) / n;
        let s = 0;
        for (let i = 0; i <= n; i++) { const x = a + i * h, v = f.evaluate({ x }); s += (i === 0 || i === n) ? v : i % 2 === 0 ? 2 * v : 4 * v; }
        return `∫[${intA},${intB}] ${expr} dx ≈ ${(s * h / 3).toFixed(8)}`;
      })}>∫ dx</button></div>
      <Result {...ir} />
      <div style={S.sep} />
      <div style={S.sh}>Limit as x → 0</div>
      <div style={S.btnRow}><button style={S.btn(true)} onClick={() => runL(() => {
        const f = math.compile(expr), e = 1e-8;
        return `lim(x→0) ${expr} ≈ ${((f.evaluate({ x: e }) + f.evaluate({ x: -e })) / 2).toFixed(8)}`;
      })}>lim</button></div>
      <Result {...lr} />
      <div style={S.sep} />
      <div style={S.sh}>Taylor series</div>
      <div style={S.row}>
        <div style={S.col}><Field label="Expand about a =" value={taylorAt} onChange={setTaylorAt} placeholder="0" /></div>
        <div style={S.col}><Field label="Terms" value={nTerms} onChange={setNTerms} placeholder="6" /></div>
      </div>
      <div style={S.btnRow}><button style={S.btn(true)} onClick={() => runT(() => {
        const a = +taylorAt, n = +nTerms;
        let terms = [], cur = math.parse(expr);
        for (let i = 0; i < n; i++) {
          const val = math.evaluate(cur.toString(), { x: a });
          const coef = val / math.factorial(i);
          if (Math.abs(coef) > 1e-12) terms.push(`${coef.toFixed(5)}(x${a !== 0 ? `−${a}` : ""})^${i}`);
          cur = math.derivative(cur.toString(), "x");
        }
        return terms.join(" + ");
      })}>Expand</button></div>
      <Result {...tr} />
    </div>
  );
}

// ── ODE SOLVER ──
function ODETab() {
  const [eq, setEq] = useState("y");
  const [y0, setY0] = useState("1");
  const [tStart, setTStart] = useState("0");
  const [tEnd, setTEnd] = useState("5");
  const [method, setMethod] = useState("rk4");
  const [r, run] = useCalc();
  const [graphFns, setGraphFns] = useState([]);
  const [graphLabels, setGraphLabels] = useState([]);
  const [show, setShow] = useState(false);

  const solve = () => run(() => {
    const f = math.compile(eq);
    const rhs = (t, y) => f.evaluate({ t, y, x: t });
    const a = +tStart, b = +tEnd, n = 800, h = (b - a) / n;
    const ts = [a], ys = [+y0];
    if (method === "euler") {
      for (let i = 0; i < n; i++) { ys.push(ys[i] + h * rhs(ts[i], ys[i])); ts.push(ts[i] + h); }
    } else if (method === "rk4") {
      for (let i = 0; i < n; i++) {
        const k1 = rhs(ts[i], ys[i]);
        const k2 = rhs(ts[i] + h / 2, ys[i] + h * k1 / 2);
        const k3 = rhs(ts[i] + h / 2, ys[i] + h * k2 / 2);
        const k4 = rhs(ts[i] + h, ys[i] + h * k3);
        ys.push(ys[i] + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6);
        ts.push(ts[i] + h);
      }
    } else { // Midpoint
      for (let i = 0; i < n; i++) {
        const k1 = rhs(ts[i], ys[i]);
        const k2 = rhs(ts[i] + h / 2, ys[i] + h * k1 / 2);
        ys.push(ys[i] + h * k2); ts.push(ts[i] + h);
      }
    }
    const interp = t => { const idx = Math.max(0, Math.min(n - 1, Math.floor((t - a) / (b - a) * n))); return ys[idx]; };
    setGraphFns([interp]); setGraphLabels([`y(t), y'=${eq}`]); setShow(true);
    return `y(${b}) ≈ ${ys[n].toFixed(8)}\ny_max ≈ ${Math.max(...ys.filter(isFinite)).toFixed(6)}\ny_min ≈ ${Math.min(...ys.filter(isFinite)).toFixed(6)}`;
  });

  return (
    <div style={S.card}>
      <div style={S.sh}>ODE Solver — y′ = f(t, y)</div>
      <div style={S.row}>
        <div style={S.col}><Field label="f(t, y)  [right-hand side]" value={eq} onChange={setEq} placeholder="y · e.g. -y+sin(t)" /></div>
        <div style={S.col}><Field label="y(t₀)" value={y0} onChange={setY0} placeholder="1" /></div>
      </div>
      <div style={S.row}>
        <div style={S.col}><Field label="t start" value={tStart} onChange={setTStart} placeholder="0" /></div>
        <div style={S.col}><Field label="t end" value={tEnd} onChange={setTEnd} placeholder="5" /></div>
        <div style={S.col}>
          <label style={S.label}>Method</label>
          <select style={{ ...S.input, cursor: "pointer" }} value={method} onChange={e => setMethod(e.target.value)}>
            <option value="euler">Euler</option>
            <option value="midpoint">Midpoint</option>
            <option value="rk4">RK4</option>
          </select>
        </div>
      </div>
      <div style={S.btnRow}><button style={S.btn()} onClick={solve}>Solve</button></div>
      <Result {...r} />
      {show && <InteractiveGraph fns={graphFns} fnLabels={graphLabels} xMin={+tStart} xMax={+tEnd} height={380} />}
      <div style={S.sep} />
      <div style={{ fontSize: 11, color: C.muted, fontFamily: mono, lineHeight: 1.8 }}>
        Use <code>t</code> and <code>y</code> in f. Examples: <code>-y</code> (decay) · <code>y*(1-y)</code> (logistic) · <code>-2*t*y</code> · <code>sin(t)-y</code>
      </div>
    </div>
  );
}

// ── DISCRETE ──
function ModClock({ n, highlight }) {
  const ref = useRef();
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.38;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = C.surface; ctx.fillRect(0, 0, W, H);
    const count = Math.max(2, Math.min(n, 36));
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i / count) - Math.PI / 2;
      const px = cx + R * Math.cos(angle), py = cy + R * Math.sin(angle);
      const isHl = ((i % count) + count) % count === ((highlight % count) + count) % count;
      ctx.fillStyle = isHl ? C.accent : C.dim; ctx.beginPath(); ctx.arc(px, py, isHl ? 9 : 6, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = isHl ? "#fff" : C.muted; ctx.font = `${isHl ? 11 : 9}px ${mono}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(i, px, py);
    }
    if (highlight !== null) {
      const angle = (2 * Math.PI * (((highlight % count) + count) % count) / count) - Math.PI / 2;
      const px = cx + R * Math.cos(angle), py = cy + R * Math.sin(angle);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = C.border; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(cx, cy, R * 0.15, 0, 2 * Math.PI); ctx.stroke();
  }, [n, highlight]);
  return <canvas ref={ref} width={280} height={280} style={{ ...S.canvas, width: 280, maxWidth: "100%", borderRadius: "50%" }} />;
}

function DiscreteTab() {
  const [n, setN] = useState("10"); const [k, setK] = useState("3");
  const [modA, setModA] = useState("17"); const [modM, setModM] = useState("12");
  const [gA, setGA] = useState("48"); const [gB, setGB] = useState("18");
  const [setA, setSetA] = useState("1,2,3,4"); const [setB, setSetB] = useState("3,4,5,6");
  const [cr, runC] = useCalc(); const [mr, runM] = useCalc(); const [gr, runG] = useCalc(); const [sr, runS] = useCalc();
  const [modResult, setModResult] = useState(null);

  return (
    <div style={S.card}>
      <div style={S.sh}>Combinatorics</div>
      <div style={S.row}>
        <div style={S.col}><Field label="n" value={n} onChange={setN} placeholder="10" /></div>
        <div style={S.col}><Field label="k" value={k} onChange={setK} placeholder="3" /></div>
      </div>
      <div style={S.btnRow}>
        <button style={S.btn(true)} onClick={() => runC(() => {
          const ni = +n, ki = +k;
          const D = n2 => Math.round(math.factorial(n2) * [...Array(n2 + 1)].reduce((s, _, i) => s + (i % 2 === 0 ? 1 : -1) / math.factorial(i), 0));
          return `C(${n},${k}) = ${math.combinations(ni, ki)}\nP(${n},${k}) = ${math.permutations(ni, ki)}\nDerangements D(${n}) = ${D(ni)}\nMultiset C(${n}+${k}-1,${k}) = ${math.combinations(ni + ki - 1, ki)}`;
        })}>Compute</button>
      </div>
      <Result {...cr} />
      <div style={S.sep} />
      <div style={S.sh}>Modular arithmetic clock</div>
      <div style={S.row}>
        <div style={S.col}><Field label="a" value={modA} onChange={setModA} placeholder="17" /></div>
        <div style={S.col}><Field label="mod m" value={modM} onChange={setModM} placeholder="12" /></div>
      </div>
      <div style={S.btnRow}>
        <button style={S.btn(true)} onClick={() => {
          runM(() => {
            const a = +modA, m = +modM, res = ((a % m) + m) % m;
            let inv = -1;
            for (let x = 1; x < m; x++) if ((a * x) % m === 1) { inv = x; break; }
            setModResult(res);
            return `${a} mod ${m} = ${res}\nInverse of ${a} (mod ${m}) = ${inv < 0 ? "none (not coprime)" : inv}\ngcd(${a},${m}) = ${math.gcd(a, m)}`;
          });
        }}>Compute</button>
      </div>
      <Result {...mr} />
      <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
        <ModClock n={+modM} highlight={modResult} />
      </div>
      <div style={{ fontSize: 11, color: C.muted, fontFamily: mono, textAlign: "center", marginTop: 6 }}>{modA} mod {modM} = {modResult !== null ? modResult : "?"} (highlighted)</div>
      <div style={S.sep} />
      <div style={S.sh}>GCD / LCM / Bézout</div>
      <div style={S.row}>
        <div style={S.col}><Field label="a" value={gA} onChange={setGA} placeholder="48" /></div>
        <div style={S.col}><Field label="b" value={gB} onChange={setGB} placeholder="18" /></div>
      </div>
      <div style={S.btnRow}>
        <button style={S.btn(true)} onClick={() => runG(() => {
          const a = +gA, b = +gB;
          let [or, r2, os, s2, ot, t2] = [a, b, 1, 0, 0, 1];
          while (r2) { const q = Math.floor(or / r2); [or, r2] = [r2, or - q * r2]; [os, s2] = [s2, os - q * s2]; [ot, t2] = [t2, ot - q * t2]; }
          return `GCD(${a},${b}) = ${or}\nLCM(${a},${b}) = ${math.lcm(a, b)}\nBézout: ${os}·${a} + ${ot}·${b} = ${or}`;
        })}>Compute</button>
      </div>
      <Result {...gr} />
      <div style={S.sep} />
      <div style={S.sh}>Set operations</div>
      <div style={S.row}>
        <div style={S.col}><Field label="Set A" value={setA} onChange={setSetA} placeholder="1,2,3,4" /></div>
        <div style={S.col}><Field label="Set B" value={setB} onChange={setSetB} placeholder="3,4,5,6" /></div>
      </div>
      <div style={S.btnRow}>
        <button style={S.btn(true)} onClick={() => runS(() => {
          const A = new Set(setA.split(",").map(x => x.trim())), B = new Set(setB.split(",").map(x => x.trim()));
          const fmt = s => `{${[...s].sort().join(", ")}}`;
          return `A ∪ B = ${fmt(new Set([...A, ...B]))}\nA ∩ B = ${fmt(new Set([...A].filter(x => B.has(x))))}\nA \\ B = ${fmt(new Set([...A].filter(x => !B.has(x))))}\nA △ B = ${fmt(new Set([...[...A].filter(x => !B.has(x)), ...[...B].filter(x => !A.has(x))]))}\n|A|=${A.size}  |B|=${B.size}  |A∪B|=${new Set([...A, ...B]).size}`;
        })}>Compute</button>
      </div>
      <Result {...sr} />
    </div>
  );
}

// ── LINEAR ALGEBRA ──
function MatrixViz({ mat }) {
  if (!mat || !mat.length) return null;
  const maxV = Math.max(...mat.flat().map(Math.abs), 1);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: C.muted, fontFamily: mono, marginBottom: 6 }}>heatmap</div>
      <div style={{ display: "inline-block", border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
        {mat.map((row, i) => (
          <div key={i} style={{ display: "flex" }}>
            {row.map((v, j) => {
              const t = Math.abs(v) / maxV;
              const bg = v >= 0 ? `rgba(94,234,212,${t * 0.4})` : `rgba(248,113,113,${t * 0.4})`;
              return <div key={j} style={{ width: 56, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: bg, fontSize: 11, fontFamily: mono, color: C.text, borderRight: j < row.length - 1 ? `1px solid ${C.border}` : "none", borderBottom: i < mat.length - 1 ? `1px solid ${C.border}` : "none" }}>{typeof v === "number" ? v.toFixed(3) : String(v)}</div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function LinAlgTab() {
  const [mA, setMA] = useState("1,2;3,4");
  const [mB, setMB] = useState("5,6;7,8");
  const [vec, setVec] = useState("1,2,3");
  const [vec2, setVec2] = useState("4,5,6");
  const [matResult, setMatResult] = useState(null);
  const [r, run] = useCalc(); const [vr, runV] = useCalc();
  const parse = s => s.split(";").map(r => r.split(",").map(Number));
  const fmt = m => m.map(r => "[" + r.map(v => math.format(v, { precision: 5 })).join(", ") + "]").join("\n");
  const matOp = fn => () => run(() => {
    const res = fn();
    const arr = Array.isArray(res) && Array.isArray(res[0]) ? res.map(r => r.map(v => typeof v === "object" ? math.re(v) : v)) : null;
    setMatResult(arr);
    return Array.isArray(res) ? fmt(res) : String(res);
  });

  return (
    <div style={S.card}>
      <div style={S.sh}>Matrices</div>
      <div style={S.row}>
        <div style={S.col}><Field label="Matrix A (rows=';', cols=',')" value={mA} onChange={setMA} placeholder="1,2;3,4" /></div>
        <div style={S.col}><Field label="Matrix B" value={mB} onChange={setMB} placeholder="5,6;7,8" /></div>
      </div>
      <div style={S.btnRow}>
        {[["A+B", () => math.add(parse(mA), parse(mB))], ["A×B", () => math.multiply(parse(mA), parse(mB))], ["det(A)", () => [[math.det(parse(mA))]]], ["inv(A)", () => math.inv(parse(mA))], ["Aᵀ", () => math.transpose(parse(mA))], ["eig(A)", () => { const e = math.eigs(parse(mA)); return e.values.map(v => [math.format(v, { precision: 5 })]); }], ["LU(A)", () => { const [L, U] = luDecomp(parse(mA)); return L.map((r, i) => [...r.map(v => v.toFixed(3)), "|", ...U[i].map(v => v.toFixed(3))]); }]].map(([label, fn]) => (
          <button key={label} style={S.btn(true)} onClick={matOp(fn)}>{label}</button>
        ))}
      </div>
      <Result {...r} />
      <MatrixViz mat={matResult} />
      <div style={S.sep} />
      <div style={S.sh}>Vectors</div>
      <div style={S.row}>
        <div style={S.col}><Field label="u" value={vec} onChange={setVec} placeholder="1,2,3" /></div>
        <div style={S.col}><Field label="v" value={vec2} onChange={setVec2} placeholder="4,5,6" /></div>
      </div>
      <div style={S.btnRow}>
        {[
          ["u·v", () => { const u = vec.split(",").map(Number), v = vec2.split(",").map(Number); return `dot = ${u.reduce((s, x, i) => s + x * v[i], 0)}`; }],
          ["u×v", () => { const [a1, a2, a3] = vec.split(",").map(Number), [b1, b2, b3] = vec2.split(",").map(Number); return `(${a2 * b3 - a3 * b2}, ${a3 * b1 - a1 * b3}, ${a1 * b2 - a2 * b1})`; }],
          ["|u|", () => { const u = vec.split(",").map(Number); return `||u|| = ${Math.sqrt(u.reduce((s, x) => s + x * x, 0)).toFixed(6)}`; }],
          ["angle", () => { const u = vec.split(",").map(Number), v = vec2.split(",").map(Number); const dot = u.reduce((s, x, i) => s + x * v[i], 0), nu = Math.sqrt(u.reduce((s, x) => s + x * x, 0)), nv = Math.sqrt(v.reduce((s, x) => s + x * x, 0)); return `θ = ${(Math.acos(dot / (nu * nv)) * 180 / Math.PI).toFixed(4)}°`; }],
          ["proj u→v", () => { const u = vec.split(",").map(Number), v = vec2.split(",").map(Number); const s = u.reduce((s, x, i) => s + x * v[i], 0) / v.reduce((s, x) => s + x * x, 0); return `(${v.map(x => (s * x).toFixed(4)).join(", ")})`; }],
        ].map(([label, fn]) => <button key={label} style={S.btn(true)} onClick={() => runV(fn)}>{label}</button>)}
      </div>
      <Result {...vr} />
    </div>
  );
}

function luDecomp(A) {
  const n = A.length;
  const L = Array.from({ length: n }, (_, i) => Array(n).fill(0).map((_, j) => i === j ? 1 : 0));
  const U = A.map(r => [...r]);
  for (let k = 0; k < n; k++) for (let i = k + 1; i < n; i++) { L[i][k] = U[i][k] / U[k][k]; for (let j = k; j < n; j++) U[i][j] -= L[i][k] * U[k][j]; }
  return [L, U];
}

// ── NUMBER THEORY ──
function NumberTheoryTab() {
  const [num, setNum] = useState("360");
  const [r, run] = useCalc();
  const [show, setShow] = useState(false);
  const sieve = max => { const p = Array(max + 1).fill(true); p[0] = p[1] = false; for (let i = 2; i * i <= max; i++) if (p[i]) for (let j = i * i; j <= max; j += i) p[j] = false; return p; };

  const ops = [
    ["Factorize", () => { let n = +num, f = {}, d = 2; while (d * d <= n) { while (n % d === 0) { f[d] = (f[d] || 0) + 1; n /= d; } d++; } if (n > 1) f[n] = (f[n] || 0) + 1; return Object.entries(f).map(([p, e]) => e > 1 ? `${p}^${e}` : p).join(" × "); }],
    ["Miller-Rabin", () => { const n = BigInt(num); if (n < 2n) return `${num} is not prime`; let d = n - 1n, r = 0; while (d % 2n === 0n) { d /= 2n; r++; } const pow = (b, e, m) => { let res = 1n; b %= m; while (e > 0n) { if (e % 2n === 1n) res = res * b % m; e /= 2n; b = b * b % m; } return res; }; for (const a of [2n, 3n, 5n, 7n, 11n, 13n]) { if (a >= n) continue; let x = pow(a, d, n); if (x === 1n || x === n - 1n) continue; let comp = true; for (let i = 0; i < r - 1; i++) { x = x * x % n; if (x === n - 1n) { comp = false; break; } } if (comp) return `${num} is composite`; } return `${num} is prime`; }],
    ["Euler φ(n)", () => { let n = +num, res = n, orig = n, p = 2; while (p * p <= n) { if (n % p === 0) { while (n % p === 0) n /= p; res -= res / p; } p++; } if (n > 1) res -= res / n; return `φ(${orig}) = ${Math.round(res)}`; }],
    ["Divisors σ", () => { const n = +num, d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return `σ₀=${d.length}  σ₁=${d.reduce((a, b) => a + b, 0)}\n${d.join(", ")}`; }],
    ["Collatz", () => { let n = +num, steps = [n]; while (n !== 1 && steps.length < 1000) { n = n % 2 === 0 ? n / 2 : 3 * n + 1; steps.push(n); } return `${steps.length - 1} steps  peak=${Math.max(...steps)}\n${steps.slice(0, 30).join("→")}${steps.length > 30 ? "→…" : ""}`; }],
    ["Fibonacci", () => { const n = Math.min(+num, 78); let a = 0n, b = 1n, res = [0n]; for (let i = 1; i < n; i++) { res.push(b); [a, b] = [b, a + b]; } return res.join(", "); }],
    ["Plot π(x)", () => { setShow(true); return `π(x) up to ${Math.min(+num, 1000)}`; }],
  ];

  const piGraph = (() => {
    const max = Math.min(+num || 100, 1000);
    const p = sieve(max);
    const piFn = x => p.slice(0, Math.floor(x) + 1).filter(Boolean).length;
    return { fns: [piFn, x => x / Math.log(Math.max(x, 1.01))], labels: ["π(x)", "x/ln(x)"], max };
  })();

  return (
    <div style={S.card}>
      <div style={S.sh}>Number theory</div>
      <Field label="n" value={num} onChange={setNum} placeholder="360" />
      <div style={S.btnRow}>{ops.map(([label, fn]) => <button key={label} style={S.btn(true)} onClick={() => run(fn)}>{label}</button>)}</div>
      <Result {...r} />
      {show && <InteractiveGraph fns={piGraph.fns} fnLabels={piGraph.labels} xMin={2} xMax={piGraph.max} yMin={0} yMax={piGraph.fns[0](piGraph.max) * 1.2} height={340} />}
    </div>
  );
}

// ── STATISTICS ──
function HistCanvas({ data }) {
  const ref = useRef();
  useEffect(() => {
    if (!data.length || !ref.current) return;
    const cv = ref.current, ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = C.surface; ctx.fillRect(0, 0, W, H);
    const bins = 12, min = Math.min(...data), max = Math.max(...data), bw = (max - min) / bins || 1;
    const counts = Array(bins).fill(0);
    data.forEach(v => { let i = Math.floor((v - min) / bw); if (i >= bins) i = bins - 1; counts[i]++; });
    const maxC = Math.max(...counts);
    const pad = { l: 32, r: 10, t: 10, b: 28 };
    const W2 = W - pad.l - pad.r, H2 = H - pad.t - pad.b;
    counts.forEach((c, i) => {
      const bh = (c / maxC) * H2, bx = pad.l + i * (W2 / bins), by = pad.t + H2 - bh;
      ctx.fillStyle = C.accentDim; ctx.fillRect(bx + 1, by, W2 / bins - 2, bh);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 0.8; ctx.strokeRect(bx + 1, by, W2 / bins - 2, bh);
      ctx.fillStyle = C.muted; ctx.font = `9px ${mono}`; ctx.textAlign = "center";
      ctx.fillText((min + (i + 0.5) * bw).toFixed(1), bx + W2 / bins / 2 + pad.l / bins, H - 8);
    });
    ctx.fillStyle = C.dim; ctx.font = `9px ${mono}`; ctx.textAlign = "left"; ctx.fillText(min.toFixed(1), pad.l, H - 8);
    ctx.textAlign = "right"; ctx.fillText(max.toFixed(1), W - pad.r, H - 8);
  }, [data]);
  return <canvas ref={ref} width={700} height={180} style={S.canvas} />;
}

function StatsTab() {
  const [data, setData] = useState("4,7,13,2,1,7,9,15,3,7");
  const [r, run] = useCalc(); const [vizData, setVizData] = useState([]);

  const parse = () => data.split(/[,\s|]+/).map(Number).filter(x => !isNaN(x));

  const ops = [
    ["Summary", () => {
      const d = parse().sort((a, b) => a - b), n = d.length;
      const mean = d.reduce((a, b) => a + b, 0) / n;
      const v = d.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
      const med = n % 2 === 0 ? (d[n / 2 - 1] + d[n / 2]) / 2 : d[(n - 1) / 2];
      const freq = {}; d.forEach(x => freq[x] = (freq[x] || 0) + 1);
      const mode = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
      const sk = d.reduce((s, x) => s + ((x - mean) / Math.sqrt(v)) ** 3, 0) / n;
      const ku = d.reduce((s, x) => s + ((x - mean) / Math.sqrt(v)) ** 4, 0) / n - 3;
      setVizData(d);
      return `n=${n}  mean=${mean.toFixed(4)}  median=${med}  mode=${mode}\nσ²=${v.toFixed(4)}  σ=${Math.sqrt(v).toFixed(4)}\nskewness=${sk.toFixed(4)}  excess kurtosis=${ku.toFixed(4)}\nmin=${d[0]}  max=${d[n - 1]}  range=${d[n - 1] - d[0]}`;
    }],
    ["Percentiles", () => { const d = parse().sort((a, b) => a - b); const q = p => { const i = p / 100 * (d.length - 1), lo = Math.floor(i), hi = Math.ceil(i); return d[lo] + (d[hi] - d[lo]) * (i - lo); }; return `Q1=${q(25).toFixed(3)}  Q2=${q(50).toFixed(3)}  Q3=${q(75).toFixed(3)}\nIQR=${(q(75) - q(25)).toFixed(3)}  P10=${q(10).toFixed(3)}  P90=${q(90).toFixed(3)}`; }],
    ["Pearson r", () => { const parts = data.split("|"); if (parts.length < 2) return "separate two datasets with |"; const x = parts[0].split(",").map(Number), y = parts[1].split(",").map(Number), n = Math.min(x.length, y.length); const mx = x.slice(0,n).reduce((a,b)=>a+b,0)/n, my = y.slice(0,n).reduce((a,b)=>a+b,0)/n; const num = x.slice(0,n).reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0); const den = Math.sqrt(x.slice(0,n).reduce((s,v)=>s+(v-mx)**2,0)*y.slice(0,n).reduce((s,v)=>s+(v-my)**2,0)); const rr = num/den; return `r = ${rr.toFixed(6)}\nr² = ${(rr**2).toFixed(6)}`; }],
    ["Normal fit", () => { const d = parse(), n = d.length, mean = d.reduce((a,b)=>a+b,0)/n; const sd = Math.sqrt(d.reduce((s,x)=>s+(x-mean)**2,0)/n); return `μ=${mean.toFixed(4)}  σ=${sd.toFixed(4)}\n68%: [${(mean-sd).toFixed(3)}, ${(mean+sd).toFixed(3)}]\n95%: [${(mean-2*sd).toFixed(3)}, ${(mean+2*sd).toFixed(3)}]\n99.7%: [${(mean-3*sd).toFixed(3)}, ${(mean+3*sd).toFixed(3)}]`; }],
    ["Binomial", () => { const pts = data.split(",").map(Number); const [n2, k2, p2] = [pts[0]||10, pts[1]||3, pts[2]||0.5]; const C2 = math.combinations(n2, k2); return `P(X=${k2};n=${n2},p=${p2}) = ${(C2*Math.pow(p2,k2)*Math.pow(1-p2,n2-k2)).toFixed(8)}\nE[X]=${(n2*p2).toFixed(4)}  Var=${(n2*p2*(1-p2)).toFixed(4)}\n(format: n,k,p)`; }],
    ["Z-scores", () => { const d = parse(), n = d.length, mean = d.reduce((a,b)=>a+b,0)/n; const sd = Math.sqrt(d.reduce((s,x)=>s+(x-mean)**2,0)/n); return d.map((x,i)=>`x[${i+1}]=${x}  z=${((x-mean)/sd).toFixed(4)}`).join("\n"); }],
  ];

  return (
    <div style={S.card}>
      <div style={S.sh}>Statistics</div>
      <Field label="Data (comma-sep · correlation: A|B · binomial: n,k,p)" value={data} onChange={setData} placeholder="4,7,13,2,1,7,9,15,3,7" />
      <div style={S.btnRow}>{ops.map(([label, fn]) => <button key={label} style={S.btn(true)} onClick={() => run(fn)}>{label}</button>)}</div>
      <Result {...r} />
      {vizData.length > 0 && <div style={{ marginTop: 12 }}><div style={S.sh}>histogram</div><HistCanvas data={vizData} /></div>}
    </div>
  );
}

// ── COMPLEX ──
function ComplexTab() {
  const [expr, setExpr] = useState("(2+3i)^2 / (1-i)");
  const [points, setPoints] = useState("1+2i, 3-i, -2+0i, 1+i");
  const [r, run] = useCalc();
  const cvRef = useRef();

  const drawArgand = pts => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, scale = 55;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = C.surface; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
    for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(cx + i * scale, 0); ctx.lineTo(cx + i * scale, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, cy + i * scale); ctx.lineTo(W, cy + i * scale); ctx.stroke(); }
    ctx.strokeStyle = C.dim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    ctx.strokeStyle = C.border; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(cx, cy, scale, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = `9px ${mono}`; ctx.fillText("Re", W - 16, cy - 4); ctx.fillText("Im", cx + 4, 12);
    const cols = ["#8b7cf6", "#5eead4", "#fbbf24", "#f87171", "#60a5fa"];
    pts.forEach((z, i) => {
      const px = cx + math.re(z) * scale, py = cy - math.im(z) * scale;
      ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.arc(px, py, 5, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = C.text; ctx.font = `10px ${mono}`; ctx.fillText(`${math.re(z).toFixed(2)}+${math.im(z).toFixed(2)}i`, px + 7, py - 4);
    });
  };

  return (
    <div style={S.card}>
      <div style={S.sh}>Complex numbers</div>
      <Field label="Expression" value={expr} onChange={setExpr} placeholder="(2+3i)^2 / (1-i)" />
      <div style={S.btnRow}>
        <button style={S.btn(true)} onClick={() => run(() => { const z = math.evaluate(expr), re = math.re(z), im = math.im(z), mod = math.abs(z), arg = math.arg(z); return `z = ${re.toFixed(6)} + ${im.toFixed(6)}i\n|z| = ${mod.toFixed(6)}\narg(z) = ${arg.toFixed(6)} rad = ${(arg * 180 / Math.PI).toFixed(4)}°\nconjugate = ${re.toFixed(6)} − ${im.toFixed(6)}i\npolar: ${mod.toFixed(6)}·e^(${arg.toFixed(6)}i)`; })}>Evaluate</button>
      </div>
      <Result {...r} />
      <div style={S.sep} />
      <div style={S.sh}>Argand plane</div>
      <Field label="Points (comma-sep complex)" value={points} onChange={setPoints} placeholder="1+2i, 3-i" />
      <div style={S.btnRow}><button style={S.btn(true)} onClick={() => { try { drawArgand(points.split(",").map(s => math.evaluate(s.trim()))); } catch { } }}>Plot</button></div>
      <div style={{ marginTop: 12 }}><canvas ref={cvRef} width={500} height={300} style={{ ...S.canvas, maxWidth: "100%" }} /></div>
    </div>
  );
}

// ── TOPOLOGY ──
function TopologyTab() {
  const [pts, setPts] = useState("0,1,2,3,4");
  const [metric, setMetric] = useState("euclidean");
  const [epsi, setEpsi] = useState("1.5");
  const [r, run] = useCalc();
  const cvRef = useRef();

  const drawMatrix = matrix => {
    const cv = cvRef.current; if (!cv) return;
    const n = matrix.length, cell = Math.min(64, 280 / n);
    cv.width = n * cell + 60; cv.height = n * cell + 30;
    const ctx = cv.getContext("2d"), labels = pts.split(",").map(x => x.trim());
    ctx.clearRect(0, 0, cv.width, cv.height); ctx.fillStyle = C.surface; ctx.fillRect(0, 0, cv.width, cv.height);
    const maxD = Math.max(...matrix.flat().filter(isFinite), 1);
    matrix.forEach((row, i) => row.forEach((v, j) => {
      const t = isFinite(v) ? v / maxD : 1;
      ctx.fillStyle = `rgba(139,124,246,${t * 0.65})`; ctx.fillRect(60 + j * cell, i * cell, cell, cell);
      ctx.strokeStyle = C.border; ctx.lineWidth = 0.5; ctx.strokeRect(60 + j * cell, i * cell, cell, cell);
      ctx.fillStyle = C.text; ctx.font = `9px ${mono}`; ctx.textAlign = "center";
      ctx.fillText(isFinite(v) ? v.toFixed(2) : "∞", 60 + j * cell + cell / 2, i * cell + cell / 2 + 4);
    }));
    labels.forEach((l, i) => { ctx.fillStyle = C.muted; ctx.font = `9px ${mono}`; ctx.textAlign = "right"; ctx.fillText(l, 54, i * cell + cell / 2 + 4); ctx.textAlign = "center"; ctx.fillText(l, 60 + i * cell + cell / 2, n * cell + 14); });
  };

  return (
    <div style={S.card}>
      <div style={S.sh}>Metric spaces</div>
      <div style={S.row}>
        <div style={S.col}><Field label="Points (1D)" value={pts} onChange={setPts} placeholder="0,1,2,3,4" /></div>
        <div style={{ width: 140 }}><label style={S.label}>Metric</label><select style={{ ...S.input, cursor: "pointer" }} value={metric} onChange={e => setMetric(e.target.value)}><option value="euclidean">Euclidean</option><option value="discrete">Discrete</option><option value="taxicab">Taxicab</option><option value="padic2">2-adic</option></select></div>
        <div style={{ width: 80 }}><Field label="ε (ball)" value={epsi} onChange={setEpsi} placeholder="1.5" /></div>
      </div>
      <div style={S.btnRow}>
        <button style={S.btn(true)} onClick={() => run(() => {
          const p2 = pts.split(",").map(Number);
          const d = (a, b) => metric === "euclidean" ? Math.abs(a - b) : metric === "discrete" ? (a === b ? 0 : 1) : metric === "taxicab" ? Math.abs(a - b) : (() => { let diff = Math.abs(a - b); if (!diff) return 0; let k = 0; while (diff % 2 === 0) { diff /= 2; k++; } return Math.pow(2, -k); })();
          const mat = p2.map(a => p2.map(b => d(a, b)));
          drawMatrix(mat);
          return p2.map(p => `B(${p},${epsi}) = {${p2.filter(q => d(p, q) < +epsi).join(",")}}`).join("\n");
        })}>Analyze</button>
      </div>
      <Result {...r} />
      <div style={{ marginTop: 12 }}><div style={S.sh}>distance matrix</div><canvas ref={cvRef} style={{ ...S.canvas, width: "auto" }} /></div>
    </div>
  );
}

// ── TRANSFORMS ──
function TransformTab() {
  const [signal, setSignal] = useState("1,0,-1,0,1,0,-1,0");
  const [r, run] = useCalc();
  const cvRef = useRef();

  const drawSpectrum = mags => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, n = mags.length, bw = W / n;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = C.surface; ctx.fillRect(0, 0, W, H);
    const maxM = Math.max(...mags, 1);
    mags.forEach((m, i) => { const bh = (m / maxM) * (H - 20); ctx.fillStyle = C.accentDim; ctx.fillRect(i * bw + 1, H - bh - 10, bw - 2, bh); ctx.strokeStyle = C.accent; ctx.lineWidth = 0.8; ctx.strokeRect(i * bw + 1, H - bh - 10, bw - 2, bh); if (n <= 16) { ctx.fillStyle = C.muted; ctx.font = `9px ${mono}`; ctx.textAlign = "center"; ctx.fillText(i, i * bw + bw / 2, H - 2); } });
  };

  return (
    <div style={S.card}>
      <div style={S.sh}>Transforms</div>
      <Field label="DFT — signal samples (comma-sep)" value={signal} onChange={setSignal} placeholder="1,0,-1,0,1,0,-1,0" />
      <div style={S.btnRow}>
        <button style={S.btn(true)} onClick={() => run(() => {
          const x = signal.split(",").map(Number), N = x.length;
          const X = Array(N).fill(0).map((_, k) => { let re = 0, im = 0; for (let n = 0; n < N; n++) { re += x[n] * Math.cos(2 * Math.PI * k * n / N); im -= x[n] * Math.sin(2 * Math.PI * k * n / N); } return { re, im }; });
          drawSpectrum(X.map(z => Math.sqrt(z.re ** 2 + z.im ** 2)));
          return X.slice(0, Math.ceil(N / 2)).map((z, k) => `X[${k}]: |X|=${Math.sqrt(z.re**2+z.im**2).toFixed(4)}  φ=${Math.atan2(z.im,z.re).toFixed(4)}`).join("\n");
        })}>DFT</button>
        <button style={S.btn(true)} onClick={() => run(() => {
          const x = signal.split(",").map(Number), n = x.length;
          // Laplace (s=jω approximation)
          const freqs = [0.1, 0.5, 1, 2, 5, 10];
          return freqs.map(w => { let re = 0, im = 0; x.forEach((v, t) => { re += v * Math.cos(w * t) * Math.exp(-0.01 * t); im -= v * Math.sin(w * t) * Math.exp(-0.01 * t); }); return `F(j${w}) ≈ ${re.toFixed(3)} + ${im.toFixed(3)}j`; }).join("\n");
        })}>Laplace (approx)</button>
        <button style={S.btn(true)} onClick={() => run(() => {
          // Autocorrelation
          const x = signal.split(",").map(Number), n = x.length;
          const ac = Array(n).fill(0).map((_, lag) => x.reduce((s, v, i) => i + lag < n ? s + v * x[i + lag] : s, 0) / n);
          return ac.map((v, i) => `R[${i}] = ${v.toFixed(4)}`).join("\n");
        })}>Autocorrelation</button>
      </div>
      <Result {...r} />
      <div style={{ marginTop: 12 }}><div style={S.sh}>magnitude spectrum</div><canvas ref={cvRef} width={700} height={180} style={S.canvas} /></div>
    </div>
  );
}

// ── CONTINUED FRACTIONS ──
function MiscTab() {
  const [r1, run1] = useCalc(); const [r2, run2] = useCalc(); const [r3, run3] = useCalc(); const [r4, run4] = useCalc();
  const [cfN, setCfN] = useState("3.14159265"); const [cfD, setCfD] = useState("10");
  const [baseN, setBaseN] = useState("255"); const [baseF, setBaseF] = useState("10"); const [baseT, setBaseT] = useState("2");
  const [venn1, setVenn1] = useState("A,B,C"); const [venn2, setVenn2] = useState("B,C,D");
  const [rpnExpr, setRpnExpr] = useState("3 4 + 2 *");

  return (
    <div style={S.card}>
      <div style={S.sh}>Continued fractions</div>
      <div style={S.row}>
        <div style={S.col}><Field label="Number x" value={cfN} onChange={setCfN} placeholder="3.14159265" /></div>
        <div style={{ width: 80 }}><Field label="Max terms" value={cfD} onChange={setCfD} placeholder="10" /></div>
      </div>
      <div style={S.btnRow}><button style={S.btn(true)} onClick={() => run1(() => {
        let x = +cfN, terms = [];
        for (let i = 0; i < +cfD; i++) { const a = Math.floor(x); terms.push(a); x = x - a; if (Math.abs(x) < 1e-10) break; x = 1 / x; }
        let h1 = 1, h0 = 0, k1 = 0, k0 = 1;
        const convs = terms.map(a => { [h1, h0] = [a * h1 + h0, h1]; [k1, k0] = [a * k1 + k0, k1]; return `${h1}/${k1}`; });
        return `[${terms.join("; ")}]\nConvergents: ${convs.join("  ")}`;
      })}>Expand</button></div>
      <Result {...r1} />
      <div style={S.sep} />
      <div style={S.sh}>Base conversion</div>
      <div style={S.row}>
        <div style={S.col}><Field label="Number" value={baseN} onChange={setBaseN} placeholder="255" /></div>
        <div style={{ width: 80 }}><Field label="From base" value={baseF} onChange={setBaseF} placeholder="10" /></div>
        <div style={{ width: 80 }}><Field label="To base" value={baseT} onChange={setBaseT} placeholder="2" /></div>
      </div>
      <div style={S.btnRow}><button style={S.btn(true)} onClick={() => run2(() => {
        const dec = parseInt(baseN, +baseF);
        return `${baseN} (base ${baseF}) = ${dec.toString(+baseT).toUpperCase()} (base ${baseT})\n= ${dec} decimal\nhex: ${dec.toString(16).toUpperCase()}  oct: ${dec.toString(8)}  bin: ${dec.toString(2)}`;
      })}>Convert</button></div>
      <Result {...r2} />
      <div style={S.sep} />
      <div style={S.sh}>RPN calculator</div>
      <Field label="Expression (postfix)" value={rpnExpr} onChange={setRpnExpr} placeholder="3 4 + 2 *" />
      <div style={S.btnRow}><button style={S.btn(true)} onClick={() => run3(() => {
        const tokens = rpnExpr.trim().split(/\s+/), stack = [];
        for (const t of tokens) {
          if (["+","-","*","/","^"].includes(t)) { const b = stack.pop(), a = stack.pop(); stack.push(t==="+"?a+b:t==="-"?a-b:t==="*"?a*b:t==="/"?a/b:Math.pow(a,b)); }
          else stack.push(+t);
        }
        return `Result = ${stack[0]}`;
      })}>Evaluate</button></div>
      <Result {...r3} />
      <div style={S.sep} />
      <div style={S.sh}>Graph theory (degree sequence)</div>
      <Field label="Adjacency list rows (semicolons between rows, edges with commas)" value={venn1} onChange={setVenn1} placeholder="0,1,2; 0,2; 1" />
      <div style={S.btnRow}><button style={S.btn(true)} onClick={() => run4(() => {
        const rows = venn1.split(";").map(r => r.split(",").map(s => s.trim()).filter(Boolean));
        const n = rows.length;
        const deg = rows.map(r => r.length);
        const edgeCount = deg.reduce((a,b)=>a+b,0)/2;
        const isEulerian = deg.every(d=>d%2===0);
        return `Nodes: ${n}\nDegrees: [${deg.join(", ")}]\nEdges: ${edgeCount}\nDegree sum: ${deg.reduce((a,b)=>a+b,0)}\nEulerian circuit: ${isEulerian?"yes":"no"}\nDense: ${edgeCount > n*(n-1)/4?"yes":"no"}`;
      })}>Analyze</button></div>
      <Result {...r4} />
    </div>
  );
}

const TABS = [
  ["Arithmetic", ArithmeticTab], ["Graphing", GraphingTab], ["Calculus", CalculusTab],
  ["ODE Solver", ODETab], ["Discrete", DiscreteTab], ["Linear Alg.", LinAlgTab],
  ["Number Theory", NumberTheoryTab], ["Statistics", StatsTab], ["Complex", ComplexTab],
  ["Topology", TopologyTab], ["Transforms", TransformTab], ["Misc", MiscTab],
];

export default function App() {
  const [tab, setTab] = useState(0);
  const Tab = TABS[tab][1];
  return (
    <div style={S.wrap}>
      <h1 style={S.title}>Calculator</h1>
      <div style={S.tabRow}>
        {TABS.map(([name], i) => <button key={name} style={S.tab(i === tab)} onClick={() => setTab(i)}>{name}</button>)}
      </div>
      <div style={S.main}><Tab /></div>
    </div>
  );
}

import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);
