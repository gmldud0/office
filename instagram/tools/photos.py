"""무료 라이선스 사진 찾기 (Openverse: 위키미디어·플리커 등의 공개 라이선스 사진 모음, 키 필요 없음)

사용:
  python3 photos.py search "laundry pile" [개수]   → 후보를 scratch/후보/ 에 받고 한 장짜리 모아보기(sheet.jpg)를 만든다
  python3 photos.py get <id> <저장할 이름>          → instagram/assets/photos/<이름>.jpg 로 원본을 받고, 출처를 credits.json 에 기록

- CC0·공개 도메인·CC BY만 찾는다 (BY-SA는 카드까지 같은 라이선스로 묶여서 제외).
- CC BY는 출처 표시가 필요하다 → 캡션 끝에 "사진: 작가 / 라이선스" 를 넣는다 (credits.json 참고).
"""
import json
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "assets" / "photos"
API = "https://api.openverse.org/v1/images/"
UA = {"User-Agent": "Mozilla/5.0 (yozmbom-card-maker)"}


def get_json(url: str):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return json.load(r)


def fetch(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=40) as r:
            data = r.read()
        if not data[:3] == b"\xff\xd8\xff" and not data[:8].startswith(b"\x89PNG"):
            return False
        dest.write_bytes(data)
        return True
    except Exception:
        return False


def search(q: str, n: int = 12) -> None:
    out = Path.cwd() / "후보"
    out.mkdir(exist_ok=True)
    for f in out.glob("*"):
        f.unlink()
    params = urllib.parse.urlencode({"q": q, "license": "cc0,pdm,by", "page_size": n, "mature": "false"})
    d = get_json(f"{API}?{params}")
    got = []
    for i, x in enumerate(d["results"]):
        dest = out / f"{i:02d}.jpg"
        # 작은 미리보기: 원본 주소 → 안 되면 Openverse 썸네일
        if fetch(x["url"], dest) or fetch(f"{API}{x['id']}/thumb/", dest):
            subprocess.run(["mogrify", "-resize", "600x600>", str(dest)], check=False)
            got.append(x)
            (out / f"{i:02d}.json").write_text(json.dumps(x, ensure_ascii=False))
    subprocess.run(["montage", *sorted(map(str, out.glob("*.jpg"))), "-label", "%t", "-tile", "4x",
                    "-geometry", "300x225+4+4", str(out / "sheet.jpg")], check=False)
    print(f"{q}: {len(got)}장 → {out}/sheet.jpg")
    for f in sorted(out.glob("*.json")):
        x = json.loads(f.read_text())
        print(f"  {f.stem}  {x['id']}  {x['license']} {x.get('license_version') or ''}  {x.get('width')}x{x.get('height')}  {x['title'][:50]}")


def get(img_id: str, name: str) -> None:
    x = get_json(f"{API}{img_id}/")
    ASSETS.mkdir(parents=True, exist_ok=True)
    dest = ASSETS / f"{name}.jpg"
    if not fetch(x["url"], dest) and not fetch(f"{API}{img_id}/thumb/?full_size=true&compressed=false", dest):
        sys.exit(f"받기 실패: {x['url']}")
    subprocess.run(["mogrify", "-resize", "1600x1600>", "-quality", "88", str(dest)], check=False)
    credits = ASSETS / "credits.json"
    c = json.loads(credits.read_text()) if credits.exists() else {}
    c[name] = {k: x.get(k) for k in ["id", "title", "creator", "license", "license_version", "license_url",
                                      "foreign_landing_url", "provider", "attribution"]}
    credits.write_text(json.dumps(c, ensure_ascii=False, indent=2) + "\n")
    need = "출처 표시 필요" if x["license"] not in ("cc0", "pdm") else "출처 표시 필요 없음"
    print(f"✓ {dest.name} ({x['license']} {x.get('license_version') or ''}, {need}) — {x.get('creator')}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "search":
        search(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 12)
    elif cmd == "get":
        get(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
