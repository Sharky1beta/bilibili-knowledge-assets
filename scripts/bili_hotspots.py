#!/usr/bin/env python3
# Usage: python scripts/bili_hotspots.py BV1xx411c7mD
import argparse
import gzip
import json
import math
import statistics
import subprocess
import webbrowser
import xml.etree.ElementTree as ET
import zlib
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import matplotlib.pyplot as plt

HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.bilibili.com/"}
HOT_WORDS = [
    "\u9ad8\u80fd", "\u524d\u65b9", "\u540d\u573a\u9762",
    "\u6cea\u76ee", "\u54c8\u54c8", "\u554a\u554a", "\u8349",
    "\u5367\u69fd", "\u725b", "666", "\u7834\u9632", "\u6765\u4e86",
]


def fetch(url):
    try:
        import requests
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        return r.content
    except ImportError:
        pass
    except Exception as e:
        print(f"requests failed: {e}")
    try:
        with urlopen(Request(url, headers=HEADERS), timeout=15) as resp:
            data = resp.read()
            enc = (resp.headers.get("Content-Encoding") or "").lower()
        if enc == "gzip":
            return gzip.decompress(data)
        if enc == "deflate":
            try:
                return zlib.decompress(data)
            except zlib.error:
                return zlib.decompress(data, -zlib.MAX_WBITS)
        return data
    except Exception as e:
        print(f"urllib failed, fallback to curl.exe: {e}")
    cmd = [
        "curl.exe", "-L", "--compressed", "--silent", "--show-error",
        "--max-time", "20", "-H", f"User-Agent: {HEADERS['User-Agent']}",
        "-H", f"Referer: {HEADERS['Referer']}", url,
    ]
    p = subprocess.run(cmd, capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode("utf-8", "ignore") or "curl.exe failed")
    return p.stdout


def api(path, **params):
    url = "https://api.bilibili.com" + path + "?" + urlencode(params)
    data = json.loads(fetch(url).decode("utf-8", "ignore"))
    if data.get("code") != 0:
        raise RuntimeError(data.get("message") or data)
    return data["data"]


def get_video(bvid):
    data = api("/x/web-interface/view", bvid=bvid)
    page = data["pages"][0]
    return {
        "bvid": data["bvid"],
        "title": data["title"],
        "cid": page["cid"],
        "duration": int(page.get("duration") or data["duration"]),
    }


def danmaku(cid):
    xml = fetch(f"https://comment.bilibili.com/{cid}.xml").decode("utf-8", "ignore")
    root, rows = ET.fromstring(xml), []
    for node in root.iter("d"):
        try:
            rows.append((float((node.get("p") or "").split(",")[0]), node.text or ""))
        except ValueError:
            pass
    return rows


def smooth(values, radius=2):
    out = []
    for i in range(len(values)):
        lo, hi = max(0, i - radius), min(len(values), i + radius + 1)
        out.append(sum(values[lo:hi]) / (hi - lo))
    return out


def curve(rows, duration, bin_size):
    n = max(1, math.ceil(duration / bin_size))
    raw, heat = [0] * n, [0.0] * n
    for sec, text in rows:
        i = min(n - 1, max(0, int(sec // bin_size)))
        raw[i] += 1
        heat[i] += 1 + 1.8 * sum(word in text for word in HOT_WORDS)
    xs = [i * bin_size + bin_size / 2 for i in range(n)]
    return xs, raw, smooth(heat)


def hotspots(ys, top):
    avg, sd = statistics.mean(ys), statistics.pstdev(ys) or 1
    peaks = []
    for i, y in enumerate(ys):
        left = ys[i - 1] if i else -1
        right = ys[i + 1] if i + 1 < len(ys) else -1
        if y >= avg + 1.15 * sd and y >= left and y >= right:
            peaks.append(i)
    return sorted(peaks, key=lambda i: ys[i], reverse=True)[:top]


def fmt(sec):
    sec = int(sec)
    return f"{sec // 60:02d}:{sec % 60:02d}"


def draw(video, xs, raw, heat, peaks, scale):
    fig, ax = plt.subplots(figsize=(12, 6))
    width = (xs[1] - xs[0]) * 0.75 if len(xs) > 1 else 8
    ax.bar(xs, raw, width=width, color="#9fc5e8", alpha=0.45, label="danmaku count")
    ax.plot(xs, heat, color="#e06666", linewidth=2.2, label="heat")
    ax.scatter([xs[i] for i in peaks], [heat[i] for i in peaks], c="#cc0000", s=70, label="hotspot")
    for rank, i in enumerate(peaks, 1):
        ax.annotate(f"{rank}. {fmt(xs[i])}", (xs[i], heat[i]), xytext=(0, 10),
                    textcoords="offset points", ha="center")
    if scale == "symlog":
        ax.set_yscale("symlog", linthresh=1)
    ax.set(title=f"Bilibili Hotspots | {video['bvid']} | click curve to jump",
           xlabel="time", ylabel="heat")
    ax.set_xticks([x for x in xs if x % 60 < xs[0]])
    ax.set_xticklabels([fmt(x) for x in ax.get_xticks()])
    ax.grid(alpha=0.2)
    ax.legend()

    def click(event):
        if event.inaxes == ax and event.xdata is not None:
            sec = max(0, int(event.xdata))
            url = f"https://www.bilibili.com/video/{video['bvid']}?t={sec}"
            print(f"open {fmt(sec)}: {url}")
            webbrowser.open(url)

    fig.canvas.mpl_connect("button_press_event", click)
    plt.tight_layout()
    plt.show()


def main():
    p = argparse.ArgumentParser(description="Bilibili hotspot analyzer")
    p.add_argument("bvid")
    p.add_argument("-b", "--bin", type=int, default=10, help="seconds per bucket")
    p.add_argument("-n", "--top", type=int, default=8, help="number of hotspots")
    p.add_argument("--scale", choices=["symlog", "linear"], default="symlog")
    args = p.parse_args()
    video = get_video(args.bvid.strip())
    rows = danmaku(video["cid"])
    xs, raw, heat = curve(rows, video["duration"], max(1, args.bin))
    peaks = hotspots(heat, args.top)
    print(f"bvid: {video['bvid']}  cid: {video['cid']}  duration: {fmt(video['duration'])}")
    print(f"danmaku: {len(rows)}  after 60s: {sum(1 for sec, _ in rows if sec >= 60)}")
    print("hotspots:", ", ".join(fmt(xs[i]) for i in peaks) or "none")
    draw(video, xs, raw, heat, peaks, args.scale)


if __name__ == "__main__":
    main()
