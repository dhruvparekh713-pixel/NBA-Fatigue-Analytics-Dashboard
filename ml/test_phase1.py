"""Phase 1 sanity check — 5 games, verify quarterly splits add up.

Checks:
  1. Q1+Q2+Q3+Q4 PTS  == full-game PTS  (should be exact)
  2. Q1+Q2+Q3+Q4 MIN  ~= full-game MIN  (within 0.1 min rounding)
  3. Q1+Q2+Q3+Q4 FGA  == full-game FGA  (exact)
  4. Prints one spotlight player's quarter-by-quarter line for manual
     cross-check against NBA.com box scores.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd
import numpy as np
from nba_api.stats.endpoints import BoxScoreTraditionalV2, LeagueGameFinder

from src.scraper import _call_api, parse_minutes

SPOTLIGHT_PLAYER = "LeBron James"   # change if he didn't play those games
N_GAMES = 5


# ---------------------------------------------------------------------------

def get_game_sample(n: int = N_GAMES) -> pd.DataFrame:
    """Return the first N regular-season game IDs from 2024-25."""
    print(f"Fetching 2024-25 game schedule…")
    ep = _call_api(LeagueGameFinder,
                   season_nullable="2024-25",
                   season_type_nullable="Regular Season",
                   league_id_nullable="00")
    raw = ep.get_data_frames()[0]
    raw["GAME_DATE"] = pd.to_datetime(raw["GAME_DATE"])
    raw["IS_HOME"] = raw["MATCHUP"].str.contains(r"vs\.", regex=True)

    # One row per game (home team row), sorted chronologically
    home = (raw[raw["IS_HOME"]]
            .sort_values("GAME_DATE")
            .drop_duplicates("GAME_ID")
            [["GAME_ID", "GAME_DATE", "MATCHUP"]]
            .head(n)
            .reset_index(drop=True))
    return home


QUARTER_TIME_RANGES = {1: (0, 7200), 2: (7201, 14400), 3: (14401, 21600), 4: (21601, 28800)}

def fetch_quarters(game_id: str) -> pd.DataFrame:
    """Fetch Q1-Q4 separately using range_type=2 (the only mode that filters correctly)."""
    frames = []
    for period in [1, 2, 3, 4]:
        sr, er = QUARTER_TIME_RANGES[period]
        ep = _call_api(BoxScoreTraditionalV2,
                       game_id=game_id,
                       start_period=period, end_period=period,
                       start_range=sr, end_range=er, range_type=2)
        df = ep.player_stats.get_data_frame()
        if df.empty:
            continue
        df = df.copy()
        df["PERIOD"] = period
        df["MIN_DEC"] = df["MIN"].apply(parse_minutes)
        frames.append(df)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def fetch_full_game(game_id: str) -> pd.DataFrame:
    """Full-game box score (single call, default params = all periods)."""
    ep = _call_api(BoxScoreTraditionalV2,
                   game_id=game_id,
                   start_period=1, end_period=10,
                   start_range=0, end_range=28800, range_type=0)
    df = ep.player_stats.get_data_frame().copy()
    df["MIN_DEC"] = df["MIN"].apply(parse_minutes)
    return df


# ---------------------------------------------------------------------------

def verify_game(game_id: str, game_date: str, matchup: str) -> dict:
    """
    For one game: fetch quarters + full-game, then diff the two.
    Returns a summary dict with pass/fail counts.
    """
    print(f"\n{'='*60}")
    print(f"Game {game_id}  |  {game_date}  |  {matchup}")
    print(f"{'='*60}")

    quarterly = fetch_quarters(game_id)
    full_game  = fetch_full_game(game_id)

    if quarterly.empty or full_game.empty:
        print("  ERROR: empty data returned — skipping")
        return {"game_id": game_id, "players": 0, "pts_ok": 0, "min_ok": 0, "fga_ok": 0}

    # ── Aggregate quarterly totals per player ─────────────────────────────
    q_agg = (quarterly.groupby("PLAYER_ID")
             .agg(q_pts=("PTS", "sum"),
                  q_fga=("FGA", "sum"),
                  q_fgm=("FGM", "sum"),
                  q_min=("MIN_DEC", "sum"),
                  q_ast=("AST", "sum"),
                  q_reb=("REB", "sum"))
             .reset_index())

    full_cols = ["PLAYER_ID", "PLAYER_NAME", "MIN_DEC",
                 "PTS", "FGA", "FGM", "AST", "REB", "MIN"]
    full_sub  = full_game[full_cols].rename(
        columns={"MIN_DEC": "full_min", "PTS": "full_pts",
                 "FGA": "full_fga", "FGM": "full_fgm",
                 "AST": "full_ast", "REB": "full_reb"})

    merged = q_agg.merge(full_sub, on="PLAYER_ID", how="inner")

    # ── Checks ────────────────────────────────────────────────────────────
    merged["pts_match"] = merged["q_pts"]  == merged["full_pts"]
    merged["fga_match"] = merged["q_fga"]  == merged["full_fga"]
    merged["min_diff"]  = (merged["q_min"] - merged["full_min"]).abs()
    merged["min_match"] = merged["min_diff"] < 0.11          # < 6-sec rounding

    # Only check players who actually played (full_min > 0)
    played = merged[merged["full_min"] > 0]

    pts_ok = int(played["pts_match"].sum())
    fga_ok = int(played["fga_match"].sum())
    min_ok = int(played["min_match"].sum())
    n      = len(played)

    print(f"\n  Players with minutes: {n}")
    print(f"  PTS  match  : {pts_ok}/{n}  {'PASS' if pts_ok == n else 'FAIL MISMATCH'}")
    print(f"  FGA  match  : {fga_ok}/{n}  {'PASS' if fga_ok == n else 'FAIL MISMATCH'}")
    print(f"  MIN  match  : {min_ok}/{n}  {'PASS' if min_ok == n else 'FAIL MISMATCH'}")

    # ── Show any mismatches ───────────────────────────────────────────────
    bad_pts = played[~played["pts_match"]]
    bad_min = played[~played["min_match"]]
    if not bad_pts.empty:
        print(f"\n  PTS mismatches:")
        print(bad_pts[["PLAYER_NAME","q_pts","full_pts"]].to_string(index=False))
    if not bad_min.empty:
        print(f"\n  MIN mismatches (> 6 sec):")
        print(bad_min[["PLAYER_NAME","q_min","full_min","min_diff"]].to_string(index=False))

    # ── Spotlight player ──────────────────────────────────────────────────
    spotlight = quarterly[quarterly["PLAYER_NAME"].str.contains(
        SPOTLIGHT_PLAYER, case=False, na=False)]

    if spotlight.empty:
        # Fall back to highest-minutes player
        top_player = (quarterly.groupby("PLAYER_NAME")["MIN_DEC"]
                      .sum().idxmax())
        spotlight  = quarterly[quarterly["PLAYER_NAME"] == top_player]
        label      = f"(highest-minutes player — {top_player})"
    else:
        label = f"({SPOTLIGHT_PLAYER})"

    print(f"\n  Spotlight player {label}:")
    cols = ["PERIOD", "MIN", "MIN_DEC", "PTS", "FGA", "FGM",
            "FG3M", "FG3A", "AST", "REB", "TO", "PLUS_MINUS"]
    available = [c for c in cols if c in spotlight.columns]
    spot_display = spotlight[available].sort_values("PERIOD").reset_index(drop=True)
    spot_display.index = [f"Q{p}" for p in spot_display["PERIOD"]]

    # Add a totals row
    num_cols  = [c for c in ["MIN_DEC","PTS","FGA","FGM","FG3M","FG3A","AST","REB","TO"] if c in spot_display.columns]
    totals    = spot_display[num_cols].sum()
    totals["MIN"]    = "—"
    totals["PERIOD"] = "—"
    totals.name      = "TOTAL"

    print(pd.concat([spot_display, totals.to_frame().T]).to_string())

    # Full-game line for cross-check
    full_spot = full_game[full_game["PLAYER_NAME"].str.contains(
        spotlight.iloc[0]["PLAYER_NAME"], case=False, na=False)]
    if not full_spot.empty:
        row = full_spot.iloc[0]
        print(f"\n  Full-game API line (single call): "
              f"MIN={row['MIN']}  PTS={row['PTS']}  "
              f"FGA={row['FGA']}  AST={row['AST']}  REB={row['REB']}")
        print(f"  → Compare to NBA.com box score for {game_date}")
        print(f"    https://www.nba.com/game/{game_id}")

    return {"game_id": game_id, "players": n,
            "pts_ok": pts_ok, "fga_ok": fga_ok, "min_ok": min_ok}


# ---------------------------------------------------------------------------

def main():
    games = get_game_sample(N_GAMES)
    print(f"\nSample games:\n{games.to_string(index=False)}\n")

    results = []
    for _, row in games.iterrows():
        r = verify_game(
            game_id=str(row["GAME_ID"]).zfill(10),
            game_date=str(row["GAME_DATE"])[:10],
            matchup=row["MATCHUP"],
        )
        results.append(r)

    # ── Summary table ──────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    summary = pd.DataFrame(results)
    summary["pts_%"] = (summary["pts_ok"] / summary["players"] * 100).round(1)
    summary["fga_%"] = (summary["fga_ok"] / summary["players"] * 100).round(1)
    summary["min_%"] = (summary["min_ok"] / summary["players"] * 100).round(1)
    print(summary[["game_id","players","pts_%","fga_%","min_%"]].to_string(index=False))

    all_pass = (
        summary["pts_ok"].eq(summary["players"]).all() and
        summary["fga_ok"].eq(summary["players"]).all() and
        summary["min_ok"].eq(summary["players"]).all()
    )
    print(f"\n{'ALL CHECKS PASSED' if all_pass else 'FAILURES DETECTED -- see details above'}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
