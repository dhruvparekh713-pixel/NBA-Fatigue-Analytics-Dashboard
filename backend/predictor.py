"""Online inference — loads the trained XGBoost artifact and scores one
player-game on demand.

This is the request-path counterpart to the offline batch scoring in
`ml/src/evaluate.py`. The feature vector is assembled the same way the
training CLI does it (see `ml/src/model.py::predict_q4_dropoff`): start from
that player's median profile, fall back to league medians for anything
missing, then overlay the live context the caller supplies.

Loading is lazy and failure is non-fatal — if xgboost or the pickle is
unavailable the API still serves every other route, and /api/predict
returns 503.
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any, Optional

import pandas as pd

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent / "data" / "fatigue_model.pkl"

# Must match ml/src/model.py::FEATURE_COLS — XGBoost scores by column order.
FEATURE_COLS: list[str] = [
    "cumulative_minutes_q1q3",
    "pace_q1q3",
    "usage_trend",
    "fg_pct_trend",
    "rest_days",
    "season_minutes_load",
    "game_pace",
    "score_diff_entering_q4",
    "is_home",
    "player_age",
    "minutes_per_game_season_avg",
]

TARGET_LABELS: dict[str, str] = {
    "q4_pts_dropoff": "Points per minute",
    "q4_fg_pct_dropoff": "Field goal percentage",
    "q4_ast_dropoff": "Assists per minute",
    "q4_to_surplus": "Turnovers per minute",
}

_artifact: Optional[dict[str, Any]] = None
_load_error: Optional[str] = None


def load_model() -> bool:
    """Load the artifact once at startup. Returns True on success."""
    global _artifact, _load_error

    if _artifact is not None:
        return True

    if not MODEL_PATH.exists():
        _load_error = f"Model artifact not found at {MODEL_PATH.name}"
        logger.warning(_load_error)
        return False

    try:
        import xgboost  # noqa: F401  — unpickling the regressors requires it
    except ImportError:
        _load_error = "xgboost is not installed; online inference unavailable"
        logger.warning(_load_error)
        return False

    try:
        with MODEL_PATH.open("rb") as fh:
            _artifact = pickle.load(fh)
    except Exception as exc:  # corrupt pickle, version skew, etc.
        _load_error = f"Failed to load model artifact: {exc}"
        logger.warning(_load_error)
        return False

    logger.info(
        "Loaded %d models trained on %d player-games from %s",
        len(_artifact.get("models", {})),
        _artifact.get("n_train", 0),
        _artifact.get("train_seasons", ["?"]),
    )
    return True


def is_ready() -> bool:
    return _artifact is not None


def status() -> dict[str, Any]:
    """Metadata for the health/readiness surface."""
    if _artifact is None:
        return {"ready": False, "error": _load_error}
    return {
        "ready": True,
        "targets": list(_artifact.get("models", {})),
        "n_train": _artifact.get("n_train"),
        "n_test": _artifact.get("n_test"),
        "train_seasons": _artifact.get("train_seasons"),
        "trained_at": _artifact.get("trained_at"),
        "known_players": len(_artifact.get("player_profiles", {})),
    }


def find_player(name: str) -> Optional[str]:
    """Case-insensitive partial match against known profile keys.

    Mirrors ml/src/model.py::_find_player so the API and the CLI resolve
    the same name to the same profile.
    """
    if _artifact is None:
        return None
    profiles = _artifact.get("player_profiles", {})
    query = name.lower().strip()
    if query in profiles:
        return query
    matches = [k for k in profiles if query in k or k in query]
    return max(matches, key=len) if matches else None


def predict(
    player_name: str,
    minutes_so_far: float,
    pace: float,
    rest_days: float,
    score_diff: Optional[float] = None,
    is_home: Optional[bool] = None,
) -> dict[str, Any]:
    """Score one player entering Q4.

    Returns the four target predictions plus which profile was used, so the
    caller can tell a player-specific estimate from a league-median guess.
    """
    if _artifact is None:
        raise RuntimeError(_load_error or "Model not loaded")

    profiles = _artifact.get("player_profiles", {})
    medians = _artifact.get("feature_medians", {})

    player_key = find_player(player_name)
    base: dict[str, float] = dict(medians)
    if player_key:
        base.update(profiles[player_key])

    # Live context overrides the profile. pace fills both the Q1-Q3 and
    # whole-game pace features — the caller only observes one number.
    base["cumulative_minutes_q1q3"] = float(minutes_so_far)
    base["pace_q1q3"] = float(pace)
    base["game_pace"] = float(pace)
    base["rest_days"] = float(rest_days)
    if is_home is not None:
        base["is_home"] = float(is_home)

    # Score margin and home/away are only overridden when the caller supplies
    # them; otherwise the player's profile value stands, falling back to a
    # tied game. This mirrors the setdefault in ml/src/model.py so the API and
    # the CLI return identical numbers for identical input.
    if score_diff is not None:
        base["score_diff_entering_q4"] = float(score_diff)
    else:
        base.setdefault("score_diff_entering_q4", 0.0)

    row = {c: float(base.get(c, 0.0)) for c in FEATURE_COLS}
    fv = pd.DataFrame([row], columns=FEATURE_COLS)

    predictions = {
        target: round(float(model.predict(fv)[0]), 4)
        for target, model in _artifact["models"].items()
    }

    return {
        "player_name": player_name,
        "matched_profile": player_key,
        "used_league_medians": player_key is None,
        "features_used": row,
        "predictions": predictions,
    }
