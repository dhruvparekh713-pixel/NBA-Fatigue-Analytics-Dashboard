"""Loads and enriches the backtest parquet into an in-memory DataFrame.

If backtest_2024_25.parquet is missing or too small, falls back to
generate_synthetic_data() which creates a realistic full-season demo.
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).parent / "data"

_TEAM_ABB = [
    "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN",
    "DET", "GSW", "HOU", "IND", "LAC", "LAL", "MEM", "MIA",
    "MIL", "MIN", "NOP", "NYK", "OKC", "ORL", "PHI", "PHX",
    "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
]

_STAR_PLAYERS = [
    "LeBron James", "Stephen Curry", "Kevin Durant", "Nikola Jokic",
    "Giannis Antetokounmpo", "Jayson Tatum", "Luka Doncic", "Joel Embiid",
    "Damian Lillard", "Devin Booker", "Anthony Davis", "Kawhi Leonard",
    "Paul George", "Jimmy Butler", "Donovan Mitchell", "Trae Young",
    "Tyrese Haliburton", "Shai Gilgeous-Alexander", "Ja Morant",
    "Zion Williamson",
]


def load_backtest() -> pd.DataFrame:
    """Load and enrich the backtest DataFrame.

    Joins team abbreviations from game_ids and adds derived columns
    needed by the API (fatigue_risk_score, prediction_correct, etc.).

    Falls back to synthetic data if real data not found.
    """
    bt_path = DATA_DIR / "backtest_2024_25.parquet"
    fm_path = DATA_DIR / "feature_matrix.parquet"
    gid_path = DATA_DIR / "game_ids" / "game_ids_2024-25.parquet"

    if bt_path.exists() and fm_path.exists() and gid_path.exists():
        bt = pd.read_parquet(bt_path)
        fm_cols = ["GAME_ID", "PLAYER_ID", "TEAM_ID"]
        fm_full = pd.read_parquet(fm_path)
        if "cumulative_minutes_q1q3" in fm_full.columns:
            fm_cols.append("cumulative_minutes_q1q3")
        fm = fm_full[fm_cols]
        gids = pd.read_parquet(gid_path)

        # Attach TEAM_ID to backtest rows
        bt = bt.merge(fm, on=["GAME_ID", "PLAYER_ID"], how="left")

        # Build team abb lookup: TEAM_ID → abbreviation
        home = gids[["GAME_ID", "HOME_TEAM_ID", "HOME_TEAM_ABB"]].rename(
            columns={"HOME_TEAM_ID": "TEAM_ID", "HOME_TEAM_ABB": "TEAM_ABB"}
        )
        away = gids[["GAME_ID", "AWAY_TEAM_ID", "AWAY_TEAM_ABB"]].rename(
            columns={"AWAY_TEAM_ID": "TEAM_ID", "AWAY_TEAM_ABB": "TEAM_ABB"}
        )
        team_abb = (
            pd.concat([home, away], ignore_index=True)
            .drop_duplicates(["GAME_ID", "TEAM_ID"])
        )
        bt = bt.merge(team_abb, on=["GAME_ID", "TEAM_ID"], how="left")
        bt["TEAM_ABB"] = bt["TEAM_ABB"].fillna("UNK")

        # Opponent abbreviation (the other team in the same game)
        opp_map = _build_opponent_map(gids)
        bt["OPP_ABB"] = bt.apply(
            lambda r: opp_map.get((r["GAME_ID"], r["TEAM_ABB"]), "UNK"), axis=1
        )

        bt = _add_derived_columns(bt)
        bt = _extend_to_full_season(bt)
        return bt

    print("WARNING: Real data not found — generating synthetic demo dataset")
    return generate_synthetic_data()


def _build_opponent_map(gids: pd.DataFrame) -> dict:
    m = {}
    for _, row in gids.iterrows():
        m[(row["GAME_ID"], row["HOME_TEAM_ABB"])] = row["AWAY_TEAM_ABB"]
        m[(row["GAME_ID"], row["AWAY_TEAM_ABB"])] = row["HOME_TEAM_ABB"]
    return m


def _add_derived_columns(bt: pd.DataFrame) -> pd.DataFrame:
    """Compute fatigue_risk_score and prediction_correct."""
    # Fatigue risk: 0-100 scale from cumulative minutes + rest days penalty
    # Higher minutes and fewer rest days → higher risk
    if "cumulative_minutes_q1q3" in bt.columns:
        cum_min = bt["cumulative_minutes_q1q3"]
    else:
        cum_min = bt["minutes_q4"] * 3

    rest = bt["rest_days"].clip(upper=7)
    minutes_norm = (cum_min.clip(0, 36) / 36 * 60)
    rest_penalty = ((7 - rest) / 7 * 40)
    bt["fatigue_risk_score"] = (minutes_norm + rest_penalty).clip(0, 100).round(1)

    # prediction_correct: model predicted direction (sign) correctly
    bt["prediction_correct"] = (
        np.sign(bt["pts_dropoff_pred"]) == np.sign(bt["pts_rate_actual"] - bt["pts_rate_q1q3"])
    ).astype(bool)

    bt["actual_pts_dropoff"] = (bt["pts_rate_actual"] - bt["pts_rate_q1q3"]).round(4)
    bt["predicted_pts_dropoff"] = bt["pts_dropoff_pred"].round(4)

    bt["GAME_DATE"] = pd.to_datetime(bt["GAME_DATE"])
    bt["date_str"] = bt["GAME_DATE"].dt.strftime("%Y-%m-%d")

    return bt


def _extend_to_full_season(real_bt: pd.DataFrame) -> pd.DataFrame:
    """Extend the real backtest with synthetic data to simulate a full season.

    Real data covers Oct 22–30. We generate synthetic rows for Nov–Apr
    so the dashboard has a full season of data to display.
    """
    rng = np.random.default_rng(42)

    real_dates = pd.date_range("2024-10-22", "2024-10-30")
    synthetic_dates = pd.date_range("2024-11-01", "2025-04-13")

    teams = _TEAM_ABB.copy()
    player_pool = _build_player_pool_from_real(real_bt)

    records = []
    game_counter = 100

    for date in synthetic_dates:
        # ~5-7 games per day on average
        n_games = rng.integers(4, 9)
        shuffled_teams = rng.permutation(teams)
        used = 0
        for g in range(min(n_games, len(shuffled_teams) // 2)):
            home = shuffled_teams[used]
            away = shuffled_teams[used + 1]
            used += 2
            game_id = f"SYN{game_counter:06d}"
            game_counter += 1

            n_players = rng.integers(10, 15)
            for _ in range(n_players):
                player = rng.choice(player_pool)
                rest = rng.choice([0, 1, 2, 3, 4, 5], p=[0.1, 0.15, 0.3, 0.25, 0.12, 0.08])
                cum_min = rng.uniform(8, 36)
                pts_q1q3_rate = rng.uniform(0.2, 0.9)
                true_drop = rng.normal(-0.04, 0.2)
                pred_drop = true_drop + rng.normal(0, 0.12)
                q4_min = rng.uniform(3, 12)
                is_starter = rng.random() < 0.55
                age = rng.uniform(21, 38)

                team_abb = home if rng.random() < 0.5 else away
                opp_abb = away if team_abb == home else home
                records.append({
                    "GAME_ID": game_id,
                    "PLAYER_ID": hash(player["name"]) % 10_000_000,
                    "PLAYER_NAME": player["name"],
                    "GAME_DATE": date,
                    "SEASON": "2024-25",
                    "minutes_q4": round(q4_min, 2),
                    "is_home": float(team_abb == home),
                    "rest_days": float(rest),
                    "is_back_to_back": float(rest == 0),
                    "START_POSITION": "G" if is_starter else "",
                    "player_age": round(age, 1),
                    "pts_rate_q1q3": round(pts_q1q3_rate, 4),
                    "pts_dropoff_pred": round(float(pred_drop), 4),
                    "pts_rate_pred_fatigue": round(pts_q1q3_rate + pred_drop, 4),
                    "pts_rate_actual": round(pts_q1q3_rate + true_drop, 4),
                    "pts_pred_fatigue": round((pts_q1q3_rate + pred_drop) * q4_min, 4),
                    "pts_pred_naive": round(pts_q1q3_rate * q4_min, 4),
                    "pts_actual": max(0, int(round((pts_q1q3_rate + true_drop) * q4_min))),
                    "ast_rate_q1q3": round(rng.uniform(0.05, 0.3), 4),
                    "ast_dropoff_pred": round(float(rng.normal(-0.01, 0.05)), 4),
                    "ast_rate_actual": round(rng.uniform(0.0, 0.35), 4),
                    "ast_pred_fatigue": round(rng.uniform(0, 2), 4),
                    "ast_pred_naive": round(rng.uniform(0, 2), 4),
                    "ast_actual": max(0, int(rng.integers(0, 5))),
                    "to_rate_q1q3": round(rng.uniform(0, 0.15), 4),
                    "to_dropoff_pred": round(float(rng.normal(0, 0.03)), 4),
                    "to_rate_actual": round(rng.uniform(0, 0.2), 4),
                    "to_actual": max(0, int(rng.integers(0, 3))),
                    "fg_pct_rate_q1q3": round(rng.uniform(0.3, 0.6), 4),
                    "fg_pct_dropoff_pred": round(float(rng.normal(-0.01, 0.05)), 4),
                    "fg_pct_rate_actual": round(rng.uniform(0.25, 0.65), 4),
                    "is_starter": is_starter,
                    "TEAM_ABB": team_abb,
                    "OPP_ABB": opp_abb,
                    "cumulative_minutes_q1q3": round(cum_min, 2),
                })

    synth_df = pd.DataFrame(records)
    synth_df = _add_derived_columns(synth_df)

    # Provenance flag — the headline metrics report real rows only, since
    # synthetic predictions are built as (truth + noise) and their accuracy
    # is an artifact of that construction rather than model skill.
    real_bt = real_bt.copy()
    real_bt["is_synthetic"] = False
    synth_df["is_synthetic"] = True

    combined = pd.concat([real_bt, synth_df], ignore_index=True)
    combined["GAME_DATE"] = pd.to_datetime(combined["GAME_DATE"])
    combined["date_str"] = combined["GAME_DATE"].dt.strftime("%Y-%m-%d")
    return combined


def _build_player_pool_from_real(bt: pd.DataFrame) -> list[dict]:
    players = []
    for name in bt["PLAYER_NAME"].unique():
        players.append({"name": name})
    # Add star players not in the small real dataset
    existing = {p["name"] for p in players}
    for s in _STAR_PLAYERS:
        if s not in existing:
            players.append({"name": s})
    return players


def generate_synthetic_data(n_games: int = 600) -> pd.DataFrame:
    """Generate a full synthetic season dataset for demo purposes."""
    rng = np.random.default_rng(99)
    teams = _TEAM_ABB.copy()
    players = [{"name": n} for n in _STAR_PLAYERS]
    for i in range(200):
        players.append({"name": f"Player {i+21}"})

    all_dates = pd.date_range("2024-10-22", "2025-04-13")
    records = []
    game_counter = 0

    for date in all_dates:
        if game_counter >= n_games:
            break
        n_today = rng.integers(3, 9)
        shuffled = rng.permutation(teams)
        used = 0
        for _ in range(min(n_today, len(shuffled) // 2)):
            if game_counter >= n_games:
                break
            home = shuffled[used]
            away = shuffled[used + 1]
            used += 2
            game_id = f"SYN{game_counter:06d}"
            game_counter += 1

            for _ in range(rng.integers(10, 16)):
                p = rng.choice(players)
                rest = int(rng.choice([0, 1, 2, 3, 4], p=[0.1, 0.15, 0.35, 0.25, 0.15]))
                cum_min = rng.uniform(8, 36)
                pts_q1q3_rate = rng.uniform(0.2, 0.9)
                true_drop = rng.normal(-0.04, 0.2)
                pred_drop = true_drop + rng.normal(0, 0.12)
                q4_min = rng.uniform(3, 12)
                is_starter = rng.random() < 0.55
                age = rng.uniform(21, 38)

                team_abb = home if rng.random() < 0.5 else away
                opp_abb = away if team_abb == home else home
                records.append({
                    "GAME_ID": game_id,
                    "PLAYER_ID": hash(p["name"]) % 10_000_000,
                    "PLAYER_NAME": p["name"],
                    "GAME_DATE": date,
                    "SEASON": "2024-25",
                    "minutes_q4": round(q4_min, 2),
                    "is_home": float(team_abb == home),
                    "rest_days": float(rest),
                    "is_back_to_back": float(rest == 0),
                    "START_POSITION": "G" if is_starter else "",
                    "player_age": round(age, 1),
                    "pts_rate_q1q3": round(pts_q1q3_rate, 4),
                    "pts_dropoff_pred": round(float(pred_drop), 4),
                    "pts_rate_pred_fatigue": round(pts_q1q3_rate + pred_drop, 4),
                    "pts_rate_actual": round(pts_q1q3_rate + true_drop, 4),
                    "pts_pred_fatigue": round((pts_q1q3_rate + pred_drop) * q4_min, 4),
                    "pts_pred_naive": round(pts_q1q3_rate * q4_min, 4),
                    "pts_actual": max(0, int(round((pts_q1q3_rate + true_drop) * q4_min))),
                    "ast_rate_q1q3": round(rng.uniform(0.05, 0.3), 4),
                    "ast_dropoff_pred": round(float(rng.normal(-0.01, 0.05)), 4),
                    "ast_rate_actual": round(rng.uniform(0.0, 0.35), 4),
                    "ast_pred_fatigue": round(rng.uniform(0, 2), 4),
                    "ast_pred_naive": round(rng.uniform(0, 2), 4),
                    "ast_actual": max(0, int(rng.integers(0, 5))),
                    "to_actual": max(0, int(rng.integers(0, 3))),
                    "is_starter": is_starter,
                    "TEAM_ABB": team_abb,
                    "OPP_ABB": opp_abb,
                    "cumulative_minutes_q1q3": round(cum_min, 2),
                    "fg_pct_rate_q1q3": round(rng.uniform(0.3, 0.6), 4),
                    "fg_pct_dropoff_pred": round(float(rng.normal(-0.01, 0.05)), 4),
                    "fg_pct_rate_actual": round(rng.uniform(0.25, 0.65), 4),
                })

    df = pd.DataFrame(records)
    df = _add_derived_columns(df)
    df["is_synthetic"] = True  # this whole path is the no-real-data fallback
    return df
