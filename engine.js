(function () {
  var PROC = window.PROCESS || {};
  var LABEL = { human: "Human-led", augment: "Augment", automate: "Automate", create: "Create" };
  var TODAY = { use: "Already in use", emerging: "Just starting", not: "Not yet in use" };
  var GENERIC = PROC.GENERIC;
  var SHRM = PROC.SHRM;
  var WORLD = PROC.WORLD;

  /* h = illustrative hours a week for one full-time generalist recruiter (adds up to 40) */
  var PRESETS = PROC.PRESETS;

  var TERMS = PROC.TERMS;

  var ORGS = PROC.ORGS;
  var BUCKETS = PROC.BUCKETS;
  var DEFS = PROC.DEFS;
  var UC = PROC.UC;
  var CRIT = PROC.CRIT;
  var STEPS = PROC.STEPS;
  var MS = {human: 0, augment: 60, automate: 85, create: 95};
  var MODES = [["human", "Human-led"], ["augment", "Augment"], ["automate", "Automate"], ["create", "Create"]];
  var STORE = PROC.store || "hr-v1";
  var UNIT = PROC.unit || {};
  var PW = UNIT.per || "per week";
  var items = [];
  var uid = 0;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }
  function taskZone(it) {
    var w = { human: 0, augment: 0, automate: 0, create: 0 };
    it.steps.forEach(function (st) { w[st.m] += st.w; });
    var order = ["human", "augment", "automate", "create"], base = "human";
    order.forEach(function (k) { if (w[k] > w[base]) { base = k; } });
    var capped = !!it.s && (base === "automate" || base === "create");
    return { key: capped ? "augment" : base, base: base, capped: capped };
  }
  function fmt(x) { if (x > 0 && x < 1) { return String(Math.round(x * 100) / 100); } var r = Math.round(x * 10) / 10; return (r % 1 === 0) ? String(r) : r.toFixed(1); }
  function fmtH(x) { var r = Math.round(x * 100) / 100; return String(r); }
  var MAXH = 60;
  function clampH(x) { if (typeof x !== "number" || !isFinite(x) || x < 0) { return 0; } return x > MAXH ? MAXH : x; }
  function aiText(h, v) { if (v >= 99.5) { return h <= 1 ? "AI is involved in every task here" : "AI is involved in every task here (" + fmtH(h) + " h)"; } return h <= 1 ? "AI helps with " + Math.round(v) + "% of this activity" : "AI helps with about " + fmt(h * v / 100) + " of " + fmtH(h) + " h (" + Math.round(v) + "%)"; }
  function joinNames(a) {
    if (a.length <= 1) { return a.join(""); }
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }

  /* Steps maths */
  function calcV(steps) {
    var w = 0, hl = 0;
    steps.forEach(function (st) { w += st.w; if (st.m === "human") { hl += st.w; } });
    return w > 0 ? (w - hl) / w * 100 : 0;
  }
  function playersBlock(g, r) {
    if ((!g || !g.length) && (!r || !r.length)) { return null; }
    var box = el("div", "plist");
    [["Global HR tech", g], ["India-based HR tech", r]].forEach(function (p) {
      if (!p[1] || !p[1].length) { return; }
      var w = el("div");
      w.appendChild(el("div", "k", p[0]));
      var c = el("div", "pchips");
      p[1].forEach(function (x) { c.appendChild(el("span", "pchip", x)); });
      w.appendChild(c); box.appendChild(w);
    });
    return box;
  }

  function drawTaskPie(box, it) {
    box.textContent = "";
    var tw = 0; it.steps.forEach(function (st) { tw += st.w; });
    if (tw <= 0) { return; }
    it.steps.forEach(function (st, i) {
      var pc = st.w / tw * 100;
      var seg = el("div", "fseg", pc >= 6 ? String(i + 1) : "");
      seg.style.width = pc + "%"; seg.style.background = "var(--" + st.m + ")";
      seg.title = (i + 1) + ". " + st.n + ": " + LABEL[st.m];
      box.appendChild(seg);
    });
  }

  var MAXT = 12;
  function normW(it) {
    if (it.custom) { return; }
    var ws = roundTo100(it.steps.map(function (x) { return x.w > 0 ? x.w : 0; }));
    it.steps.forEach(function (x, k) { x.w = ws[k]; });
  }
  function rebuildRow(it, silent) {
    var old = it.ui && it.ui.row; if (!old || !old.parentNode) { return; }
    var det = old.querySelector("details.more"); var wasOpen = det && det.open;
    var nr = buildRow(it); old.parentNode.replaceChild(nr, old);
    if (it.custom) { it.rowEl = nr; }
    var d2 = nr.querySelector("details.more"); if (d2 && wasOpen) { d2.open = true; }
    if (!silent) { totals(); persist(); }
  }
  function mkInput(val, max, label, ph) {
    var i = document.createElement("input"); i.type = "text"; i.maxLength = max; i.value = val || ""; i.setAttribute("aria-label", label); if (ph) { i.placeholder = ph; } return i;
  }
  function openTaskEdit(it, si, li) {
    var st = it.steps[si]; li.textContent = ""; li.className = "stp editing";
    var f = el("div", "tform");
    var n = mkInput(st.n, 80, "Task name"); var w = mkInput(st.why, 200, "Why this label (optional)", "Why (optional)");
    var sv = el("button", "btn small", "Save"); sv.type = "button";
    var cn = el("button", "btn small", "Cancel"); cn.type = "button";
    sv.addEventListener("click", function () {
      var v = n.value.trim(); if (!v) { n.focus(); return; }
      st.n = v.slice(0, 80); st.why = w.value.trim().slice(0, 200); if (!it.custom) { it.edited = true; } rebuildRow(it);
    });
    cn.addEventListener("click", function () { rebuildRow(it, true); });
    f.appendChild(n); f.appendChild(w); f.appendChild(sv); f.appendChild(cn); li.appendChild(f); n.focus();
  }
  function removeTask(it, si) {
    if (it.steps.length <= 1) { return; }
    it.steps.splice(si, 1); if (!it.custom) { it.edited = true; normW(it); } else { it.edited = true; }
    rebuildRow(it);
  }
  function openTaskAdd(it, btn) {
    btn.hidden = true;
    var f = el("div", "tform"); var n = mkInput("", 80, "New task name", "Task name");
    var sel = document.createElement("select"); sel.setAttribute("aria-label", "Who should do it");
    MODES.forEach(function (m) { var o = document.createElement("option"); o.value = m[0]; o.textContent = m[1]; sel.appendChild(o); });
    var sv = el("button", "btn small", "Add"); sv.type = "button"; var cn = el("button", "btn small", "Cancel"); cn.type = "button";
    sv.addEventListener("click", function () {
      var v = n.value.trim(); if (!v || it.steps.length >= MAXT) { n.focus(); return; }
      var tot = 0; it.steps.forEach(function (x) { tot += x.w; });
      var nw = it.custom ? 1 : Math.max(1, Math.round(tot / 9));
      it.steps.push({ n: v.slice(0, 80), m: sel.value, m0: sel.value, rec: sel.value, w: nw, w0: nw, why: "" });
      it.edited = true; normW(it); rebuildRow(it);
    });
    cn.addEventListener("click", function () { f.remove(); btn.hidden = false; });
    f.appendChild(n); f.appendChild(sel); f.appendChild(sv); f.appendChild(cn); btn.parentNode.insertBefore(f, btn.nextSibling); n.focus();
  }
  function openRename(it, btn) {
    btn.hidden = true; var f = el("div", "tform"); var n = mkInput(it.disp || it.n, 60, "Activity name");
    var sv = el("button", "btn small", "Save"); sv.type = "button"; var cn = el("button", "btn small", "Cancel"); cn.type = "button";
    sv.addEventListener("click", function () {
      var v = n.value.trim().slice(0, 60); if (!v) { n.focus(); return; }
      if (it.custom) { it.n = v; } else { it.disp = (v === it.n) ? null : v; }
      rebuildRow(it);
    });
    cn.addEventListener("click", function () { f.remove(); btn.hidden = false; });
    f.appendChild(n); f.appendChild(sv); f.appendChild(cn); btn.parentNode.insertBefore(f, btn.nextSibling); n.focus();
  }
  function origSteps(name) { return (STEPS[name] || []).map(function (x) { return { n: x[0], m: x[1], m0: x[1], w: x[2], w0: x[2], rec: x[1], why: x[3] }; }); }

  function buildRow(it) {
    uid++;
    var id = "r" + uid;
    var row = el("article", "row" + (it.custom ? " own" : ""));

    var name = el("div", "c-name");
    var h3 = el("h3", "", it.disp || it.n); if (it.custom) { h3.appendChild(el("span", "mt yours", "Yours")); }
    name.appendChild(h3);
    var ppl = el("span");
    var leave = null;
    if (it.s) {
      var fx = el("button", "afx", (it.crit ? "Affects people: " + it.crit[0].join(", ") : "Affects people (you ticked this)") + " \u24D8"); fx.type = "button"; fx.setAttribute("aria-expanded", "false");
      fx.setAttribute("aria-label", "Affects people" + (it.crit ? ": " + it.crit[0].join(", ") : "") + ". What does this mean?");
      var pop = el("div", "afpop"); pop.hidden = true; pop.setAttribute("role", "region"); pop.setAttribute("aria-label", "What affects people means");
      var tests = it.crit ? it.crit[0] : ["chances", "pay", "privacy"];
      pop.appendChild(el("p", "afp-h", it.crit ? "If AI is used on this activity, it meets the test for " + tests.join(" and ") + "." : "You ticked this activity as affecting people. These are the three tests."));
      tests.forEach(function (k) { var q = el("p", ""); q.appendChild(el("b", "", DEFS[k][0] + ". ")); q.appendChild(document.createTextNode(DEFS[k][1])); pop.appendChild(q); });
      if (it.crit) { pop.appendChild(el("p", "afp-why", "Why this activity: " + it.crit[1])); }
      pop.appendChild(el("p", "afp-rule", "An activity is flagged if it meets any one of three tests: chances, pay or privacy. AI can prepare and suggest. A person decides, and the activity shows as Augment at most."));
      var full = el("button", "afp-link", "Open the full definition"); full.type = "button";
      full.addEventListener("click", function () { var d = $("defFold"); if (d) { d.open = true; d.scrollIntoView({ behavior: RM() ? "auto" : "smooth", block: "center" }); closeP(); } });
      pop.appendChild(full);
      var closeP = function () { pop.hidden = true; fx.setAttribute("aria-expanded", "false"); };
      fx.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var open = pop.hidden;
        Array.prototype.forEach.call(document.querySelectorAll(".afpop"), function (x) { x.hidden = true; });
        Array.prototype.forEach.call(document.querySelectorAll(".afx"), function (x) { x.setAttribute("aria-expanded", "false"); });
        if (open) { pop.hidden = false; fx.setAttribute("aria-expanded", "true"); pop.style.top = (fx.offsetTop + fx.offsetHeight + 6) + "px"; }
      });
      pop.addEventListener("click", function (ev) { ev.stopPropagation(); });
      pop.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { closeP(); fx.focus(); } });
      fx.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { closeP(); } });
      /* Delegated handler added once outside buildRow — see below */
      name.appendChild(fx); row.appendChild(pop);
    }
    if (!it.custom) { leave = el("button", "leave", "Ignore it"); leave.type = "button"; name.appendChild(leave); }
    row.appendChild(name);

    var hw = el("div", "c-hours");
    var hl = el("label", "hrs"); hl.setAttribute("for", id + "-h");
    var hi = document.createElement("input"); hi.type = "number"; hi.id = id + "-h"; hi.min = "0"; hi.max = String(MAXH); hi.step = "0.25"; hi.value = String(it.h);
    hi.setAttribute("aria-label", (UNIT.aria || "Hours per week one recruiter spends on ") + it.n);
    hl.appendChild(hi); hl.appendChild(el("span", "", UNIT.short || "h / week"));
    hw.appendChild(hl);
    var hnote = el("span", "hnote"); hnote.setAttribute("role", "status"); hw.appendChild(hnote);
    row.appendChild(hw);

    var sw = el("div", "c-slider");
    var gauge = el("div", "flat mini"); gauge.setAttribute("role", "img");
    var calc = el("div", "calc");
    sw.appendChild(gauge); sw.appendChild(calc);
    row.appendChild(sw);

    var pw = el("div", "c-pill");
    var pill = el("span", "pill");
    pw.appendChild(pill);
    row.appendChild(pw);

    var more = el("details", "more");
    if (it.open) { more.open = true; }
    more.appendChild(el("summary", "", "Activity details"));
    var mb = el("div", "mbody");

    function dlRows(list) {
      var dl = el("dl", "uc");
      list.forEach(function (f) {
        if (!f[1]) { return; }
        var d = el("div", "ucr");
        var dt = el("dt");
        if (f[2]) { var dd0 = el("i", "dot"); dd0.style.background = "var(--" + f[2] + ")"; dt.appendChild(dd0); }
        dt.appendChild(document.createTextNode(f[0]));
        d.appendChild(dt); d.appendChild(el("dd", "", f[1])); dl.appendChild(d);
      });
      return dl;
    }
    var uc = it.uc;
    var thought = el("p", "thought", "");
    if (it.custom) { mb.appendChild(thought); }
    if (it.crit) { var wf = el("p", "whyflag"); wf.appendChild(el("b", "", "Why a person must decide: ")); wf.appendChild(document.createTextNode(it.crit[1])); mb.appendChild(wf); }

    if (uc && uc.goal) { var ob = el("p", "objective"); ob.appendChild(el("b", "", "Objective: ")); ob.appendChild(document.createTextNode(uc.goal)); mb.appendChild(ob); }
    {
    mb.appendChild(el("div", "steps-h", it.custom ? "Who should do each task?" : "Who should do each task? The % is each task's share of the activity's time. It is our starting guess, so change it to fit your team. A bold square box marks our starting view where your pick differs."));
    var stl = el("ul", "stl");
    var shares = [];
    var totalW = 0; it.steps.forEach(function (st) { totalW += st.w; });
    it.steps.forEach(function (st, si) {
      var li = el("li", "stp");
      var sn = el("span", "sn");
      sn.appendChild(el("span", "num", String(si + 1)));
      sn.appendChild(document.createTextNode(st.n));
      if (!it.custom && totalW > 0) { sn.appendChild(weightBox(it, st, si)); }
      if (st.why) { var wy = el("span", "why"); wy.appendChild(el("span", "sr", "Our starting view: " + LABEL[st.rec] + ". ")); wy.appendChild(document.createTextNode(st.why)); sn.appendChild(wy); }
      li.appendChild(sn);
      var seg = el("div", "seg"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "Tag for " + st.n);
      var btns = [];
      MODES.forEach(function (m) {
        var sug = st.rec === m[0]; var b = el("button", "sb" + (sug ? " sug" : ""), m[1]); b.type = "button"; b.setAttribute("data-m", m[0]); if (sug) { b.title = "Our starting view. Your choice may differ."; }
        b.addEventListener("click", function () {
          st.m = m[0]; btns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
          persist();
          refresh(it);
        });
        btns.push(b); seg.appendChild(b);
      });
      st.btns = btns;
      li.appendChild(seg);
      var tt = el("div", "tedit");
      var eb = el("button", "btn small", "Edit"); eb.type = "button"; eb.setAttribute("aria-label", "Edit task: " + st.n);
      var db = el("button", "btn small", "Remove"); db.type = "button"; db.setAttribute("aria-label", "Remove task: " + st.n);
      if (it.steps.length <= 1) { db.disabled = true; db.title = "An activity needs at least one task."; }
      eb.addEventListener("click", function () { openTaskEdit(it, si, li); });
      db.addEventListener("click", function () { removeTask(it, si); });
      tt.appendChild(eb); tt.appendChild(db); li.appendChild(tt);
      stl.appendChild(li);
    });
    mb.appendChild(stl);
    var addT = el("button", "btn small taskadd", "Add a task"); addT.type = "button";
    if (it.steps.length >= MAXT) { addT.disabled = true; addT.title = "Up to " + MAXT + " tasks per activity."; }
    addT.addEventListener("click", function () { openTaskAdd(it, addT); });
    mb.appendChild(addT);
    var rnB = el("button", "btn small taskadd", "Rename this activity"); rnB.type = "button"; rnB.style.marginLeft = "8px";
    rnB.addEventListener("click", function () { openRename(it, rnB); });
    mb.appendChild(rnB);
    }

    var nTech = Object.keys(orgMap).filter(function (k) { return orgMap[k].indexOf(it.n) >= 0; }).length;
    if (nTech) {
      var lk = el("button", "tlink", "See HR tech for this activity (" + nTech + ") ↓"); lk.type = "button";
      lk.addEventListener("click", function () { showTech(it.n); });
      mb.appendChild(lk);
    }
    if (uc) {
      var bg = el("details", "more2");
      bg.appendChild(el("summary", "", "Risks and safeguards"));
      var bb = el("div", "mbody");
      if (uc) { bb.appendChild(dlRows([["Today", uc.today], ["Who is affected", uc.who], ["Keep with people", uc.keep, "human"], ["Watch out for", uc.risk], ["Safeguard", uc.safe], ["Who is responsible", uc.owner], ["Small trial", uc.pilot]])); }
      bg.appendChild(bb); mb.appendChild(bg);
    }
    if (it.custom) {
      var rm = el("button", "rm", "Remove this activity"); rm.type = "button";
      rm.addEventListener("click", function () {
        items = items.filter(function (x) { return x !== it; });
        row.remove(); persist(); totals(); if (typeof previewAdd === "function") { previewAdd(); }
      });
      mb.appendChild(rm);
    }
    more.appendChild(mb);
    row.appendChild(more);

    it.ui = { gauge: gauge, hours: hi, calc: calc, pill: pill, ppl: ppl, thought: thought, row: row, leave: leave, hnote: hnote };
    hi.addEventListener("input", function () {
      var x = parseFloat(hi.value); var bad = !isNaN(x) && (x < 0 || x > MAXH);
      it.h = clampH(isNaN(x) ? 0 : x);
      if (bad) { hi.value = String(it.h); hnote.textContent = "Kept between 0 and " + MAXH + " hours."; } else { hnote.textContent = ""; }
      refresh(it); persist();
    });
    if (leave) { leave.addEventListener("click", function () { it.off = !it.off; refresh(it); persist(); }); }
    refresh(it, true);
    return row;
  }


  function pctList(it) {
    var tw = 0; it.steps.forEach(function (x) { tw += x.w; });
    return it.steps.map(function (x) { return tw > 0 ? x.w / tw * 100 : 100 / it.steps.length; });
  }
  function weightBox(it, st, si) {
    var wrap = el("span", "wt");
    var inp = el("input", "wti"); inp.type = "number"; inp.min = "0"; inp.max = "100"; inp.step = "5"; inp.inputMode = "numeric";
    inp.value = String(Math.round(pctList(it)[si]));
    inp.setAttribute("aria-label", "Share of the activity's time for task " + (si + 1));
    inp.title = "This task's share of the activity's time. Our starting guess. The other tasks adjust so the total stays at 100.";
    inp.addEventListener("change", function () { setWeight(it, si, parseFloat(inp.value)); });
    st.wi = inp;
    wrap.appendChild(inp); wrap.appendChild(document.createTextNode("%"));
    return wrap;
  }
  function setWeight(it, si, val) {
    var n = it.steps.length;
    if (!isFinite(val)) { syncWeights(it); return; }
    var v = Math.max(0, Math.min(100, Math.round(val)));
    if (n === 1) { v = 100; }
    var cur = pctList(it), rest = 0, k;
    for (k = 0; k < n; k++) { if (k !== si) { rest += cur[k]; } }
    var target = 100 - v, raw = [], fl = [], used = 0;
    for (k = 0; k < n; k++) {
      if (k === si) { raw.push(v); fl.push(v); used += v; continue; }
      var r = n === 1 ? 0 : (rest > 0 ? cur[k] / rest * target : target / (n - 1));
      raw.push(r); fl.push(Math.floor(r)); used += Math.floor(r);
    }
    var left = 100 - used;
    var order = raw.map(function (r, idx) { return idx; }).filter(function (idx) { return idx !== si; })
      .sort(function (a, b) { return (raw[b] - fl[b]) - (raw[a] - fl[a]); });
    for (k = 0; k < left && order.length; k++) { fl[order[k % order.length]] += 1; }
    it.steps.forEach(function (x, idx) { x.w = fl[idx]; });
    syncWeights(it);
    persist();
    refresh(it);
  }
  function syncWeights(it) {
    var p = pctList(it);
    it.steps.forEach(function (x, idx) { if (x.wi) { x.wi.value = String(Math.round(p[idx])); } });
  }
  function refresh(it, skipTotals) {
    var u = it.ui;
    it.v = calcV(it.steps);
    var z = taskZone(it);
    if (it.off) { u.pill.className = "pill off"; u.pill.textContent = "Ignored"; } else { u.pill.className = "pill " + z.key; u.pill.textContent = LABEL[z.key]; }
    if (u.row) { u.row.classList.toggle("off", !!it.off); }
    if (u.leave) { u.leave.textContent = it.off ? "Count it again" : "Ignore it"; u.leave.setAttribute("aria-label", (it.off ? "Count it again: " : "Ignore it: ") + it.n); }
    u.ppl.hidden = !it.s;
    it.steps.forEach(function (st) { (st.btns || []).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-m") === st.m ? "true" : "false"); }); });
    syncWeights(it);
    drawTaskPie(u.gauge, it);
    u.gauge.setAttribute("aria-label", "Share of " + it.n + " where AI helps: " + Math.round(it.v) + " percent");
    u.calc.textContent = (it.off ? "Ignored. Not counted in the totals." : aiText(it.h, it.v) + (z.capped ? " · a person still decides" : ""));
    if (it.custom) { u.thought.textContent = GENERIC[z.key]; }
    if (!skipTotals) { totals(); }
  }

  var NS = "http://www.w3.org/2000/svg";
  function pt(cx, cy, r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
  var ACT = {
    automate: "Automate: set up a workflow and spot-check the results.",
    augment: "Augment: AI prepares, a person decides.",
    create: "Create: look for the new work or service this makes possible.",
    human: "Human-led: keep with people. AI helps only in the background."
  };
  function stepHours(it, fn) {
    var tw = 0; it.steps.forEach(function (st) { tw += st.w; });
    if (tw <= 0) { return; }
    it.steps.forEach(function (st) { var hh = it.h * st.w / tw; if (hh > 0) { fn(st, hh); } });
  }
  function liveItems() { return items.filter(function (x) { return !x.off; }); }
  function roundTo100(vals) {
    var sum = 0; vals.forEach(function (v) { sum += v; });
    if (sum <= 0) { return vals.map(function () { return 0; }); }
    var raw = vals.map(function (v) { return v / sum * 100; });
    var out = raw.map(function (r) { return Math.floor(r); });
    var left = 100 - out.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (r, i) { return { i: i, f: r - Math.floor(r) }; }).sort(function (a, b) { return b.f - a.f; }).slice(0, left).forEach(function (x) { out[x.i]++; });
    return out;
  }
  function drawAdvised(total) {
    var you = $("advYou"), rec = $("advRec"), ul = $("advList"); you.textContent = ""; rec.textContent = ""; if (ul) { ul.textContent = ""; }
    if (total <= 0) { return; }
    var keys = ["human", "augment", "automate", "create"], y = {}, r = {}, up = [], keep = [], yt = 0, rt = 0;
    keys.forEach(function (k) { y[k] = 0; r[k] = 0; });
    liveItems().forEach(function (it) {
      stepHours(it, function (st, hh) {
        var rk = st.rec || st.m; y[st.m] += hh; r[rk] += hh; yt += hh; rt += hh;
      });
    });
    function bar(box, o, t) {
      var pcs = roundTo100(keys.map(function (k) { return o[k]; }));
      keys.forEach(function (k, i) { if (o[k] > 0) { var pc = o[k] / t * 100, sg = el("div", "fseg", pcs[i] + "%"); sg.style.width = pc + "%"; sg.style.background = "var(--" + k + ")"; sg.title = LABEL[k] + ": " + pcs[i] + "% of the time"; box.appendChild(sg); } });
    }
    bar(you, y, yt);
    you.setAttribute("aria-label", "Your choices: " + keys.map(function (k, i) { var pcs = roundTo100(keys.map(function (k2) { return y[k2]; })); return LABEL[k] + " " + pcs[i] + "%"; }).join(", "));
    bar(rec, r, rt);
    rec.setAttribute("aria-label", "Our starting view: " + keys.map(function (k, i) { var pcs = roundTo100(keys.map(function (k2) { return r[k2]; })); return LABEL[k] + " " + pcs[i] + "%"; }).join(", "));
    var gaps = 0; keys.forEach(function (k) { if (Math.abs(r[k] - y[k]) >= 0.05) { gaps++; } });
    if (!ul) { return; }
    function top(a, n) { return a.slice().sort(function (p, q) { return q.h - p.h; }).slice(0, n).map(function (x) { return x.n; }).join(" · "); }
    if (!gaps) { ul.appendChild(el("li", "advok", "Your choices match our advice overall.")); return; }
    keys.forEach(function (k) {
      if (Math.abs(r[k] - y[k]) < 0.05) { return; }
      var d = r[k] - y[k], li = el("li"), sw = el("i", "sw"); sw.style.background = "var(--" + k + ")";
      li.appendChild(sw);
      var head = el("span", "", ""); head.appendChild(el("b", "", LABEL[k] + ": ")); head.appendChild(el("span", "nums", fmt(y[k]) + " h now, " + fmt(r[k]) + " h advised")); li.appendChild(head);
      var pot, eg = "";
      if (k === "human") {
        if (d < 0) { pot = "Suggestion: tighten up Human-led. Try AI help on " + fmt(-d) + " h of these tasks."; eg = up.length ? "For example: " + top(up, 2) : ""; }
        else { pot = "Suggestion: keep " + fmt(d) + " h more with people."; eg = keep.length ? "For example: " + top(keep, 2) : ""; }
      } else if (d > 0) {
        pot = "Suggestion: move " + fmt(d) + " h more to " + LABEL[k] + ".";
        var m = [];
        liveItems().forEach(function (it) { stepHours(it, function (st, hh) { if ((st.rec || st.m) === k && st.m !== k) { m.push({ n: st.n, h: hh }); } }); });
        eg = m.length ? "For example: " + top(m, 2) : "";
      } else { pot = "Suggestion: look again at " + fmt(-d) + " h. It is more than advised. Check the reason under each task."; }
      li.appendChild(el("span", "pot", pot)); if (eg) { li.appendChild(el("span", "eg", eg)); }
      ul.appendChild(li);
    });
  }
  var grpOpen = {};
  function RM() { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function drawPie(total) {
    var bars = $("vBars"); bars.textContent = "";
    $("vCount").textContent = "";
    if (total <= 0) { return; }
    var keys = ["human", "augment", "automate", "create"];
    var lv = liveItems();
    var g = {}; keys.forEach(function (k) { g[k] = { h: 0 }; });
    lv.forEach(function (it) { g[taskZone(it).key].h += it.h; });
    var sorted = lv.filter(function (x) { return x.h > 0; }).sort(function (x, y) { return y.h - x.h; });
    var maxH = sorted.length ? sorted[0].h : 1;
    var hot = sorted.slice(0, 3);
    keys.forEach(function (k) {
      var mem = sorted.filter(function (x) { return taskZone(x).key === k; });
      var gh = el("li", "bgroup");
      var d = el("i", "dot"); d.style.background = "var(--" + k + ")";
      var rowsOfK = [];
      if (mem.length) {
        gh.classList.add("tgl"); gh.tabIndex = 0; gh.setAttribute("role", "button"); gh.setAttribute("aria-expanded", grpOpen[k] ? "true" : "false");
        gh.appendChild(el("i", "caret", grpOpen[k] ? "\u2212" : "+"));
        var flip = function () {
          grpOpen[k] = !grpOpen[k];
          gh.setAttribute("aria-expanded", grpOpen[k] ? "true" : "false");
          gh.querySelector(".caret").textContent = grpOpen[k] ? "\u2212" : "+";
          rowsOfK.forEach(function (r) { r.hidden = !grpOpen[k]; });
        };
        gh.addEventListener("click", flip);
        gh.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
      }
      if (!mem.length) { gh.classList.add("empty"); gh.appendChild(el("i", "caret", "")); }
      gh.appendChild(d);
      gh.appendChild(el("b", "", "Mostly " + LABEL[k]));
      var memN = mem.filter(function (x) { return !x.draft; }).length; var memD = mem.length - memN;
      gh.appendChild(el("span", "", mem.length ? fmt(g[k].h) + " h · " + memN + (memN === 1 ? " activity" : " activities") + (memD ? " + 1 not added yet" : "") : "No activity is mostly " + LABEL[k]));
      bars.appendChild(gh);
      mem.forEach(function (x) {
        var isHot = hot.indexOf(x) !== -1;
        var li = el("li", "bar" + (isHot ? " hot" : ""));
        var bn = el("span", "bn", x.disp || x.n); if (x.custom) { bn.appendChild(el("span", "mt yours", "Yours")); } if (isHot) { bn.appendChild(el("span", "mt", "Most time")); }
        var bt = el("div", "bt"); var bo = el("div", "bo"); bo.style.width = (x.h / maxH * 100) + "%"; bo.style.background = "color-mix(in srgb, var(--" + k + ") 25%, transparent)";
        var bi = el("div", "bi"); bi.style.width = x.v + "%"; bi.style.background = "var(--" + k + ")";
        bo.appendChild(bi); bt.appendChild(bo);
        li.appendChild(bn); li.appendChild(bt); li.appendChild(el("span", "bv", fmtH(x.h) + " h"));
        li.hidden = !grpOpen[k]; rowsOfK.push(li);
        bars.appendChild(li);
      });
    });
    var sN = { human: 0, augment: 0, automate: 0, create: 0 }, sTot = 0;
    lv.forEach(function (it) { it.steps.forEach(function (st) { if (sN[st.m] !== undefined) { sN[st.m]++; sTot++; } }); });
    $("vCount").textContent = sTot ? "Of " + sTot + (sTot === 1 ? " task: " : " tasks: ") + ["human", "augment", "automate", "create"].map(function (k) { return sN[k] + " " + LABEL[k]; }).join(", ") + ". Each task is counted under its own label." : "";
  }

  /* Totals and verdict */
  function bandText(total, ai, autoH, anyLeft) {
    if (total <= 0) { return anyLeft ? "Every activity is ignored. Count at least one activity to see the working hypothesis." : "Add some hours to see the working hypothesis."; }
    if (ai <= 0) { return "With your choices, no time is given to AI."; }
    var pct = ai / total * 100, ap = autoH / total * 100;
    if (ap >= 40) { return "Heavy automation. Make sure a person checks the results."; }
    if (pct < 35) { return "People lead. AI is a helper at the edges."; }
    if (pct < 55) { return "People lead. AI prepares the ground."; }
    if (pct < 80) { return "A shared job. AI prepares or does the routine work, and people decide."; }
    return "AI is involved in nearly everything. Check that a person still owns each decision.";
  }
  function totals() {
    var lv = liveItems();
    var offN = 0, offH = 0; items.forEach(function (it) { if (it.off && !it.draft) { offN++; offH += it.h; } });
    var total = 0, autoH = 0, augH = 0, creH = 0, humH = 0, riskH = 0, realN = 0;
    lv.forEach(function (it) {
      total += it.h;
      if (!it.draft) { realN++; }
      stepHours(it, function (st, hh) {
        if (st.m === "automate") { autoH += hh; } else if (st.m === "augment") { augH += hh; } else if (st.m === "create") { creH += hh; } else { humH += hh; }
        if (it.s && (st.m === "automate" || st.m === "create")) { riskH += hh; }
      });
    });
    var ai = autoH + augH + creH;
    var pct = total > 0 ? ai / total * 100 : 0;
    if (typeof addSum !== "undefined") { var tt = 0, aa = 0; lv.forEach(function (x) { tt += x.h; aa += x.h * (x.v || 0) / 100; }); addSum.textContent = (UNIT.whole || "Your whole week now:") + " " + fmt(aa) + " of " + fmtH(tt) + " h where AI plays a role (" + (tt > 0 ? Math.round(aa / tt * 100) : 0) + "%). Your own activities are included."; }
    if (typeof updateStages === "function") { updateStages(); }
    if (typeof ownCols !== "undefined") { ownCols.hidden = ownCount() === 0; }

    if ($("rAi")) { $("rAi").textContent = fmt(ai); $("rTot").textContent = fmtH(total); }
    (function guessTag() {
      var g = $("gTag"); if (!g) { return; }
      var touched = items.some(function (it) { return it.custom || it.off || it.h !== it.h0 || it.steps.some(function (s) { return s.m !== s.m0 || (s.w0 !== undefined && s.w !== s.w0); }); });
      g.hidden = touched;
    })();
    (function drawPills() {
      var box = $("rPills"); if (!box) { return; }
      box.textContent = "";
      var ks = ["human", "augment", "automate", "create"], hv = [humH, augH, autoH, creH];
      var pc = total > 0 ? roundTo100(hv) : [0, 0, 0, 0];
      ks.forEach(function (k, i) {
        var p = el("span", "rp " + k); p.style.setProperty("--w", String(pc[i]));
        p.appendChild(el("i", "dot " + k)); p.appendChild(el("span", "rpn", (k === "human" ? "Human" : LABEL[k]) + " ")); p.appendChild(el("b", "", total > 0 ? pc[i] + "%" : "-"));
        p.title = LABEL[k] + ": " + (total > 0 ? pc[i] + "% of the hours" : "no hours yet");
        box.appendChild(p);
      });
    })();

    $("hN").textContent = Math.round(pct) + "%"; $("hHrs").textContent = "about " + fmt(ai) + " of " + fmtH(total) + " " + (UNIT.phrase || "hours a week");
    var vt = $("vTop"); vt.textContent = "";
    var srs = el("span", "sr", fmt(ai) + " of " + fmtH(total) + " "); vt.appendChild(srs);
    vt.appendChild(document.createTextNode("AI plays a role in this share of the time. This is involvement, not time saved. Actual impact depends on your organisation."));
    $("vBand").textContent = bandText(total, ai, autoH, offN > 0);
    $("vSub").textContent = total > 0
      ? "This shows where AI plays a role, not how much time is saved. Oversight, corrections and learning new tools all take real time. These hours are starting guesses to test with your team."
      : "Add some hours to see the calculation.";
    var dn = $("dNote"); if (dn) { var hasD = items.indexOf(draft) >= 0; dn.hidden = !hasD; dn.textContent = hasD ? "These numbers include the activity you are adding, which is not added yet. Click Add activity to keep it." : ""; }
    var rn = $("riskNote"); if (rn) { var showR = total > 0 && riskH >= 0.05; rn.hidden = !showR; rn.textContent = showR ? fmt(riskH) + " h of the automated or new work is on activities that affect people's chances, pay or privacy. A person must check these before they take effect." : ""; }
    var on = $("offNote"); if (on) { on.hidden = offN <= 0; on.textContent = offN > 0 ? "Counting " + fmtH(total) + " h. " + offN + (offN === 1 ? " activity is" : " activities are") + " ignored (" + fmtH(offH) + " h), so " + (offN === 1 ? "it is" : "they are") + " not in these numbers." : ""; }
    var hs = $("hStats"); hs.textContent = "";
    var zN = { human: 0, augment: 0, automate: 0, create: 0 };
    lv.forEach(function (it) { it.steps.forEach(function (st) { if (zN[st.m] !== undefined) { zN[st.m]++; } }); });
    var qs = [["human", humH, "People do it. AI helps at most in the background."], ["augment", augH, "AI prepares, a person decides."], ["automate", autoH, "A workflow does it, a person spot-checks."], ["create", creH, "New things AI makes possible."]];
    var qp = roundTo100(qs.map(function (x) { return x[1]; }));
    var tp = roundTo100([zN.human, zN.augment, zN.automate, zN.create]);
    qs.forEach(function (x, i) {
      var c = el("div", "hs lcard " + x[0]); var hd = el("div", "hsh"); hd.appendChild(el("i", "dot " + x[0])); hd.appendChild(el("b", "", LABEL[x[0]])); c.appendChild(hd);
      c.appendChild(el("em", "hpc", qp[i] + "%"));
      c.appendChild(el("span", "hmeta", "Time: " + fmtH(x[1]) + (UNIT.suffix || " h per week")));
      c.appendChild(el("span", "hmeta", zN[x[0]] + " of " + (zN.human + zN.augment + zN.automate + zN.create) + ((zN.human + zN.augment + zN.automate + zN.create) === 1 ? " task" : " tasks")));
      c.appendChild(el("span", "hdef", x[2])); hs.appendChild(c);
    });
    if (total > 0) { $("hN").textContent = (100 - qp[0]) + "%"; }

    drawAdvised(total);
    var af = $("affFold"), ab = $("affBody");
    if (af && ab) {
      ab.textContent = "";
      var fl = lv.filter(function (x) { return x.s && !x.draft; });
      af.hidden = fl.length === 0;
      var sm = af.querySelector("summary"); if (sm) { sm.textContent = fl.length + " of " + realN + (realN === 1 ? " activity affects" : " activities affect") + " people's chances, pay or privacy: which ones, and why"; }
      if (fl.length) {
        var cnt = { chances: 0, pay: 0, privacy: 0 };
        fl.forEach(function (x) { if (x.crit) { x.crit[0].forEach(function (k) { cnt[k]++; }); } });
        ab.appendChild(el("p", "pnote", fl.length + (fl.length === 1 ? " activity is" : " activities are") + " counted: " + cnt.chances + " on chances, " + cnt.pay + " on pay, " + cnt.privacy + " on privacy. An activity can meet more than one test."));
        var fu = el("ul", "afl");
        fl.forEach(function (x) {
          var li = el("li"); var hd = el("div", "afh"); hd.appendChild(el("b", "", x.n)); hd.appendChild(el("span", "aft", x.crit ? x.crit[0].join(" · ") : "you ticked this"));
          li.appendChild(hd); li.appendChild(el("span", "afr", x.crit ? x.crit[1] : "You marked this activity as affecting people.")); fu.appendChild(li);
        });
        ab.appendChild(fu);
      }
    }
  }

  /* World + terms */
  var wl = $("world");
  function addWorldItem(w, parent) {
    var li = el("li"); li.appendChild(document.createTextNode(w.t + " "));
    if (w.h) { var a = el("a", "src", w.s); a.href = w.h; a.target = "_blank"; a.rel = "noopener"; li.appendChild(a); }
    else { li.appendChild(document.createTextNode("(" + w.s + ")")); }
    parent.appendChild(li);
  }
  WORLD.forEach(function (g) {
    if (g.region) {
      var h4 = el("h4", "world-region", g.region);
      wl.appendChild(h4);
      var ul = el("ul");
      g.items.forEach(function (w) { addWorldItem(w, ul); });
      wl.appendChild(ul);
    } else {
      if (!wl._flatUl) { wl._flatUl = el("ul"); wl.appendChild(wl._flatUl); }
      addWorldItem(g, wl._flatUl);
    }
  });
  var tg = $("terms");
  TERMS.forEach(function (t) {
    var d = el("div", "term"); d.appendChild(el("dt", "", t[0])); d.appendChild(el("dd", "", t[1])); tg.appendChild(d);
  });

  /* Organisations, derived from the players on each task */
  var orgMap = {};
  PRESETS.forEach(function (p) {
    (p.g || []).concat(p.r || []).forEach(function (n) {
      if (!ORGS[n]) { return; }
      (orgMap[n] = orgMap[n] || []).push(p.n);
    });
  });
  var orgNames = Object.keys(orgMap).sort(function (a, b) { return a.localeCompare(b); });
  var orgFilter = "all";
  var taskFilter = "";
  var openAreas = {};
  function drawOrgs() {
    var root = $("orgs"); root.textContent = "";
    var n = 0, groups = 0;
    BUCKETS.forEach(function (bk) {
      var names = bk[2].filter(function (x) { return orgMap[x] && (orgFilter === "all" || ORGS[x][0] === orgFilter) && (!taskFilter || orgMap[x].indexOf(taskFilter) >= 0); });
      if (!names.length) { return; }
      n += names.length; groups++;
      var det = el("details", "area"); if (openAreas[bk[0]] || taskFilter) { det.open = true; }
      det.addEventListener("toggle", function () { if (!taskFilter) { openAreas[bk[0]] = det.open; } });
      var sum = el("summary");
      var left = el("div", "al"); left.appendChild(el("b", "", bk[0])); left.appendChild(el("span", "ac", bk[1]));
      var right = el("div", "ar"); right.appendChild(el("span", "an", names.length + (names.length === 1 ? " product" : " products") + " · tap to open"));
      sum.appendChild(left); sum.appendChild(right); det.appendChild(sum);
      if (bk[3] && bk[4]) {
        var nt = el("div", "areanote");
        var n1 = el("p"); n1.appendChild(el("b", "", "Tools are good at: ")); n1.appendChild(document.createTextNode(bk[3]));
        var n2 = el("p"); n2.appendChild(el("b", "", "Keep with people: ")); n2.appendChild(document.createTextNode(bk[4]));
        nt.appendChild(n1); nt.appendChild(n2); det.appendChild(nt);
      }
      var ul = el("ul", "orgs");
      names.forEach(function (name) {
        var o = ORGS[name];
        var li = el("li", "org");
        var h = el("div"); h.appendChild(el("b", "", name)); h.appendChild(el("span", "rg", o[0] === "Global" ? "Global" : "India"));
        li.appendChild(h);
        li.appendChild(el("span", "kf", o[1]));
        li.appendChild(el("span", "tk", "Used for: " + orgMap[name].join(", ")));
        ul.appendChild(li);
      });
      det.appendChild(ul);
      var wrap = el("li"); wrap.appendChild(det); root.appendChild(wrap);
    });
    var tb = $("tfBar"); tb.textContent = ""; tb.hidden = !taskFilter;
    if (taskFilter) {
      tb.appendChild(el("span", "", "Showing HR tech for: "));
      tb.appendChild(el("b", "", taskFilter));
      var clr = el("button", "chip", "Show all"); clr.type = "button";
      clr.addEventListener("click", function () { taskFilter = ""; drawOrgs(); });
      tb.appendChild(clr);
    }
    $("orgCount").textContent = n + " HR tech products in " + groups + " areas. Examples, not recommendations. Descriptions are brief, so check them with each company.";
  }
  Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (c) {
    c.addEventListener("click", function () {
      orgFilter = c.getAttribute("data-f");
      Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
      drawOrgs();
    });
  });
  function showTech(name) {
    taskFilter = name; drawOrgs();
    var h = document.querySelector(".hrt"); if (h && h.scrollIntoView) { h.scrollIntoView({ behavior: RM() ? "auto" : "smooth", block: "start" }); }
  }
  drawOrgs();

  /* Storage */
  function collectState() {
    var st = { v: 2, t: Date.now(), hours: {}, steps: {}, weights: {}, off: {}, customs: [], tasks: {}, names: {} };
    items.forEach(function (i) {
      if (i.draft) { return; }
      if (i.custom) { st.customs.push({ id: i.id, n: i.n, h: i.h, s: !!i.s, steps: i.steps.map(function (x) { return { n: x.n, m: x.m }; }) }); }
      else { st.hours[i.n] = i.h; st.steps[i.n] = i.steps.map(function (x) { return x.m; }); st.weights[i.n] = i.steps.map(function (x) { return x.w; }); if (i.off) { st.off[i.n] = true; } if (i.edited) { st.tasks[i.n] = i.steps.map(function (x) { return { n: x.n, m: x.m, w: x.w, why: x.why || "", rec: x.rec || x.m }; }); } if (i.disp) { st.names[i.n] = i.disp; } }
    });
    return st;
  }
  function readLocal() { try { var r = window.localStorage.getItem(STORE); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  var dbDoc = null, dbTimer = null, dbBusy = false, dbDirty = false;
  function setNote(t) { var n = $("saveNote"); if (n) { n.textContent = t; } }
  function flushDb() {
    if (!dbDoc) { return; }
    if (dbBusy) { dbDirty = true; return; }
    dbBusy = true; dbDirty = false;
    dbDoc.set(collectState()).then(function () { setNote("Saved to your account."); }, function () { setNote("Saved in this browser only. Your account could not be reached."); }).then(function () { dbBusy = false; if (dbDirty) { flushDb(); } });
  }
  /* Excel export */
  function stageOf(name) {
    var out = "Your own activities";
    (PROC.STAGES || []).forEach(function (sg) { if (sg[2] && sg[2].indexOf(name) >= 0) { out = sg[0]; } });
    return out;
  }
  function buildRows() {
    var head = ["Stage", "Activity", "Task", "Activity hours " + PW + " (shown once per activity)", "Weight (%)", "Task hours " + PW, "Human-led", "Augment", "Automate", "Create", "Counted in working hypothesis", "Our starting view"];
    var rows = [head];
    items.forEach(function (it) {
      if (it.draft) { return; }
      var tw = 0; it.steps.forEach(function (x) { tw += x.w; });
      var stg = it.custom ? "Your own activities" : stageOf(it.n);
      it.steps.forEach(function (x) {
        var pct = tw > 0 ? Math.round(x.w / tw * 1000) / 10 : 0;
        var hrs = tw > 0 ? it.h * x.w / tw : 0; hrs = Math.round(hrs * 10000) / 10000;
        rows.push([stg, it.n, x.n, (it.steps.indexOf(x) === 0 ? it.h : ""), pct, hrs, x.m === "human" ? "✓" : "", x.m === "augment" ? "✓" : "", x.m === "automate" ? "✓" : "", x.m === "create" ? "✓" : "", it.off ? "No (ignored)" : "Yes", (x.rec ? LABEL[x.rec] : "-")]);
      });
    });
    return rows;
  }
  function exportXlsx(dl, note) {
    var X = window.XLSX;
    if (!X) { note.textContent = "The spreadsheet tool did not load."; return; }
    var rows = buildRows();
    var ws = X.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 20 }, { wch: 34 }, { wch: 56 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 11 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 16 }, { wch: 14 }];
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    var about = X.utils.aoa_to_sheet([
      ["Process", "Talent Acquisition"],
      ["Exported", new Date().toISOString().slice(0, 10)],
      ["Note", "Hours and weights are starting guesses to test with your team. Weight is each task's share of its activity's time. Task hours = activity hours x weight."]
    ]);
    about["!cols"] = [{ wch: 12 }, { wch: 100 }];
    var n = rows.length, RN = "'Talent Acquisition'!";
    var labs = [["Human-led", "G", 6], ["Augment", "H", 7], ["Automate", "I", 8], ["Create", "J", 9]];
    var sum = [["Label", "Task hours " + PW, "% of hours", "Number of tasks", "% of tasks"]];
    var hv = [], cv = [], tH = 0, tC = 0;
    labs.forEach(function (l) {
      var h = 0, c = 0;
      rows.slice(1).forEach(function (r) { if (r[10] === "Yes" && r[l[2]] === "\u2713") { h += r[5]; c += 1; } });
      hv.push(h); cv.push(c); tH += h; tC += c;
    });
    labs.forEach(function (l, i) {
      var r = i + 2;
      sum.push([l[0],
        { t: "n", v: hv[i], f: "SUMIFS(" + RN + "$F$2:$F$" + n + "," + RN + l[1] + "$2:" + l[1] + "$" + n + ",\"\u2713\"," + RN + "$K$2:$K$" + n + ",\"Yes\")", z: "0.00" },
        { t: "n", v: tH > 0 ? hv[i] / tH : 0, f: "IF(B6=0,0,B" + r + "/B6)", z: "0%" },
        { t: "n", v: cv[i], f: "COUNTIFS(" + RN + l[1] + "$2:" + l[1] + "$" + n + ",\"\u2713\"," + RN + "$K$2:$K$" + n + ",\"Yes\")" },
        { t: "n", v: tC > 0 ? cv[i] / tC : 0, f: "IF(D6=0,0,D" + r + "/D6)", z: "0%" }]);
    });
    sum.push(["Total", { t: "n", v: tH, f: "SUM(B2:B5)", z: "0.00" }, { t: "n", v: tH > 0 ? 1 : 0, f: "SUM(C2:C5)", z: "0%" }, { t: "n", v: tC, f: "SUM(D2:D5)" }, { t: "n", v: tC > 0 ? 1 : 0, f: "SUM(E2:E5)", z: "0%" }]);
    sum.push([]);
    sum.push(["Hours weight each task by its share of the activity's time. This is what the working hypothesis uses. Task counts treat every task equally. Ignored activities are left out."]);
    var sws = X.utils.aoa_to_sheet(sum);
    sws["!cols"] = [{ wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 12 }];
    var wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, "Talent Acquisition");
    X.utils.book_append_sheet(wb, sws, "Summary");
    X.utils.book_append_sheet(wb, about, "About");
    var buf = X.write(wb, { bookType: "xlsx", type: "array" });
    note.textContent = "";
    dl.save({ filename: "talent-acquisition-workload.xlsx", data: buf }).then(function () { note.textContent = "Saved."; }, function (e) {
      var c = e && e.code;
      note.textContent = c === "declined" ? "Not saved." : (c === "rate_limited" ? "Please wait a moment and try again." : "Saving is not available here.");
    });
  }
  function initExport() {
    var btn = $("xlsBtn"), note = $("xlsNote");
    if (!btn || !window.claude || !window.claude.use) { return; }
    window.claude.use("downloads").then(function (dl) {
      if (!dl || !window.XLSX) { return; }
      btn.hidden = false;
      btn.addEventListener("click", function () { exportXlsx(dl, note); });
    }, function () {});
  }
  initExport();
  function persist() {
    var st = collectState();
    try { window.localStorage.setItem(STORE, JSON.stringify(st)); setNote(dbDoc ? "Saving…" : "Saved in this browser."); }
    catch (e) { setNote(dbDoc ? "Saving…" : "Not saved. This browser blocks storage."); }
    if (dbDoc) { clearTimeout(dbTimer); dbTimer = setTimeout(flushDb, 800); }
  }

  /* Single delegated handler for closing affects-people popups */
  document.addEventListener("click", function () {
    Array.prototype.forEach.call(document.querySelectorAll(".afpop"), function (x) { x.hidden = true; });
    Array.prototype.forEach.call(document.querySelectorAll(".afx"), function (x) { x.setAttribute("aria-expanded", "false"); });
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") {
      Array.prototype.forEach.call(document.querySelectorAll(".afpop:not([hidden])"), function (x) { x.hidden = true; });
      Array.prototype.forEach.call(document.querySelectorAll(".afx[aria-expanded='true']"), function (x) { x.setAttribute("aria-expanded", "false"); });
    }
  });

  /* Build the list */
  var list = $("list");
  var MAXC = 15;
  var STAGES = PROC.STAGES;
  var stageUI = [];
  function colsHeader() {
    var c = el("div", "cols"); c.setAttribute("aria-hidden", "true");
    ["Activity|c-name", "Hours " + PW + "|c-hours", "How much AI helps|c-slider", "Result|c-pill"].forEach(function (x) { var q = x.split("|"); c.appendChild(el("span", q[1], q[0])); });
    return c;
  }
  function makeStage(name, sub, isOpen, pick) {
    var det = el("details", "stage"); if (isOpen) { det.open = true; }
    var sm = el("summary");
    var nm = el("div", "sg-name"); nm.appendChild(el("b", "", name)); var subEl = el("span", "sg-sub", sub); nm.appendChild(subEl);
    var bar = el("div", "flat mini sg-bar"); bar.setAttribute("role", "img");
    var end = el("div", "sg-end"); var hrs = el("b", ""); var ai = el("span", ""); end.appendChild(hrs); end.appendChild(ai);
    sm.appendChild(nm); sm.appendChild(bar); sm.appendChild(end); det.appendChild(sm);
    var body = el("div", "stagebody"); det.appendChild(body);
    stageUI.push({ pick: pick, sub: subEl, sub0: sub, bar: bar, hrs: hrs, ai: ai, name: name });
    list.appendChild(det);
    return { det: det, body: body };
  }
  function updateStages() {
    stageUI.forEach(function (sg) {
      var its = items.filter(sg.pick), h = 0, ai = 0, md = { human: 0, augment: 0, automate: 0, create: 0 };
      var offC = its.filter(function (x) { return x.off; }).length;
      its.forEach(function (it) {
        if (it.off) { return; }
        h += it.h; stepHours(it, function (st, hh) { md[st.m] += hh; if (st.m !== "human") { ai += hh; } });
      });
      var realIts = its.filter(function (x) { return !x.draft; }).length;
      sg.sub.textContent = sg.sub0 + " · " + realIts + (realIts === 1 ? " activity" : " activities") + (offC ? " (" + offC + " ignored)" : "") + (its.length > realIts ? " + 1 not added yet" : "");
      var allOff = its.length > 0 && offC === its.length;
      sg.hrs.textContent = allOff ? "Ignored" : fmtH(h) + " h";
      sg.ai.textContent = allOff ? "Not counted" : fmt(ai) + " h with AI";
      if (sg.tog) { sg.tog.textContent = allOff ? "Count this whole stage again" : "Ignore this whole stage"; }
      sg.bar.textContent = "";
      if (h > 0) { MODES.forEach(function (m) { if (md[m[0]] > 0) { var seg = el("div", "fseg"); seg.style.width = (md[m[0]] / h * 100) + "%"; seg.style.background = "var(--" + m[0] + ")"; seg.title = LABEL[m[0]] + ": " + fmt(md[m[0]]) + " h"; sg.bar.appendChild(seg); } }); }
      sg.bar.setAttribute("aria-label", "Stage " + sg.name + ": hours by who does the work");
    });
  }
  var firstRow = true;
  STAGES.forEach(function (sg, si) {
    var st = makeStage(sg[0], sg[1], false, function (x) { return !x.custom && sg[2].indexOf(x.n) !== -1; });
    var tools = el("div", "stagetools");
    var tog = el("button", "btn small", "Ignore this whole stage"); tog.type = "button";
    tog.addEventListener("click", function () {
      var mem = items.filter(function (x) { return !x.custom && sg[2].indexOf(x.n) !== -1; });
      var allOff = mem.length > 0 && mem.every(function (x) { return x.off; });
      mem.forEach(function (x) { x.off = !allOff; refresh(x, true); });
      totals(); persist();
    });
    tools.appendChild(tog); tools.appendChild(el("span", "hint", "Ignore activities your process does not have, for example because they are already automated elsewhere."));
    stageUI[stageUI.length - 1].tog = tog;
    st.body.appendChild(tools);
    st.body.appendChild(colsHeader());
    sg[2].forEach(function (name) {
      var idx = -1; PRESETS.forEach(function (q, k) { if (q.n === name) { idx = k; } });
      var p = PRESETS[idx];
      var steps = (STEPS[p.n] || []).map(function (x) { return { n: x[0], m: x[1], m0: x[1], w: x[2], w0: x[2], rec: x[1], why: x[3] }; });
      var cr = CRIT && CRIT[p.n] ? CRIT[p.n] : null;
      var it = { id: "p" + idx, n: p.n, st: p.st, h: p.h, h0: p.h, t: p.t, s: !!cr, nw: p.nw, th: p.th, g: p.g, r: p.r, uc: UC[p.n], crit: cr, steps: steps, open: false, custom: false };
      firstRow = false;
      items.push(it); st.body.appendChild(buildRow(it));
    });
  });

  /* Your own tasks */
  var MAXS = 8;
  var draft = { id: "draft", n: "Your new activity (not added yet)", st: "", h: 0, s: false, th: "", steps: [], custom: true, draft: true, v: 0 };
  var touched = false;
  var own = makeStage("Your own activities", "Your space: add activities we missed. Up to " + MAXC, false, function (x) { return !!x.custom; });
  own.det.classList.add("own");
  var addBox = el("div", "addform");
  addBox.appendChild(el("h3", "", "Add your own activity"));
  var r1 = el("div", "arow");
  var nameIn = document.createElement("input"); nameIn.type = "text"; nameIn.maxLength = 60; nameIn.placeholder = "For example, Run a hiring event";
  var hoursIn = document.createElement("input"); hoursIn.type = "number"; hoursIn.min = "0"; hoursIn.max = String(MAXH); hoursIn.step = "0.25"; hoursIn.value = "2";
  function lab(t, inp) { var l = el("label"); l.appendChild(el("span", "", t)); l.appendChild(inp); return l; }
  var hoursLab = lab("Hours " + PW, hoursIn); var hoursWarn = el("span", "hnote"); hoursWarn.setAttribute("role", "status"); hoursLab.appendChild(hoursWarn);
  r1.appendChild(lab("Activity name", nameIn)); r1.appendChild(hoursLab);
  addBox.appendChild(r1);
  var stkLab = el("label", "stk"); var stkIn = document.createElement("input"); stkIn.type = "checkbox";
  stkLab.appendChild(stkIn); stkLab.appendChild(el("span", "", "Tick this if AI on this activity could change someone's chances (who moves forward, is turned down or gets an offer), their pay or contract terms, or would handle sensitive personal data. A person must decide, so it never goes past Augment."));
  var kwHint = el("p", "kwhint", ""); kwHint.hidden = true; addBox.appendChild(kwHint);
  addBox.appendChild(el("div", "steps-h", "Tasks. Type each task and pick who should do it."));
  var stepBox = el("div", "fsteps"); addBox.appendChild(stepBox);
  var stepRows = [];
  function addStepRow() {
    if (stepRows.length >= MAXS) { return; }
    var row = { m: "human" };
    var wrap = el("div", "fstep");
    var inp = document.createElement("input"); inp.type = "text"; inp.maxLength = 80; inp.placeholder = "Task " + (stepRows.length + 1); row.inp = inp;
    inp.setAttribute("aria-label", "Task " + (stepRows.length + 1) + " name");
    var seg = el("div", "seg"); seg.setAttribute("role", "group"); var btns = [];
    MODES.forEach(function (m) {
      var b = el("button", "sb", m[1]); b.type = "button"; b.setAttribute("data-m", m[0]); b.setAttribute("aria-pressed", m[0] === row.m ? "true" : "false");
      b.addEventListener("click", function () { row.m = m[0]; btns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); userChange(); });
      btns.push(b); seg.appendChild(b);
    });
    var rmv = el("button", "rm", "Remove"); rmv.type = "button";
    rmv.addEventListener("click", function () { stepRows = stepRows.filter(function (x) { return x !== row; }); wrap.remove(); userChange(); });
    inp.addEventListener("input", userChange);
    wrap.appendChild(inp); wrap.appendChild(seg); wrap.appendChild(rmv);
    row.wrap = wrap; stepRows.push(row); stepBox.appendChild(wrap);
  }
  var moreStep = el("button", "btn", "Add a task"); moreStep.type = "button"; moreStep.style.justifySelf = "start";
  moreStep.addEventListener("click", function () { addStepRow(); userChange(); });
  addBox.appendChild(moreStep);
  function resetSteps() { stepBox.textContent = ""; stepRows = []; addStepRow(); addStepRow(); addStepRow(); }
  addBox.appendChild(el("p", "hint", "Each task counts the same. The activity's result is the choice that covers most of its time."));
  var prevBar = el("div", "flat mini"); var prevTxt = el("p", "addprev", ""); addBox.appendChild(prevBar); addBox.appendChild(prevTxt);
  var addHelp = el("p", "addhelp", ""); addHelp.setAttribute("role", "status"); addBox.appendChild(addHelp);
  var addBtn = el("button", "addbtn", "Add activity"); addBtn.type = "button"; addBox.appendChild(addBtn);
  var addSum = el("p", "addsum", ""); addBox.appendChild(addSum);
  var addDone = el("p", "adddone", ""); addDone.hidden = true; addDone.setAttribute("role", "status"); addBox.appendChild(addDone); nameIn.addEventListener("input", function () { addDone.hidden = true; });
  function wk() { var tt = 0, aa = 0; items.forEach(function (x) { if (!x.draft && !x.off) { tt += x.h; aa += x.h * (x.v || 0) / 100; } }); return { t: tt, a: aa }; }
  var ownList = el("div", "stagebody"); ownList.style.padding = "0";
  var ownCols = colsHeader(); ownCols.hidden = true;
  own.body.appendChild(addBox); own.body.appendChild(ownCols); own.body.appendChild(ownList);
  function readSteps() { var out = []; stepRows.forEach(function (r) { var t = r.inp.value.trim(); if (t) { out.push({ n: t, m: r.m }); } }); return out; }
  function ownCount() { return items.filter(function (x) { return x.custom && !x.draft; }).length; }
  function makeCustom(id, n, h, stk, stepList) {
    var steps = stepList.map(function (x) { return { n: x.n, m: x.m, m0: x.m, w: 1 }; });
    return { id: id, n: n, st: "", h: h, s: stk, th: "", steps: steps, custom: true };
  }
  function readHours() {
    var x = parseFloat(hoursIn.value), bad = !isNaN(x) && (x < 0 || x > MAXH), h = clampH(isNaN(x) ? 0 : x);
    if (bad) { hoursIn.value = String(h); hoursWarn.textContent = "Kept between 0 and " + MAXH + " hours."; } else { hoursWarn.textContent = ""; }
    return h;
  }
  var KW = PROC.KW;
  function userChange() { touched = true; previewAdd(); }
  function syncDraft() {
    var rows = readSteps().map(function (x) { return { n: x.n, m: x.m, m0: x.m, w: 1 }; });
    var h = readHours();
    draft.s = stkIn.checked; draft.h = h; draft.steps = rows; draft.v = calcV(rows);
    var nm = nameIn.value.trim(); draft.n = nm ? nm + " (not added yet)" : "Your new activity (not added yet)";
    var idx = items.indexOf(draft), want = touched && rows.length > 0 && ownCount() < MAXC;
    if (want && idx < 0) { items.push(draft); } else if (!want && idx >= 0) { items.splice(idx, 1); }
    totals();
  }
  function previewAdd() {
    var sl = readSteps();
    var h = readHours();
    var t = makeCustom("tmp", "x", h, stkIn.checked, sl);
    var kwText = nameIn.value + " " + sl.map(function (x) { return x.n; }).join(" ");
    kwHint.hidden = true;
    kwHint.textContent = kwHint.hidden ? "" : "This looks like it could affect someone's chances, pay or privacy. Tick the box above if it does.";
    prevBar.textContent = "";
    if (!sl.length) { prevTxt.textContent = "Add at least one task to see the result."; }
    else {
      drawTaskPie(prevBar, t);
      var z = taskZone(t), v = calcV(t.steps);
      prevTxt.textContent = "Result: " + LABEL[z.key] + (z.capped ? " (a person still decides)" : "") + ". " + aiText(h, v) + ".";
    }
    var full = ownCount() >= MAXC;
    addBtn.disabled = full || !sl.length || !nameIn.value.trim();
    addHelp.textContent = full ? "" : (!nameIn.value.trim() ? "Type an activity name to turn on Add activity." : (!sl.length ? "Type at least one task to turn on Add activity." : ""));
    addBtn.textContent = full ? "You have added " + MAXC + " activities, the most you can add" : "Add activity";
    moreStep.disabled = stepRows.length >= MAXS;
    syncDraft();
  }
  [nameIn, hoursIn, stkIn].forEach(function (x) { x.addEventListener("input", userChange); x.addEventListener("change", userChange); });
  addBtn.addEventListener("click", function () {
    if (ownCount() >= MAXC) { return; }
    var h = readHours();
    var di = items.indexOf(draft); if (di >= 0) { items.splice(di, 1); }
    var before = wk();
    var it = makeCustom("c" + Date.now(), nameIn.value.trim(), h, stkIn.checked, readSteps()); it.open = true;
    items.push(it); it.rowEl = buildRow(it); ownList.appendChild(it.rowEl); persist(); totals();
    var after = wk(), nm = nameIn.value.trim();
    nameIn.value = ""; stkIn.checked = false; touched = false; resetSteps(); previewAdd(); own.det.open = true;
    addDone.hidden = false;
    addDone.textContent = "Added \u201c" + nm + "\u201d. It is now in your working hypothesis. Before: " + fmt(before.a) + " of " + fmt(before.t) + " h where AI plays a role (" + (before.t > 0 ? Math.round(before.a / before.t * 100) : 0) + "%). Now: " + fmt(after.a) + " of " + fmt(after.t) + " h (" + (after.t > 0 ? Math.round(after.a / after.t * 100) : 0) + "%).";
    var hero = document.querySelector(".hero"); if (hero) { hero.classList.remove("pulse"); void hero.offsetWidth; hero.classList.add("pulse"); }
  });
  function applyState(st) {
    if (!st || typeof st !== "object") { return; }
    items.forEach(function (i) {
      if (i.custom || i.draft) { return; }
      var tk = st.tasks && st.tasks[i.n], dn = st.names && st.names[i.n], rb = false;
      if (Array.isArray(tk) && tk.length && tk.length <= MAXT && tk.every(function (x) { return x && MS.hasOwnProperty(x.m) && typeof x.w === "number" && isFinite(x.w) && x.w >= 0 && x.w <= 100 && typeof x.n === "string" && x.n; })) {
        i.steps = tk.map(function (x) { var rc = MS.hasOwnProperty(x.rec) ? x.rec : x.m; return { n: x.n.slice(0, 80), m: x.m, m0: rc, w: x.w, w0: x.w, rec: rc, why: typeof x.why === "string" ? x.why.slice(0, 200) : "" }; });
        i.edited = true; rb = true;
      }
      if (typeof dn === "string" && dn) { i.disp = dn.slice(0, 60); rb = true; }
      if (rb) { rebuildRow(i, true); }
      var h = (st.v >= 2 && st.hours) ? st.hours[i.n] : undefined;
      if (typeof h === "number" && isFinite(h) && h >= 0) { i.h = clampH(h); i.ui.hours.value = String(i.h); }
      i.off = !!(st.off && st.off[i.n]);
      var ms = st.steps ? st.steps[i.n] : undefined;
      if (Array.isArray(ms) && ms.length === i.steps.length) { i.steps.forEach(function (x, k) { if (MS.hasOwnProperty(ms[k])) { x.m = ms[k]; } }); }
      var ws = st.weights ? st.weights[i.n] : undefined;
      if (Array.isArray(ws) && ws.length === i.steps.length && ws.every(function (q) { return typeof q === "number" && isFinite(q) && q >= 0 && q <= 100; }) && ws.reduce(function (a, b) { return a + b; }, 0) > 0) { i.steps.forEach(function (x, k) { x.w = ws[k]; }); }
      refresh(i, true);
    });
    items.filter(function (i) { return i.custom && !i.draft; }).forEach(function (i) { if (i.rowEl) { i.rowEl.remove(); } });
    items = items.filter(function (i) { return !(i.custom && !i.draft); });
    (Array.isArray(st.customs) ? st.customs : []).slice(0, MAXC).forEach(function (c) {
      if (!c || !Array.isArray(c.steps) || !c.steps.length) { return; }
      var sl = c.steps.filter(function (x) { return x && MS.hasOwnProperty(x.m); }).map(function (x) { return { n: String(x.n), m: x.m }; });
      if (!sl.length) { return; }
      var it = makeCustom(String(c.id || ("c" + Date.now())), String(c.n).slice(0, 60), clampH(Number(c.h)), false, sl.map(function (x) { return { n: x.n.slice(0, 80), m: x.m }; }));
      items.push(it); it.rowEl = buildRow(it); ownList.appendChild(it.rowEl);
    });
    if (ownCount() > 0) { own.det.open = true; }
    totals();
  }
  function migrateLegacy() {
    var out = { v: 1, t: Date.now(), hours: {}, steps: {}, customs: [] };
    ["hr-recruit-v5", "hr-recruit-v4"].forEach(function (key) {
      try {
        var raw = window.localStorage.getItem(key), arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) { return; }
        arr.forEach(function (c) {
          if (!c || !c.n) { return; }
          var steps = Array.isArray(c.steps) ? c.steps : (c.mix ? MODES.filter(function (m) { return c.mix[m[0]] > 0; }).map(function (m) { return { n: c.n + ": " + m[1], m: m[0] }; }) : []);
          if (steps.length && !out.customs.some(function (x) { return x.id === c.id; })) { out.customs.push({ id: c.id, n: c.n, h: c.h || 0, steps: steps }); }
        });
      } catch (e) { /* ignore */ }
    });
    return out.customs.length ? out : null;
  }
  var startState = readLocal(), migrated = false;
  if (!startState) { startState = migrateLegacy(); migrated = !!startState; }
  applyState(startState);
  if (migrated) { persist(); }
  resetSteps();
  if (ownCount() > 0) { own.det.open = true; }

  var resetArmed = false, resetTimer = null;
  function disarmReset() { resetArmed = false; clearTimeout(resetTimer); $("reset").textContent = "Reset to starting view"; }
  $("reset").addEventListener("click", function () {
    if (!resetArmed) { resetArmed = true; $("reset").textContent = "Click again to reset (your own activities stay)"; resetTimer = setTimeout(disarmReset, 5000); return; }
    disarmReset();
    items.forEach(function (it) {
      if (!it.custom) { if (it.edited || it.disp) { it.edited = false; it.disp = null; it.steps = origSteps(it.n); rebuildRow(it, true); } it.h = it.h0; it.off = false; it.ui.hours.value = String(it.h0); it.ui.hnote.textContent = ""; it.steps.forEach(function (st) { st.m = st.m0; if (st.w0 !== undefined) { st.w = st.w0; } }); refresh(it, true); }
    });
    totals(); persist();
  });
  var allOpen = false;
  $("toggleAll").addEventListener("click", function () {
    allOpen = !allOpen;
    Array.prototype.forEach.call(document.querySelectorAll("details.more, details.stage"), function (d) { d.open = allOpen; });
    $("toggleAll").textContent = allOpen ? "Close all" : "Open all";
  });

  previewAdd();
  totals();

  (function initWhy() {
    var b = $("toggleWhy"), L = $("list"); if (!b || !L) { return; }
    function apply(hide) { L.classList.toggle("nowhy", hide); b.textContent = hide ? "Show reasons" : "Hide reasons"; }
    var hide = false;
    try { hide = window.localStorage.getItem("hr-recruit-why") === "hide"; } catch (e) { hide = false; }
    apply(hide);
    b.addEventListener("click", function () {
      hide = !L.classList.contains("nowhy"); apply(hide);
      try { window.localStorage.setItem("hr-recruit-why", hide ? "hide" : "show"); } catch (e) { /* ignore */ }
    });
  })();

  (function initStart() {
    var b = $("startBtn"); if (!b) { return; }
    b.addEventListener("click", function () {
      var d = document.querySelector("#list details.stage"); if (!d) { return; }
      d.open = true;
      var s = d.querySelector("summary");
      try { d.scrollIntoView({ behavior: RM() ? "auto" : "smooth", block: "start" }); } catch (e) { d.scrollIntoView(); }
      if (s) { s.focus({ preventScroll: true }); }
    });
  })();

  /* Save to the viewer's own account, when available */
  (function initDb() {
    if (!window.claude || !window.claude.use) { return; }
    Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (r) {
      var db = r[0], user = r[1];
      if (!db || !user) { return; }
      return user.id().then(function (id) {
        if (!id) { return; }
        dbDoc = db.doc("data/users/" + id + "/" + (PROC.id || "recruitment"));
        return dbDoc.get().then(function (snap) {
          var remote = snap.exists ? snap.data() : null, local = readLocal();
          if (remote && (!local || (remote.t || 0) > (local.t || 0))) {
            applyState(remote);
            try { window.localStorage.setItem(STORE, JSON.stringify(remote)); } catch (e) { /* storage unavailable */ }
            setNote("Saved to your account.");
          } else if (local) { flushDb(); }
          else { setNote("Saved to your account."); }
        });
      });
    }).catch(function () { /* stay with browser storage */ });
  })();
})();
