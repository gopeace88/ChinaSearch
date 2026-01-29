#!/usr/bin/env python3
"""Save analysis artifacts for an iteration.

Usage:
  ./scripts/save_analysis.py <case_id> <iteration_no> --json /path/to/analysis.json --prompt /path/to/next.md

This is intentionally dumb: it only writes files to the right places.
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("case_id")
    p.add_argument("iteration_no", type=int)
    p.add_argument("--base", default=str(Path(__file__).resolve().parents[1] / "cases"))
    p.add_argument("--json", dest="json_path", required=True)
    p.add_argument("--prompt", dest="prompt_path", required=True)
    args = p.parse_args()

    base = Path(args.base).expanduser().resolve()
    case_dir = base / args.case_id
    it_dir = case_dir / "iterations"
    it_dir.mkdir(parents=True, exist_ok=True)

    analysis_dst = it_dir / f"iteration-{args.iteration_no:03d}.analysis.json"
    prompt_dst = it_dir / f"iteration-{args.iteration_no:03d}.next.md"

    analysis_dst.write_text(Path(args.json_path).read_text(encoding="utf-8"), encoding="utf-8")
    prompt_dst.write_text(Path(args.prompt_path).read_text(encoding="utf-8"), encoding="utf-8")

    print(f"saved: {analysis_dst.name}, {prompt_dst.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
