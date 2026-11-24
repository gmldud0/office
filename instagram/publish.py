#!/usr/bin/env python3
"""인스타그램 자동 게시: 대기열(instagram/queue)에서 가장 오래된 게시물 하나를 올리고 posted/로 옮긴다.

  python3 instagram/publish.py publish   # 하나 올리기 (GitHub Actions가 하루 2번 실행)
  python3 instagram/publish.py refresh   # (인스타 로그인 토큰일 때만) 기간 연장 60일
  python3 instagram/publish.py check     # 토큰이 살아 있는지, 어느 계정인지 확인

환경 변수
  IG_ACCESS_TOKEN  접근 토큰 (GitHub Secrets에 저장)
  IG_USER_ID       인스타 계정 ID. 통합 로그인(시스템 사용자 토큰)일 때 필요 (GitHub Variables에 저장)
  IMAGE_BASE_URL   대기열 이미지가 공개되는 주소의 앞부분. 예: https://raw.githubusercontent.com/<계정>/<저장소>/<커밋>
  DRY_RUN=1        실제로 올리지 않고 할 일만 출력
  GRAPH_BASE       API 주소 (기본: IG_USER_ID가 있으면 https://graph.facebook.com/v23.0,
                   없으면 https://graph.instagram.com/v23.0)
"""
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
QUEUE = ROOT / "queue"
POSTED = ROOT / "posted"
IG_USER_ID = os.environ.get("IG_USER_ID", "").strip()
_default_graph = "https://graph.facebook.com/v23.0" if IG_USER_ID else "https://graph.instagram.com/v23.0"
GRAPH = (os.environ.get("GRAPH_BASE", "").strip() or _default_graph).rstrip("/")
DRY = os.environ.get("DRY_RUN") == "1"


def token() -> str:
    t = os.environ.get("IG_ACCESS_TOKEN", "").strip()
    if not t:
        sys.exit("IG_ACCESS_TOKEN이 없어요. GitHub 저장소 Settings → Secrets에 넣어 주세요.")
    return t


def call(method: str, url: str, params: dict) -> dict:
    data = urllib.parse.urlencode(params).encode()
    if method == "GET":
        url = f"{url}?{data.decode()}"
        data = None
    req = urllib.request.Request(url, data=data, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        # 토큰이 로그에 찍히지 않도록 오류 본문만 보여 준다
        sys.exit(f"인스타그램 API 오류 ({e.code}): {body}")


def account(tok: str) -> tuple[str, str]:
    """(인스타 계정 ID, 아이디)를 돌려준다."""
    if IG_USER_ID:
        r = call("GET", f"{GRAPH}/{IG_USER_ID}", {"fields": "username", "access_token": tok})
        return IG_USER_ID, r.get("username", "?")
    me = call("GET", f"{GRAPH}/me", {"fields": "user_id,username", "access_token": tok})
    return me.get("user_id") or me.get("id"), me.get("username", "?")


def next_post() -> Path | None:
    posts = sorted(p for p in QUEUE.iterdir() if p.is_dir() and (p / "post.json").exists()) if QUEUE.exists() else []
    return posts[0] if posts else None


def wait_ready(container_id: str, tok: str) -> None:
    for _ in range(30):
        st = call("GET", f"{GRAPH}/{container_id}", {"fields": "status_code", "access_token": tok}).get("status_code")
        if st == "FINISHED":
            return
        if st in ("ERROR", "EXPIRED"):
            sys.exit(f"이미지 처리 실패 ({container_id}: {st}). 이미지 주소가 공개돼 있는지 확인해 주세요.")
        time.sleep(5)
    sys.exit(f"이미지 처리가 너무 오래 걸려요 ({container_id}).")


def publish() -> None:
    post_dir = next_post()
    if not post_dir:
        print("대기열이 비어 있어요. 올릴 게시물이 없습니다.")
        return
    post = json.loads((post_dir / "post.json").read_text(encoding="utf-8"))
    base = os.environ.get("IMAGE_BASE_URL", "").rstrip("/")
    if not base:
        sys.exit("IMAGE_BASE_URL이 없어요.")
    rel = post_dir.relative_to(ROOT.parent).as_posix()
    urls = [f"{base}/{urllib.parse.quote(rel)}/{img}" for img in post["images"]]
    caption = post["caption"]
    print(f"게시물: {post_dir.name} ({len(urls)}장)")

    if DRY:
        for u in urls:
            print("  이미지:", u)
        print("  캡션 첫 줄:", caption.splitlines()[0])
        print("DRY_RUN: 실제로 올리지 않았어요.")
        return

    tok = token()
    uid, username = account(tok)
    print(f"계정: @{username}")

    if len(urls) == 1:
        cid = call("POST", f"{GRAPH}/{uid}/media", {"image_url": urls[0], "caption": caption, "access_token": tok})["id"]
    else:
        children = []
        for u in urls:
            c = call("POST", f"{GRAPH}/{uid}/media", {"image_url": u, "is_carousel_item": "true", "access_token": tok})["id"]
            wait_ready(c, tok)
            children.append(c)
        cid = call("POST", f"{GRAPH}/{uid}/media", {
            "media_type": "CAROUSEL", "children": ",".join(children), "caption": caption, "access_token": tok,
        })["id"]
    wait_ready(cid, tok)
    media_id = call("POST", f"{GRAPH}/{uid}/media_publish", {"creation_id": cid, "access_token": tok})["id"]
    print(f"✓ 게시 완료 (media id {media_id})")

    POSTED.mkdir(exist_ok=True)
    post["published"] = {"media_id": media_id, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    (post_dir / "post.json").write_text(json.dumps(post, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.move(str(post_dir), str(POSTED / post_dir.name))


def refresh() -> None:
    # 토큰 연장은 버전 없는 주소를 쓴다 (예: https://graph.instagram.com/refresh_access_token)
    head, _, last = GRAPH.rpartition("/")
    root = head if last.startswith("v") and last[1:2].isdigit() else GRAPH
    r = call("GET", f"{root}/refresh_access_token", {"grant_type": "ig_refresh_token", "access_token": token()})
    days = int(r.get("expires_in", 0)) // 86400
    print(f"✓ 토큰 기간 연장: 앞으로 약 {days}일")
    out = os.environ.get("GITHUB_OUTPUT")
    new = r.get("access_token", "")
    if out and new:
        # 새 토큰은 로그에 숨기고 다음 단계로만 넘긴다
        print(f"::add-mask::{new}")
        with open(out, "a") as f:
            f.write(f"token={new}\n")


def check() -> None:
    uid, username = account(token())
    print(f"✓ 토큰 정상: @{username} (id {uid})")
    n = len([p for p in QUEUE.iterdir() if p.is_dir()]) if QUEUE.exists() else 0
    print(f"대기열: {n}개")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "publish"
    {"publish": publish, "refresh": refresh, "check": check}.get(cmd, lambda: sys.exit(f"모르는 명령: {cmd}"))()
