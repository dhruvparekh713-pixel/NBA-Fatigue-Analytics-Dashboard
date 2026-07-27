"""Investigate the FGA mismatch in games 4 and 5.

Hypothesis: a field goal attempt at the exact quarter boundary (clock=0.0)
is being double-counted or dropped by the time-range filter.
"""
import sys
sys.path.insert(0, ".")

import pandas as pd
from nba_api.stats.endpoints import BoxScoreTraditionalV2
from src.scraper import _call_api, parse_minutes

QUARTER_TIME_RANGES = {1: (0, 7200), 2: (7200, 14400), 3: (14400, 21600), 4: (21600, 28800)}

def check_game(game_id, label):
    print(f"\n{label}  ({game_id})")

    # Full game
    ep_full = _call_api(BoxScoreTraditionalV2, game_id=game_id,
                        start_period=1, end_period=10,
                        start_range=0, end_range=28800, range_type=0)
    full = ep_full.player_stats.get_data_frame().set_index("PLAYER_ID")

    # Quarterly aggregated
    frames = []
    for p, (sr, er) in QUARTER_TIME_RANGES.items():
        ep = _call_api(BoxScoreTraditionalV2, game_id=game_id,
                       start_period=p, end_period=p,
                       start_range=sr, end_range=er, range_type=2)
        df = ep.player_stats.get_data_frame().copy()
        df["PERIOD"] = p
        frames.append(df)

    quarterly = pd.concat(frames, ignore_index=True)
    q_agg = quarterly.groupby("PLAYER_ID").agg(
        q_fga=("FGA", "sum"), q_pts=("PTS", "sum"),
        PLAYER_NAME=("PLAYER_NAME", "first")).reset_index()

    # Find mismatches
    merged = q_agg.merge(full[["PLAYER_NAME","FGA","PTS","MIN"]].reset_index(),
                         on="PLAYER_ID", suffixes=("_q","_full"))
    bad = merged[merged["q_fga"] != merged["FGA"]]

    if bad.empty:
        print("  All FGA match")
    else:
        print(f"  FGA mismatches ({len(bad)} players):")
        for _, r in bad.iterrows():
            diff = r["q_fga"] - r["FGA"]
            print(f"    {r['PLAYER_NAME_q']:30s}  q_sum={r['q_fga']}  full={r['FGA']}  diff={diff:+.0f}")
            # Show the per-quarter breakdown for this player
            pq = quarterly[quarterly["PLAYER_ID"] == r["PLAYER_ID"]][
                ["PERIOD","MIN","FGA","PTS"]].sort_values("PERIOD")
            print(f"    {pq.to_string(index=False)}")

check_game("0022400064", "ATL vs BKN  2024-10-23")
check_game("0022400065", "MIA vs ORL  2024-10-23")
