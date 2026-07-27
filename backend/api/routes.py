"""FastAPI route handlers for the NBA Fatigue Dashboard."""

from __future__ import annotations

import urllib.parse
from typing import Any, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException

import predictor
from api.schemas import (
    AccuracySplit,
    CumulativeAccuracyResponse,
    CumulativePoint,
    DatesResponse,
    GamesResponse,
    GameSummary,
    OverviewResponse,
    PlayerGame,
    PlayerPrediction,
    PlayerProfileResponse,
    PredictRequest,
    PredictResponse,
    PredictedTarget,
    PredictionSummary,
    PredictionsResponse,
    SegmentStat,
    SegmentsResponse,
)

router = APIRouter()

# Injected by main.py on startup
_df: pd.DataFrame | None = None


def set_dataframe(df: pd.DataFrame) -> None:
    global _df
    _df = df


def _get_df() -> pd.DataFrame:
    if _df is None:
        raise HTTPException(500, "Data not loaded")
    return _df


# ---------------------------------------------------------------------------
# GET /api/dates
# ---------------------------------------------------------------------------

@router.get("/dates", response_model=DatesResponse)
def get_dates():
    df = _get_df()
    dates = sorted(df["date_str"].dropna().unique().tolist())
    return DatesResponse(dates=dates)


# ---------------------------------------------------------------------------
# GET /api/games/{date}
# ---------------------------------------------------------------------------

@router.get("/games/{date}", response_model=GamesResponse)
def get_games(date: str):
    df = _get_df()
    day = df[df["date_str"] == date]
    if day.empty:
        raise HTTPException(404, f"No games found for date {date}")

    games = []
    for gid, grp in day.groupby("GAME_ID"):
        # Collect all distinct teams mentioned across TEAM_ABB and OPP_ABB in the group
        teams_in_game = set()
        if "TEAM_ABB" in grp.columns:
            teams_in_game.update(grp["TEAM_ABB"].dropna().unique())
        if "OPP_ABB" in grp.columns:
            teams_in_game.update(grp["OPP_ABB"].dropna().unique())
        teams_in_game.discard("UNK")

        if len(teams_in_game) >= 2:
            sorted_teams = sorted(teams_in_game)
            home_team, away_team = sorted_teams[0], sorted_teams[1]
        elif len(teams_in_game) == 1:
            home_team = list(teams_in_game)[0]
            away_team = "UNK"
        else:
            home_team, away_team = "HOM", "AWY"

        n = len(grp)
        correct = int(grp["prediction_correct"].sum())
        acc = round(correct / n * 100, 1) if n > 0 else 0.0
        games.append(GameSummary(
            game_id=str(gid),
            home_team=str(home_team),
            away_team=str(away_team),
            date=date,
            n_predictions=n,
            correct=correct,
            accuracy_pct=acc,
        ))

    return GamesResponse(games=games, date=date)


# ---------------------------------------------------------------------------
# GET /api/predictions/{date}
# ---------------------------------------------------------------------------

@router.get("/predictions/{date}", response_model=PredictionsResponse)
def get_predictions(date: str):
    df = _get_df()
    day = df[df["date_str"] == date]
    if day.empty:
        raise HTTPException(404, f"No predictions found for date {date}")

    preds = []
    for _, row in day.iterrows():
        cum_min = float(row.get("cumulative_minutes_q1q3", row.get("minutes_q4", 0) * 3))
        preds.append(PlayerPrediction(
            player_name=str(row["PLAYER_NAME"]),
            team=str(row.get("TEAM_ABB", "UNK")),
            opponent=str(row.get("OPP_ABB", "UNK")),
            game_id=str(row["GAME_ID"]),
            minutes_q1q3=round(cum_min, 1),
            rest_days=float(row["rest_days"]),
            is_back_to_back=bool(row["is_back_to_back"]),
            is_starter=bool(row.get("is_starter", row.get("START_POSITION", "") != "")),
            player_age=float(row.get("player_age", 26)),
            fatigue_risk_score=float(row.get("fatigue_risk_score", 50)),
            predicted_q4_dropoff=round(float(row.get("pts_dropoff_pred", 0)), 4),
            actual_q4_dropoff=round(float(row.get("actual_pts_dropoff", 0)), 4),
            prediction_correct=bool(row["prediction_correct"]),
            q4_points_predicted=round(float(row.get("pts_pred_fatigue", 0)), 1),
            q4_points_actual=round(float(row.get("pts_actual", 0)), 1),
            q4_ast_predicted=round(float(row["ast_pred_fatigue"]), 1) if "ast_pred_fatigue" in row and pd.notna(row["ast_pred_fatigue"]) else None,
            q4_ast_actual=round(float(row["ast_actual"]), 1) if "ast_actual" in row and pd.notna(row["ast_actual"]) else None,
        ))

    n = len(preds)
    correct = sum(1 for p in preds if p.prediction_correct)
    acc = round(correct / n * 100, 1) if n > 0 else 0.0

    return PredictionsResponse(
        predictions=preds,
        summary=PredictionSummary(total_players=n, correct=correct, accuracy_pct=acc),
        date=date,
    )


# ---------------------------------------------------------------------------
# GET /api/player/{player_name}
# ---------------------------------------------------------------------------

@router.get("/player/{player_name}", response_model=PlayerProfileResponse)
def get_player(player_name: str):
    df = _get_df()
    # URL-decode name
    decoded = urllib.parse.unquote(player_name)
    mask = df["PLAYER_NAME"].str.lower() == decoded.lower()
    if not mask.any():
        # Partial match
        mask = df["PLAYER_NAME"].str.lower().str.contains(decoded.lower(), regex=False)
    if not mask.any():
        raise HTTPException(404, f"Player '{decoded}' not found")

    sub = df[mask].sort_values("GAME_DATE")
    name = str(sub["PLAYER_NAME"].iloc[0])
    team = str(sub["TEAM_ABB"].iloc[0]) if "TEAM_ABB" in sub.columns else "UNK"
    age = float(sub["player_age"].median()) if "player_age" in sub.columns else 26.0
    total = len(sub)
    correct = int(sub["prediction_correct"].sum())
    season_acc = round(correct / total * 100, 1) if total > 0 else 0.0
    avg_fat = round(float(sub["fatigue_risk_score"].mean()), 1)

    games = []
    for _, row in sub.iterrows():
        cum_min = float(row.get("cumulative_minutes_q1q3", row.get("minutes_q4", 0) * 3))
        games.append(PlayerGame(
            game_id=str(row["GAME_ID"]),
            date=str(row["date_str"]),
            opponent=str(row.get("OPP_ABB", "UNK")),
            minutes_q1q3=round(cum_min, 1),
            rest_days=float(row["rest_days"]),
            is_back_to_back=bool(row["is_back_to_back"]),
            fatigue_risk_score=float(row.get("fatigue_risk_score", 50)),
            predicted_q4_dropoff=round(float(row.get("pts_dropoff_pred", 0)), 4),
            actual_q4_dropoff=round(float(row.get("actual_pts_dropoff", 0)), 4),
            prediction_correct=bool(row["prediction_correct"]),
            q4_points_predicted=round(float(row.get("pts_pred_fatigue", 0)), 1),
            q4_points_actual=round(float(row.get("pts_actual", 0)), 1),
        ))

    return PlayerProfileResponse(
        name=name,
        team=team,
        player_age=round(age, 1),
        season_accuracy=season_acc,
        avg_fatigue_score=avg_fat,
        total_games=total,
        games=games,
    )


# ---------------------------------------------------------------------------
# GET /api/players/search?q=
# ---------------------------------------------------------------------------

@router.get("/players/search")
def search_players(q: str = ""):
    df = _get_df()
    if not q:
        names = sorted(df["PLAYER_NAME"].unique().tolist())[:50]
    else:
        mask = df["PLAYER_NAME"].str.lower().str.contains(q.lower(), regex=False)
        names = sorted(df[mask]["PLAYER_NAME"].unique().tolist())[:20]
    return {"players": names}


# ---------------------------------------------------------------------------
# GET /api/accuracy/cumulative
# ---------------------------------------------------------------------------

@router.get("/accuracy/cumulative", response_model=CumulativeAccuracyResponse)
def get_cumulative_accuracy():
    df = _get_df()
    daily = (
        df.groupby("date_str")
        .agg(daily_correct=("prediction_correct", "sum"), daily_total=("prediction_correct", "count"))
        .reset_index()
        .sort_values("date_str")
    )
    daily["cumulative_correct"] = daily["daily_correct"].cumsum()
    daily["cumulative_total"] = daily["daily_total"].cumsum()
    daily["cumulative_pct"] = (daily["cumulative_correct"] / daily["cumulative_total"] * 100).round(2)

    points = []
    for _, row in daily.iterrows():
        points.append(CumulativePoint(
            date=str(row["date_str"]),
            cumulative_correct=int(row["cumulative_correct"]),
            cumulative_total=int(row["cumulative_total"]),
            cumulative_pct=float(row["cumulative_pct"]),
            daily_correct=int(row["daily_correct"]),
            daily_total=int(row["daily_total"]),
        ))
    return CumulativeAccuracyResponse(data=points)


# ---------------------------------------------------------------------------
# GET /api/accuracy/segments
# ---------------------------------------------------------------------------

@router.get("/accuracy/segments", response_model=SegmentsResponse)
def get_segment_accuracy():
    df = _get_df()

    def _seg(grp_col: str, label_fn) -> list[SegmentStat]:
        stats = []
        for key, sub in df.groupby(grp_col):
            label = label_fn(key)
            n = len(sub)
            c = int(sub["prediction_correct"].sum())
            acc = round(c / n * 100, 1) if n > 0 else 0.0
            stats.append(SegmentStat(label=label, correct=c, total=n, accuracy_pct=acc))
        return stats

    # Role
    by_role = []
    if "is_starter" in df.columns:
        starter_series = df["is_starter"]
    elif "START_POSITION" in df.columns:
        starter_series = df["START_POSITION"].notna() & (df["START_POSITION"] != "")
    else:
        starter_series = pd.Series(False, index=df.index)
    for starter, sub in df.groupby(starter_series):
        label = "Starters" if starter else "Bench"
        n = len(sub)
        c = int(sub["prediction_correct"].sum())
        by_role.append(SegmentStat(label=label, correct=c, total=n, accuracy_pct=round(c / n * 100, 1) if n > 0 else 0))

    # Rest status
    def _rest_label(d: float) -> str:
        if d == 0:
            return "Back-to-Back"
        elif d <= 1:
            return "1 Rest Day"
        else:
            return "2+ Rest Days"

    rest_bins = df["rest_days"].apply(lambda d: "B2B" if d == 0 else ("1 day" if d <= 1 else "2+ days"))
    by_rest = []
    for key in ["B2B", "1 day", "2+ days"]:
        sub = df[rest_bins == key]
        if sub.empty:
            continue
        n = len(sub)
        c = int(sub["prediction_correct"].sum())
        labels = {"B2B": "Back-to-Back", "1 day": "1 Rest Day", "2+ days": "2+ Rest Days"}
        by_rest.append(SegmentStat(label=labels[key], correct=c, total=n, accuracy_pct=round(c / n * 100, 1)))

    # Age group
    by_age = []
    if "player_age" in df.columns:
        age_bins = pd.cut(df["player_age"], bins=[0, 25, 30, 99], labels=["Under 25", "25-30", "30+"])
        for key in ["Under 25", "25-30", "30+"]:
            sub = df[age_bins == key]
            if sub.empty:
                continue
            n = len(sub)
            c = int(sub["prediction_correct"].sum())
            by_age.append(SegmentStat(label=str(key), correct=c, total=n, accuracy_pct=round(c / n * 100, 1)))

    # Minutes load
    by_minutes = []
    if "cumulative_minutes_q1q3" in df.columns:
        med = df["cumulative_minutes_q1q3"].median()
        for label, sub in [("High Minutes", df[df["cumulative_minutes_q1q3"] > med]),
                            ("Low Minutes", df[df["cumulative_minutes_q1q3"] <= med])]:
            n = len(sub)
            if n == 0:
                continue
            c = int(sub["prediction_correct"].sum())
            by_minutes.append(SegmentStat(label=label, correct=c, total=n, accuracy_pct=round(c / n * 100, 1)))

    return SegmentsResponse(segments={
        "by_role": by_role,
        "by_rest": by_rest,
        "by_age": by_age,
        "by_minutes": by_minutes,
    })


# ---------------------------------------------------------------------------
# POST /api/predict  — online inference
# ---------------------------------------------------------------------------

@router.post("/predict", response_model=PredictResponse)
def predict_q4(req: PredictRequest):
    """Score one player entering Q4 by running the model in the request path.

    Distinct from every other route here: the rest of the API reads
    predictions that were batch-scored offline into Parquet, whereas this
    one loads the XGBoost artifact and evaluates it live.
    """
    if not predictor.is_ready():
        raise HTTPException(
            503,
            f"Online inference unavailable: {predictor.status().get('error', 'model not loaded')}",
        )

    try:
        result = predictor.predict(
            player_name=req.player_name,
            minutes_so_far=req.minutes_so_far,
            pace=req.pace,
            rest_days=req.rest_days,
            score_diff=req.score_diff,
            is_home=req.is_home,
        )
    except Exception as exc:
        raise HTTPException(500, f"Prediction failed: {exc}")

    targets = [
        PredictedTarget(
            target=name,
            label=predictor.TARGET_LABELS.get(name, name),
            value=value,
        )
        for name, value in result["predictions"].items()
    ]

    # Same 60/40 heuristic the dashboard displays, applied to live input so
    # the number is comparable to the ones in the game tables.
    minutes_norm = min(max(req.minutes_so_far, 0.0), 36.0) / 36.0 * 60.0
    rest_penalty = (7.0 - min(req.rest_days, 7.0)) / 7.0 * 40.0
    fatigue = round(min(max(minutes_norm + rest_penalty, 0.0), 100.0), 1)

    st = predictor.status()
    note = (
        f"Model trained on {st.get('n_train')} player-games from "
        f"{st.get('train_seasons')}. Negative values indicate a predicted decline in Q4."
    )
    if result["used_league_medians"]:
        note += (
            f" '{req.player_name}' is not in the training data — league-median "
            "features were used, so treat this as a generic estimate."
        )

    return PredictResponse(
        player_name=result["player_name"],
        matched_profile=result["matched_profile"],
        used_league_medians=result["used_league_medians"],
        fatigue_risk_score=fatigue,
        predictions=targets,
        features_used=result["features_used"],
        model_note=note,
    )


@router.get("/predict/status")
def predict_status():
    """Whether online inference is available, and what the model is."""
    return predictor.status()


# ---------------------------------------------------------------------------
# GET /api/stats/overview
# ---------------------------------------------------------------------------

def _accuracy_split(label: str, sub: pd.DataFrame) -> Optional[AccuracySplit]:
    """Accuracy and majority-class baseline for one slice of the data."""
    n = len(sub)
    if n == 0:
        return None

    acc = round(int(sub["prediction_correct"].sum()) / n * 100, 1)

    # Majority class: always call whichever direction is more common. This is
    # the right floor for a binary sign call — a coin flip understates it, and
    # the old "always predict up" baseline (45%) scored *below* chance, which
    # made the model's lift look roughly twice as large as it is.
    dropped = (sub["actual_pts_dropoff"] < 0).mean()
    baseline = round(max(dropped, 1 - dropped) * 100, 1)

    return AccuracySplit(
        label=label,
        total_predictions=n,
        accuracy_pct=acc,
        baseline_pct=baseline,
        lift_pct=round(acc - baseline, 1),
    )


@router.get("/stats/overview", response_model=OverviewResponse)
def get_overview():
    df = _get_df()
    if df.empty:
        raise HTTPException(404, "No data loaded")

    # Provenance split. Rows without the flag predate it and are treated as real.
    synth_mask = df["is_synthetic"] if "is_synthetic" in df.columns else pd.Series(False, index=df.index)
    real_df = df[~synth_mask]
    synth_df = df[synth_mask]

    real = _accuracy_split("Real backtest", real_df)
    synthetic = _accuracy_split("Synthetic demo season", synth_df)
    combined = _accuracy_split("All displayed rows", df)

    # Headline reports real rows when we have them; the synthetic-only
    # fallback dataset has no real rows to report.
    headline = real or combined
    headline_df = real_df if real is not None else df

    # Best/worst segment, computed on the same rows as the headline.
    segs = _compute_all_segment_accuracies(headline_df)
    best = max(segs, key=lambda s: s["acc"])["label"] if segs else "N/A"
    worst = min(segs, key=lambda s: s["acc"])["label"] if segs else "N/A"

    if synthetic is not None:
        note = (
            f"Accuracy is measured on {headline.total_predictions:,} real backtest rows. "
            f"The dashboard also displays {synthetic.total_predictions:,} synthetic player-games "
            "generated to exercise the UI at full-season scale; their predictions are built as "
            "(truth + noise), so that accuracy is an artifact of construction, not model skill."
        )
    else:
        note = f"Accuracy is measured on {headline.total_predictions:,} real backtest rows."

    return OverviewResponse(
        total_predictions=headline.total_predictions,
        overall_accuracy=headline.accuracy_pct,
        baseline_accuracy=headline.baseline_pct,
        improvement_pct=headline.lift_pct,
        best_segment=best,
        worst_segment=worst,
        total_games=int(df["GAME_ID"].nunique()),
        total_players=int(df["PLAYER_NAME"].nunique()),
        real=headline,
        synthetic=synthetic,
        combined=combined,
        data_note=note,
    )


def _compute_all_segment_accuracies(df: pd.DataFrame) -> list[dict]:
    segs = []

    def _add(label: str, sub: pd.DataFrame):
        n = len(sub)
        if n < 5:
            return
        c = int(sub["prediction_correct"].sum())
        segs.append({"label": label, "acc": round(c / n * 100, 1)})

    if "is_starter" in df.columns:
        is_starter = df["is_starter"]
    elif "START_POSITION" in df.columns:
        is_starter = df["START_POSITION"].notna() & (df["START_POSITION"] != "")
    else:
        is_starter = pd.Series(False, index=df.index)
    _add("Starters", df[is_starter])
    _add("Bench", df[~is_starter])

    if "rest_days" in df.columns:
        _add("Back-to-Back", df[df["rest_days"] == 0])
        _add("Rested", df[df["rest_days"] > 0])

    if "player_age" in df.columns:
        _add("Under 25", df[df["player_age"] < 25])
        _add("30+", df[df["player_age"] >= 30])

    return segs
