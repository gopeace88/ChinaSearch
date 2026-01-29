#!/usr/bin/env python3
"""Save a captured iteration payload into a case folder.

Input is JSON on stdin (or --in file) containing at least:
  { text: string, links: [{href,text}], source: {...} }

Writes:
  iterations/iteration-XXX.raw.md
  iterations/iteration-XXX.capture.json
  increments state.json iteration_count
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("case_id")
    p.add_argument("--base", default=str(Path(__file__).resolve().parents[1] / "cases"))
    p.add_argument("--in", dest="in_path", default="")
    args = p.parse_args()

    base = Path(args.base).expanduser().resolve()
    case_dir = base / args.case_id
    it_dir = case_dir / "iterations"
    it_dir.mkdir(parents=True, exist_ok=True)

    payload_text = Path(args.in_path).read_text(encoding="utf-8") if args.in_path else __import__("sys").stdin.read()
    payload = json.loads(payload_text)

    state_path = case_dir / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {"iteration_count": 0}
    it_no = int(state.get("iteration_count", 0)) + 1

    ts = datetime.now(timezone.utc).isoformat()

    raw_md = f"# Iteration {it_no}\n\n" + (payload.get("text") or "") + "\n"
    (it_dir / f"iteration-{it_no:03d}.raw.md").write_text(raw_md, encoding="utf-8")
    (it_dir / f"iteration-{it_no:03d}.capture.json").write_text(json.dumps({**payload, "captured_at": ts}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    state["iteration_count"] = it_no
    state["updated_at"] = ts
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"iteration={it_no}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
