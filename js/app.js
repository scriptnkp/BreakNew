/* ===== ตรรกะหลัก + แสดงผล ===== */
(function () {

  var EVENTS = [];
  var F = { view: "today", imp: "all", ccy: "usdeur" };
  var LOGS = [];

  function $(id) { return document.getElementById(id); }

  function log(msg) {
    LOGS.unshift("[" + new Date().toLocaleTimeString("th-TH") + "] " + msg);
    if (LOGS.length > 25) LOGS.pop();
    $("log").textContent = LOGS.join("\n");
  }

  /* ---------- แปลงตัวเลข รองรับ K M B % ---------- */
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

  /* ---------- normalize ตั้งแต่ตอนโหลด แก้ปัญหาตัวกรองหลุด ---------- */
  function normalize(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var d = new Date(e.date);
      if (isNaN(d.getTime())) continue;
      e._d = d;
      e._t = d.getTime();
      e._imp = String(e.impact || "").trim().toLowerCase();
      e._cc = String(e.country || "").trim().toUpperCase();
      out.push(e);
    }
    out.sort(function (a, b) { return a._t - b._t; });
    return out;
  }

  function sameDay(a, b) { return a.toDateString() === b.toDateString(); }

  /* ---------- คะแนน -1..+1 (บวก = หนุนทอง) ---------- */
  function lean(cur, ref, ev) {
    if (cur === null || ref === null) return null;
    var dir = CCY_DIR[ev._cc];
    if (dir === undefined) return null;
    var w = WEIGHT[ev._imp];
    if (w === undefined) w = 1;
    if (w === 0) return null;

    var diff = cur - ref;
    if (INVERSE_RE.test(ev.title || "")) diff = -diff;

    var base = Math.abs(ref) || Math.abs(cur) || 1;
    var surprise = Math.max(-1, Math.min(1, (diff / base) * CONFIG.SENSITIVITY));
    return Math.max(-1, Math.min(1, surprise * dir * (w / 3)));
  }

  function preLean(ev)  { return lean(num(ev.forecast), num(ev.previous), ev); }
  function postLean(ev) {
    var f = num(ev.forecast);
    if (f === null) f = num(ev.previous);
    return lean(num(ev.actual), f, ev);
  }

  function toBuyPct(score) { return Math.round(50 + score * 50); }

  function pctCell(score) {
    if (score === null) return '<span class="dim">-</span>';
    var b = toBuyPct(score), s = 100 - b;
    var cls = b > 55 ? "up" : b < 45 ? "down" : "dim";
    return '<div class="pw"><div class="pb"><i style="width:' + b + '%"></i></div>' +
           '<div class="pt ' + cls + '">B ' + b + '% / S ' + s + '%</div></div>';
  }

  /* ---------- กรอง ---------- */
  function filterEvents() {
    var now = new Date();
    var rows = EVENTS;

    if (F.view === "today")      rows = rows.filter(function (e) { return sameDay(e._d, now); });
    else if (F.view === "upcoming") rows = rows.filter(function (e) { return e._t >= now.getTime(); });

    if (F.imp === "high")         rows = rows.filter(function (e) { return e._imp === "high"; });
    else if (F.imp === "highmed") rows = rows.filter(function (e) { return e._imp === "high" || e._imp === "medium"; });

    if (F.ccy === "usd")          rows = rows.filter(function (e) { return e._cc === "USD"; });
    else if (F.ccy === "usdeur")  rows = rows.filter(function (e) { return e._cc === "USD" || e._cc === "EUR"; });

    return rows;
  }

  /* ---------- ตาราง ---------- */
  function renderTable(rows) {
    $("count").textContent = "แสดง " + rows.length + " / " + EVENTS.length + " รายการ";

    if (!rows.length) {
      $("tbody").innerHTML = '<tr><td colspan="9" class="dim">ไม่มีข่าวตามเงื่อนไข ลองกด "ทั้งสัปดาห์" หรือ "ทุกความแรง"</td></tr>';
      return;
    }
    var html = "", lastDay = "";
    for (var i = 0; i < rows.length; i++) {
      var ev = rows[i];
      var key = ev._d.toDateString();
      if (key !== lastDay) {
        lastDay = key;
        html += '<tr class="day"><td colspan="9">' +
          ev._d.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short" }) + "</td></tr>";
      }
      html += "<tr>" +
        '<td class="dim">' + ev._d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + "</td>" +
        "<td><b>" + ev._cc + "</b></td>" +
        '<td><span class="dot" style="background:' + (IMPACT_COLOR[ev._imp] || "#8b98a9") + '"></span></td>' +
        "<td>" + (ev.title || "-") + "</td>" +
        "<td><b>" + (ev.actual || "-") + "</b></td>" +
        '<td class="dim">' + (ev.forecast || "-") + "</td>" +
        '<td class="dim">' + (ev.previous || "-") + "</td>" +
        "<td>" + pctCell(preLean(ev)) + "</td>" +
        "<td>" + pctCell(postLean(ev)) + "</td></tr>";
    }
    $("tbody").innerHTML = html;
  }

  /* ---------- การ์ดสรุป ---------- */
  function renderSummary(rows) {
    var pre = 0, preN = 0, post = 0, postN = 0;
    for (var i = 0; i < rows.length; i++) {
      var w = WEIGHT[rows[i]._imp] || 1;
      var a = preLean(rows[i]);
      var b = postLean(rows[i]);
      if (a !== null) { pre += a * w; preN += w; }
      if (b !== null) { post += b * w; postN += w; }
    }
    var score = null, label = "";
    if (postN > 0) { score = post / postN; label = "อิงผลจริงที่ออกแล้ว"; }
    else if (preN > 0) { score = pre / preN; label = "อิงคาดการณ์ก่อนข่าว (Forecast vs Previous)"; }

    var bar = $("splitBar");
    if (score === null) {
      $("buyPct").textContent = "--";
      $("sellPct").textContent = "--";
      $("biasTxt").textContent = "ไม่มีตัวเลขให้คำนวณในช่วงที่เลือก";
      bar.style.width = "50%";
      return;
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
    var pending = EVENTS.filter(function (e) {
      return e._imp === "high" && CCY_DIR[e._cc] !== undefined && e._t > now;
    });
    $("hiCount").textContent = pending.length;
    if (!pending.length) { $("nextEv").textContent = "ไม่มีข่าวแรงสูงเหลือในสัปดาห์นี้"; return; }
    var d = pending[0]._d;
    var hrs = Math.round((d.getTime() - now) / 3600000);
    $("nextEv").textContent = pending[0].title + " • " +
      d.toLocaleString("th-TH", { weekday: "short", hour: "2-digit", minute: "2-digit" }) +
      " (อีก ~" + hrs + " ชม.)";
  }

  function render() {
    var rows = filterEvents();
    renderTable(rows);
    renderSummary(rows);
    renderNext();
  }

  /* ---------- โหลดข้อมูล ---------- */
  function loadGold() {
    API.getGold()
      .then(function (d) {
        $("px").textContent = "$" + Number(d.price).toFixed(2);
        $("pxSub").textContent = "อัปเดต " + new Date().toLocaleTimeString("th-TH");
      })
      .catch(function (e) {
        $("px").textContent = "N/A";
        $("pxSub").textContent = "ดึงราคาไม่สำเร็จ";
        log("ราคาทองล้มเหลว: " + e.message);
      });
  }

  function afterLoad(via) {
    API.saveCache(EVENTS);
    $("status").textContent = "• " + new Date().toLocaleTimeString("th-TH") + " " + via;

    if (F.view === "today") {
      var today = new Date();
      var has = EVENTS.some(function (e) { return sameDay(e._d, today); });
      if (!has) { log('วันนี้ไม่มีข่าว → สลับไปโหมด "ข่าวถัดไป"'); setSeg("view", "upcoming"); return; }
    }
    render();
  }

  function loadCalendar() {
    API.getCalendar(log)
      .then(function (res) { EVENTS = normalize(res.data); afterLoad("via " + res.via); })
      .catch(function (e) {
        log("✗✗ " + e.message);
        var c = API.loadCache();
        if (c) {
          EVENTS = normalize(c.data);
          log("ใช้แคชจาก " + new Date(c.t).toLocaleString("th-TH"));
          afterLoad("แคช");
        } else {
          $("tbody").innerHTML = '<tr><td colspan="9" class="down">ดึงปฏิทินไม่ได้ — แนะนำตั้ง Cloudflare Worker แล้วใส่ URL ใน js/config.js</td></tr>';
          $("status").textContent = "ผิดพลาด";
        }
      });
  }

  function loadAll() {
    $("status").textContent = "กำลังดึงข้อมูล...";
    loadGold();
    loadCalendar();
  }

  /* ---------- ปุ่มกรอง ---------- */
  function setSeg(group, val) {
    F[group] = val;
    var boxes = document.querySelectorAll('.seg[data-group="' + group + '"] button');
    for (var i = 0; i < boxes.length; i++) {
      boxes[i].className = boxes[i].getAttribute("data-v") === val ? "on" : "";
    }
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

  $("btnRefresh").addEventListener("click", loadAll);

  log("เริ่มทำงาน • " + new Date().toLocaleString("th-TH"));
  loadAll();
  setInterval(loadAll, CONFIG.REFRESH_MS);
})();