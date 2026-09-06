/* ===== ตรรกะหลัก + แสดงผล ===== */
(function () {

  var EVENTS = [];
  var VIEW = "today";
  var LOGS = [];

  function $(id) { return document.getElementById(id); }

  function log(msg) {
    var t = new Date().toLocaleTimeString("th-TH");
    LOGS.unshift("[" + t + "] " + msg);
    if (LOGS.length > 25) LOGS.pop();
    $("log").textContent = LOGS.join("\n");
  }

  function num(s) {
    if (s === null || s === undefined || s === "") return null;
    var m = String(s).replace(/[,%$]/g, "").match(/-?\d+\.?\d*/);
    if (!m) return null;
    var v = parseFloat(m[0]);
    if (/K/i.test(s)) v *= 1e3;
    if (/M/i.test(s)) v *= 1e6;
    if (/B/i.test(s)) v *= 1e9;
    return v;
  }

  function sameDay(a, b) { return a.toDateString() === b.toDateString(); }

  /* ---------- คำนวณคะแนน ---------- */
  function scoreEvent(ev) {
    var a = num(ev.actual);
    var f = num(ev.forecast);
    if (f === null) f = num(ev.previous);
    if (a === null || f === null) return null;

    var diff = a - f;
    if (INVERSE_RE.test(ev.title)) diff = -diff;

    var base = Math.abs(f) || 1;
    var surprise = Math.max(-1, Math.min(1, (diff / base) * 3));

    var dir = CCY_DIR[ev.country];
    if (dir === undefined) return null;

    var w = WEIGHT[ev.impact];
    if (w === undefined) w = 1;

    return surprise * dir * w;
  }

  /* ---------- กรองรายการตามมุมมอง ---------- */
  function filterEvents() {
    var now = new Date();
    var rows = EVENTS.slice();

    if (VIEW === "today") {
      rows = rows.filter(function (e) { return sameDay(new Date(e.date), now); });
    } else if (VIEW === "upcoming") {
      rows = rows.filter(function (e) { return new Date(e.date).getTime() >= now.getTime(); });
    }

    if ($("onlyHigh").checked) rows = rows.filter(function (e) { return e.impact === "High"; });
    if ($("onlyUSD").checked) rows = rows.filter(function (e) { return e.country === "USD" || e.country === "EUR"; });

    rows.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    return rows;
  }

  /* ---------- วาดตาราง ---------- */
  function renderTable(rows) {
    if (!rows.length) {
      $("tbody").innerHTML = '<tr><td colspan="8" class="dim">ไม่มีข่าวตามเงื่อนไข ลองสลับเป็น "ทั้งสัปดาห์" หรือปิดตัวกรอง</td></tr>';
      return;
    }
    var html = "", lastDay = "";
    rows.forEach(function (ev) {
      var d = new Date(ev.date);
      var dayKey = d.toDateString();
      if (dayKey !== lastDay) {
        lastDay = dayKey;
        html += '<tr class="day"><td colspan="8">' +
          d.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short" }) +
          "</td></tr>";
      }
      var s = scoreEvent(ev);
      var eff = '<span class="dim">รอผล</span>';
      if (s !== null) {
        if (s > 0.15) eff = '<span class="up">UP หนุนทอง</span>';
        else if (s < -0.15) eff = '<span class="down">DOWN กดทอง</span>';
        else eff = '<span class="dim">กลาง</span>';
      }
      html += "<tr>" +
        '<td class="dim">' + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + "</td>" +
        "<td><b>" + ev.country + "</b></td>" +
        '<td><span class="dot" style="background:' + (IMPACT_COLOR[ev.impact] || "#8b98a9") + '"></span></td>' +
        "<td>" + ev.title + "</td>" +
        "<td><b>" + (ev.actual || "-") + "</b></td>" +
        '<td class="dim">' + (ev.forecast || "-") + "</td>" +
        '<td class="dim">' + (ev.previous || "-") + "</td>" +
        "<td>" + eff + "</td></tr>";
    });
    $("tbody").innerHTML = html;
  }

  /* ---------- วาดการ์ด Bias ---------- */
  function renderBias(rows) {
    var total = 0, counted = 0;
    rows.forEach(function (ev) {
      var s = scoreEvent(ev);
      if (s !== null) { total += s; counted++; }
    });

    var el = $("bias"), bar = $("gaugeBar");
    if (!counted) {
      el.textContent = "รอข่าว";
      el.className = "big dim";
      $("biasTxt").textContent = "ยังไม่มีผล Actual ในช่วงที่เลือก";
      bar.style.width = "0";
      return;
    }
    var pct = Math.max(-100, Math.min(100, Math.round((total / counted) * 100)));
    el.textContent = pct > 25 ? "ขาขึ้น" : pct < -25 ? "ขาลง" : "ไซด์เวย์";
    el.className = "big " + (pct > 25 ? "up" : pct < -25 ? "down" : "");
    $("biasTxt").textContent = "คะแนน " + pct + " จาก " + counted + " ข่าว";
    bar.style.width = Math.abs(pct) / 2 + "%";
    bar.style.left = (pct >= 0 ? 50 : 50 - Math.abs(pct) / 2) + "%";
    bar.style.background = pct >= 0 ? "#26a69a" : "#ef5350";
  }

  /* ---------- การ์ดข่าวถัดไป ---------- */
  function renderNext() {
    var now = Date.now();
    var pending = EVENTS.filter(function (e) {
      return e.impact === "High" && CCY_DIR[e.country] !== undefined &&
        new Date(e.date).getTime() > now;
    }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });

    $("hiCount").textContent = pending.length;
    if (!pending.length) {
      $("nextEv").textContent = "ไม่มีข่าวแรงสูงเหลือในสัปดาห์นี้";
      return;
    }
    var d = new Date(pending[0].date);
    var hrs = Math.round((d - now) / 3600000);
    $("nextEv").textContent = pending[0].title + " • " +
      d.toLocaleString("th-TH", { weekday: "short", hour: "2-digit", minute: "2-digit" }) +
      " (อีก ~" + hrs + " ชม.)";
  }

  function render() {
    renderTable(filterEvents());
    renderBias(filterEvents());
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
    $("status").textContent = "อัปเดต " + new Date().toLocaleTimeString("th-TH") + " • " + via;

    // ถ้าวันนี้ไม่มีข่าวเลย (เสาร์-อาทิตย์) ให้สลับไปโหมดข่าวถัดไปอัตโนมัติ
    if (VIEW === "today") {
      var today = new Date();
      var has = EVENTS.some(function (e) { return sameDay(new Date(e.date), today); });
      if (!has) {
        log("วันนี้ไม่มีข่าวในปฏิทิน → สลับไปโหมด \"ข่าวถัดไป\"");
        setView("upcoming");
        return;
      }
    }
    render();
  }

  function loadCalendar() {
    API.getCalendar(log)
      .then(function (res) {
        EVENTS = res.data;
        afterLoad("via " + res.via);
      })
      .catch(function (e) {
        log("✗✗ " + e.message);
        var c = API.loadCache();
        if (c) {
          EVENTS = c.data;
          log("ใช้ข้อมูลแคชจาก " + new Date(c.t).toLocaleString("th-TH"));
          afterLoad("แคช");
        } else {
          $("tbody").innerHTML = '<tr><td colspan="8" class="down">ดึงปฏิทินไม่ได้ — แนะนำตั้ง Cloudflare Worker แล้วใส่ URL ใน js/config.js</td></tr>';
          $("status").textContent = "ผิดพลาด";
        }
      });
  }

  function loadAll() {
    $("status").textContent = "กำลังดึงข้อมูล...";
    loadGold();
    loadCalendar();
  }

  /* ---------- ตัวควบคุม ---------- */
  function setView(v) {
    VIEW = v;
    var btns = $("viewSeg").getElementsByTagName("button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = btns[i].getAttribute("data-view") === v ? "on" : "";
    }
    render();
  }

  $("viewSeg").addEventListener("click", function (e) {
    var v = e.target.getAttribute("data-view");
    if (v) setView(v);
  });
  $("btnRefresh").addEventListener("click", loadAll);
  $("onlyHigh").addEventListener("change", render);
  $("onlyUSD").addEventListener("change", render);

  log("เริ่มทำงาน • " + new Date().toLocaleString("th-TH"));
  loadAll();
  setInterval(loadAll, CONFIG.REFRESH_MS);
})();
