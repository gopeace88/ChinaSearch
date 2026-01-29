#!/usr/bin/env python3
"""Create a new ChinaSearch case folder with starter files.

Usage:
  ./scripts/create_case.py <case_id> --goal "..." [--decision "..."]

Case ID suggestion: YYYY-MM-DD-<short-slug>
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("case_id")
    p.add_argument("--goal", required=True)
    p.add_argument("--decision", default="")
    p.add_argument("--base", default=str(Path(__file__).resolve().parents[1] / "cases"))
    args = p.parse_args()

    base = Path(args.base).expanduser().resolve()
    case_dir = base / args.case_id
    it_dir = case_dir / "iterations"
    it_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc).isoformat()
    case_json = {
        "case_id": args.case_id,
        "created_at": now,
        "goal": args.goal,
        "decision_context": args.decision,
        "settings": {
            "approval_required": True,
            "autorun_max_iterations": 0,
            "evidence_top_k_fetch": 5,
        },
        "attachments": [],
    }
    state_json = {
        "research_goal": args.goal,
        "decision_context": args.decision,
        "assumptions": [],
        "current_hypotheses": [],
        "evidence_list": [],
        "uncertainties": [],
        "confidence_score": 0,
        "next_questions": [],
        "iteration_count": 0,
        "stop_reason": None,
        "updated_at": now,
    }

    (case_dir / "case.json").write_text(json.dumps(case_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (case_dir / "state.json").write_text(json.dumps(state_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(str(case_dir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
