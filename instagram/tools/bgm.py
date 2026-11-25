"""릴스용 배경음악을 코드로 직접 만든다 (저작권 걱정 없는 우리 음악).
사용: python3 bgm.py <저장할.wav> [길이초=26] [시드=날짜 등 아무 문자열]
- 밝은 팝/로파이 느낌: 코드 진행 + 베이스 + 킥/스네어/하이햇 + 짧은 멜로디.
- 시드마다 조(key)·빠르기·멜로디가 조금씩 달라져서 매일 같은 곡이 되지 않는다.
"""
import hashlib
import sys
import wave

import numpy as np

SR = 44100


def env(n, a=0.005, r=0.2):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) * np.exp(-t / r)
    return e


def tone(freq, dur, kind="tri", vol=0.2, a=0.01, r=0.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    if kind == "tri":
        w = 2 * np.abs(2 * ((t * freq) % 1) - 1) - 1
    elif kind == "saw":
        w = 2 * ((t * freq) % 1) - 1
    elif kind == "sq":
        w = np.sign(np.sin(2 * np.pi * freq * t)) * 0.6
    else:
        w = np.sin(2 * np.pi * freq * t)
    return w * env(n, a, r) * vol


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


def make(path, length=26.0, seed="yozmbom"):
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    rng = np.random.default_rng(h % (2**32))
    bpm = [100, 104, 108, 112, 116][h % 5]
    root = 57 + (h // 5) % 7  # A3 근처에서 조 바꾸기
    beat = 60 / bpm
    # 밝은 진행 몇 가지 중 하나 (I–V–vi–IV 등), 각 화음 2박자 x2 = 한 마디
    progs = [[0, 7, 9, 5], [0, 5, 9, 7], [9, 5, 0, 7], [0, 9, 5, 7]]
    prog = progs[(h // 35) % len(progs)]
    major = [0, 4, 7]
    minor = [0, 3, 7]
    scale = [0, 2, 4, 7, 9, 12, 14, 16]  # 펜타토닉 → 멜로디가 늘 어울림

    n = int(length * SR)
    mix = np.zeros(n + SR)

    def put(sig, at):
        i = int(at * SR)
        j = min(len(mix), i + len(sig))
        mix[i:j] += sig[: j - i]

    bar = beat * 4
    bars = int(length / bar) + 1
    melody = [rng.choice(scale) for _ in range(16)]
    for b in range(bars):
        t0 = b * bar
        deg = prog[b % 4]
        chord = minor if deg == 9 else major
        # 화음(부드러운 패드): 반박자마다 짧게 튕기기
        for k in range(8):
            for c in chord:
                put(tone(midi(root + deg + c), beat * 0.5, "tri", 0.045, 0.01, 0.25), t0 + k * beat * 0.5)
        # 베이스
        for k in range(4):
            put(tone(midi(root + deg - 12), beat * 0.9, "sine", 0.22, 0.005, 0.35), t0 + k * beat)
        # 드럼 (두 번째 마디부터)
        if b >= 1:
            for k in range(4):
                tt = t0 + k * beat
                kick_n = int(0.25 * SR)
                kt = np.arange(kick_n) / SR
                kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-kt * 30)) * kt) * np.exp(-kt * 12) * 0.5
                if k in (0, 2):
                    put(kick, tt)
                if k in (1, 3):
                    sn = rng.standard_normal(int(0.18 * SR)) * env(int(0.18 * SR), 0.001, 0.05) * 0.18
                    put(sn, tt)
                for hh in (0, 0.5):
                    hat = rng.standard_normal(int(0.05 * SR)) * env(int(0.05 * SR), 0.001, 0.012) * 0.06
                    put(np.diff(hat, prepend=0), tt + hh * beat)
        # 멜로디 (세 번째 마디부터, 2마디 패턴 반복)
        if b >= 2:
            for k in range(8):
                note = melody[(b % 2) * 8 + k]
                if (k + b) % 3 == 2:
                    continue
                put(tone(midi(root + 12 + note), beat * 0.45, "sq", 0.05, 0.005, 0.18), t0 + k * beat * 0.5)

    mix = mix[:n]
    # 시작·끝 페이드
    fade = int(1.0 * SR)
    mix[:fade] *= np.linspace(0, 1, fade)
    mix[-fade * 2:] *= np.linspace(1, 0, fade * 2)
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.85
    pcm = (mix * 32767).astype(np.int16)
    stereo = np.column_stack([pcm, pcm]).ravel()
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(stereo.tobytes())
    print(f"✓ {path} ({length:.0f}초, {bpm}bpm)")


if __name__ == "__main__":
    make(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 26.0, sys.argv[3] if len(sys.argv) > 3 else "yozmbom")
