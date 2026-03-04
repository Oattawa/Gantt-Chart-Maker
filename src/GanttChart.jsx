import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const ROW_H = 44, NAME_W = 440, HEADER_H = 72;
// NAME_W layout: 0-14 handle | 16-162 name | 165-277 start date | 281-393 end/dur | 414+ delete
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const VIEW_CONFIG = {
  day:     { cellW: 36,  unitCount: 35 },
  week:    { cellW: 90,  unitCount: 16 },
  month:   { cellW: 80,  unitCount: 12 },
  quarter: { cellW: 120, unitCount: 8  },
};
const COLORS = [
  { bg:"#6366f1", light:"#818cf8", name:"Indigo"  },
  { bg:"#8b5cf6", light:"#a78bfa", name:"Violet"  },
  { bg:"#06b6d4", light:"#22d3ee", name:"Cyan"    },
  { bg:"#10b981", light:"#34d399", name:"Emerald" },
  { bg:"#f59e0b", light:"#fbbf24", name:"Amber"   },
  { bg:"#ef4444", light:"#f87171", name:"Red"     },
  { bg:"#ec4899", light:"#f472b6", name:"Pink"    },
  { bg:"#14b8a6", light:"#2dd4bf", name:"Teal"    },
];

// ── Date utils ──────────────────────────────────────────────────────────────
function addDays(d, n)   { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function startOfWeek(d)  { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfQ(d)     { return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1); }
function dimMonth(d)     { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function diffDays(a, b)  { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function fmtShort(d)     { return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric" }); }
function fmtISO(d) {
  const dt = new Date(d);
  return dt.getFullYear() + "-" + String(dt.getMonth()+1).padStart(2,"0") + "-" + String(dt.getDate()).padStart(2,"0");
}
function hexColor(c) { return c.replace("#",""); }

function dateToFrac(date, vs, view) {
  const d = new Date(date); d.setHours(0,0,0,0);
  const v = new Date(vs);   v.setHours(0,0,0,0);
  const dd = (d - v) / 86400000;
  if (view === "day")     return dd;
  if (view === "week")    return dd / 7;
  if (view === "month") {
    const m = (d.getFullYear() - v.getFullYear()) * 12 + (d.getMonth() - v.getMonth());
    return m + (d.getDate() - 1) / dimMonth(d);
  }
  if (view === "quarter") {
    const m = (d.getFullYear() - v.getFullYear()) * 12 + (d.getMonth() - v.getMonth());
    return m / 3 + (d.getDate() - 1) / (dimMonth(d) * 3);
  }
  return dd;
}
function fracToDate(frac, vs, view) {
  const v = new Date(vs); v.setHours(0,0,0,0);
  if (view === "day")     return addDays(v, Math.round(frac));
  if (view === "week")    return addDays(v, Math.round(frac * 7));
  if (view === "month") {
    const mo = Math.floor(frac);
    const r = addMonths(v, mo);
    r.setDate(1 + Math.round((frac - mo) * dimMonth(r)));
    return r;
  }
  if (view === "quarter") return addMonths(v, Math.round(frac * 3));
  return addDays(v, Math.round(frac));
}

function buildUnits(vs, view, n) {
  return Array.from({ length: n }, (_, i) => {
    let date, l1, l2;
    if (view === "day") {
      date = addDays(vs, i); l1 = String(date.getDate()); l2 = DAY_NAMES[date.getDay()];
    } else if (view === "week") {
      date = addDays(vs, i * 7);
      l1 = MONTH_NAMES[date.getMonth()] + " " + date.getDate(); l2 = "W" + (i + 1);
    } else if (view === "month") {
      date = addMonths(vs, i); l1 = MONTH_NAMES[date.getMonth()]; l2 = String(date.getFullYear());
    } else {
      date = addMonths(vs, i * 3);
      l1 = "Q" + (Math.floor(date.getMonth() / 3) + 1); l2 = String(date.getFullYear());
    }
    return { date, l1, l2 };
  });
}
function buildGroups(units, view) {
  const g = [];
  units.forEach((u, i) => {
    const key = (view === "day" || view === "week")
      ? u.date.getFullYear() + "-" + u.date.getMonth()
      : String(u.date.getFullYear());
    const label = (view === "day" || view === "week")
      ? MONTH_NAMES[u.date.getMonth()] + " " + u.date.getFullYear()
      : String(u.date.getFullYear());
    if (!g.length || g[g.length-1].key !== key) g.push({ key, label, start: i });
    else g[g.length-1].count = (g[g.length-1].count || 1) + 1;
  });
  return g;
}

let nid = 6;
function initTasks(today) {
  return [
    { id:1, name:"Research & Discovery", start:addDays(today,-2), end:addDays(today,4),  ci:0 },
    { id:2, name:"UI Design",            start:addDays(today,3),  end:addDays(today,12), ci:1 },
    { id:3, name:"Dev Sprint 1",         start:addDays(today,8),  end:addDays(today,22), ci:2 },
    { id:4, name:"Testing & QA",         start:addDays(today,20), end:addDays(today,28), ci:3 },
    { id:5, name:"Launch",               start:addDays(today,27), end:addDays(today,32), ci:4 },
  ];
}

// ── Project serialization ────────────────────────────────────────────────────
function serializeTasks(tasks) {
  return tasks.map(t => ({ ...t, start: fmtISO(t.start), end: fmtISO(t.end) }));
}
function deserializeTasks(tasks) {
  return tasks.map(t => ({ ...t, start: new Date(t.start), end: new Date(t.end) }));
}

// ── Excel helpers ────────────────────────────────────────────────────────────
function argb(h) { return "FF" + h.toUpperCase(); }
function xcs(fillHex, fcHex, bold, align, sz) {
  const fc  = fcHex  || "E5E7EB";
  const bld = bold   || false;
  const al  = align  || "left";
  const s   = sz     || 10;
  return {
    fill: { patternType:"solid", fgColor:{ argb:argb(fillHex) }, bgColor:{ argb:"FF000000" } },
    font: { color:{ argb:argb(fc) }, bold:bld, sz:s, name:"Segoe UI" },
    alignment: { horizontal:al, vertical:"middle" },
    border: {
      top:    { style:"thin", color:{ argb:"FF1E1E2E" } },
      bottom: { style:"thin", color:{ argb:"FF1E1E2E" } },
      left:   { style:"thin", color:{ argb:"FF1E1E2E" } },
      right:  { style:"thin", color:{ argb:"FF1E1E2E" } },
    }
  };
}
function setXCell(ws, r, c, v, style) {
  const addr = window.XLSX.utils.encode_cell({ r, c });
  ws[addr] = { v, t: typeof v === "number" ? "n" : "s", s: style };
}
function setRef(ws, rows, cols) {
  ws["!ref"] = "A1:" + window.XLSX.utils.encode_col(cols - 1) + rows;
}

function buildTimelineSheet(tasks, mode, today) {
  const allD = tasks.flatMap(t => [new Date(t.start), new Date(t.end)]);
  const rawMin = new Date(Math.min(...allD));
  const rawMax = new Date(Math.max(...allD));
  let cols = [];

  if (mode === "day") {
    const cs = addDays(rawMin, -2);
    const span = diffDays(cs, rawMax) + 5;
    for (let i = 0; i < span; i++) {
      const d = addDays(cs, i);
      const isWE = d.getDay() === 0 || d.getDay() === 6;
      const isT = fmtISO(d) === fmtISO(today);
      cols.push({ label: d.getDate() + "/" + (d.getMonth()+1), top: MONTH_NAMES[d.getMonth()] + " " + d.getFullYear(), date:d, isWE, isToday:isT });
    }
  } else if (mode === "week") {
    const cs = startOfWeek(addDays(rawMin, -7));
    const span = Math.ceil(diffDays(cs, rawMax) / 7) + 3;
    for (let i = 0; i < span; i++) {
      const d = addDays(cs, i * 7);
      const isT = today >= d && today <= addDays(d, 6);
      cols.push({ label: d.getDate() + "/" + (d.getMonth()+1), top: MONTH_NAMES[d.getMonth()] + " " + d.getFullYear(), date:d, isWE:false, isToday:isT });
    }
  } else if (mode === "month") {
    const cs = new Date(rawMin.getFullYear(), rawMin.getMonth() - 1, 1);
    const endM = new Date(rawMax.getFullYear(), rawMax.getMonth() + 2, 1);
    let cur = new Date(cs);
    while (cur < endM) {
      const isT = cur.getFullYear() === today.getFullYear() && cur.getMonth() === today.getMonth();
      cols.push({ label: MONTH_NAMES[cur.getMonth()], top: String(cur.getFullYear()), date: new Date(cur), isWE:false, isToday:isT });
      cur = addMonths(cur, 1);
    }
  } else if (mode === "quarter") {
    const cs = new Date(rawMin.getFullYear(), Math.floor(rawMin.getMonth()/3)*3 - 3, 1);
    const qEnd = new Date(rawMax.getFullYear(), Math.floor(rawMax.getMonth()/3)*3 + 6, 1);
    let cur = new Date(cs);
    while (cur < qEnd) {
      const q = Math.floor(cur.getMonth() / 3) + 1;
      const isT = cur.getFullYear() === today.getFullYear() && Math.floor(cur.getMonth()/3) === Math.floor(today.getMonth()/3);
      cols.push({ label: "Q" + q, top: String(cur.getFullYear()), date: new Date(cur), isWE:false, isToday:isT });
      cur = addMonths(cur, 3);
    }
  } else {
    const yS = rawMin.getFullYear() - 1, yE = rawMax.getFullYear() + 2;
    for (let y = yS; y < yE; y++) {
      cols.push({ label: String(y), top: "", date: new Date(y, 0, 1), isWE:false, isToday: y === today.getFullYear() });
    }
  }

  const PANEL = "16161D", ALT = "1E1E2E", HDR = "0D0D20";
  const colW = mode === "day" ? 3.5 : mode === "week" ? 9 : mode === "month" ? 8 : mode === "quarter" ? 10 : 12;
  const numCols = cols.length + 1;
  const numRows = tasks.length + 2;
  const ws = {};
  setRef(ws, numRows, numCols);
  ws["!cols"] = [{ wch:22 }, ...cols.map(() => ({ wch:colW }))];
  ws["!rows"] = [{ hpt:14 }, { hpt:22 }, ...tasks.map(() => ({ hpt:20 }))];

  // Row 0 – group labels
  setXCell(ws, 0, 0, "", xcs(HDR, "6B7280"));
  let lastTop = "";
  cols.forEach((col, i) => {
    const show = col.top !== lastTop;
    const bg = col.isToday ? "3730A3" : HDR;
    const fc = col.isToday ? "A5B4FC" : "4B5563";
    setXCell(ws, 0, i+1, show ? col.top : "", xcs(bg, fc, show && !!col.top, "left", 8));
    if (show) lastTop = col.top;
  });

  // Row 1 – col headers
  setXCell(ws, 1, 0, "Task", xcs(HDR, "E5E7EB", true, "left", 10));
  cols.forEach((col, i) => {
    const bg = col.isToday ? "3730A3" : col.isWE ? "1C1C2A" : HDR;
    const fc = col.isToday ? "A5B4FC" : col.isWE ? "374151" : "6B7280";
    const s = xcs(bg, fc, col.isToday, "center", mode === "day" ? 7 : 9);
    if (mode === "day") s.alignment = { horizontal:"center", vertical:"middle", textRotation:90 };
    setXCell(ws, 1, i+1, col.label, s);
  });

  // Task rows
  tasks.forEach((t, ri) => {
    const rowBg = ri % 2 === 0 ? PANEL : ALT;
    const tBg = hexColor(COLORS[t.ci].bg);
    const tLt = hexColor(COLORS[t.ci].light);
    setXCell(ws, ri+2, 0, t.name, xcs(tBg + "44", tLt, true, "left", 10));
    cols.forEach((col, ci) => {
      const ts = new Date(t.start); ts.setHours(0,0,0,0);
      const te = new Date(t.end);   te.setHours(0,0,0,0);
      const cd = new Date(col.date); cd.setHours(0,0,0,0);
      let inRange = false;
      if (mode === "day")     inRange = cd >= ts && cd <= te;
      else if (mode === "week")    { const we = addDays(cd, 6); inRange = cd <= te && we >= ts; }
      else if (mode === "month")   { const me = new Date(cd.getFullYear(), cd.getMonth()+1, 0); inRange = cd <= te && me >= ts; }
      else if (mode === "quarter") { const qe = addMonths(cd, 3); qe.setDate(qe.getDate()-1); inRange = cd <= te && qe >= ts; }
      else                         { const ye = new Date(cd.getFullYear(), 11, 31); inRange = cd <= te && ye >= ts; }
      const bg = inRange ? tBg : col.isWE ? "131318" : rowBg;
      const fc = inRange ? tLt : "2A2A44";
      setXCell(ws, ri+2, ci+1, inRange ? " " : "", xcs(bg, fc, false, "center", 8));
    });
  });
  return ws;
}

function exportXLSX(tasks, XLSX) {
  const today = new Date(); today.setHours(0,0,0,0);
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Sheets: [] };
  const STATUS_COLORS = { "Completed":"10B981", "In Progress":"F59E0B", "Upcoming":"6366F1" };

  // Sheet 0 – Task List
  const ws0 = {};
  setRef(ws0, tasks.length + 1, 7);
  ws0["!cols"] = [{ wch:4 },{ wch:26 },{ wch:14 },{ wch:14 },{ wch:14 },{ wch:14 },{ wch:14 }];
  ws0["!rows"] = [{ hpt:24 }, ...tasks.map(() => ({ hpt:20 }))];
  ["#","Task Name","Start","End","Duration","Status","Color"].forEach((h, c) =>
    setXCell(ws0, 0, c, h, xcs("0D0D20", "E5E7EB", true, "center", 11))
  );
  tasks.forEach((t, i) => {
    const status = new Date(t.end) < today ? "Completed" : new Date(t.start) <= today ? "In Progress" : "Upcoming";
    const tBg = hexColor(COLORS[t.ci].bg), tLt = hexColor(COLORS[t.ci].light);
    const rowBg = i % 2 === 0 ? "16161D" : "1E1E2E";
    const sCol = STATUS_COLORS[status];
    [i+1, t.name, fmtISO(t.start), fmtISO(t.end), diffDays(t.start, t.end), status, COLORS[t.ci].name].forEach((v, c) => {
      const isSt = c === 5, isCl = c === 6, isNum = c === 0 || c === 4;
      setXCell(ws0, i+1, c, v, xcs(isCl ? tBg+"44" : rowBg, isSt ? sCol : isCl ? tLt : "E5E7EB", isSt||isCl, isNum||isSt ? "center" : "left", 10));
    });
  });
  XLSX.utils.book_append_sheet(wb, ws0, "Task List");
  wb.Workbook.Sheets[0] = { TabColor:{ argb:argb("4F46E5") } };

  const views = [
    { mode:"day",     label:"Day View",     tab:"06B6D4" },
    { mode:"week",    label:"Week View",    tab:"8B5CF6" },
    { mode:"month",   label:"Month View",   tab:"10B981" },
    { mode:"quarter", label:"Quarter View", tab:"F59E0B" },
    { mode:"year",    label:"Year View",    tab:"EF4444" },
  ];
  views.forEach(({ mode, label, tab }, si) => {
    const ws = buildTimelineSheet(tasks, mode, today);
    XLSX.utils.book_append_sheet(wb, ws, label);
    wb.Workbook.Sheets[si + 1] = { TabColor:{ argb:argb(tab) } };
  });

  XLSX.writeFile(wb, "GanttChart_Export.xlsx", { bookSST:false, cellStyles:true });
}

// ── JSON project save / load ─────────────────────────────────────────────────
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => { try { resolve(JSON.parse(e.target.result)); } catch { reject(new Error("Invalid JSON")); } };
    reader.onerror = () => reject(new Error("Read error"));
    reader.readAsText(file);
  });
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function GanttChart() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [view,      setView]      = useState("day");
  const [tasks,     setTasks]     = useState(() => initTasks(today));
  const [editingId, setEditingId] = useState(null);
  const [editName,  setEditName]  = useState("");
  const [hoveredId, setHoveredId] = useState(null);
  const [dragging,  setDragging]  = useState(null);
  const [reordering, setReordering] = useState(null); // { id, fromIdx, curIdx, sy }
  const [dateMode,   setDateMode]   = useState("end"); // "end" | "dur"
  const [xlsxReady, setXlsxReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [projects,  setProjects]  = useState(() => ({
    "My Project": { versions: [] }
  }));
  const [activeProject,    setActiveProject]    = useState("My Project");
  const [showPanel,        setShowPanel]        = useState(false);
  const [savingAs,         setSavingAs]         = useState(false);
  const [versionNote,      setVersionNote]      = useState("");
  const [newProjectName,   setNewProjectName]   = useState("");
  const inputRef   = useRef(null);
  const projRef    = useRef(null);
  const importRef  = useRef(null);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    if (window.XLSX) { setXlsxReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => setXlsxReady(true);
    document.head.appendChild(s);
  }, []);

  const { cellW, unitCount } = VIEW_CONFIG[view];
  const vs = useMemo(() => {
    if (view === "day")     { const d = addDays(today, -3); d.setHours(0,0,0,0); return d; }
    if (view === "week")    return startOfWeek(addDays(today, -7));
    if (view === "month")   return startOfMonth(addMonths(today, -1));
    if (view === "quarter") return startOfQ(addMonths(today, -3));
  }, [view, today]);

  const units  = useMemo(() => buildUnits(vs, view, unitCount),  [vs, view, unitCount]);
  const groups = useMemo(() => buildGroups(units, view),         [units, view]);
  const totalW = NAME_W + unitCount * cellW;
  const totalH = HEADER_H + tasks.length * ROW_H + 40;
  const todayF = useMemo(() => dateToFrac(today, vs, view), [today, vs, view]);
  const todayX = NAME_W + todayF * cellW;

  const getBX = t => NAME_W + dateToFrac(t.start, vs, view) * cellW + 3;
  const getBW = t => Math.max(cellW * 0.35, (dateToFrac(t.end, vs, view) - dateToFrac(t.start, vs, view)) * cellW - 6);

  // Drag
  const onMD = useCallback((e, id, type) => {
    e.preventDefault();
    const t = tasks.find(t => t.id === id);
    setDragging({ id, type, sx: e.clientX, os: new Date(t.start), oe: new Date(t.end) });
  }, [tasks]);

  const startReorder = useCallback((e, id, fromIdx) => {
    e.preventDefault();
    e.stopPropagation();
    setReordering({ id, fromIdx, curIdx: fromIdx, sy: e.clientY });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const mv = e => {
      const dx = (e.clientX - dragging.sx) / cellW;
      setTasks(prev => prev.map(t => {
        if (t.id !== dragging.id) return t;
        if (dragging.type === "move") {
          const sf = dateToFrac(dragging.os, vs, view) + dx;
          const ef = dateToFrac(dragging.oe, vs, view) + dx;
          return { ...t, start: fracToDate(sf, vs, view), end: fracToDate(ef, vs, view) };
        } else if (dragging.type === "left") {
          const sf = Math.min(dateToFrac(dragging.os, vs, view) + dx, dateToFrac(dragging.oe, vs, view) - 0.5);
          return { ...t, start: fracToDate(sf, vs, view) };
        } else {
          const ef = Math.max(dateToFrac(dragging.oe, vs, view) + dx, dateToFrac(dragging.os, vs, view) + 0.5);
          return { ...t, end: fracToDate(ef, vs, view) };
        }
      }));
    };
    const up = () => setDragging(null);
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, [dragging, cellW, view, vs]);

  useEffect(() => {
    if (!reordering) return;
    const mv = e => {
      const dy = e.clientY - reordering.sy;
      const newIdx = Math.max(0, Math.min(tasks.length - 1, reordering.fromIdx + Math.round(dy / ROW_H)));
      if (newIdx !== reordering.curIdx) setReordering(prev => ({ ...prev, curIdx: newIdx }));
    };
    const up = () => {
      setTasks(prev => {
        if (reordering.curIdx === reordering.fromIdx) return prev;
        const arr = [...prev];
        const [item] = arr.splice(reordering.fromIdx, 1);
        arr.splice(reordering.curIdx, 0, item);
        return arr;
      });
      setReordering(null);
    };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, [reordering, tasks.length]);

  const startEdit = (id, name) => { setEditingId(id); setEditName(name); setTimeout(() => inputRef.current && inputRef.current.focus(), 50); };
  const commit    = () => { if (editName.trim()) setTasks(p => p.map(t => t.id === editingId ? { ...t, name: editName.trim() } : t)); setEditingId(null); };
  const addTask   = () => { const ci = nid % COLORS.length; setTasks(p => [...p, { id: nid++, name:"New Task", start: new Date(today), end: addDays(today, view === "quarter" ? 60 : view === "month" ? 20 : view === "week" ? 14 : 5), ci }]); };
  const delTask   = id => setTasks(p => p.filter(t => t.id !== id));
  const clrTask   = id => setTasks(p => p.map(t => t.id === id ? { ...t, ci:(t.ci + 1) % COLORS.length } : t));

  const updateTaskDate = useCallback((id, field, val) => {
    const d = new Date(val + "T00:00:00");
    if (isNaN(d)) return;
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (field === "start") return { ...t, start: d, end: d > t.end ? new Date(d) : t.end };
      return { ...t, end: d, start: d < t.start ? new Date(d) : t.start };
    }));
  }, []);

  const updateTaskDur = useCallback((id, val) => {
    const days = Math.max(1, parseInt(val) || 1);
    setTasks(prev => prev.map(t => t.id !== id ? t : { ...t, end: addDays(t.start, days) }));
  }, []);

  const handleExport = async () => {
    if (!xlsxReady || !window.XLSX) return;
    setExporting(true);
    await new Promise(r => setTimeout(r, 60));
    try { exportXLSX(tasks, window.XLSX); } catch(e) { console.error(e); }
    setExporting(false);
  };

  // Project / version actions
  const saveVersion = () => {
    const label = versionNote.trim() || ("v" + ((projects[activeProject] && projects[activeProject].versions ? projects[activeProject].versions.length : 0) + 1));
    setProjects(prev => {
      const proj = prev[activeProject] || { versions: [] };
      const ver  = { label, tasks: serializeTasks(tasks), savedAt: new Date().toISOString() };
      return { ...prev, [activeProject]: { ...proj, versions: [...proj.versions, ver] } };
    });
    setVersionNote("");
    setSavingAs(false);
  };

  const loadVersion = (projName, vIdx) => {
    const ver = projects[projName] && projects[projName].versions && projects[projName].versions[vIdx];
    if (ver) { setTasks(deserializeTasks(ver.tasks)); setActiveProject(projName); setShowPanel(false); }
  };

  const createProject = () => {
    const name = newProjectName.trim();
    if (!name || projects[name]) return;
    setProjects(prev => ({ ...prev, [name]: { versions: [] } }));
    setActiveProject(name);
    setTasks(initTasks(today));
    setNewProjectName("");
  };

  const deleteProject = name => {
    if (Object.keys(projects).length <= 1) return;
    setProjects(prev => { const n = { ...prev }; delete n[name]; return n; });
    if (activeProject === name) setActiveProject(Object.keys(projects).find(k => k !== name));
  };

  // ── JSON download / upload ───────────────────────────────────────────────
  const exportCurrentProject = () => {
    const proj = projects[activeProject] || { versions: [] };
    const snapshot = {
      __ganttVersion: 1,
      exportedAt: new Date().toISOString(),
      projectName: activeProject,
      currentTasks: serializeTasks(tasks),
      versions: proj.versions,
    };
    downloadJSON(snapshot, activeProject.replace(/\s+/g,"_") + "_gantt.json");
  };

  const exportAllProjects = () => {
    const snapshot = {
      __ganttVersion: 1,
      exportedAt: new Date().toISOString(),
      activeProject,
      projects: Object.fromEntries(
        Object.entries(projects).map(([k, v]) => [k, v])
      ),
      currentTasks: { [activeProject]: serializeTasks(tasks) },
    };
    downloadJSON(snapshot, "all_projects_gantt.json");
  };

  const handleImportFile = async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const data = await readJSONFile(file);
      if (data.__ganttVersion !== 1) throw new Error("Unknown format");

      if (data.projects) {
        // Full workspace import
        setProjects(data.projects);
        setActiveProject(data.activeProject || Object.keys(data.projects)[0]);
        const ct = data.currentTasks && data.currentTasks[data.activeProject];
        if (ct) setTasks(deserializeTasks(ct));
        setImportMsg("✅ All projects imported!");
      } else if (data.projectName) {
        // Single project import — merge in
        const name = data.projectName;
        setProjects(prev => ({ ...prev, [name]: { versions: data.versions || [] } }));
        setActiveProject(name);
        if (data.currentTasks) setTasks(deserializeTasks(data.currentTasks));
        setImportMsg("✅ Project \"" + name + "\" imported!");
      } else {
        throw new Error("Unrecognised file structure");
      }
    } catch(err) {
      setImportMsg("❌ Import failed: " + err.message);
    }
    e.target.value = "";
    setTimeout(() => setImportMsg(""), 4000);
  };

  const activeS   = { background:"linear-gradient(135deg,#6366f1,#8b5cf6)", border:"none", color:"#fff", boxShadow:"0 2px 12px rgba(99,102,241,0.4)" };
  const inactiveS = { background:"#1a1a26", border:"1px solid #2a2a3a", color:"#6b7280" };
  const versions  = (projects[activeProject] && projects[activeProject].versions) ? projects[activeProject].versions : [];

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif", background:"#0f0f13", minHeight:"100vh", padding:"24px 0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
        * { box-sizing:border-box }
        ::-webkit-scrollbar { height:6px; width:6px; background:#1a1a22 }
        ::-webkit-scrollbar-thumb { background:#333; border-radius:3px }
        .task-row:hover .del-btn { opacity:1 !important }
        .bh { cursor:ew-resize; opacity:0; transition:opacity .15s }
        .bg:hover .bh { opacity:1 }
        .bb { cursor:grab } .bb:active { cursor:grabbing }
        @keyframes spin { to { transform:rotate(360deg) } }
        .xbtn:hover { filter:brightness(1.2); transform:translateY(-1px) }
        .ver-row:hover  { background:#1e1e30 !important }
        .proj-row:hover { background:#1a1a28 !important }
        .di { background:#1a1a2e; border:1px solid #2a2a4a; border-radius:5px; color:#d1d5db; font-size:11px; font-family:'DM Sans',sans-serif; padding:2px 5px; outline:none; width:100%; height:100%; box-sizing:border-box }
        .di:focus { border-color:#6366f1 }
        .di::-webkit-calendar-picker-indicator { filter:invert(0.4); cursor:pointer; padding:0; margin:0 }
        .di::-webkit-inner-spin-button { opacity:0.4 }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ maxWidth:1120, margin:"0 auto", padding:"0 24px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div>
            <h1 style={{ color:"#fff", margin:0, fontSize:22, fontFamily:"'Space Grotesk'", letterSpacing:"-0.5px" }}>📅 Gantt Timeline</h1>
            <p style={{ color:"#4b5563", margin:"3px 0 0", fontSize:12 }}>Drag · Resize · Double-click to rename</p>
          </div>
          <button onClick={() => setShowPanel(p => !p)} style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:10, color:"#a5b4fc", padding:"7px 14px", cursor:"pointer", fontFamily:"'Space Grotesk'", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
            🗂 {activeProject} <span style={{ color:"#4b5563", fontSize:10 }}>▾</span>
          </button>
        </div>

        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:3, background:"#13131a", borderRadius:10, padding:4, border:"1px solid #1e1e2e" }}>
            {["day","week","month","quarter"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ ...(view === v ? activeS : inactiveS), borderRadius:7, padding:"7px 14px", cursor:"pointer", fontFamily:"'Space Grotesk'", fontSize:12, fontWeight:600, transition:"all .2s" }}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={addTask} style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", border:"none", borderRadius:10, color:"#fff", padding:"9px 16px", cursor:"pointer", fontFamily:"'Space Grotesk'", fontSize:13, fontWeight:600, boxShadow:"0 4px 16px rgba(99,102,241,.4)" }}>
            + Task
          </button>
          <button onClick={() => setSavingAs(p => !p)} style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:10, color:"#a5b4fc", padding:"9px 16px", cursor:"pointer", fontFamily:"'Space Grotesk'", fontSize:13, fontWeight:600 }}>
            💾 Save
          </button>
          <button className="xbtn" onClick={handleExport} disabled={exporting || !xlsxReady}
            style={{ background:"linear-gradient(135deg,#047857,#10b981)", border:"none", borderRadius:10, color:"#fff", padding:"9px 16px", cursor: (exporting || !xlsxReady) ? "not-allowed" : "pointer", fontFamily:"'Space Grotesk'", fontSize:13, fontWeight:600, boxShadow:"0 4px 16px rgba(16,185,129,.35)", display:"flex", alignItems:"center", gap:6, transition:"all .2s", opacity: xlsxReady ? 1 : 0.6 }}>
            {exporting ? (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.3"/><path d="M21 12a9 9 0 00-9-9"/></svg> Exporting…</>
            ) : !xlsxReady ? (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.3"/><path d="M21 12a9 9 0 00-9-9"/></svg> Loading…</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9,15 12,18 15,15"/></svg> Export .xlsx</>
            )}
          </button>
        </div>
      </div>

      {/* ── Save version bar ── */}
      {savingAs && (
        <div style={{ maxWidth:1120, margin:"0 auto", padding:"0 24px 14px" }}>
          <div style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:12, padding:"14px 18px", display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ color:"#a5b4fc", fontSize:13, fontFamily:"'Space Grotesk'", fontWeight:600 }}>
              💾 Save to: <em style={{ color:"#fff" }}>{activeProject}</em>
            </span>
            <input value={versionNote} onChange={e => setVersionNote(e.target.value)}
              placeholder="Version note, e.g. v2 — Added sprints"
              onKeyDown={e => e.key === "Enter" && saveVersion()}
              style={{ flex:1, minWidth:180, background:"#0f0f1a", border:"1.5px solid #3730a3", borderRadius:8, color:"#fff", padding:"6px 12px", fontSize:13, fontFamily:"'DM Sans'", outline:"none" }} />
            <button onClick={saveVersion} style={{ background:"linear-gradient(135deg,#4f46e5,#7c3aed)", border:"none", borderRadius:8, color:"#fff", padding:"7px 16px", cursor:"pointer", fontFamily:"'Space Grotesk'", fontSize:13, fontWeight:600 }}>Save</button>
            <button onClick={() => setSavingAs(false)} style={{ background:"transparent", border:"1px solid #2a2a4a", borderRadius:8, color:"#6b7280", padding:"7px 12px", cursor:"pointer", fontSize:13 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Project panel ── */}
      {showPanel && (
        <div style={{ maxWidth:1120, margin:"0 auto", padding:"0 24px 16px" }}>
          <div style={{ background:"#13131a", border:"1px solid #1e1e2e", borderRadius:14, padding:18, display:"flex", gap:20, flexWrap:"wrap" }}>
            {/* Projects */}
            <div style={{ flex:"0 0 200px" }}>
              <div style={{ color:"#6b7280", fontSize:11, fontFamily:"'Space Grotesk'", fontWeight:600, letterSpacing:"1px", marginBottom:10 }}>PROJECTS</div>
              {Object.keys(projects).map(pName => (
                <div key={pName} className="proj-row" onClick={() => setActiveProject(pName)}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", borderRadius:8, cursor:"pointer", background: pName === activeProject ? "#1e1e3a" : "transparent", marginBottom:4 }}>
                  <span style={{ color: pName === activeProject ? "#a5b4fc" : "#9ca3af", fontSize:13, fontFamily:"'DM Sans'", fontWeight: pName === activeProject ? 600 : 400 }}>
                    {pName === activeProject ? "▶ " : ""}{pName}
                  </span>
                  {Object.keys(projects).length > 1 && (
                    <span onClick={e => { e.stopPropagation(); deleteProject(pName); }} style={{ color:"#ef4444", cursor:"pointer", fontSize:12, opacity:0.6 }}>✕</span>
                  )}
                </div>
              ))}
              <div style={{ marginTop:12, display:"flex", gap:6 }}>
                <input ref={projRef} value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                  placeholder="New project…" onKeyDown={e => e.key === "Enter" && createProject()}
                  style={{ flex:1, background:"#0f0f1a", border:"1px solid #2a2a3a", borderRadius:7, color:"#fff", padding:"5px 8px", fontSize:12, fontFamily:"'DM Sans'", outline:"none" }} />
                <button onClick={createProject} style={{ background:"#4f46e5", border:"none", borderRadius:7, color:"#fff", padding:"5px 10px", cursor:"pointer", fontSize:12 }}>+</button>
              </div>
            </div>

            {/* Versions */}
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ color:"#6b7280", fontSize:11, fontFamily:"'Space Grotesk'", fontWeight:600, letterSpacing:"1px", marginBottom:10 }}>
                VERSIONS — {activeProject}
              </div>
              {versions.length === 0 && (
                <div style={{ color:"#374151", fontSize:13, fontStyle:"italic", marginBottom:10 }}>No saved versions yet. Click 💾 Save to create one.</div>
              )}
              {[...versions].reverse().map((ver, revIdx) => {
                const vIdx = versions.length - 1 - revIdx;
                const d = new Date(ver.savedAt);
                const timeStr = d.toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
                return (
                  <div key={vIdx} className="ver-row"
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", borderRadius:9, background:"#0f0f18", marginBottom:6, border:"1px solid #1e1e2e", cursor:"pointer" }}
                    onClick={() => loadVersion(activeProject, vIdx)}>
                    <div>
                      <div style={{ color:"#e5e7eb", fontSize:13, fontFamily:"'DM Sans'", fontWeight:600 }}>{ver.label}</div>
                      <div style={{ color:"#4b5563", fontSize:11, marginTop:2 }}>{timeStr} · {ver.tasks.length} tasks</div>
                    </div>
                    <span style={{ color:"#6366f1", fontSize:12, fontFamily:"'Space Grotesk'", fontWeight:600 }}>Load ↗</span>
                  </div>
                );
              })}
            </div>

            {/* JSON Save / Load column */}
            <div style={{ flex:"0 0 190px", borderLeft:"1px solid #1e1e2e", paddingLeft:18 }}>
              <div style={{ color:"#6b7280", fontSize:11, fontFamily:"'Space Grotesk'", fontWeight:600, letterSpacing:"1px", marginBottom:10 }}>SAVE / LOAD JSON</div>

              <button onClick={exportCurrentProject}
                style={{ width:"100%", background:"linear-gradient(135deg,#1e3a5f,#1e40af)", border:"1px solid #2a4a8f", borderRadius:9, color:"#93c5fd", padding:"9px 12px", cursor:"pointer", fontFamily:"'Space Grotesk'", fontSize:12, fontWeight:600, marginBottom:8, display:"flex", alignItems:"center", gap:7, transition:"all .2s" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Save This Project
              </button>

              <button onClick={exportAllProjects}
                style={{ width:"100%", background:"#13131a", border:"1px solid #2a2a4a", borderRadius:9, color:"#6b7280", padding:"9px 12px", cursor:"pointer", fontFamily:"'Space Grotesk'", fontSize:12, fontWeight:600, marginBottom:16, display:"flex", alignItems:"center", gap:7, transition:"all .2s" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Save All Projects
              </button>

              <div style={{ borderTop:"1px solid #1e1e2e", marginBottom:16 }} />

              <input ref={importRef} type="file" accept=".json" onChange={handleImportFile} style={{ display:"none" }} />
              <button onClick={() => importRef.current && importRef.current.click()}
                style={{ width:"100%", background:"linear-gradient(135deg,#1a2e1a,#14532d)", border:"1px solid #166534", borderRadius:9, color:"#86efac", padding:"9px 12px", cursor:"pointer", fontFamily:"'Space Grotesk'", fontSize:12, fontWeight:600, marginBottom:8, display:"flex", alignItems:"center", gap:7, transition:"all .2s" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Load from JSON
              </button>

              {importMsg && (
                <div style={{ background: importMsg.startsWith("✅") ? "#052e16" : "#2d0a0a", border:"1px solid " + (importMsg.startsWith("✅") ? "#166534" : "#7f1d1d"), borderRadius:8, padding:"8px 10px", color: importMsg.startsWith("✅") ? "#86efac" : "#fca5a5", fontSize:11, fontFamily:"'DM Sans'" }}>
                  {importMsg}
                </div>
              )}

              <div style={{ marginTop:12, color:"#374151", fontSize:11, lineHeight:1.6 }}>
                <div>📥 <strong style={{color:"#4b5563"}}>Save This Project</strong> — exports current project + all its versions as <code style={{color:"#6366f1"}}>ProjectName_gantt.json</code></div>
                <div style={{marginTop:6}}>📦 <strong style={{color:"#4b5563"}}>Save All Projects</strong> — exports every project in one file</div>
                <div style={{marginTop:6}}>📤 <strong style={{color:"#4b5563"}}>Load from JSON</strong> — imports and merges back into the app</div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Gantt ── */}
      <div style={{ maxWidth:1120, margin:"0 auto", padding:"0 24px" }}>
        <div style={{ background:"#16161d", borderRadius:16, border:"1px solid #1e1e2e", overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
          <div style={{ overflowX:"auto" }}>
          <svg width={totalW} height={totalH} style={{ display:"block" }}>
            {/* Column BG */}
            {units.map((u, i) => {
              const x = NAME_W + i * cellW;
              const isWE = view === "day" && (u.date.getDay() === 0 || u.date.getDay() === 6);
              const isTd = Math.floor(todayF) === i;
              return <rect key={i} x={x} y={HEADER_H} width={cellW} height={totalH - HEADER_H} fill={isTd ? "#1a1040" : isWE ? "#131318" : "transparent"} opacity={isTd ? 0.6 : 1} />;
            })}
            {/* Grid */}
            {units.map((_, i) => <line key={i} x1={NAME_W + i*cellW} y1={0} x2={NAME_W + i*cellW} y2={totalH} stroke="#1a1a24" strokeWidth={1} />)}
            {tasks.map((_, i) => <line key={i} x1={0} y1={HEADER_H + (i+1)*ROW_H} x2={totalW} y2={HEADER_H + (i+1)*ROW_H} stroke="#1e1e2a" strokeWidth={1} />)}
            {/* Name col */}
            <rect x={0} y={0} width={NAME_W} height={totalH} fill="#13131a" />
            <line x1={NAME_W} y1={0} x2={NAME_W} y2={totalH} stroke="#23233a" strokeWidth={1.5} />
            {/* Name-panel column dividers (below header) */}
            <line x1={165} y1={HEADER_H} x2={165} y2={totalH} stroke="#1e1e2a" strokeWidth={1} />
            <line x1={281} y1={HEADER_H} x2={281} y2={totalH} stroke="#1e1e2a" strokeWidth={1} />
            {/* Month row */}
            <rect x={0} y={0} width={totalW} height={32} fill="#0d0d14" />
            <text x={16} y={21} fill="#4b5563" fontSize={11} fontFamily="'Space Grotesk'" fontWeight={600} letterSpacing=".5px">TASK</text>
            <text x={181} y={21} fill="#374151" fontSize={9} fontFamily="'Space Grotesk'" fontWeight={600} letterSpacing=".5px">START</text>
            <g style={{ cursor:"pointer" }} onClick={() => setDateMode(m => m === "end" ? "dur" : "end")}>
              <text x={295} y={21} fill="#6366f1" fontSize={9} fontFamily="'Space Grotesk'" fontWeight={600} letterSpacing=".5px">
                {dateMode === "end" ? "END DATE ▾" : "DURATION ▾"}
              </text>
            </g>
            {groups.map((g, i) => (
              <text key={i} x={NAME_W + g.start*cellW + 10} y={21} fill="#6b7280" fontSize={11} fontFamily="'Space Grotesk'" fontWeight={600} letterSpacing="1px">
                {g.label.toUpperCase()}
              </text>
            ))}
            {/* Unit header */}
            <rect x={0} y={32} width={totalW} height={40} fill="#0f0f18" />
            {units.map((u, i) => {
              const x = NAME_W + i * cellW;
              const isTU = Math.floor(todayF) === i;
              const isWE = view === "day" && (u.date.getDay() === 0 || u.date.getDay() === 6);
              return (
                <g key={i}>
                  {isTU && <rect x={x+2} y={34} width={cellW-4} height={36} rx={6} fill="#3730a3" opacity={0.6} />}
                  <text x={x + cellW/2} y={52} textAnchor="middle" fill={isTU ? "#a5b4fc" : isWE ? "#374151" : "#4b5563"} fontSize={view === "quarter" ? 14 : 11} fontFamily="'DM Sans'" fontWeight={isTU ? 700 : 400}>{u.l1}</text>
                  <text x={x + cellW/2} y={65} textAnchor="middle" fill={isTU ? "#6366f1" : "#2d3748"} fontSize={9} fontFamily="'DM Sans'">{u.l2}</text>
                </g>
              );
            })}
            {/* Today line */}
            {todayF >= 0 && todayF < unitCount && (
              <line x1={todayX} y1={HEADER_H} x2={todayX} y2={totalH} stroke="#4f46e5" strokeWidth={2} strokeDasharray="4,4" opacity={0.7} />
            )}
            {/* Tasks */}
            {tasks.map((task, i) => {
              const y = HEADER_H + i * ROW_H;
              const c = COLORS[task.ci];
              const BX = getBX(task), BW = getBW(task), BY = y + 9, BH = ROW_H - 18;
              const isH = hoveredId === task.id;
              return (
                <g key={task.id} className="task-row" onMouseEnter={() => setHoveredId(task.id)} onMouseLeave={() => setHoveredId(null)}
                  style={reordering && reordering.id === task.id ? { opacity: 0.35 } : undefined}>
                  {isH && <rect x={NAME_W} y={y+1} width={totalW - NAME_W} height={ROW_H-1} fill="#ffffff05" />}
                  <g style={{ cursor: reordering ? "grabbing" : "grab", opacity: isH ? 0.7 : 0.25 }}
                    onMouseDown={e => startReorder(e, task.id, i)}>
                    <rect x={3} y={y+15} width={11} height={2} rx={1} fill="#9ca3af" />
                    <rect x={3} y={y+21} width={11} height={2} rx={1} fill="#9ca3af" />
                    <rect x={3} y={y+27} width={11} height={2} rx={1} fill="#9ca3af" />
                  </g>
                  {editingId === task.id ? (
                    <foreignObject x={10} y={y+10} width={148} height={ROW_H-20}>
                      <input ref={inputRef} value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={commit}
                        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditingId(null); }}
                        style={{ width:"100%", background:"#1e1e2e", border:"1.5px solid #6366f1", borderRadius:6, color:"#fff", padding:"4px 8px", fontSize:13, fontFamily:"'DM Sans'", outline:"none" }} />
                    </foreignObject>
                  ) : (
                    <text x={16} y={y + ROW_H/2 + 5} fill="#c4c4d4" fontSize={13} fontFamily="'DM Sans'"
                      style={{ cursor:"text", userSelect:"none" }}
                      onDoubleClick={() => startEdit(task.id, task.name)}>
                      {task.name.length > 18 ? task.name.slice(0,17) + "…" : task.name}
                    </text>
                  )}
                  {/* Date inputs */}
                  <foreignObject x={166} y={y+8} width={112} height={28}>
                    <input type="date" className="di" value={fmtISO(task.start)}
                      onChange={e => updateTaskDate(task.id, "start", e.target.value)} />
                  </foreignObject>
                  <foreignObject x={282} y={y+8} width={112} height={28}>
                    {dateMode === "end" ? (
                      <input type="date" className="di" value={fmtISO(task.end)}
                        onChange={e => updateTaskDate(task.id, "end", e.target.value)} />
                    ) : (
                      <input type="number" className="di" min="1" value={diffDays(task.start, task.end)}
                        onChange={e => updateTaskDur(task.id, e.target.value)} />
                    )}
                  </foreignObject>
                  <g className="del-btn" style={{ opacity:0, cursor:"pointer" }} onClick={() => delTask(task.id)}>
                    <rect x={NAME_W-26} y={y + ROW_H/2-10} width={20} height={20} rx={4} fill="#2a1f1f" />
                    <text x={NAME_W-16} y={y + ROW_H/2+5} textAnchor="middle" fill="#ef4444" fontSize={14}>×</text>
                  </g>
                  <g className="bg">
                    <rect x={BX+2} y={BY+3} width={BW} height={BH} rx={6} fill={c.bg} opacity={0.2} />
                    <rect className="bb" x={BX} y={BY} width={BW} height={BH} rx={6} fill={c.bg} opacity={isH ? 1 : 0.85} onMouseDown={e => onMD(e, task.id, "move")} />
                    <rect x={BX} y={BY} width={BW} height={BH/2} rx={6} fill="white" opacity={0.06} style={{ pointerEvents:"none" }} />
                    {BW > 80 && (
                      <text x={BX+10} y={BY + BH/2 + 5} fill="#fff" fontSize={10} fontFamily="'DM Sans'" fontWeight={500} style={{ pointerEvents:"none", userSelect:"none" }}>
                        {fmtShort(task.start)} → {fmtShort(task.end)}
                      </text>
                    )}
                    <rect className="bh" x={BX}      y={BY} width={10} height={BH} rx={6} fill={c.light} onMouseDown={e => onMD(e, task.id, "left")} />
                    <rect className="bh" x={BX+1}    y={BY + BH/2-6} width={3} height={12} rx={2} fill="white" opacity={0.6} style={{ pointerEvents:"none" }} />
                    <rect className="bh" x={BX+BW-10} y={BY} width={10} height={BH} rx={6} fill={c.light} onMouseDown={e => onMD(e, task.id, "right")} />
                    <rect className="bh" x={BX+BW-5}  y={BY + BH/2-6} width={3} height={12} rx={2} fill="white" opacity={0.6} style={{ pointerEvents:"none" }} />
                    <circle cx={BX+BW-18} cy={BY + BH/2} r={5} fill={c.light} stroke="white" strokeWidth={1.5} style={{ cursor:"pointer", pointerEvents:"all" }} onClick={() => clrTask(task.id)} />
                  </g>
                </g>
              );
            })}
            {/* Drop indicator */}
            {reordering && reordering.curIdx !== reordering.fromIdx && (
              <rect x={0} y={HEADER_H + reordering.curIdx * ROW_H - 1} width={totalW} height={3} rx={1.5} fill="#6366f1" opacity={0.85} />
            )}
            <g style={{ cursor:"pointer" }} onClick={addTask}>
              <rect x={0} y={HEADER_H + tasks.length*ROW_H} width={NAME_W} height={38} fill="transparent" />
              <text x={16} y={HEADER_H + tasks.length*ROW_H + 24} fill="#374151" fontSize={13} fontFamily="'DM Sans'">+ Add task…</text>
            </g>
          </svg>
          </div>
        </div>

        <div style={{ display:"flex", gap:16, marginTop:14, padding:"0 4px", flexWrap:"wrap", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
            {[["⟺","Drag"], ["↕","Reorder"], ["◂▸","Resize"], ["✎","Rename"], ["📅","Dates (click END DATE/DURATION to toggle)"], ["●","Color"], ["💾","Save version"], ["🗂","Projects"]].map(([icon, text], i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:5, color:"#4b5563", fontSize:11 }}>
                <span style={{ color:"#6366f1" }}>{icon}</span>{text}
              </div>
            ))}
          </div>
          <div style={{ color:"#374151", fontSize:11 }}>
            <span style={{ color:"#10b981" }}>↓</span> xlsx: Task List · Day · Week · Month · Quarter · Year
          </div>
        </div>
      </div>
    </div>
  );
}
