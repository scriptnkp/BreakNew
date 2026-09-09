# -*- coding: utf-8 -*-
"""ดึงข้อมูลสินทรัพย์ 7 กลุ่ม x 4 กรอบเวลา + สัญญาณเทคนิค -> data/scan.json"""
import json, os, math, datetime as dt
import pandas as pd
import yfinance as yf

UNIVERSE = {
    "th": [
        "PTT.BK","PTTEP.BK","AOT.BK","ADVANC.BK","CPALL.BK","SCB.BK","KBANK.BK",
        "BBL.BK","KTB.BK","SCC.BK","GULF.BK","BDMS.BK","CPN.BK","MINT.BK","TRUE.BK",
        "DELTA.BK","BH.BK","EA.BK","TOP.BK","IVL.BK","CRC.BK","OR.BK","BEM.BK",
        "HMPRO.BK","TU.BK","GPSC.BK","BANPU.BK","AWC.BK","LH.BK","INTUCH.BK",
        "CPF.BK","CPAXT.BK","TTB.BK","BTS.BK","EGCO.BK","RATCH.BK","KCE.BK",
        "SAWAD.BK","MTC.BK","TIDLOR.BK","JMT.BK","PTTGC.BK","SPRC.BK","BCP.BK",
        "WHA.BK","AMATA.BK","SIRI.BK","AP.BK","COM7.BK","SCGP.BK",
    ],
    "global": [
        "AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","AVGO","AMD","NFLX",
        "JPM","V","MA","UNH","WMT","COST","ORCL","CRM","ADBE","INTC",
        "QCOM","MU","ARM","PLTR","SMCI","TSM","BABA","ASML","SAP","DIS",
        "BA","CAT","GE","LLY","NVO","PFE","KO","PEP","MCD","NKE",
        "BRK-B","JNJ","PG","HD","ABBV","MRK","CVX","BAC","TMO","CSCO",
        "7203.T","6758.T","005930.KS","0700.HK","9988.HK","NESN.SW","MC.PA","SIE.DE",
    ],
    "energy": [
        "XOM","CVX","COP","SLB","EOG","PSX","MPC","VLO","OXY","HAL",
        "BKR","DVN","FANG","HES","WMB","KMI","OKE","LNG","SHEL","BP",
        "TTE","ENPH","FSLR","SEDG","RUN","NEE","BEP","ICLN","TAN","XLE",
        "PTT.BK","PTTEP.BK","TOP.BK","BCP.BK","GULF.BK","GPSC.BK","EGCO.BK","BANPU.BK",
    ],
    "crypto": [
        "BTC-USD","ETH-USD","BNB-USD","SOL-USD","XRP-USD","ADA-USD","DOGE-USD",
        "AVAX-USD","TRX-USD","DOT-USD","LINK-USD","MATIC-USD","TON-USD","SHIB-USD",
        "LTC-USD","BCH-USD","NEAR-USD","UNI-USD","APT-USD","ATOM-USD",
        "ICP-USD","XLM-USD","ARB-USD","OP-USD","INJ-USD",
        "MSTR","COIN","MARA","RIOT","IBIT",
    ],
    "commodities": [
        "GC=F","SI=F","PL=F","PA=F","HG=F","CL=F","BZ=F","NG=F","HO=F","RB=F",
        "ZC=F","ZW=F","ZS=F","ZM=F","ZL=F","KC=F","SB=F","CT=F","CC=F","LE=F",
        "ALI=F","OJ=F","HE=F","GF=F",
    ],
    "currencies": [
        "THB=X","EURUSD=X","GBPUSD=X","USDJPY=X","AUDUSD=X","NZDUSD=X","USDCAD=X",
        "USDCHF=X","USDCNY=X","USDSGD=X","USDKRW=X","USDINR=X","USDMYR=X","USDIDR=X",
        "USDVND=X","USDPHP=X","EURJPY=X","GBPJPY=X","EURGBP=X","AUDJPY=X",
        "EURTHB=X","JPYTHB=X","CNYTHB=X","DX-Y.NYB",
    ],
    "aifunds": [
        "BOTZ","ROBO","ROBT","IRBO","AIQ","ARKQ","ARKW","ARKK","WTAI","THNQ",
        "CHAT","XT","IGPT","UBOT","QTUM","SMH","SOXX","XLK","VGT","FDN",
        "AIVL","LOUP","BLOK","DTEC","CIBR","IYW",
    ],
}

STOCK_LIKE = ("th", "global", "energy", "aifunds")
TFS = [("daily", 1), ("weekly", 5), ("monthly", 21), ("yearly", 252)]


def rsi14(close):
    if len(close) < 20:
        return None
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1 / 14, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / 14, adjust=False).mean()
    last = float(dn.iloc[-1])
    if last == 0:
        return 100.0
    return round(100 - 100 / (1 + float(up.iloc[-1]) / last), 1)


def safe(v):
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return None


def build():
    out = {"updated": dt.datetime.utcnow().isoformat() + "Z", "groups": {}, "total": 0}
    total = 0

    for grp, syms in UNIVERSE.items():
        print(f"\n=== {grp} ({len(syms)}) ===")
        buckets = {tf: [] for tf, _ in TFS}

        try:
            raw = yf.download(syms, period="2y", interval="1d", group_by="ticker",
                              threads=True, progress=False, auto_adjust=False)
        except Exception as e:
            print("  download error:", e)
            out["groups"][grp] = buckets
            continue

        for sym in syms:
            try:
                df = raw[sym] if isinstance(raw.columns, pd.MultiIndex) else raw
                close = df["Close"].dropna()
                if len(close) < 3:
                    print(f"  skip {sym}")
                    continue

                price = float(close.iloc[-1])
                vol = safe(df["Volume"].iloc[-1]) if "Volume" in df else None

                # ---- สัญญาณเทคนิค ----
                rsi = rsi14(close)
                ma50 = float(close.rolling(50).mean().iloc[-1]) if len(close) >= 50 else None
                ma200 = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else None
                ma_sig = None
                if ma50 and ma200:
                    ma_sig = "golden" if ma50 > ma200 else "death"
                elif ma50:
                    ma_sig = "up50" if price > ma50 else "dn50"

                vspike = None
                if "Volume" in df:
                    v = df["Volume"].dropna()
                    if len(v) >= 21 and vol:
                        avg = float(v.iloc[-21:-1].mean())
                        if avg > 0:
                            vspike = round(vol / avg, 2)

                # ---- meta ----
                name, cap, pe = sym, None, None
                try:
                    tk = yf.Ticker(sym)
                    fi = tk.fast_info
                    cap = safe(getattr(fi, "market_cap", None))
                    if grp in STOCK_LIKE or grp == "crypto":
                        info = tk.info
                        name = info.get("shortName") or info.get("longName") or sym
                        pe = safe(info.get("trailingPE"))
                        if cap is None:
                            cap = safe(info.get("marketCap"))
                except Exception:
                    pass

                if cap is None and vol:
                    cap = vol * price

                base = {"sym": sym, "name": name, "price": round(price, 6), "cap": cap,
                        "pe": round(pe, 2) if pe else None, "vol": vol,
                        "rsi": rsi, "ma": ma_sig, "vs": vspike}

                for tf, back in TFS:
                    idx = -1 - back
                    if len(close) < abs(idx):
                        idx = 0
                    prev = float(close.iloc[idx])
                    row = dict(base)
                    row["chg"] = round(price - prev, 6)
                    row["pct"] = round((price - prev) / prev * 100, 4) if prev else None
                    buckets[tf].append(row)

                total += 1
                print(f"  ok {sym:12s} {price:>13,.4f}  rsi={rsi}")

            except Exception as e:
                print(f"  ERR {sym}: {e}")

        for tf in buckets:
            buckets[tf].sort(key=lambda r: (r["pct"] is None, -(r["pct"] or 0)))
        out["groups"][grp] = buckets

    out["total"] = total
    os.makedirs("data", exist_ok=True)
    with open("data/scan.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\n✔ data/scan.json — {total} assets")


if __name__ == "__main__":
    build()
