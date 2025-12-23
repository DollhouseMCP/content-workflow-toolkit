#!/usr/bin/env python3
"""
Transcribe video/audio to SRT captions using OpenAI Whisper.

Usage:
    python transcribe.py <input_file> [--model MODEL] [--output OUTPUT]

Examples:
    python transcribe.py video.mp4
    python transcribe.py audio.wav --model large-v3
    python transcribe.py video.mp4 --output captions.srt
"""

import argparse
import sys
from pathlib import Path

try:
    import whisper
except ImportError:
    print("Error: OpenAI Whisper not installed.")
    print("Install with: pip install openai-whisper")
    print("Or: pip install git+https://github.com/openai/whisper.git")
    sys.exit(1)


def transcribe(
    input_file: str,
    model_name: str = "turbo",
    output_path: str | None = None,
    output_format: str = "srt"
) -> Path:
    """
    Transcribe audio/video file to SRT captions.

    Args:
        input_file: Path to input audio/video file
        model_name: Whisper model to use (tiny, base, small, medium, large-v3, turbo)
        output_path: Optional output path, defaults to input filename with .srt extension
        output_format: Output format (srt, vtt, txt, json)

    Returns:
        Path to output file
    """
    input_path = Path(input_file)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_file}")

    # Determine output path
    if output_path:
        out_path = Path(output_path)
    else:
        out_path = input_path.with_suffix(f".{output_format}")

    print(f"Loading Whisper model: {model_name}")
    model = whisper.load_model(model_name)

    print(f"Transcribing: {input_file}")
    result = model.transcribe(str(input_path))

    # Generate output based on format
    if output_format == "srt":
        content = generate_srt(result["segments"])
    elif output_format == "vtt":
        content = generate_vtt(result["segments"])
    elif output_format == "txt":
        content = result["text"]
    elif output_format == "json":
        import json
        content = json.dumps(result, indent=2)
    else:
        raise ValueError(f"Unsupported format: {output_format}")

    # Write output
    out_path.write_text(content)
    print(f"Output written to: {out_path}")

    return out_path


def format_timestamp(seconds: float, use_comma: bool = True) -> str:
    """Format seconds as SRT/VTT timestamp."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)

    sep = "," if use_comma else "."
    return f"{hours:02d}:{minutes:02d}:{secs:02d}{sep}{millis:03d}"


def generate_srt(segments: list) -> str:
    """Generate SRT format from segments."""
    lines = []
    for i, segment in enumerate(segments, 1):
        start = format_timestamp(segment["start"], use_comma=True)
        end = format_timestamp(segment["end"], use_comma=True)
        text = segment["text"].strip()
        lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(lines)


def generate_vtt(segments: list) -> str:
    """Generate WebVTT format from segments."""
    lines = ["WEBVTT\n"]
    for segment in segments:
        start = format_timestamp(segment["start"], use_comma=False)
        end = format_timestamp(segment["end"], use_comma=False)
        text = segment["text"].strip()
        lines.append(f"{start} --> {end}\n{text}\n")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe video/audio to captions using Whisper"
    )
    parser.add_argument("input", help="Input video or audio file")
    parser.add_argument(
        "--model", "-m",
        default="turbo",
        choices=["tiny", "base", "small", "medium", "large-v3", "turbo"],
        help="Whisper model to use (default: turbo)"
    )
    parser.add_argument(
        "--output", "-o",
        help="Output file path (default: input file with .srt extension)"
    )
    parser.add_argument(
        "--format", "-f",
        default="srt",
        choices=["srt", "vtt", "txt", "json"],
        help="Output format (default: srt)"
    )

    args = parser.parse_args()

    try:
        transcribe(
            args.input,
            model_name=args.model,
            output_path=args.output,
            output_format=args.format
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
