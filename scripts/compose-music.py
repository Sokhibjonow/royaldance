"""
Renders public/audio/music.mp3 — an original, royalty-free romantic piano
waltz (I–V–vi–iii–IV–I–IV–V) with a soft string pad and hall reverb.
Everything is synthesised here, so there are no licensing concerns.

    python3 scripts/compose-music.py   (needs numpy + ffmpeg)
"""
import subprocess
import numpy as np

SR = 44100
BPM = 66
BEAT = 60 / BPM
BAR = 3 * BEAT
KEY = 2  # transpose C → D major
rng = np.random.default_rng(7)

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi(name):
    n, octave = name[:-1], int(name[-1])
    return 12 * (octave + 1) + NOTE[n[0]] + (1 if "#" in n else 0) + KEY


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


CHORDS = {  # root, third, fifth (C4-based names)
    "C": ["C3", "E3", "G3"], "G": ["G2", "B2", "D3"], "Am": ["A2", "C3", "E3"],
    "Em": ["E2", "G2", "B2"], "F": ["F2", "A2", "C3"],
}
PROG = ["C", "G", "Am", "Em", "F", "C", "F", "G", "Am", "F", "C", "G", "F", "G", "C", "C"]
MELODY = [
    [("E5", 2), ("D5", .5), ("C5", .5)], [("D5", 2), ("B4", 1)], [("C5", 1.5), ("B4", .5), ("A4", 1)], [("G4", 3)],
    [("A4", 1), ("C5", 1), ("F5", 1)], [("E5", 2), ("G4", 1)], [("A4", 1.5), ("C5", .5), ("D5", 1)], [("D5", 3)],
    [("E5", 1), ("A5", 1.5), ("G5", .5)], [("F5", 1), ("E5", 1), ("C5", 1)], [("E5", 1.5), ("D5", .5), ("C5", 1)], [("D5", 2), ("G4", 1)],
    [("A4", 1), ("C5", 1), ("F5", 1)], [("E5", 1), ("D5", 1), ("B4", 1)], [("C5", 3)], [(None, 3)],
]
PASSES = 2
LENGTH = len(PROG) * PASSES * BAR
TAIL = 4.0
N = int((LENGTH + TAIL) * SR)
L = np.zeros(N)
R = np.zeros(N)


def piano(m, dur, vel):
    """Additive piano: inharmonic partials, per-partial decay, two detuned strings, hammer thump."""
    f0 = hz(m)
    length = dur + 2.5
    t = np.arange(int(length * SR)) / SR
    out = np.zeros_like(t)
    B = 0.0004
    for k in range(1, 12):
        fk = f0 * k * np.sqrt(1 + B * k * k)
        if fk > SR / 2.2:
            break
        amp = (1 / k ** 1.4) * (0.6 + 0.4 * vel ** (k * 0.3))
        decay = 1.2 + 0.0035 * f0 * k ** 0.7
        for det in (-0.6, 0.6):
            out += amp * np.sin(2 * np.pi * (fk + det) * t + rng.random() * 6.28) * np.exp(-t * decay)
    out *= np.minimum(1, t / 0.004)
    # damper: notes are released after their written length
    rel = np.clip((t - dur) / 0.35, 0, 1)
    out *= 1 - rel * 0.85
    thump = rng.standard_normal(len(t)) * np.exp(-t * 140) * 0.008
    return (out + thump) * vel * 0.18


def pad(ms, dur):
    t = np.arange(int((dur + 1.5) * SR)) / SR
    env = np.minimum(1, t / 1.2) * np.clip((dur + 1.2 - t) / 1.2, 0, 1)
    out = np.zeros_like(t)
    for m in ms:
        f = hz(m + 12)
        vib = 1 + 0.003 * np.sin(2 * np.pi * 5.1 * t + rng.random() * 6)
        for k in range(1, 7):
            out += np.sin(2 * np.pi * f * k * vib * t + rng.random() * 6) / k ** 1.6
    return out * env * 0.012


def place(sig, start, pan):
    i = int(start * SR)
    j = min(N, i + len(sig))
    L[i:j] += sig[: j - i] * np.cos(pan * np.pi / 2)
    R[i:j] += sig[: j - i] * np.sin(pan * np.pi / 2)


for p in range(PASSES):
    for b, chord in enumerate(PROG):
        t0 = (p * len(PROG) + b) * BAR
        root, third, fifth = (midi(n) for n in CHORDS[chord])
        # waltz arpeggio in eighths: R 5 8 10 8 5
        pattern = [root, fifth, root + 12, third + 12, root + 12, fifth]
        for i, m in enumerate(pattern):
            v = 0.55 if i == 0 else 0.32 + 0.05 * rng.random()
            place(piano(m, BEAT * 0.9, v), t0 + i * BEAT / 2 + rng.random() * 0.008, 0.35 + (m - 40) / 120)
        if p == 1:  # second time: strings join, bass doubles an octave down
            place(pad([root, third, fifth], BAR), t0, 0.5)
            place(piano(root - 12, BAR * 0.95, 0.35), t0, 0.4)
        beat = 0
        for name, length in MELODY[b]:
            if name:
                m = midi(name)
                vel = 0.75 if beat == 0 else 0.62
                place(piano(m, length * BEAT, vel), t0 + beat * BEAT + 0.012, 0.6)
            beat += length

# hall reverb: decaying stereo noise impulse response, FFT convolution
ir_len = int(3.2 * SR)
tt = np.arange(ir_len) / SR
size = 1 << int(np.ceil(np.log2(N + ir_len)))
wet = []
for ch, seed in ((L, 1), (R, 2)):
    ir = np.random.default_rng(seed).standard_normal(ir_len) * np.exp(-tt / 0.75)
    ir[: int(0.02 * SR)] = 0  # pre-delay
    ir /= np.sqrt((ir ** 2).sum())
    wet.append(np.fft.irfft(np.fft.rfft(ch, size) * np.fft.rfft(ir, size), size)[:N])
L = L + wet[0] * 0.55
R = R + wet[1] * 0.55

# seamless loop: fold the tail back onto the beginning
loop = int(LENGTH * SR)
for ch in (L, R):
    ch[: N - loop] += ch[loop:]
mix = np.stack([L[:loop], R[:loop]], axis=1)
mix = np.tanh(mix / np.abs(mix).max() * 1.2) * 0.85

pcm = (mix * 32767).astype("<i2").tobytes()
subprocess.run(
    ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-",
     "-c:a", "libmp3lame", "-b:a", "128k", "public/audio/music.mp3"],
    input=pcm, check=True,
)
print(f"public/audio/music.mp3 — {LENGTH:.1f}s loop")
