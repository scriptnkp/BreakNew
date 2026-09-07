/* ===== ชั้นดึงข้อมูล: ไฟล์ในrepo → proxy → แคช ===== */
var API = (function () {

  function fetchTimeout(url, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(url, { signal: ctrl.signal, cache: "no-store" })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .catch(function (e) {
        clearTimeout(timer);
        throw new Error(e.name === "AbortError" ? "timeout" : e.message);
      });
  }

  function parse(txt, wrap) {
    if (/^\s*</.test(txt)) throw new Error("ได้ HTML (โดน rate limit)");
    var raw = wrap ? JSON.parse(txt).contents : txt;
    var data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error("ไม่ใช่ array");
    if (!data.length) throw new Error("array ว่าง");
    return data;
  }

  function buildList() {
    var list = PROXIES.slice();
    if (CONFIG.MY_WORKER) {
      list.unshift({ name: "myworker", wrap: false, url: function () { return CONFIG.MY_WORKER; } });
    }
    return list;
  }

  /* 1) ลองไฟล์ในrepoก่อน — same-origin ไม่มี CORS */
  function tryLocal(onLog) {
    onLog("→ อ่านไฟล์ในrepo data/calendar.json");
    return fetchTimeout(CONFIG.LOCAL_URL + "?t=" + Date.now(), 8000)
      .then(function (txt) {
        var data = parse(txt, false);
        onLog("✓ ไฟล์ในrepo สำเร็จ " + data.length + " รายการ");
        return { data: data, via: "repo" };
      });
  }

  /* 2) proxy สำรอง */
  function tryProxies(onLog) {
    var list = buildList();
    function step(i) {
      if (i >= list.length) return Promise.reject(new Error("proxy ทุกตัวใช้ไม่ได้"));
      var p = list[i];
      onLog("→ ลอง " + p.name + " (" + (i + 1) + "/" + list.length + ")");
      return fetchTimeout(p.url(CONFIG.FF_URL), CONFIG.PROXY_TIMEOUT)
        .then(function (txt) {
          var data = parse(txt, p.wrap);
          onLog("✓ " + p.name + " สำเร็จ " + data.length + " รายการ");
          return { data: data, via: p.name };
        })
        .catch(function (e) {
          onLog("✗ " + p.name + ": " + e.message);
          return step(i + 1);
        });
    }
    return step(0);
  }

  function getCalendar(onLog) {
    return tryLocal(onLog).catch(function (e) {
      onLog("✗ ไฟล์ในrepo: " + e.message + " → ยังไม่ได้ตั้ง GitHub Actions?");
      return tryProxies(onLog);
    });
  }

  function getGold() {
    return fetchTimeout(CONFIG.GOLD_URL, CONFIG.GOLD_TIMEOUT)
      .then(function (txt) { return JSON.parse(txt); });
  }

  function saveCache(data) {
    try { localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ t: Date.now(), data: data })); } catch (e) {}
  }

  function loadCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY));
      if (c && c.data && Date.now() - c.t < 604800000) return c;
    } catch (e) {}
    return null;
  }

  return { getCalendar: getCalendar, getGold: getGold, saveCache: saveCache, loadCache: loadCache };
})();