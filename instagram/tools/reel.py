"""카드 이미지(01.jpg …)로 릴스용 세로 영상(reel.mp4, 1080×1920)을 만든다.
사용: python3 reel.py ../queue/2026-11-25-2-desk-habits [더 많은 폴더…]
- 카드마다 2.6초(표지는 2초), 배경은 그 카드를 흐리게 키운 것.
- 소리는 없는(무음) 트랙을 넣는다. 음악은 인스타 앱에서 붙일 수 있다.
"""
import subprocess
import sys
from pathlib import Path

COVER_SEC, CARD_SEC, FPS = 2.0, 2.6, 30


def make(folder: Path) -> None:
    cards = sorted(folder.glob("[0-9][0-9].jpg"))
    if not cards:
        print(f"카드가 없어요: {folder}")
        return
    args = ["ffmpeg", "-y", "-loglevel", "error"]
    for i, c in enumerate(cards):
        args += ["-loop", "1", "-t", str(COVER_SEC if i == 0 else CARD_SEC), "-framerate", str(FPS), "-i", str(c)]
    args += ["-f", "lavfi", "-t", "60", "-i", "anullsrc=r=44100:cl=stereo"]
    parts = []
    for i in range(len(cards)):
        parts.append(
            f"[{i}:v]split[a{i}][b{i}];"
            f"[a{i}]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:3,eq=brightness=-0.12[bg{i}];"
            f"[b{i}]scale=1000:-1[fg{i}];"
            f"[bg{i}][fg{i}]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v{i}]"
        )
    concat = "".join(f"[v{i}]" for i in range(len(cards))) + f"concat=n={len(cards)}:v=1:a=0[v]"
    args += ["-filter_complex", ";".join(parts) + ";" + concat, "-map", "[v]", "-map", f"{len(cards)}:a",
             "-shortest", "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-r", str(FPS), "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(folder / "reel.mp4")]
    subprocess.run(args, check=True)
    size = (folder / "reel.mp4").stat().st_size / 1e6
    print(f"✓ {folder.name}/reel.mp4 ({len(cards)}장, {size:.1f}MB)")


if __name__ == "__main__":
    for f in sys.argv[1:]:
        make(Path(f))
