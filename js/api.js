/* ===== ชั้นดึงข้อมูล ===== */
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

  function buildList() {
    var list = PROXIES.slice();
    if (CONFIG.MY_WORKER) {
      list.unshift({ name: "myworker", wrap: false, url: function () { return CONFIG.MY_WORKER; } });
    }
    return list;
  }

  function parse(txt, wrap) {
    var raw = wrap ? JSON.parse(txt).contents : txt;
    var data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error("not an array");
    if (!data.length) throw new Error("empty array");
    return data;
  }

  /* ไล่ยิง proxy ทีละตัวจนกว่าจะสำเร็จ */
  function getCalendar(onLog) {
    var list = buildList();

    function step(i) {
      if (i >= list.length) return Promise.reject(new Error("proxy ทุกตัวใช้ไม่ได้"));
      var p = list[i];
      onLog("→ ลอง " + p.name + " (" + (i + 1) + "/" + list.length + ")");
      var t0 = Date.now();
      return fetchTimeout(p.url(CONFIG.FF_URL), CONFIG.PROXY_TIMEOUT)
        .then(function (txt) {
          var data = parse(txt, p.wrap);
          onLog("✓ " + p.name + " สำเร็จ " + data.length + " รายการ (" + (Date.now() - t0) + "ms)");
          return { data: data, via: p.name };
        })
        .catch(function (e) {
          onLog("✗ " + p.name + " ล้มเหลว: " + e.message);
          return step(i + 1);
        });
    }
    return step(0);
  }

  function getGold() {
    return fetchTimeout(CONFIG.GOLD_URL, CONFIG.GOLD_TIMEOUT)
      .then(function (txt) { return JSON.parse(txt); });
  }

  /* แคชไว้ใน localStorage เผื่อ proxy ล่มทั้งหมด */
  function saveCache(data) {
    try {
      localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ t: Date.now(), data: data }));
    } catch (e) {}
  }

  function loadCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY));
      if (c && c.data && Date.now() - c.t < 86400000) return c;
    } catch (e) {}
    return null;
  }

  return { getCalendar: getCalendar, getGold: getGold, saveCache: saveCache, loadCache: loadCache };
})();
