# -*- coding: utf-8 -*-
"""ดึงข้อมูลสินทรัพย์ 4 กลุ่ม × 4 กรอบเวลา → data/scan.json"""
import json, os, time, datetime as dt
import yfinance as yf

UNIVERSE = {
    "stocks": [
        # --- ไทย (SET) ---
        "PTT.BK","PTTEP.BK","AOT.BK","ADVANC.BK","CPALL.BK","SCB.BK","KBANK.BK",
        "BBL.BK","KTB.BK","SCC.BK","GULF.BK","BDMS.BK","CPN.BK","MINT.BK","TRUE.BK",
        "DELTA.BK","BH.BK","EA.BK","TOP.BK","IVL.BK","CRC.BK","OR.BK","BEM.BK",
        "HMPRO.BK","TU.BK","GPSC.BK","BANPU.BK","AWC.BK","LH.BK","INTUCH.BK",
        # --- ต่างประเทศ ---
        "AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","AVGO","AMD","NFLX",
        "JPM","V","MA","UNH","XOM","WMT","COST","ORCL","CRM","ADBE",
        "INTC","QCOM","MU","ARM","PLTR","SMCI","TSM","BABA","ASML","SAP",
    ],
    "commodities": [
        "GC=F","SI=F","PL=F","PA=F","HG=F","CL=F","BZ=F","NG=F","HO=F","RB=F",
        "ZC=F","ZW=F","ZS=F","ZM=F","ZL=F","KC=F","SB=F","CT=F","CC=F","LE=F",
    ],
    "currencies": [
        "THB=X","EURUSD=X","GBPUSD=X","USDJPY=X","AUDUSD=X","NZDUSD=X","USDCAD=X",
        "USDCHF=X","USDCNY=X","USDSGD=X","USDKRW=X","USDINR=X","USDMYR=X","USDIDR=X",
        "USDVND=X","EURJPY=X","GBPJPY=X","EURGBP=X","AUDJPY=X","DX-Y.NYB",
    ],
    "aifunds": [
        "BOTZ","ROBO","ROBT","IRBO","AIQ","ARKQ","ARKW","ARKK","WTAI","THNQ",
        "CHAT","XT","IGPT","UBOT","QTUM","SMH","SOXX","XLK","VGT","FDN",
    ],
}

PERIODS = {"daily": 5, "weekly": 12, "monthly": 45, "yearly": 400}


def pct_change(closes, back):
    """% เปลี่ยนแปลงเทียบกับ back แท่งก่อนหน้า"""
    if closes is None or len(closes) < 2:
        return None
    last = float(closes.iloc[-1])
    idx = -1 - back
    if len(closes) < abs(idx):
        idx = 0
    prev = float(closes.iloc[idx])
    if prev == 0:
        return None
    return (last - prev) / prev * 100.0


def build():
    out = {"updated": dt.datetime.utcnow().isoformat() + "Z", "groups": {}, "total": 0}
    total = 0

    for grp, syms in UNIVERSE.items():
        buckets = {"daily": [], "weekly": [], "monthly": [], "yearly": []}
        print(f"\n=== {grp} ({len(syms)} symbols) ===")

        for sym in syms:
            try:
                tk = yf.Ticker(sym)
                hist = tk.history(period="2y", interval="1d")
                if hist.empty or len(hist) < 2:
                    print(f"  skip {sym} (no data)")
                    continue

                closes = hist["Close"].dropna()
                price = float(closes.iloc[-1])
                chg = price - float(closes.iloc[-2])

                try:
                    info = tk.fast_info
                    cap = getattr(info, "market_cap", None)
                    vol = getattr(info, "last_volume", None)
                except Exception:
                    cap, vol = None, None

                if vol is None and "Volume" in hist:
                    try:
                        vol = float(hist["Volume"].iloc[-1])
                    except Exception:
                        vol = None

                pe = None
                if grp in ("stocks", "aifunds"):
                    try:
                        pe = tk.info.get("trailingPE")
                    except Exception:
                        pe = None

                # มูลค่าซื้อขายสำหรับโภคภัณฑ์/สกุลเงิน = turnover ประมาณ
                if grp in ("commodities", "currencies") and vol:
                    cap = float(vol) * price

                base = {
                    "sym": sym,
                    "name": (tk.info.get("shortName") if grp in ("stocks", "aifunds") else sym) or sym,
                    "price": round(price, 6),
                    "chg": round(chg, 6),
                    "cap": float(cap) if cap else None,
                    "pe": float(pe) if pe else None,
                    "vol": float(vol) if vol else None,
                }

                for tf, back in [("daily", 1), ("weekly", 5), ("monthly", 21), ("yearly", 252)]:
                    p = pct_change(closes, back)
                    row = dict(base)
                    row["pct"] = round(p, 4) if p is not None else None
                    buckets[tf].append(row)

                total += 1
                print(f"  ok {sym:12s} {price:>12,.4f}")
                time.sleep(0.12)

            except Exception as e:
                print(f"  ERR {sym}: {e}")

        for tf in buckets:
            buckets[tf].sort(key=lambda r: (r["pct"] is None, -(r["pct"] or 0)))
        out["groups"][grp] = buckets

    out["total"] = total
    os.makedirs("data", exist_ok=True)
    with open("data/scan.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\n✔ เขียน data/scan.json — {total} สินทรัพย์")


if __name__ == "__main__":
    build()
