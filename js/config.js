/* ===== ตั้งค่าทั้งหมดอยู่ที่นี่ ===== */
var CONFIG = {
  FF_URL: "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  GOLD_URL: "https://api.gold-api.com/price/XAU",

  // ใส่ URL Cloudflare Worker ของคุณตรงนี้ (ถ้ามี) แล้วมันจะถูกใช้เป็นตัวแรก
  MY_WORKER: "",

  PROXY_TIMEOUT: 10000,   // หมดเวลาต่อ proxy 1 ตัว (ms)
  GOLD_TIMEOUT: 8000,
  REFRESH_MS: 180000,     // auto refresh ทุก 3 นาที
  CACHE_KEY: "gbr_cache_v1"
};

/* proxy เรียงตามลำดับที่จะลอง */
var PROXIES = [
  { name: "codetabs",       wrap: false, url: function(u){ return "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u); } },
  { name: "allorigins-raw", wrap: false, url: function(u){ return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); } },
  { name: "allorigins-get", wrap: true,  url: function(u){ return "https://api.allorigins.win/get?url=" + encodeURIComponent(u); } },
  { name: "cors-x2u",       wrap: false, url: function(u){ return "https://cors.x2u.in/" + u; } },
  { name: "corsfix",        wrap: false, url: function(u){ return "https://proxy.corsfix.com/?" + u; } },
  { name: "corsproxy-io",   wrap: false, url: function(u){ return "https://corsproxy.io/?url=" + encodeURIComponent(u); } },
  { name: "thingproxy",     wrap: false, url: function(u){ return "https://thingproxy.freeboard.io/fetch/" + u; } }
];

/* น้ำหนักตามความแรงข่าว */
var WEIGHT = { High: 3, Medium: 1.5, Low: 0.5, Holiday: 0 };

/* ทิศทางผลต่อทอง: USD แข็ง = ทองลง จึงเป็นลบ */
var CCY_DIR = { USD: -1, EUR: 0.4, GBP: 0.3, CHF: 0.3, JPY: 0.2, CNY: 0.2 };

/* ข่าวที่ "ตัวเลขสูง = แย่" ต้องกลับเครื่องหมาย */
var INVERSE_RE = /unemploy|jobless|claims|deficit|inventor|delinquen/i;

var IMPACT_COLOR = { High:"#ef5350", Medium:"#ffa726", Low:"#ffd54f", Holiday:"#8b98a9" };
