#!/usr/bin/env python3
"""
Phase 3: Real-Time Dual-Session Demo Recorder (Playwright + FFmpeg)
Records the live Next.js 15 app running at http://localhost:3000:
  - docs/screenshot-light.png (1440x900 Warm Paper Editorial Editor)
  - docs/screenshot-dark.png  (1440x900 Obsidian Ink Dark Mode + Precision Inspector)
  - docs/demo-realtime.mp4    (1920x1080 30fps H.264 CRF 19 faststart for LinkedIn)
  - docs/demo-realtime.gif    (1200px wide 15fps 2-pass palettegen/sierra2_4a < 8MB for GitHub README)
"""

import os
import shutil
import subprocess
import time
from playwright.sync_api import sync_playwright

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(PROJECT_ROOT, "docs")
FRAMES_DIR = os.path.join(DOCS_DIR, "_frames")
PALETTE_PATH = os.path.join(DOCS_DIR, "_palette.png")

FFMPEG_CANDIDATES = [
    r"C:\Users\luisl\.pidia_downloader\bin\ffmpeg.exe",
    r"C:\Users\luisl\OneDrive\Escritorio\Programacion y proyectos\PROYECTOS PROGRAMACION\PiDiaDownloader\.venv\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe",
    "ffmpeg",
]

BASE_URL = "http://localhost:3000"
RFC_DOC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"


def find_ffmpeg() -> str:
    for cand in FFMPEG_CANDIDATES:
        if os.path.isfile(cand) or shutil.which(cand):
            return cand
    raise RuntimeError("FFmpeg executable not found!")


def wait_fonts(target) -> None:
    try:
        target.evaluate("() => document.fonts && document.fonts.ready")
    except Exception:
        pass


def main() -> None:
    ffmpeg_bin = find_ffmpeg()
    os.makedirs(DOCS_DIR, exist_ok=True)
    if os.path.exists(FRAMES_DIR):
        shutil.rmtree(FRAMES_DIR)
    os.makedirs(FRAMES_DIR, exist_ok=True)

    print(f"[*] Using FFmpeg: {ffmpeg_bin}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ---------------------------------------------------------------------
        # 1. Capture High-Craft Light & Dark Screenshots (1440x900)
        # ---------------------------------------------------------------------
        shot_ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        shot_page = shot_ctx.new_page()

        print("[*] Capturing docs/screenshot-light.png (Warm Paper)...")
        shot_page.goto(f"{BASE_URL}/documents/{RFC_DOC}?as=admin&theme=light", wait_until="networkidle")
        wait_fonts(shot_page)
        shot_page.wait_for_timeout(700)
        shot_page.screenshot(path=os.path.join(DOCS_DIR, "screenshot-light.png"))

        print("[*] Capturing docs/screenshot-dark.png (Obsidian Ink + Inspector)...")
        shot_page.goto(
            f"{BASE_URL}/documents/{RFC_DOC}?as=admin&theme=dark&inspector=1",
            wait_until="networkidle",
        )
        wait_fonts(shot_page)
        shot_page.wait_for_timeout(700)
        shot_page.screenshot(path=os.path.join(DOCS_DIR, "screenshot-dark.png"))
        shot_ctx.close()

        # ---------------------------------------------------------------------
        # 2. Choreograph Live Dual-Session Split-Screen Recording (1920x1080)
        # ---------------------------------------------------------------------
        print("[*] Launching Split-Screen Live Demo Stage (1920x1080)...")
        demo_ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        stage = demo_ctx.new_page()
        stage.goto(f"{BASE_URL}/demo-stage", wait_until="networkidle")
        wait_fonts(stage)
        stage.wait_for_timeout(1200)

        left_frame = stage.frame(name="pane-left")
        right_frame = stage.frame(name="pane-right")
        assert left_frame is not None and right_frame is not None, "Demo stage iframes failed to mount!"

        left_frame.wait_for_selector("#collaborative-document-title-input", timeout=15000)
        right_frame.wait_for_selector("#collaborative-document-title-input", timeout=15000)
        wait_fonts(left_frame)
        wait_fonts(right_frame)
        stage.wait_for_timeout(800)

        frame_idx = 0

        def snap(count: int = 1, delay_ms: int = 55) -> None:
            nonlocal frame_idx
            for _ in range(count):
                frame_idx += 1
                out_file = os.path.join(FRAMES_DIR, f"frame_{frame_idx:04d}.png")
                stage.screenshot(path=out_file)
                if delay_ms > 0:
                    stage.wait_for_timeout(delay_ms)

        # Reset clean localStorage seed right before recording
        stage.click("button:has-text('Reset Seed')")
        stage.wait_for_timeout(1100)
        left_frame = stage.frame(name="pane-left")
        right_frame = stage.frame(name="pane-right")
        assert left_frame is not None and right_frame is not None
        left_frame.wait_for_selector("#collaborative-document-title-input", timeout=15000)
        right_frame.wait_for_selector("#collaborative-document-title-input", timeout=15000)
        wait_fonts(left_frame)
        wait_fonts(right_frame)
        stage.wait_for_timeout(500)

        # Scene 1 (1.3s): Calm Warm Paper side-by-side overview (Luis Admin left, Elena Editor right)
        print("  -> Scene 1: Initial side-by-side presence handshake...")
        snap(18, 50)

        # Scene 2 (4.0s): Open Inspector on Right (Elena) & Luis types at end of paragraph -> streams live to Right + CAS v4 -> v5
        print("  -> Scene 2: Live collaborative typing & BroadcastChannel sync + OCC CAS v4 -> v5...")
        right_frame.locator("button[title*='Inspector']").click()
        snap(10, 50)

        # Focus paragraph block (index 2, since index 0 is title textarea and index 1 is H1)
        para_block = left_frame.locator("article textarea").nth(2)
        para_block.click()
        para_block.press("End")
        snap(6, 45)

        live_phrase = " Zero lost updates verified live."
        for ch in live_phrase:
            para_block.type(ch, delay=8)
            snap(1, 28)

        # Wait for debounced OCC Compare-And-Swap commit (v4 -> v5) to propagate across both panes
        snap(16, 55)

        # Scene 3 (3.2s): Trigger Concurrent Conflict 3-Way Merge inside Elena's Precision Inspector (v5 -> v7)
        print("  -> Scene 3: Triggering Concurrent OCC 3-Way Merge in Precision Inspector...")
        sim_btn = right_frame.locator("button:has-text('Simulate Concurrent Conflict')")
        if sim_btn.count() > 0:
            sim_btn.click()
        snap(24, 55)

        # Switch Elena's Inspector tab to JSONB Tree briefly so viewers see live JSONB payload
        jsonb_btn = right_frame.locator("button:has-text('JSONB Tree')")
        if jsonb_btn.count() > 0:
            jsonb_btn.click()
        snap(18, 55)

        # Scene 4 (3.0s): Switch Right Window to Marco Silva (Viewer · RLS Read-Only) & Probe SQLSTATE 42501
        print("  -> Scene 4: Switching Session B to Marco Silva (Viewer) & testing RLS 42501 guard...")
        stage.click("#stage-role-viewer")
        stage.wait_for_timeout(900)
        right_frame = stage.frame(name="pane-right")
        if right_frame:
            right_frame.wait_for_selector("#collaborative-document-title-input", timeout=10000)
            wait_fonts(right_frame)
            stage.wait_for_timeout(350)
            snap(12, 50)
            probe_btn = right_frame.locator("button:has-text('Force Write Probe')")
            if probe_btn.count() > 0:
                probe_btn.click()
            snap(22, 55)

        # Scene 5 (2.5s): Toggle Obsidian Ink Dark Mode on Left Window to showcase dual-theme craft
        print("  -> Scene 5: Showcasing Obsidian Ink Dark Mode...")
        left_theme_btn = left_frame.locator("button[aria-label='Toggle color theme']")
        if left_theme_btn.count() > 0:
            left_theme_btn.click()
        if right_frame:
            right_theme_btn = right_frame.locator("button[aria-label='Toggle color theme']")
            if right_theme_btn.count() > 0:
                right_theme_btn.click()
        snap(26, 55)

        print(f"[*] Captured {frame_idx} lossless 1080p frames (~{frame_idx / 15.0:.1f}s at 15fps).")
        demo_ctx.close()
        browser.close()

    # -------------------------------------------------------------------------
    # 3. Encode High-Definition MP4 (1920x1080, 30fps, H.264 CRF 19, faststart)
    # -------------------------------------------------------------------------
    mp4_out = os.path.join(DOCS_DIR, "demo-realtime.mp4")
    gif_out = os.path.join(DOCS_DIR, "demo-realtime.gif")
    input_pattern = os.path.join(FRAMES_DIR, "frame_%04d.png")

    print("[*] Encoding docs/demo-realtime.mp4 (1920x1080 @ 30fps H.264)...")
    subprocess.run(
        [
            ffmpeg_bin,
            "-y",
            "-framerate",
            "15",
            "-i",
            input_pattern,
            "-vf",
            "fps=30,scale=1920:1080:flags=lanczos",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "19",
            "-movflags",
            "+faststart",
            mp4_out,
        ],
        check=True,
    )

    # -------------------------------------------------------------------------
    # 4. Encode High-Craft 2-Pass Palette GIF (1200px wide, 15fps, sierra2_4a)
    # -------------------------------------------------------------------------
    print("[*] Encoding docs/demo-realtime.gif (1200px @ 15fps, 2-pass sierra2_4a)...")
    subprocess.run(
        [
            ffmpeg_bin,
            "-y",
            "-framerate",
            "15",
            "-i",
            input_pattern,
            "-vf",
            "fps=15,scale=1200:-1:flags=lanczos,palettegen=stats_mode=diff",
            PALETTE_PATH,
        ],
        check=True,
    )
    subprocess.run(
        [
            ffmpeg_bin,
            "-y",
            "-framerate",
            "15",
            "-i",
            input_pattern,
            "-i",
            PALETTE_PATH,
            "-lavfi",
            "fps=15,scale=1200:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=sierra2_4a",
            gif_out,
        ],
        check=True,
    )

    # Extract 3 key verification frames before cleaning temporary directory
    verify_dir = os.path.join(DOCS_DIR, "_verify_sample")
    os.makedirs(verify_dir, exist_ok=True)
    for sample_n in (10, max(1, frame_idx // 2), frame_idx - 5):
        src = os.path.join(FRAMES_DIR, f"frame_{sample_n:04d}.png")
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(verify_dir, f"keyframe_{sample_n:04d}.png"))

    shutil.rmtree(FRAMES_DIR, ignore_errors=True)
    if os.path.exists(PALETTE_PATH):
        os.remove(PALETTE_PATH)

    mp4_mb = os.path.getsize(mp4_out) / (1024 * 1024)
    gif_mb = os.path.getsize(gif_out) / (1024 * 1024)
    print(f"[✓] MP4 ready: {mp4_out} ({mp4_mb:.2f} MB)")
    print(f"[✓] GIF ready: {gif_out} ({gif_mb:.2f} MB)")


if __name__ == "__main__":
    main()
