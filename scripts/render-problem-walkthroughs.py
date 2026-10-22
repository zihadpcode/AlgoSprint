#!/usr/bin/env python3
"""Render original, locally narrated problem walkthroughs from reviewed source.

Dry-run is the default. Requires Pillow, macOS say, and an explicitly supplied
ffmpeg executable. No network requests, external services, or paid APIs are used.
Third-party tools remain separately installed with their own license notices.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import re
import shutil
import subprocess
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1280, 720
SAMPLE_RATE = 22050
MAX_BYTES = 12 * 1024 * 1024
PUBLIC_PREFIX = "/videos/walkthroughs"
# Bump when visuals, narration, timing, voice settings or encoding change.
RENDERER_VERSION = "2026-10-22.1"
BACKGROUND = "#0b1220"
FOREGROUND = "#f1f5f9"
MUTED = "#a8bbd0"
ACCENT = "#5eead4"


@dataclass
class Slide:
    heading: str
    lines: list[str]
    narration: str
    code: bool = False


def command(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=True, capture_output=True, text=True)


def fonts():
    candidates = [
        ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Courier New.ttf"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"),
    ]
    for regular, mono in candidates:
        if Path(regular).is_file() and Path(mono).is_file():
            return ImageFont.truetype(regular, 29), ImageFont.truetype(mono, 22), ImageFont.truetype(regular, 38), ImageFont.truetype(regular, 22)
    raise RuntimeError("Readable regular and monospace fonts were not found")


def wrap(text: str, font, width: int = 1156, code: bool = False) -> list[str]:
    """Wrap all source text, including long tokens; never discard a code line."""
    result = []
    for original in text.expandtabs(4).splitlines() or [""]:
        if not original:
            result.append("")
            continue
        remaining = original
        while font.getlength(remaining) > width:
            low, high = 1, len(remaining)
            while low < high:
                middle = (low + high + 1) // 2
                if font.getlength(remaining[:middle]) <= width:
                    low = middle
                else:
                    high = middle - 1
            end = low
            if not code:
                boundary = remaining.rfind(" ", 0, end + 1)
                if boundary > 0:
                    end = boundary
            result.append(remaining[:end])
            remaining = remaining[end:]
            if not code:
                remaining = remaining.lstrip()
        result.append(remaining)
    return result


def pages(text: str, heading: str, narration: str, regular, mono, code=False) -> list[Slide]:
    available = 17 if code else 12
    lines = wrap(text, mono if code else regular, code=code)
    chunks = [lines[i:i + available] for i in range(0, len(lines), available)]
    # Divide authored narration across pages rather than repeating an explanation.
    words = narration.split()
    spoken = []
    for index, chunk in enumerate(chunks):
        start = len(words) * index // len(chunks)
        end = len(words) * (index + 1) // len(chunks)
        speech = " ".join(words[start:end])
        if not speech:
            speech = "\n".join(chunk).strip()
        spoken.append(Slide(heading if len(chunks) == 1 else f"{heading} · {index + 1}/{len(chunks)}", chunk, speech, code))
    return spoken


def json_text(value) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def make_slides(job: dict, regular, mono) -> list[Slide]:
    solution = job["solution"]
    result = pages(job["statement"], "Problem", job["statement"], regular, mono)
    for index, example in enumerate(job["examples"], 1):
        content = "Input\n" + json_text(example["input"]) + "\n\nOutput\n" + json_text(example["output"])
        explanation = example.get("explanation", "")
        # A missing explanation is narrated from the exact authored example data.
        narration = explanation or json_text(example["input"]) + "\n" + json_text(example["output"])
        result += pages(content, f"Example {index}", narration, regular, mono, code=True)
    result += pages(solution["intuition"], "Intuition", solution["intuition"], regular, mono)
    result += pages(solution["approach"], "Approach", solution["approach"], regular, mono)
    result += pages(solution["code"], "Implementation", solution["interviewExplanation"], regular, mono, code=True)
    for index, step in enumerate(sorted(solution["steps"], key=lambda step: step["position"]), 1):
        result += pages(step["content"], f"Walkthrough {index} · {step['title']}", step["content"], regular, mono)
    complexity = "Time\n" + solution["timeComplexity"] + "\n\nSpace\n" + solution["spaceComplexity"]
    result += pages(complexity, "Complexity", solution["timeComplexity"] + ". " + solution["spaceComplexity"], regular, mono)
    return result


def render_slide(path: Path, job: dict, slide: Slide, index: int, total: int, font_set):
    regular, mono, heading, small = font_set
    canvas = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, WIDTH, 7), fill=ACCENT)
    # Bound even unusually long authored titles instead of allowing them to clip.
    title_lines = wrap(job["title"], small)
    if len(title_lines) != 1:
        raise ValueError(f"Problem title is too long for the video header: {job['slug']}")
    draw.text((60, 28), job["title"], font=small, fill=MUTED)
    heading_lines = wrap(slide.heading, heading)
    if len(heading_lines) != 1:
        # Step titles can be long: put the full title into a separate readable line.
        heading_lines = wrap(slide.heading, small)
        if len(heading_lines) > 2:
            raise ValueError(f"Walkthrough heading needs more than two lines: {job['slug']}")
        for row, line in enumerate(heading_lines):
            draw.text((60, 77 + row * 28), line, font=small, fill=ACCENT)
    else:
        draw.text((60, 75), slide.heading, font=heading, fill=ACCENT)
    body_font, spacing = (mono, 29) if slide.code else (regular, 40)
    for row, line in enumerate(slide.lines):
        if body_font.getlength(line) > 1157:
            raise AssertionError("Wrapped text exceeds the safe width")
        draw.text((60, 148 + row * spacing), line, font=body_font, fill=FOREGROUND)
    draw.line((60, 657, 1220, 657), fill="#24344c", width=1)
    language = "Python" if job["language"] == "PYTHON" else "JavaScript"
    draw.text((60, 676), f"AlgoSprint · {language}", font=small, fill=MUTED)
    count = f"{index + 1} / {total}"
    draw.text((1220 - small.getlength(count), 676), count, font=small, fill=MUTED)
    canvas.save(path, optimize=True)


def caption_chunks(text: str) -> list[str]:
    """Exact authored words, split before synthesis so cue times are measured."""
    words = text.split()
    chunks, current = [], []
    for word in words:
        if current and (len(" ".join(current)) + len(word) + 1 > 112 or len(current) >= 18):
            chunks.append(" ".join(current))
            current = []
        current.append(word)
    if current:
        chunks.append(" ".join(current))
    return chunks


def timestamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3600000)
    minutes, remainder = divmod(remainder, 60000)
    whole_seconds, millis = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{whole_seconds:02}.{millis:03}"


def validate_job(job: dict):
    if not isinstance(job, dict) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", job.get("slug", "")):
        raise ValueError("Invalid problem slug")
    if job.get("language") not in ("JAVASCRIPT", "PYTHON"):
        raise ValueError("Only reviewed JavaScript and Python sources are supported")
    if not re.fullmatch(r"[a-f0-9]{64}", job.get("sourceHash", "")):
        raise ValueError("sourceHash must be a SHA-256 digest")
    for field in ("title", "statement"):
        if not isinstance(job.get(field), str) or not job[field].strip():
            raise ValueError(f"Missing {field}")
    if not isinstance(job.get("examples"), list) or not job["examples"]:
        raise ValueError("At least one exact example is required")
    solution = job.get("solution", {})
    for field in ("intuition", "approach", "code", "interviewExplanation", "timeComplexity", "spaceComplexity"):
        if not isinstance(solution.get(field), str) or not solution[field].strip():
            raise ValueError(f"Missing reviewed solution field: {field}")
    if not isinstance(solution.get("steps"), list) or not solution["steps"]:
        raise ValueError("Authored walkthrough steps are required")


def render(job: dict, slides: list[Slide], output_root: Path, ffmpeg: str, font_set) -> dict:
    stem = job["slug"] + "-" + job["language"].lower()
    output_root.mkdir(parents=True, exist_ok=True)
    final_video = output_root / (stem + ".mp4")
    manifest_path = output_root / (stem + ".json")
    if manifest_path.exists() and final_video.exists():
        previous = json.loads(manifest_path.read_text())
        caption_path, transcript_path = output_root / (stem + ".vtt"), output_root / (stem + ".txt")
        if (previous.get("sourceHash") == job["sourceHash"]
                and previous.get("rendererVersion") == RENDERER_VERSION
                and previous.get("sha256") == hashlib.sha256(final_video.read_bytes()).hexdigest()
                and caption_path.is_file() and transcript_path.is_file()
                and previous.get("captionsSha256") == hashlib.sha256(caption_path.read_bytes()).hexdigest()
                and previous.get("transcriptSha256") == hashlib.sha256(transcript_path.read_bytes()).hexdigest()):
            return previous
    with tempfile.TemporaryDirectory(prefix="algosprint-walkthrough-") as directory:
        temporary = Path(directory)
        audio_path = temporary / "narration.wav"
        captions, transcript, durations = [], [], []
        sample_offset = 0
        with wave.open(str(audio_path), "wb") as output_audio:
            output_audio.setnchannels(1)
            output_audio.setsampwidth(2)
            output_audio.setframerate(SAMPLE_RATE)
            for index, slide in enumerate(slides):
                render_slide(temporary / f"slide-{index:04}.png", job, slide, index, len(slides), font_set)
                slide_samples = 0
                for chunk_index, chunk in enumerate(caption_chunks(slide.narration)):
                    chunk_stem = temporary / f"speech-{index:04}-{chunk_index:04}"
                    chunk_stem.with_suffix(".txt").write_text(chunk, encoding="utf-8")
                    command(["/usr/bin/say", "-r", "175", "-f", str(chunk_stem.with_suffix(".txt")), "-o", str(chunk_stem.with_suffix(".aiff"))])
                    command([ffmpeg, "-v", "error", "-y", "-i", str(chunk_stem.with_suffix(".aiff")), "-ar", str(SAMPLE_RATE), "-ac", "1", "-c:a", "pcm_s16le", str(chunk_stem.with_suffix(".wav"))])
                    with wave.open(str(chunk_stem.with_suffix(".wav")), "rb") as source_audio:
                        frames = source_audio.getnframes()
                        if frames <= 0:
                            raise RuntimeError("Local voice produced empty audio")
                        captions.append((sample_offset / SAMPLE_RATE, (sample_offset + frames) / SAMPLE_RATE, chunk))
                        output_audio.writeframes(source_audio.readframes(frames))
                    sample_offset += frames
                    slide_samples += frames
                    transcript.append(chunk)
                # Whole-second frames plus at least half a second of reading time.
                duration = max(8 if slide.code else 4, math.ceil(slide_samples / SAMPLE_RATE + 0.6))
                padding = duration * SAMPLE_RATE - slide_samples
                output_audio.writeframes(b"\0\0" * padding)
                sample_offset += padding
                durations.append(duration)
        total_duration = sum(durations)
        concat_path = temporary / "slides.txt"
        concat_path.write_text("".join(f"file 'slide-{index:04}.png'\nduration {duration}\n" for index, duration in enumerate(durations))
                               + f"file 'slide-{len(slides) - 1:04}.png'\n", encoding="utf-8")
        rendered = temporary / "walkthrough.mp4"
        command([ffmpeg, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_path), "-i", str(audio_path),
                 "-r", "1", "-fps_mode", "cfr", "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p",
                 "-c:a", "aac", "-b:a", "32k", "-ar", str(SAMPLE_RATE), "-ac", "1", "-t", str(total_duration), "-movflags", "+faststart", str(rendered)])
        if rendered.stat().st_size > MAX_BYTES:
            raise RuntimeError(f"Video exceeds the 12 MiB limit: {job['slug']}")
        command([ffmpeg, "-v", "error", "-i", str(rendered), "-f", "null", "-"])
        if captions and captions[-1][1] > total_duration:
            raise AssertionError("Spoken captions extend beyond the video")
        vtt = "WEBVTT\n\n" + "\n\n".join(f"{index}\n{timestamp(start)} --> {timestamp(end)}\n{html.escape(text, quote=False)}" for index, (start, end, text) in enumerate(captions, 1)) + "\n"
        # Only complete, verified assets replace previous files.
        shutil.copyfile(rendered, final_video)
        (output_root / (stem + ".vtt")).write_text(vtt, encoding="utf-8")
        (output_root / (stem + ".txt")).write_text("\n\n".join(transcript) + "\n", encoding="utf-8")
        manifest = {"slug": job["slug"], "language": job["language"], "title": job["title"], "src": f"{PUBLIC_PREFIX}/{stem}.mp4",
                    "captionsSrc": f"{PUBLIC_PREFIX}/{stem}.vtt", "transcriptSrc": f"{PUBLIC_PREFIX}/{stem}.txt",
                    "durationSeconds": total_duration, "sourceHash": job["sourceHash"], "sha256": hashlib.sha256(final_video.read_bytes()).hexdigest(),
                    "width": WIDTH, "height": HEIGHT, "rendererVersion": RENDERER_VERSION,
                    "captionsSha256": hashlib.sha256((output_root / (stem + ".vtt")).read_bytes()).hexdigest(),
                    "transcriptSha256": hashlib.sha256((output_root / (stem + ".txt")).read_bytes()).hexdigest()}
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-root", type=Path, default=Path("public/videos/walkthroughs"))
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--run", action="store_true", help="Render files; otherwise validate and print a dry-run summary")
    parser.add_argument("--only", action="append", default=[], metavar="SLUG:LANGUAGE")
    args = parser.parse_args()
    jobs = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(jobs, list) or not jobs:
        raise ValueError("Input must be a non-empty array of reviewed source jobs")
    selectors = set(args.only)
    for selector in selectors:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*:(?:JAVASCRIPT|PYTHON)", selector):
            raise ValueError(f"Invalid --only selector: {selector}")
    seen = set()
    for job in jobs:
        validate_job(job)
        key = job["slug"] + ":" + job["language"]
        if key in seen:
            raise ValueError(f"Duplicate walkthrough source: {key}")
        seen.add(key)
    if selectors - seen:
        raise ValueError("Unknown --only selectors: " + ", ".join(sorted(selectors - seen)))
    if selectors:
        jobs = [job for job in jobs if job["slug"] + ":" + job["language"] in selectors]
    font_set = fonts()
    prepared = [(job, make_slides(job, font_set[0], font_set[1])) for job in jobs]
    if not args.run:
        print(json.dumps({"dryRun": True, "jobs": [{"slug": job["slug"], "language": job["language"], "slides": len(slides), "sourceHash": job["sourceHash"]} for job, slides in prepared]}, indent=2))
        return
    if not Path(args.ffmpeg).is_file() or not Path("/usr/bin/say").is_file():
        raise RuntimeError("Rendering requires the supplied ffmpeg executable and macOS say")
    for job, slides in prepared:
        manifest = render(job, slides, args.output_root, args.ffmpeg, font_set)
        print(json.dumps(manifest), flush=True)
    # Per-video sidecars are authoritative. The caller owns any aggregate catalog.


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from error
