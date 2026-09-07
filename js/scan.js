/* ===== Scan สินทรัพย์ 7 กลุ่ม x 4 TF + สัญญาณเทคนิค ===== */
(function () {

  var DATA = null;
  var S = { grp: "th", tf: "daily", side: "both", q: "" };

  var GRP = {
    th:          { n: "หุ้นไทย (SET)",     i: "🇹🇭", alt: "stocks" },
    global:      { n: "หุ้นต่างประเทศ",    i: "🌍",  alt: "stocks" },
    energy:      { n: "พลังงาน",           i: "⚡",  alt: null },
    crypto:      { n: "คริปโตเคอร์เรนซี",  i: "₿",   alt: null },
    commodities: { n: "สินค้าโภคภัณฑ์",    i: "🛢️", alt: null },
    currencies:  { n: "สกุลเงิน / Forex",  i: "💱",  alt: null },
    aifunds:     { n: "กองทุน AI (ETF)",   i: "🤖",  alt: null }
  };
  var TF = { daily: "รายวัน", weekly: "รายสัปดาห์", monthly: "รายเดือน", yearly: "รายปี" };
  var TFSHORT = { daily: "1 วัน", weekly: "1 สัปดาห์", monthly: "1 เดือน", yearly: "1 ปี" };

  function $(id) { return document.getElementById(id); }
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
    if (a >= 1e12) return (v / 1e12).toFixed(2) + " ล้านล้าน";
    if (a >= 1e9)  return (v / 1e9).toFixed(2)  + " พันล้าน";
    if (a >= 1e6)  return (v / 1e6).toFixed(2)  + " ล้าน";
    if (a >= 1e3)  return (v / 1e3).toFixed(2)  + " พัน";
    return Number(v).toFixed(0);
  }

  function na(t) { return t === null ? '<span class="na">N/A</span>' : t; }

  function rowClass(p) {
    if (p === null || p === undefined || isNaN(p)) return "";
    var a = Math.abs(p);
    var lv = a >= 5 ? 3 : a >= 2 ? 2 : a > 0 ? 1 : 0;
    if (!lv) return "";
    return "r-" + (p > 0 ? "u" : "d") + lv;
  }

  function pctCell(p, maxAbs) {
    if (p === null || p === undefined || isNaN(p)) return '<span class="na">N/A</span>';
    var cls = p > 0 ? "up" : p < 0 ? "down" : "dim";
    var sign = p > 0 ? "+" : "";
    var w = maxAbs > 0 ? Math.min(100, Math.abs(p) / maxAbs * 100) : 0;
    return '<span class="pcell"><span class="pc ' + cls + '">' + sign + Number(p).toFixed(2) + "%</span>" +
      '<span class="pbar"><i class="' + (p > 0 ? "u" : "d") + '" style="width:' + w.toFixed(1) + '%"></i></span></span>';
  }

  function chgCell(c, dp) {
    if (c === null || c === undefined || isNaN(c)) return '<span class="na">N/A</span>';
    var cls = c > 0 ? "up" : c < 0 ? "down" : "dim";
    return '<span class="chgv ' + cls + '">' + (c > 0 ? "+" : "") + fmtNum(c, dp) + "</span>";
  }

  function rsiCell(r) {
    if (r === null || r === undefined || isNaN(r)) return '<span class="na">-</span>';
    var cls = r >= 70 ? "b-ob" : r <= 30 ? "b-os" : "b-nu";
    return '<span class="bdg ' + cls + '">' + Number(r).toFixed(0) + "</span>";
  }

  function sigCell(r) {
    var out = [];
    if (r.ma === "golden") out.push('<span class="bdg b-gc">Golden</span>');
    else if (r.ma === "death") out.push('<span class="bdg b-dc">Death</span>');
    else if (r.ma === "up50") out.push('<span class="bdg b-u50">&gt;MA50</span>');
    else if (r.ma === "dn50") out.push('<span class="bdg b-d50">&lt;MA50</span>');

    if (r.vs && r.vs >= 2) out.push('<span class="bdg b-vs">Vol x' + Number(r.vs).toFixed(1) + "</span>");
    if (r.rsi !== null && r.rsi !== undefined) {
      if (r.rsi >= 70) out.push('<span class="bdg b-ob">OB</span>');
      else if (r.rsi <= 30) out.push('<span class="bdg b-os">OS</span>');
    }
    return out.length ? '<span class="sigs">' + out.join("") + "</span>" : '<span class="na">-</span>';
  }

  function bucket() {
    if (!DATA || !DATA.groups) return null;
    var g = DATA.groups[S.grp];
    if (!g && GRP[S.grp].alt) g = DATA.groups[GRP[S.grp].alt];   // รองรับไฟล์เก่า
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
    return list;
  }

  function table(list) {
    var dp = S.grp === "currencies" ? 4 : 2;
    var stockish = (S.grp === "th" || S.grp === "global" || S.grp === "energy" || S.grp === "aifunds");
    var capLabel = stockish ? "มูลค่าตลาด" : "มูลค่าซื้อขาย";

    var maxAbs = 0;
    for (var m = 0; m < list.length; m++) {
      var v = Math.abs(list[m].pct || 0);
      if (v > maxAbs) maxAbs = v;
    }

    var h = '<div class="scroller"><table class="dt"><thead><tr>' +
      "<th>ชื่อสินทรัพย์</th>" +
      "<th>ราคาล่าสุด</th>" +
      "<th>ผลต่าง " + TFSHORT[S.tf] + "</th>" +
      "<th>% " + TF[S.tf] + "</th>" +
      "<th>RSI</th>" +
      "<th>สัญญาณเทคนิค</th>" +
      "<th>" + capLabel + "</th>" +
      "<th>P/E</th>" +
      "<th>ปริมาณซื้อขาย</th>" +
      "</tr></thead><tbody>";

    if (!list.length) {
      h += '<tr><td colspan="9" style="text-align:center;padding:34px" class="dim">' +
           "ไม่พบข้อมูลกลุ่มนี้ — หากเพิ่งอัปโค้ด ให้รัน GitHub Actions ใหม่</td></tr>";
    }

    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var rk = i === 0 ? " rk1" : i === 1 ? " rk2" : i === 2 ? " rk3" : "";
      h += '<tr class="' + rowClass(r.pct) + '">' +
        '<td><span class="rk' + rk + '">' + (i + 1) + "</span>" +
          '<span class="nm"><b>' + esc(r.name || r.sym) + "</b><i>" + esc(r.sym) + "</i></span></td>" +
        "<td>" + na(fmtNum(r.price, dp)) + "</td>" +
        "<td>" + chgCell(r.chg, dp) + "</td>" +
        "<td>" + pctCell(r.pct, maxAbs) + "</td>" +
        "<td>" + rsiCell(r.rsi) + "</td>" +
        "<td>" + sigCell(r) + "</td>" +
        "<td>" + na(fmtBig(r.cap)) + "</td>" +
        "<td>" + na(r.pe ? Number(r.pe).toFixed(2) : null) + "</td>" +
        "<td>" + na(fmtBig(r.vol)) + "</td>" +
        "</tr>";
    }
    return h + "</tbody></table></div>";
  }

  function block(pill, cls, list) {
    var g = GRP[S.grp];
    return '<div class="tblwrap"><div class="tblhead">' +
      "<h3>" + g.i + " " + g.n + " • " + TF[S.tf] + "</h3>" +
      '<span class="pill ' + cls + '">' + pill + "</span>" +
      '<span class="dim sm">' + list.length + " รายการ</span></div>" +
      table(list) + "</div>";
  }

  function render() {
    if (!DATA) return;
    $("pgScan").setAttribute("data-grp", S.grp);

    var all = getRows();
    var wp = all.filter(function (r) {
      return r.pct !== null && r.pct !== undefined && !isNaN(r.pct);
    });
    wp.sort(function (a, b) { return b.pct - a.pct; });

    var gainers = wp.slice(0, 10);
    var losers = wp.slice(-10);
    losers.sort(function (a, b) { return a.pct - b.pct; });

    var up = 0, dn = 0;
    for (var i = 0; i < wp.length; i++) {
      if (wp[i].pct > 0) up++; else if (wp[i].pct < 0) dn++;
    }
    $("sUp").textContent = up;
    $("sDn").textContent = dn;

    var html = "";
    if (S.side !== "lose") html += block("▲ Top 10 Gainers", "p-gain", gainers);
    if (S.side !== "gain") html += block("▼ Top 10 Losers", "p-lose", losers);

    $("scanBody").innerHTML = html || '<div class="card empty">ไม่มีข้อมูล</div>';
    $("sStatus").textContent = "• กลุ่มนี้ " + all.length + " รายการ";
  }

  function load() {
    $("sStatus").textContent = "กำลังโหลด...";
    fetch("data/scan.json?t=" + Date.now())
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        DATA = j;
        $("sUpd").textContent = new Date(j.updated).toLocaleString("th-TH",
          { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
        $("sCnt").textContent = j.total || "--";
        render();
      })
      .catch(function (e) {
        $("scanBody").innerHTML = '<div class="card empty"><span class="down">โหลดข้อมูลไม่ได้ — ' +
          esc(e.message) + '</span><br><span class="sm dim">ตรวจว่า GitHub Actions สร้าง data/scan.json แล้วหรือยัง</span></div>';
        $("sStatus").textContent = "ผิดพลาด";
      });
  }

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
        for (var k = 0; k < b.length; k++) {
          b[k].className = b[k].getAttribute("data-v") === v ? "on" : "";
        }
        render();
      });
    })(segs[i]);
  }

  var t;
  $("sq").addEventListener("input", function (e) {
    clearTimeout(t);
    var v = e.target.value.trim().toLowerCase();
    t = setTimeout(function () { S.q = v; render(); }, 220);
  });

  window.SCAN = { load: load };
  load();
  setInterval(load, 5 * 60 * 1000);
})();
