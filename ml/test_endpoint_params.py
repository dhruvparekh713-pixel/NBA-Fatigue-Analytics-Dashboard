"""Diagnostic: find the correct BoxScoreTraditionalV2 params for per-quarter stats.

Tests three parameter strategies against LAL vs MIN 2024-10-22 (0022400062).
LeBron's known full-game line: 16 pts, 36 min, 16 FGA.
If a strategy returns 16 pts for "Q1", it's returning the full game, not Q1.
"""

import sys
sys.path.insert(0, ".")

import pandas as pd
from nba_api.stats.endpoints import BoxScoreTraditionalV2
from src.scraper import _call_api, parse_minutes

GAME_ID   = "0022400062"   # LAL vs MIN, 2024-10-22
PLAYER    = "LeBron James"

# Quarter time boundaries in tenths of seconds
QUARTER_RANGES = {
    1: (0,     7200),
    2: (7200,  14400),
    3: (14400, 21600),
    4: (21600, 28800),
}

def fetch(label, **kwargs):
    ep = _call_api(BoxScoreTraditionalV2, game_id=GAME_ID, **kwargs)
    df = ep.player_stats.get_data_frame()
    row = df[df["PLAYER_NAME"] == PLAYER]
    if row.empty:
        print(f"  {label}: LeBron not found")
        return
    r = row.iloc[0]
    mins = parse_minutes(r["MIN"])
    print(f"  {label:55s}  MIN={r['MIN']} ({mins:.1f})  PTS={r['PTS']}  FGA={r['FGA']}")

print(f"Game: {GAME_ID}  (LAL vs MIN, 2024-10-22)")
print(f"LeBron full-game truth: 16 pts, 34:39 min, 16 FGA")
print(f"Expected Q1-only line:  ~4-6 pts, ~8-10 min\n")

# ── Strategy A: range_type=0 + period filter + end_range=0 (current broken) ──
print("Strategy A — range_type=0, period filter, end_range=0 (current):")
for p in [1, 2, 3, 4]:
    fetch(f"  Q{p} start_period={p} end_period={p} end_range=0",
          start_period=p, end_period=p,
          start_range=0, end_range=0, range_type=0)

# ── Strategy B: range_type=0 + period filter + end_range=28800 ───────────────
print("\nStrategy B — range_type=0, period filter, end_range=28800:")
for p in [1, 2, 3, 4]:
    fetch(f"  Q{p} start_period={p} end_period={p} end_range=28800",
          start_period=p, end_period=p,
          start_range=0, end_range=28800, range_type=0)

# ── Strategy C: range_type=1 + time-range per quarter ────────────────────────
print("\nStrategy C — range_type=1, time-based ranges:")
for p, (sr, er) in QUARTER_RANGES.items():
    fetch(f"  Q{p} start_range={sr} end_range={er} range_type=1",
          start_period=1, end_period=4,
          start_range=sr, end_range=er, range_type=1)

# ── Strategy D: range_type=2 + period + time range combined ──────────────────
print("\nStrategy D — range_type=2, combined period + time range:")
for p, (sr, er) in QUARTER_RANGES.items():
    fetch(f"  Q{p} start_period={p} end_period={p} range_type=2",
          start_period=p, end_period=p,
          start_range=sr, end_range=er, range_type=2)
