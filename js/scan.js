/* ===== Scan สินทรัพย์ 7 กลุ่ม — Top 20 + Ranking + เรียงคอลัมน์ได้ ===== */
(function () {

  var DATA = null;
  var S = { grp: "th", tf: "daily", side: "both", q: "" };
  var SORT = { key: "pct", dir: -1 };   // -1 = มากไปน้อย
  var nextAt = 0, tickTimer = null;

  var TOPN = 20;
  var TZ = "Asia/Bangkok";

  var GRP = {
    th:          { n: "หุ้นไทย (SET)",     i: "🇹🇭", alt: "stocks" },
    global:      { n: "หุ้นต่างประเทศ",    i: "🌍",  alt: "stocks" },
    energy:      { n: "พลังงาน",           i: "⚡",  alt: null },
    crypto:      { n: "คริปโตเคอร์เรนซี",  i: "₿",   alt: null },
    commodities: { n: "สินค้าโภคภัณฑ์",    i: "🛢️", alt: null },
    currencies:  { n: "สกุลเงิน / Forex",  i: "💱",  alt: null },
    aifunds:     { n: "กองทุน AI (ETF)",   i: "🤖",  alt: null }
  };
  var TF  = { daily: "รายวัน", weekly: "รายสัปดาห์", monthly: "รายเดือน", yearly: "รายปี" };
  var TFS = { daily: "1 วัน", weekly: "1 สัปดาห์", monthly: "1 เดือน", yearly: "1 ปี" };
  var STOCKISH = ["th", "global", "energy", "aifunds"];

  /* ... เพิ่มตัวแปรด้านบน ... */
var PAGE = 0;
var PER_PAGE = 10;

/* ... ใน render() แก้ส่วนสรุป ... */
function render() {
    // ... (โค้ดคัดแยก Gainers/Losers เหมือนเดิม) ...
    
    // แทนที่ส่วนการสร้าง html ด้วยฟังก์ชันใหม่
    $("scanBody").innerHTML = renderPage("Gainers", "p-gain", gain) + renderPage("Losers", "p-lose", lose);
}

function renderPage(pill, cls, list) {
    var total = Math.ceil(list.length / PER_PAGE);
    var paged = list.slice(PAGE * PER_PAGE, (PAGE + 1) * PER_PAGE);
    
    // ... (ส่วนสร้างตารางเดิม ให้ใช้ paged แทน list) ...
    // เพิ่มปุ่มเปลี่ยนหน้า
    var nav = '<div class="pg-nav"><button onclick="window.SCAN.prev()">◀</button><span>' + 
              (PAGE+1) + '/' + total + '</span><button onclick="window.SCAN.next()">▶</button></div>';
    return block(...) + nav;
}

/* เพิ่มฟังก์ชันให้ window.SCAN */
window.SCAN = { 
    load: load,
    next: function() { PAGE++; render(); },
    prev: function() { if(PAGE>0) PAGE--; render(); }
};

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function fmtNum(v, dp) {
    if (v === null || v === undefined || v === "" || isNaN(v)) return null;
    return Number(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  function fmtBig(v) {
    if (v === null || v === undefined || isNaN(v) || v === 0) return null;
    var a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(2) + "T";
    if (a >= 1e9)  return (v / 1e9).toFixed(2)  + "B";
    if (a >= 1e6)  return (v / 1e6).toFixed(2)  + "M";
    if (a >= 1e3)  return (v / 1e3).toFixed(2)  + "K";
    return Number(v).toFixed(0);
  }

  function na(t) { return t === null ? '<span class="na">N/A</span>' : t; }

  /* ================= RANKING SCORE ================= */
  /* รวม 5 ปัจจัย: RSI 25 / สัญญาณ 25 / มูลค่าตลาด 20 / P/E 15 / Volume 15 */
  function buildCtx(list) {
    var maxCap = 0, maxVol = 0;
    for (var i = 0; i < list.length; i++) {
      var c = list[i].cap, v = list[i].vol;
      if (c && c > maxCap) maxCap = c;
      if (v && v > maxVol) maxVol = v;
    }
    return { lc: maxCap > 0 ? Math.log10(maxCap) : 0, lv: maxVol > 0 ? Math.log10(maxVol) : 0 };
  }

  function calcScore(r, ctx) {
    var sum = 0, wt = 0;

    // 1) RSI — โซน 45-65 ดีที่สุด
    if (r.rsi !== null && r.rsi !== undefined) {
      var v;
      if (r.rsi >= 45 && r.rsi <= 65) v = 100;
      else if (r.rsi < 45) v = Math.max(5, 100 - (45 - r.rsi) * 2.0);
      else v = Math.max(5, 100 - (r.rsi - 65) * 2.6);
      sum += v * 25; wt += 25;
    }

    // 2) สัญญาณ MA + Volume spike
    var sg = 50;
    if (r.ma === "golden") sg = 95;
    else if (r.ma === "up50") sg = 75;
    else if (r.ma === "dn50") sg = 35;
    else if (r.ma === "death") sg = 15;
    if (r.vs) { if (r.vs >= 2) sg += 15; else if (r.vs >= 1.3) sg += 7; }
    sum += Math.min(100, sg) * 25; wt += 25;

    // 3) มูลค่าตลาด — log scale ยิ่งใหญ่ยิ่งมั่นคง
    if (r.cap && ctx.lc > 0) {
      var pc = Math.max(0, Math.min(100, (Math.log10(r.cap) / ctx.lc) * 100));
      sum += pc * 20; wt += 20;
    }

    // 4) P/E — โซน 8-20 คุ้มค่าที่สุด
    if (r.pe && r.pe > 0) {
      var pe;
      if (r.pe >= 8 && r.pe <= 20) pe = 100;
      else if (r.pe < 8) pe = 70;
      else pe = Math.max(10, 100 - (r.pe - 20) * 2.2);
      sum += pe * 15; wt += 15;
    }

    // 5) สภาพคล่อง
    if (r.vol && ctx.lv > 0) {
      var pv = Math.max(0, Math.min(100, (Math.log10(r.vol) / ctx.lv) * 100));
      sum += pv * 15; wt += 15;
    }

    return wt > 0 ? Math.round(sum / wt) : null;
  }

  function scoreHTML(sc) {
    if (sc === null) return '<span class="na">-</span>';
    var cls = sc >= 75 ? "sc-a" : sc >= 60 ? "sc-b" : sc >= 45 ? "sc-c" : "sc-d";
    return '<span class="scw"><span class="scb ' + cls + '">' + sc + '</span>' +
           '<span class="scbar"><i class="' + cls + '" style="width:' + sc + '%"></i></span></span>';
  }

  /* ================= cells ================= */
  function rowClass(p) {
    if (p === null || p === undefined || isNaN(p)) return "";
    var a = Math.abs(p);
    var lv = a >= 5 ? 3 : a >= 2 ? 2 : a > 0 ? 1 : 0;
    return lv ? "r-" + (p > 0 ? "u" : "d") + lv : "";
  }

  function pctHTML(p, maxAbs) {
    if (p === null || p === undefined || isNaN(p)) return '<span class="na">N/A</span>';
    var cls = p > 0 ? "up" : p < 0 ? "down" : "dim";
    var w = maxAbs > 0 ? Math.min(100, Math.abs(p) / maxAbs * 100) : 0;
    return '<span class="pcell"><span class="pc ' + cls + '">' + (p > 0 ? "+" : "") +
      Number(p).toFixed(2) + '%</span><span class="pbar"><i class="' + (p > 0 ? "u" : "d") +
      '" style="width:' + w.toFixed(1) + '%"></i></span></span>';
  }

  function chgHTML(c, dp) {
    if (c === null || c === undefined || isNaN(c)) return '<span class="na">N/A</span>';
    var cls = c > 0 ? "up" : c < 0 ? "down" : "dim";
    return '<span class="chgv ' + cls + '">' + (c > 0 ? "+" : "") + fmtNum(c, dp) + "</span>";
  }

  function rsiHTML(r) {
    if (r === null || r === undefined || isNaN(r)) return '<span class="na">-</span>';
    var cls = r >= 70 ? "b-ob" : r <= 30 ? "b-os" : "b-nu";
    return '<span class="bdg ' + cls + '">' + Number(r).toFixed(0) + "</span>";
  }

  function sigHTML(r) {
    var o = [];
    if (r.ma === "golden") o.push('<span class="bdg b-gc">Golden</span>');
    else if (r.ma === "death") o.push('<span class="bdg b-dc">Death</span>');
    else if (r.ma === "up50") o.push('<span class="bdg b-u50">&gt;MA50</span>');
    else if (r.ma === "dn50") o.push('<span class="bdg b-d50">&lt;MA50</span>');
    if (r.vs && r.vs >= 2) o.push('<span class="bdg b-vs">Vol x' + Number(r.vs).toFixed(1) + "</span>");
    if (r.rsi !== null && r.rsi !== undefined) {
      if (r.rsi >= 70) o.push('<span class="bdg b-ob">OB</span>');
      else if (r.rsi <= 30) o.push('<span class="bdg b-os">OS</span>');
    }
    return o.length ? '<span class="sigs">' + o.join("") + "</span>" : '<span class="na">-</span>';
  }

  /* ================= data ================= */
  function bucket() {
    if (!DATA || !DATA.groups) return null;
    var g = DATA.groups[S.grp];
    if (!g && GRP[S.grp].alt) g = DATA.groups[GRP[S.grp].alt];
    return g || null;
  }

  function getRows() {
    var g = bucket();
    var list = (g && g[S.tf]) ? g[S.tf].slice() : [];
    if (S.q) {
      var q = S.q;
      list = list.filter(function (r) {
        return (r.name || "").toLowerCase().indexOf(q) > -1 ||
               (r.sym  || "").toLowerCase().indexOf(q) > -1;
      });
    }
    var ctx = buildCtx(list);
    for (var i = 0; i < list.length; i++) list[i]._sc = calcScore(list[i], ctx);
    return list;
  }

  function sortList(list) {
    var k = SORT.key, d = SORT.dir;
    return list.sort(function (a, b) {
      var x, y;
      if (k === "name") {
        x = (a.name || a.sym || "").toLowerCase();
        y = (b.name || b.sym || "").toLowerCase();
        return x < y ? -d : x > y ? d : 0;
      }
      if (k === "sig") { x = a.ma === "golden" ? 3 : a.ma === "up50" ? 2 : a.ma === "dn50" ? 1 : 0;
                         y = b.ma === "golden" ? 3 : b.ma === "up50" ? 2 : b.ma === "dn50" ? 1 : 0; }
      else { x = a[k]; y = b[k]; }
      var nx = (x === null || x === undefined || isNaN(x));
      var ny = (y === null || y === undefined || isNaN(y));
      if (nx && ny) return 0;
      if (nx) return 1;
      if (ny) return -1;
      return (x - y) * d;
    });
  }

  var COLS = [
    { k: "name",  t: "ชื่อสินทรัพย์", a: "l" },
    { k: "_sc",   t: "Ranking",       a: "c" },
    { k: "price", t: "ราคาล่าสุด",    a: "r" },
    { k: "chg",   t: "",              a: "r" },
    { k: "pct",   t: "",              a: "r" },
    { k: "rsi",   t: "RSI",           a: "c" },
    { k: "sig",   t: "สัญญาณ",        a: "c" },
    { k: "cap",   t: "",              a: "r" },
    { k: "pe",    t: "P/E",           a: "r" },
    { k: "vol",   t: "Volume",        a: "r" }
  ];

  function tableHTML(list, dp, capLabel, maxAbs) {
    var h = '<div class="scroller"><table class="dt"><thead><tr>';
    for (var c = 0; c < COLS.length; c++) {
      var col = COLS[c];
      var label = col.t ||
        (col.k === "chg" ? "ผลต่าง " + TFS[S.tf] :
         col.k === "pct" ? "% " + TF[S.tf] : capLabel);
      var on = SORT.key === col.k ? " sorted" : "";
      var arrow = SORT.key === col.k ? (SORT.dir === -1 ? " ▼" : " ▲") : " ⇅";
      h += '<th class="sortable ta-' + col.a + on + '" data-k="' + col.k + '">' +
           esc(label) + '<span class="sar">' + arrow + "</span></th>";
    }
    h += "</tr></thead><tbody>";

    if (!list.length) {
      h += '<tr><td colspan="10" class="dim" style="text-align:center;padding:34px">ไม่พบข้อมูล</td></tr>';
    }

    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var rk = i === 0 ? " rk1" : i === 1 ? " rk2" : i === 2 ? " rk3" : "";
      h += '<tr class="' + rowClass(r.pct) + '">' +
        '<td><span class="rk' + rk + '">' + (i + 1) + '</span><span class="nm"><b>' +
          esc(r.name || r.sym) + "</b><i>" + esc(r.sym) + "</i></span></td>" +
        '<td class="ta-c">' + scoreHTML(r._sc) + "</td>" +
        "<td>" + na(fmtNum(r.price, dp)) + "</td>" +
        "<td>" + chgHTML(r.chg, dp) + "</td>" +
        "<td>" + pctHTML(r.pct, maxAbs) + "</td>" +
        '<td class="ta-c">' + rsiHTML(r.rsi) + "</td>" +
        '<td class="ta-c">' + sigHTML(r) + "</td>" +
        "<td>" + na(fmtBig(r.cap)) + "</td>" +
        "<td>" + na(r.pe ? Number(r.pe).toFixed(2) : null) + "</td>" +
        "<td>" + na(fmtBig(r.vol)) + "</td></tr>";
    }
    return h + "</tbody></table></div>";
  }

  function cardsHTML(list, dp, capLabel, maxAbs) {
    if (!list.length) return '<div class="card empty">ไม่พบข้อมูล</div>';
    var h = '<div class="mcards">';
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var rk = i === 0 ? " rk1" : i === 1 ? " rk2" : i === 2 ? " rk3" : "";
      h += '<article class="mc ' + rowClass(r.pct) + '">' +
        '<div class="mc-h"><span class="rk' + rk + '">' + (i + 1) + "</span>" +
          '<div class="mc-t"><b>' + esc(r.name || r.sym) + "</b><i>" + esc(r.sym) + "</i></div>" +
          '<div class="mc-p">' + na(fmtNum(r.price, dp)) + "</div></div>" +
        '<div class="mc-rank"><span>Ranking</span>' + scoreHTML(r._sc) + "</div>" +
        '<div class="mc-b">' +
          '<div class="mcell"><span>ผลต่าง ' + TFS[S.tf] + "</span>" + chgHTML(r.chg, dp) + "</div>" +
          '<div class="mcell"><span>% ' + TF[S.tf] + "</span>" + pctHTML(r.pct, maxAbs) + "</div>" +
          '<div class="mcell"><span>RSI</span>' + rsiHTML(r.rsi) + "</div>" +
          '<div class="mcell"><span>' + capLabel + "</span><b>" + na(fmtBig(r.cap)) + "</b></div>" +
          '<div class="mcell"><span>P/E</span><b>' + na(r.pe ? Number(r.pe).toFixed(2) : null) + "</b></div>" +
          '<div class="mcell"><span>Volume</span><b>' + na(fmtBig(r.vol)) + "</b></div>" +
        "</div>" +
        '<div class="mc-s">' + sigHTML(r) + "</div></article>";
    }
    return h + "</div>";
  }

  function block(pill, cls, list) {
    var g = GRP[S.grp];
    var dp = S.grp === "currencies" ? 4 : 2;
    var capLabel = STOCKISH.indexOf(S.grp) > -1 ? "มูลค่าตลาด" : "มูลค่าซื้อขาย";

    var maxAbs = 0;
    for (var m = 0; m < list.length; m++) {
      var v = Math.abs(list[m].pct || 0);
      if (v > maxAbs) maxAbs = v;
    }
    sortList(list);

    return '<div class="tblwrap"><div class="tblhead">' +
      "<h3>" + g.i + " " + g.n + " • " + TF[S.tf] + "</h3>" +
      '<span class="pill ' + cls + '">' + pill + "</span>" +
      '<span class="dim sm">' + list.length + " รายการ</span></div>" +
      '<div class="onlybig">' + tableHTML(list, dp, capLabel, maxAbs) + "</div>" +
      '<div class="onlysmall">' + cardsHTML(list, dp, capLabel, maxAbs) + "</div></div>";
  }

  function render() {
    if (!DATA) return;
    $("pgScan").setAttribute("data-grp", S.grp);

    var all = getRows();
    var wp = all.filter(function (r) {
      return r.pct !== null && r.pct !== undefined && !isNaN(r.pct);
    });

    var up = 0, dn = 0;
    for (var i = 0; i < wp.length; i++) {
      if (wp[i].pct > 0) up++; else if (wp[i].pct < 0) dn++;
    }
    $("sUp").textContent = up;
    $("sDn").textContent = dn;

    wp.sort(function (a, b) { return b.pct - a.pct; });
    var gain = wp.slice(0, TOPN);
    var lose = wp.slice(-TOPN).sort(function (a, b) { return a.pct - b.pct; });

    var html = "";
    if (S.side !== "lose") html += block("▲ Top " + TOPN + " Gainers", "p-gain", gain);
    if (S.side !== "gain") html += block("▼ Top " + TOPN + " Losers", "p-lose", lose);

    $("scanBody").innerHTML = html || '<div class="card empty">ไม่มีข้อมูล</div>';
    S._count = all.length;
    updateStatus();
  }

  /* ================= เวลา ================= */
  function nextSlot() {
    var d = new Date();
    d.setSeconds(30, 0);
    d.setMinutes((Math.floor(d.getMinutes() / 15) + 1) * 15);
    return d.getTime();
  }

  function updateStatus() {
    var left = Math.max(0, nextAt - Date.now());
    var mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
    var slot = new Date(nextAt);
    var txt = "• " + (S._count || 0) + " รายการ | รอบถัดไป " +
      pad(slot.getHours()) + ":" + pad(slot.getMinutes()) + " (อีก " + pad(mm) + ":" + pad(ss) + ")";

    if (DATA && DATA.updated) {
      var age = Math.floor((Date.now() - new Date(DATA.updated).getTime()) / 60000);
      if (age > 45) txt += '  ⚠️ ข้อมูลเก่า ' + age + ' นาที';
    }
    $("sStatus").textContent = txt;
  }

  function scheduleNext() {
    nextAt = nextSlot();
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(function () {
      if (Date.now() >= nextAt) load(); else updateStatus();
    }, 1000);
    updateStatus();
  }

  function load() {
    $("sStatus").textContent = "กำลังโหลด...";
    fetch("data/scan.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        DATA = j;
        $("sUpd").textContent = new Date(j.updated).toLocaleString("th-TH",
          { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
        $("sCnt").textContent = j.total || "--";
        render();
        scheduleNext();
      })
      .catch(function (e) {
        $("scanBody").innerHTML = '<div class="card empty"><span class="down">โหลดข้อมูลไม่ได้ — ' +
          esc(e.message) + '</span></div>';
        $("sStatus").textContent = "ผิดพลาด • ลองใหม่ใน 1 นาที";
        setTimeout(load, 60000);
      });
  }

  /* ================= events ================= */
  var segs = document.querySelectorAll(".seg[data-sgroup]");
  for (var i = 0; i < segs.length; i++) {
    (function (seg) {
      seg.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        var v = btn.getAttribute("data-v");
        if (!v) return;
        S[seg.getAttribute("data-sgroup")] = v;
        var b = seg.querySelectorAll("button");
        for (var k = 0; k < b.length; k++) b[k].className = b[k].getAttribute("data-v") === v ? "on" : "";
        btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        render();
      });
    })(segs[i]);
  }

  /* คลิกหัวตารางเพื่อเรียง */
  $("scanBody").addEventListener("click", function (e) {
    var th = e.target.closest("th.sortable");
    if (!th) return;
    var k = th.getAttribute("data-k");
    if (SORT.key === k) SORT.dir = -SORT.dir;
    else { SORT.key = k; SORT.dir = (k === "name") ? 1 : -1; }
    render();
  });

  var t;
  $("sq").addEventListener("input", function (e) {
    clearTimeout(t);
    var v = e.target.value.trim().toLowerCase();
    t = setTimeout(function () { S.q = v; render(); }, 220);
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && nextAt && Date.now() >= nextAt) load();
  });

  window.SCAN = { load: load };
  load();
})();
