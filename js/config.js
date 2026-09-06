/* ===== ตั้งค่าทั้งหมดอยู่ที่นี่ ===== */
var CONFIG = {
  FF_URL: "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  GOLD_URL: "https://api.gold-api.com/price/XAU",
  MY_WORKER: "",            // ใส่ URL Cloudflare Worker ถ้ามี จะถูกใช้เป็นตัวแรก
  PROXY_TIMEOUT: 10000,
  GOLD_TIMEOUT: 8000,
  REFRESH_MS: 180000,
  CACHE_KEY: "gbr_cache_v2",
  SENSITIVITY: 3            // ยิ่งสูง ยิ่งแกว่ง % แรง
};

var PROXIES = [
  { name: "codetabs",       wrap: false, url: function(u){ return "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u); } },
  { name: "allorigins-raw", wrap: false, url: function(u){ return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); } },
  { name: "allorigins-get", wrap: true,  url: function(u){ return "https://api.allorigins.win/get?url=" + encodeURIComponent(u); } },
  { name: "cors-x2u",       wrap: false, url: function(u){ return "https://cors.x2u.in/" + u; } },
  { name: "corsproxy-io",   wrap: false, url: function(u){ return "https://corsproxy.io/?url=" + encodeURIComponent(u); } },
  { name: "thingproxy",     wrap: false, url: function(u){ return "https://thingproxy.freeboard.io/fetch/" + u; } }
];

/* น้ำหนักความแรง (ใช้ key ตัวพิมพ์เล็ก) */
var WEIGHT = { high: 3, medium: 1.5, low: 0.5, holiday: 0 };

/* ทิศทางต่อทอง: USD แข็ง = ทองลง จึงติดลบ */
var CCY_DIR = { USD: -1, EUR: 0.4, GBP: 0.3, CHF: 0.3, JPY: 0.2, CNY: 0.2 };

/* ข่าวที่ "ตัวเลขสูง = แย่" ต้องกลับเครื่องหมาย */
var INVERSE_RE = /unemploy|jobless|claims|deficit|inventor|delinquen/i;

var IMPACT_COLOR = { high:"#ef5350", medium:"#ffa726", low:"#ffd54f", holiday:"#8b98a9" };