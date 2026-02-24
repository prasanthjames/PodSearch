#!/usr/bin/env python3
"""
whisper.cpp Batch Transcription Pipeline

Usage:
    python3 scripts/transcribe_batch.py --input episodes.csv --output transcripts/
    python3 scripts/transcribe_batch.py --url "https://episode.mp3" --output transcripts/
"""

import argparse
import csv
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Configuration
WHISPER_CPP_DIR = Path(__file__).parent.parent / "whisper.cpp"
WHISPER_MODEL = WHISPER_CPP_DIR / "models" / "ggml-base.en.bin"
WHISPER_MAIN = WHISPER_CPP_DIR / "main"

# Colors for output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"


def log(msg: str, level: str = "info"):
    """Colored logging."""
    prefix = {"info": "ℹ️ ", "success": "✅ ", "error": "❌ ", "warn": "⚠️ "}
    color = {"info": GREEN, "success": GREEN, "error": RED, "warn": YELLOW}
    print(f"{color.get(level, GREEN)}{prefix.get(level, 'ℹ️ ')}{msg}{RESET}")


def check_dependencies() -> bool:
    """Check if whisper.cpp and model are available."""
    if not WHISPER_MAIN.exists():
        log(f"whisper.cpp not found at {WHISPER_MAIN}", "error")
        log("Run: cd whisper.cpp && make && ./models/download-ggml-model.sh base.en", "warn")
        return False
    
    if not WHISPER_MODEL.exists():
        log(f"Model not found at {WHISPER_MODEL}", "error")
        log("Run: ./models/download-ggml-model.sh base.en", "warn")
        return False
    
    return True


def download_audio(url: str, output_path: Path) -> bool:
    """Download audio file from URL."""
    log(f"Downloading {url}...")
    result = subprocess.run(
        ["curl", "-L", "-o", str(output_path), url],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        log(f"Download failed: {result.stderr}", "error")
        return False
    
    # Check file size
    size_mb = output_path.stat().st_size / (1024 * 1024)
    log(f"Downloaded ({size_mb:.1f} MB)")
    return True


def transcribe_audio(audio_path: Path, output_dir: Path) -> Optional[Path]:
    """Transcribe audio using whisper.cpp."""
    episode_id = audio_path.stem
    output_file = output_dir / f"{episode_id}.txt"
    
    log(f"Transcribing {audio_path.name}...")
    
    cmd = [
        str(WHISPER_MAIN),
        "-m", str(WHISPER_MODEL),
        "-f", str(audio_path),
        "-otxt",
        "-o", str(output_dir),
        "--max-len", "60",  # Max line length
        "--split-on-word",   # Split on word boundaries
    ]
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=3600  # 1 hour timeout
    )
    
    if result.returncode != 0:
        log(f"Transcription failed: {result.stderr}", "error")
        return None
    
    if output_file.exists():
        log(f"Transcript saved: {output_file.name}", "success")
        return output_file
    else:
        log(f"Output file not created", "error")
        return None


def cleanup_audio(audio_path: Path):
    """Delete audio file to save storage."""
    if audio_path.exists():
        size_mb = audio_path.stat().st_size / (1024 * 1024)
        audio_path.unlink()
        log(f"Cleaned up {audio_path.name} ({size_mb:.1f} MB)")


def process_episode(url: str, output_dir: Path, keep_audio: bool = False) -> Optional[Path]:
    """Process a single episode: download → transcribe → cleanup."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate episode ID from URL
    episode_id = url.split("/")[-1].split(".")[0]
    audio_path = output_dir / f"{episode_id}.mp3"
    
    # Download
    if not download_audio(url, audio_path):
        return None
    
    # Transcribe
    transcript_path = transcribe_audio(audio_path, output_dir)
    
    # Cleanup (unless keep_audio is True)
    if not keep_audio:
        cleanup_audio(audio_path)
    
    return transcript_path


def process_csv(input_file: str, output_dir: str, limit: int = 0):
    """Process multiple episodes from CSV file."""
    input_path = Path(input_file)
    output_path = Path(output_dir)
    
    if not input_path.exists():
        log(f"Input file not found: {input_file}", "error")
        return
    
    log(f"Reading episodes from {input_file}...")
    
    with open(input_path, "r") as f:
        reader = csv.DictReader(f)
        episodes = list(reader)
    
    log(f"Found {len(episodes)} episodes to process")
    
    if limit > 0:
        episodes = episodes[:limit]
        log(f"Processing first {limit} episodes")
    
    success = 0
    failed = 0
    
    for i, episode in enumerate(episodes, 1):
        url = episode.get("url") or episode.get("audio_url")
        if not url:
            log(f"Skipping row {i}: no URL", "warn")
            continue
        
        log(f"\n[{i}/{len(episodes)}] Processing...")
        
        if process_episode(url, output_path):
            success += 1
        else:
            failed += 1
    
    log(f"\n{'='*50}")
    log(f"Processing complete!", "success")
    log(f"Success: {success}")
    log(f"Failed: {failed}")
    log(f"Total: {success + failed}")


def main():
    parser = argparse.ArgumentParser(
        description="Batch transcription using whisper.cpp"
    )
    parser.add_argument(
        "--input", "-i",
        help="CSV file with episode URLs (column: url or audio_url)"
    )
    parser.add_argument(
        "--url", "-u",
        help="Single episode URL to transcribe"
    )
    parser.add_argument(
        "--output", "-o",
        default="transcripts/",
        help="Output directory for transcripts (default: transcripts/)"
    )
    parser.add_argument(
        "--limit", "-l",
        type=int,
        default=0,
        help="Limit number of episodes to process (0 = all)"
    )
    parser.add_argument(
        "--keep-audio",
        action="store_true",
        help="Keep audio files after transcription"
    )
    
    args = parser.parse_args()
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    if args.input:
        process_csv(args.input, args.output, args.limit)
    elif args.url:
        process_episode(args.url, args.output, args.keep_audio)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
