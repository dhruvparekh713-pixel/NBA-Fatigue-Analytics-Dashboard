"""Pydantic response models for the NBA Fatigue Dashboard API."""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


class GameSummary(BaseModel):
    game_id: str
    home_team: str
    away_team: str
    date: str
    n_predictions: int
    correct: int
    accuracy_pct: float


class GamesResponse(BaseModel):
    games: list[GameSummary]
    date: str


class PlayerPrediction(BaseModel):
    player_name: str
    team: str
    opponent: str
    game_id: str
    minutes_q1q3: float
    rest_days: float
    is_back_to_back: bool
    is_starter: bool
    player_age: float
    fatigue_risk_score: float
    predicted_q4_dropoff: float
    actual_q4_dropoff: float
    prediction_correct: bool
    q4_points_predicted: float
    q4_points_actual: float
    q4_ast_predicted: Optional[float] = None
    q4_ast_actual: Optional[float] = None


class PredictionSummary(BaseModel):
    total_players: int
    correct: int
    accuracy_pct: float


class PredictionsResponse(BaseModel):
    predictions: list[PlayerPrediction]
    summary: PredictionSummary
    date: str


class PlayerGame(BaseModel):
    game_id: str
    date: str
    opponent: str
    minutes_q1q3: float
    rest_days: float
    is_back_to_back: bool
    fatigue_risk_score: float
    predicted_q4_dropoff: float
    actual_q4_dropoff: float
    prediction_correct: bool
    q4_points_predicted: float
    q4_points_actual: float


class PlayerProfileResponse(BaseModel):
    name: str
    team: str
    player_age: float
    season_accuracy: float
    avg_fatigue_score: float
    total_games: int
    games: list[PlayerGame]


class CumulativePoint(BaseModel):
    date: str
    cumulative_correct: int
    cumulative_total: int
    cumulative_pct: float
    daily_correct: int
    daily_total: int


class CumulativeAccuracyResponse(BaseModel):
    data: list[CumulativePoint]


class SegmentStat(BaseModel):
    label: str
    correct: int
    total: int
    accuracy_pct: float


class SegmentsResponse(BaseModel):
    segments: dict[str, list[SegmentStat]]


class AccuracySplit(BaseModel):
    """Accuracy for one slice of the data, with its own honest baseline.

    `baseline_pct` is the majority-class rate — always predicting whichever
    direction is more common. That is the correct floor for a binary
    directional call; a coin flip or an "always predict up" baseline both
    understate it and inflate the apparent lift.
    """
    label: str
    total_predictions: int
    accuracy_pct: float
    baseline_pct: float
    lift_pct: float


class OverviewResponse(BaseModel):
    # Headline fields describe REAL backtest rows only.
    total_predictions: int
    overall_accuracy: float
    best_segment: str
    worst_segment: str
    baseline_accuracy: float
    improvement_pct: float

    # Catalog counts describe everything browsable in the UI (real + synthetic).
    total_games: int
    total_players: int

    # Full provenance breakdown.
    real: AccuracySplit
    synthetic: Optional[AccuracySplit] = None
    combined: AccuracySplit
    data_note: str


class DatesResponse(BaseModel):
    dates: list[str]
