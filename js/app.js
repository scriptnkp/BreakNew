/* ===== ตรรกะหลัก + แสดงผล ===== */
(function () {

  var EVENTS = [];
  var F = { view: "today", imp: "all", ccy: "usdeur", q: "" };
  var OPEN = {};
  var LOGS = [];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function log(msg) {
    LOGS.unshift("[" + new Date().toLocaleTimeString("th-TH") + "] " + msg);
    if (LOGS.length > 25) LOGS.pop();
    $("log").textContent = LOGS.join("\n");
  }

  function num(s) {
    if (s === null || s === undefined || s === "") return null;
    var str = String(s);
    var m = str.replace(/[,%$<>]/g, "").match(/-?\d+\.?\d*/);
    if (!m) return null;
    var v = parseFloat(m[0]);
    if (/k/i.test(str)) v *= 1e3;
    else if (/m/i.test(str)) v *= 1e6;
    else if (/b/i.test(str)) v *= 1e9;
    return v;
  }

  function normalize(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i], d = new Date(e.date);
      if (isNaN(d.getTime())) continue;
      e._d = d; e._t = d.getTime();
      e._imp = String(e.impact || "").trim().toLowerCase();
      e._cc = String(e.country || "").trim().toUpperCase();
      e._q = String(e.title || "").toLowerCase();
      out.push(e);
    }
    out.sort(function (a, b) { return a._t - b._t; });
    return out;
  }

  function sameDay(a, b) { return a.toDateString() === b.toDateString(); }

  function lean(cur, ref, ev) {
    if (cur === null || ref === null) return null;
    var dir = CCY_DIR[ev._cc];
    if (dir === undefined) return null;
    var w = WEIGHT[ev._imp]; if (w === undefined) w = 1;
    if (w === 0) return null;
    var diff = cur - ref;
    if (INVERSE_RE.test(ev.title || "")) diff = -diff;
    var base = Math.abs(ref) || Math.abs(cur) || 1;
    var sp = Math.max(-1, Math.min(1, (diff / base) * CONFIG.SENSITIVITY));
    return Math.max(-1, Math.min(1, sp * dir * (w / 3)));
  }

  function preLean(ev) { return lean(num(ev.forecast), num(ev.previous), ev); }
  function postLean(ev) {
    var f = num(ev.forecast); if (f === null) f = num(ev.previous);
    return lean(num(ev.actual), f, ev);
  }
  function toBuyPct(s) { return Math.round(50 + s * 50); }

  function barRow(key, score) {
    if (score === null) return '<div class="bl"><span class="k">' + key + '</span>' +
      '<div class="pb" style="background:var(--line)"></div><span class="pt dim">-</span></div>';
    var b = toBuyPct(score), cls = b > 55 ? "up" : b < 45 ? "down" : "dim";
    return '<div class="bl"><span class="k">' + key + '</span>' +
      '<div class="pb"><i style="width:' + b + '%"></i></div>' +
      '<span class="pt ' + cls + '">' + b + " / " + (100 - b) + "</span></div>";
  }

  var IMP_TH = { high: "แรงสูง", medium: "แรงกลาง", low: "แรงต่ำ", holiday: "วันหยุด" };

  function filterEvents() {
    var now = new Date(), rows = EVENTS;
    if (F.view === "today") rows = rows.filter(function (e) { return sameDay(e._d, now); });
    else if (F.view === "upcoming") rows = rows.filter(function (e) { return e._t >= now.getTime(); });

    if (F.imp === "high") rows = rows.filter(function (e) { return e._imp === "high"; });
    else if (F.imp === "highmed") rows = rows.filter(function (e) { return e._imp === "high" || e._imp === "medium"; });

    if (F.ccy === "usd") rows = rows.filter(function (e) { return e._cc === "USD"; });
    else if (F.ccy === "usdeur") rows = rows.filter(function (e) { return e._cc === "USD" || e._cc === "EUR"; });

    if (F.q) rows = rows.filter(function (e) { return e._q.indexOf(F.q) > -1; });
    return rows;
  }

  function renderList(rows) {
    $("count").textContent = "แสดง " + rows.length + " / " + EVENTS.length;

    if (!rows.length) {
      $("list").innerHTML = '<div class="card empty">ไม่พบข่าวตามเงื่อนไข<br><span class="sm">ลองกด "ทั้งสัปดาห์" หรือ "ทุกแรง"</span></div>';
      return;
    }

    var html = "", lastDay = "";
    for (var i = 0; i < rows.length; i++) {
      var ev = rows[i];
      var key = ev._d.toDateString();
      if (key !== lastDay) {
        lastDay = key;
        html += '<div class="dayhead">' + ev._d.toLocaleDateString("th-TH",
          { weekday: "long", day: "numeric", month: "long" }) + "</div>";
      }

      var g = explain(ev.title);
      var id = ev._t + "_" + i;
      var side = ev._imp === "high" ? " hi" : ev._imp === "medium" ? " me" : "";
      var open = OPEN[id] ? " open" : "";

      html += '<article class="ev' + side + open + '" data-id="' + id + '">' +
        '<div class="ev-top">' +
          '<span class="time">' + ev._d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + "</span>" +
          '<span class="ccy">' + esc(ev._cc) + "</span>" +
          '<span class="imp i-' + (ev._imp || "low") + '">' + (IMP_TH[ev._imp] || "-") + "</span>" +
        "</div>" +

        '<h3 class="ev-title">' + esc(ev.title) + '<span class="chev">▼</span></h3>' +

        '<div class="vals">' +
          '<div class="v"><b>Actual</b><span>' + esc(ev.actual || "-") + "</span></div>" +
          '<div class="v"><b>Forecast</b><span class="dim">' + esc(ev.forecast || "-") + "</span></div>" +
          '<div class="v"><b>Previous</b><span class="dim">' + esc(ev.previous || "-") + "</span></div>" +
        "</div>" +

        '<div class="bias">' + barRow("คาดก่อน", preLean(ev)) + barRow("ผลจริง", postLean(ev)) + "</div>" +

        '<div class="ev-more">' +
          '<div><div class="exp"><h4>📌 ข่าวนี้คืออะไร</h4><p>' + esc(g.n) + " — " + esc(g.w) + "</p></div></div>" +
          '<div><div class="exp"><h4>🥇 ผลต่อราคาทอง</h4><p>' + esc(g.g) + "</p></div></div>" +
        "</div></article>";
    }
    $("list").innerHTML = html;
  }

  function renderSummary(rows) {
    var pre = 0, preN = 0, post = 0, postN = 0;
    for (var i = 0; i < rows.length; i++) {
      var w = WEIGHT[rows[i]._imp] || 1;
      var a = preLean(rows[i]), b = postLean(rows[i]);
      if (a !== null) { pre += a * w; preN += w; }
      if (b !== null) { post += b * w; postN += w; }
    }
    var score = null, label = "";
    if (postN > 0) { score = post / postN; label = "อิงผลจริงที่ออกแล้ว"; }
    else if (preN > 0) { score = pre / preN; label = "อิงคาดการณ์ก่อนข่าว"; }

    var bar = $("splitBar");
    if (score === null) {
      $("buyPct").textContent = "--"; $("sellPct").textContent = "--";
      $("biasTxt").textContent = "ไม่มีตัวเลขให้คำนวณในช่วงที่เลือก";
      bar.style.width = "50%"; return;
    }
    var b = toBuyPct(score);
    $("buyPct").textContent = "B " + b + "%";
    $("sellPct").textContent = "S " + (100 - b) + "%";
    bar.style.width = b + "%";
    var tone = b > 60 ? "โน้มขึ้น" : b < 40 ? "โน้มลง" : "ไซด์เวย์";
    $("biasTxt").textContent = tone + " • " + label;
  }

  function renderNext() {
    var now = Date.now();
    var p = EVENTS.filter(function (e) {
      return e._imp === "high" && CCY_DIR[e._cc] !== undefined && e._t > now;
    });
    $("hiCount").textContent = p.length;
    if (!p.length) { $("nextEv").textContent = "ไม่มีข่าวแรงสูงเหลือสัปดาห์นี้"; return; }
    var d = p[0]._d, hrs = Math.round((d.getTime() - now) / 3600000);
    $("nextEv").textContent = p[0].title + " • อีก ~" + hrs + " ชม.";
  }

  function render() {
    var rows = filterEvents();
    renderList(rows); renderSummary(rows); renderNext();
  }

  /* ---------- โหลด ---------- */
  function loadGold() {
    API.getGold().then(function (d) {
      $("px").textContent = "$" + Number(d.price).toFixed(2);
      $("pxSub").textContent = "อัปเดต " + new Date().toLocaleTimeString("th-TH");
    }).catch(function (e) {
      $("px").textContent = "N/A";
      $("pxSub").textContent = "ดึงราคาไม่สำเร็จ";
      log("ราคาทองล้มเหลว: " + e.message);
    });
  }

  function afterLoad(via) {
    API.saveCache(EVENTS);
    $("status").textContent = "• " + new Date().toLocaleTimeString("th-TH") + " " + via;
    if (F.view === "today") {
      var t = new Date();
      if (!EVENTS.some(function (e) { return sameDay(e._d, t); })) {
        log('วันนี้ไม่มีข่าว → สลับไปโหมด "ถัดไป"');
        setSeg("view", "upcoming"); return;
      }
    }
    render();
  }

  function loadCalendar() {
    API.getCalendar(log)
      .then(function (r) { EVENTS = normalize(r.data); afterLoad("via " + r.via); })
      .catch(function (e) {
        log("✗✗ " + e.message);
        var c = API.loadCache();
        if (c) {
          EVENTS = normalize(c.data);
          log("ใช้แคชจาก " + new Date(c.t).toLocaleString("th-TH"));
          afterLoad("แคช");
        } else {
          $("list").innerHTML = '<div class="card empty down">ดึงปฏิทินไม่ได้ — ตรวจว่า GitHub Actions รันแล้วหรือยัง</div>';
          $("status").textContent = "ผิดพลาด";
        }
      });
  }

  function loadAll() {
    $("status").textContent = "กำลังโหลด...";
    loadGold(); loadCalendar();
  }

  /* ---------- events ---------- */
  function setSeg(group, val) {
    F[group] = val;
    var b = document.querySelectorAll('.seg[data-group="' + group + '"] button');
    for (var i = 0; i < b.length; i++)
      b[i].className = b[i].getAttribute("data-v") === val ? "on" : "";
    render();
  }

  var segs = document.querySelectorAll(".seg");
  for (var i = 0; i < segs.length; i++) {
    (function (seg) {
      seg.addEventListener("click", function (e) {
        var v = e.target.getAttribute("data-v");
        if (v) setSeg(seg.getAttribute("data-group"), v);
      });
    })(segs[i]);
  }

  $("list").addEventListener("click", function (e) {
    var card = e.target.closest(".ev");
    if (!card) return;
    var id = card.getAttribute("data-id");
    if (OPEN[id]) { delete OPEN[id]; card.classList.remove("open"); }
    else { OPEN[id] = 1; card.classList.add("open"); }
  });

  var qt;
  $("q").addEventListener("input", function (e) {
    clearTimeout(qt);
    var v = e.target.value.trim().toLowerCase();
    qt = setTimeout(function () { F.q = v; render(); }, 220);
  });

  var root = document.documentElement;
  var saved = localStorage.getItem("gbr_theme");
  if (saved) root.setAttribute("data-theme", saved);
  $("btnTheme").textContent = root.getAttribute("data-theme") === "light" ? "☀️" : "🌙";
  $("btnTheme").addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    localStorage.setItem("gbr_theme", next);
    this.textContent = next === "light" ? "☀️" : "🌙";
  });

  $("btnRefresh").addEventListener("click", loadAll);

  log("เริ่มทำงาน • " + new Date().toLocaleString("th-TH"));
  loadAll();
  setInterval(loadAll, CONFIG.REFRESH_MS);
})();