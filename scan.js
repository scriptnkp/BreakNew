/* ===== Scan หุ้น — โหลดและแสดงผลตาราง ===== */
(function () {

  var DATA = null;
  var S = { grp: "stocks", tf: "daily", side: "both", q: "" };

  var GRP_TH = { stocks:"หุ้น (ไทย + ต่างประเทศ)", commodities:"สินค้าโภคภัณฑ์",
                 currencies:"สกุลเงิน / Forex", aifunds:"กองทุน AI (ETF)" };
  var TF_TH  = { daily:"รายวัน", weekly:"รายสัปดาห์", monthly:"รายเดือน", yearly:"รายปี" };

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  function fmtNum(v, dp){
    if (v === null || v === undefined || v === "" || isNaN(v)) return null;
    return Number(v).toLocaleString("en-US",{minimumFractionDigits:dp,maximumFractionDigits:dp});
  }
  function fmtBig(v){
    if (v === null || v === undefined || isNaN(v) || v === 0) return null;
    var a = Math.abs(v);
    if (a >= 1e12) return (v/1e12).toFixed(2) + " ล้านล้าน";
    if (a >= 1e9)  return (v/1e9).toFixed(2) + " พันล้าน";
    if (a >= 1e6)  return (v/1e6).toFixed(2) + " ล้าน";
    if (a >= 1e3)  return (v/1e3).toFixed(2) + " พัน";
    return String(v);
  }
  function na(txt){ return txt === null ? '<span class="na">N/A</span>' : txt; }

  function pctCell(p){
    if (p === null || p === undefined || isNaN(p)) return '<span class="na">N/A</span>';
    var c = p > 0 ? "up" : p < 0 ? "down" : "dim";
    var s = p > 0 ? "+" : "";
    return '<span class="pc ' + c + '">' + s + Number(p).toFixed(2) + "%</span>";
  }
  function chgCell(c, dp){
    if (c === null || c === undefined || isNaN(c)) return '<span class="na">N/A</span>';
    var cl = c > 0 ? "up" : c < 0 ? "down" : "dim";
    var s = c > 0 ? "+" : "";
    return '<span class="' + cl + '">' + s + fmtNum(c, dp) + "</span>";
  }

  function rows(){
    var g = DATA && DATA.groups && DATA.groups[S.grp];
    var list = (g && g[S.tf]) ? g[S.tf].slice() : [];
    if (S.q) {
      var q = S.q;
      list = list.filter(function(r){
        return (r.name||"").toLowerCase().indexOf(q) > -1 ||
               (r.sym||"").toLowerCase().indexOf(q) > -1;
      });
    }
    return list;
  }

  function table(list, mode){
    var dp = S.grp === "currencies" ? 4 : 2;
    var capLabel = (S.grp === "stocks" || S.grp === "aifunds") ? "มูลค่าตลาด" : "มูลค่าซื้อขาย";

    var h = '<div class="scroller"><table class="dt"><thead><tr>' +
      "<th>ชื่อสินทรัพย์</th><th>ราคาล่าสุด</th><th>ผลต่าง 1 วัน</th>" +
      "<th>% " + TF_TH[S.tf] + "</th><th>" + capLabel + "</th><th>P/E</th><th>ปริมาณซื้อขาย</th>" +
      "</tr></thead><tbody>";

    if (!list.length) {
      h += '<tr><td colspan="7" style="text-align:center;padding:30px" class="dim">ไม่พบข้อมูล</td></tr>';
    }

    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      h += "<tr>" +
        '<td><span class="rk' + (i < 3 ? " top" : "") + '">' + (i+1) + "</span>" +
          '<span class="nm"><b>' + esc(r.name || r.sym) + "</b><i>" + esc(r.sym) + "</i></span></td>" +
        "<td>" + na(fmtNum(r.price, dp)) + "</td>" +
        "<td>" + chgCell(r.chg, dp) + "</td>" +
        "<td>" + pctCell(r.pct) + "</td>" +
        "<td>" + na(fmtBig(r.cap)) + "</td>" +
        "<td>" + na(r.pe ? Number(r.pe).toFixed(2) : null) + "</td>" +
        "<td>" + na(fmtBig(r.vol)) + "</td>" +
        "</tr>";
    }
    return h + "</tbody></table></div>";
  }

  function block(title, pill, cls, list){
    return '<div class="tblwrap"><div class="tblhead">' +
      "<h3>" + title + '</h3><span class="pill ' + cls + '">' + pill + "</span>" +
      '<span class="dim sm">' + list.length + " รายการ</span></div>" +
      table(list) + "</div>";
  }

  function render(){
    if (!DATA) return;

    var all = rows();
    var withPct = all.filter(function(r){ return r.pct !== null && r.pct !== undefined && !isNaN(r.pct); });
    withPct.sort(function(a,b){ return b.pct - a.pct; });

    var gainers = withPct.slice(0, 10);
    var losers  = withPct.slice(-10).reverse();   // ลบมากสุด → น้อยสุด
    losers.sort(function(a,b){ return a.pct - b.pct; });

    var base = GRP_TH[S.grp] + " • " + TF_TH[S.tf];
    var html = "";

    if (S.side !== "lose") html += block(base, "▲ Top 10 Gainers", "p-gain", gainers);
    if (S.side !== "gain") html += block(base, "▼ Top 10 Losers", "p-lose", losers);

    $("scanBody").innerHTML = html || '<div class="card empty">ไม่มีข้อมูล</div>';
    $("sStatus").textContent = "• สแกน " + all.length + " รายการ";
  }

  function load(){
    $("sStatus").textContent = "กำลังโหลด...";
    fetch("data/scan.json?t=" + Date.now())
      .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(j){
        DATA = j;
        $("sUpd").textContent = new Date(j.updated).toLocaleString("th-TH",
          { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
        $("sCnt").textContent = j.total || "--";
        render();
      })
      .catch(function(e){
        $("scanBody").innerHTML = '<div class="card empty down">โหลดข้อมูลสแกนไม่ได้ — ' + esc(e.message) +
          '<br><span class="sm dim">ตรวจว่า GitHub Actions สร้าง data/scan.json แล้วหรือยัง</span></div>';
        $("sStatus").textContent = "ผิดพลาด";
      });
  }

  /* ---------- controls ---------- */
  var segs = document.querySelectorAll(".seg[data-sgroup]");
  for (var i = 0; i < segs.length; i++) {
    (function(seg){
      seg.addEventListener("click", function(e){
        var v = e.target.getAttribute("data-v");
        if (!v) return;
        S[seg.getAttribute("data-sgroup")] = v;
        var b = seg.querySelectorAll("button");
        for (var k = 0; k < b.length; k++) b[k].className = b[k].getAttribute("data-v") === v ? "on" : "";
        render();
      });
    })(segs[i]);
  }

  var t;
  $("sq").addEventListener("input", function(e){
    clearTimeout(t);
    var v = e.target.value.trim().toLowerCase();
    t = setTimeout(function(){ S.q = v; render(); }, 220);
  });

  window.SCAN = { load: load };
  load();
  setInterval(load, 5 * 60 * 1000);
})();