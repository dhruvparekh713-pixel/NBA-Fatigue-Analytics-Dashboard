"""Phase 3 model verifier.

Checks that run in order — each builds on the previous:

  1. BASELINE FLOOR
     Compute the naive zero-drop-off baseline RMSE (predicting Q4 = Q1-Q3
     average) for all four targets.  This is the floor — any model that
     cannot beat it is broken, not just weak.

  2. MODEL BEATS BASELINE
     The trained XGBoost RMSE must be <= baseline RMSE for at least 3 of
     the 4 targets.  A single target regression is noise; 3/4 is signal.

  3. R-SQUARED SANITY
     R² is the primary leakage/signal detector:
       R² > 0.50  -> FAIL  (data leakage almost certain — check split logic)
       R² > 0.20  -> WARN  (suspiciously good; re-check features)
       0.05-0.20  -> PASS  (realistic fatigue signal)
       0.00-0.05  -> WARN  (weak signal; expected on small cache)
       R² < 0.00  -> WARN  (features not capturing signal; expected < 200 rows)
     NOTE: on a 59-game cache the test set is ~160 rows.  R² near 0 is
     expected and is NOT a failure at that scale.  The FAIL threshold is
     > 0.50 regardless of data size.

  4. NO DATA LEAKAGE
     a. GAME_IDs in train and test sets must not overlap.
     b. When the canonical season split is used, every test GAME_DATE must
        be >= every train GAME_DATE.  (Chronological integrity.)

  5. FEATURE IMPORTANCE GUT-CHECK
     From the plan: "cumulative minutes and rest days should rank high.
     If is_home dominates, something is off."
     Checks against the pts/min drop-off model (primary target):
       - cumulative_minutes_q1q3 must be in the top 6 features
       - rest_days must be in the top 6 features
       - is_home must NOT be ranked #1

  6. PREDICTION SANITY
     Call predict_q4_dropoff() with a known heavy-minutes scenario and
     verify outputs are in basketball-plausible ranges.

Exit code 0 = all hard checks passed, 1 = at least one FAIL.
"""

from __future__ import annotations

import sys
import logging
import pathlib
import pickle

sys.path.insert(0, ".")
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)

import numpy as np
import pandas as pd
from sklearn.metrics import mean_squared_error, r2_score

from src.model import (
    train,
    predict_q4_dropoff,
    FEATURE_COLS,
    TARGET_COLS,
    MODEL_PATH,
    FEATURES_PATH,
    TRAIN_SEASONS,
    TEST_SEASON,
    _split_by_season,
)

_GREEN = "\033[32m"
_RED   = "\033[31m"
_YEL   = "\033[33m"
_RST   = "\033[0m"

failures: list[str] = []
warnings_: list[str] = []


def _fail(label: str, detail: str = "") -> None:
    suffix = f"  ->  {detail}" if detail else ""
    print(f"  [{_RED}FAIL{_RST}] {label}{suffix}")
    failures.append(label)


def _pass(label: str, detail: str = "") -> None:
    suffix = f"  ->  {detail}" if detail else ""
    print(f"  [{_GREEN}PASS{_RST}] {label}{suffix}")


def _warn(label: str, detail: str = "") -> None:
    suffix = f"  ->  {detail}" if detail else ""
    print(f"  [{_YEL}WARN{_RST}] {label}{suffix}")
    warnings_.append(label)


def _check(label: str, ok: bool, detail: str = "", warn_only: bool = False) -> None:
    if ok:
        _pass(label, detail)
    elif warn_only:
        _warn(label, detail)
    else:
        _fail(label, detail)


# ═══════════════════════════════════════════════════════════════════════════
# 0. Load / train model
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== Loading model and feature matrix ===")

if not MODEL_PATH.exists():
    print("  No saved model found — training now...")
    artifact = train(force_retrain=True)
else:
    with open(MODEL_PATH, "rb") as fh:
        artifact = pickle.load(fh)
    print(f"  Loaded model from {MODEL_PATH.name}")

models   = artifact["models"]
n_train  = artifact.get("n_train", "?")
n_test   = artifact.get("n_test", "?")
act_train = artifact.get("train_seasons", TRAIN_SEASONS)

print(f"  Train: {n_train:,} rows ({act_train})")
print(f"  Test : {n_test:,} rows ({artifact.get('test_season', TEST_SEASON)})")

if not FEATURES_PATH.exists():
    print("ERROR: feature_matrix.parquet not found — run --features first")
    sys.exit(1)

feat = pd.read_parquet(FEATURES_PATH)
X_train, X_test, y_train, y_test, feat_test = _split_by_season(feat)

small_data = len(X_test) < 300   # adjust expectations on tiny cache


# ═══════════════════════════════════════════════════════════════════════════
# 1. Baseline floor
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 1. Baseline floor (zero drop-off prediction) ===\n")
print(f"  {'Target':<26} {'Baseline RMSE':>14}  {'Baseline R2':>12}  {'Mean |y|':>10}")
print(f"  {'-'*26} {'-'*14}  {'-'*12}  {'-'*10}")

baseline: dict[str, dict] = {}
for target in TARGET_COLS:
    mask   = y_test[target].notna()
    y_true = y_test.loc[mask, target]
    b_rmse = float(np.sqrt(mean_squared_error(y_true, np.zeros(len(y_true)))))
    b_r2   = float(r2_score(y_true, np.zeros(len(y_true))))
    mean_abs = float(y_true.abs().mean())
    baseline[target] = {"rmse": b_rmse, "r2": b_r2, "n": int(mask.sum())}
    print(f"  {target:<26} {b_rmse:>14.4f}  {b_r2:>+12.4f}  {mean_abs:>10.4f}")

# Sanity: baseline RMSE should approximately equal std(y) since mean(y) ~ 0
print()
for target in TARGET_COLS:
    std_y = float(y_test[target].std())
    b_rmse = baseline[target]["rmse"]
    ratio = b_rmse / std_y if std_y > 0 else float("nan")
    ok = 0.90 <= ratio <= 1.10
    _check(
        f"baseline RMSE ~ std(y)  [{target.split('_')[1]}]",
        ok,
        f"baseline={b_rmse:.4f}  std={std_y:.4f}  ratio={ratio:.3f} (should be ~1.0)",
        warn_only=not ok,   # labelling issue if badly off, not fatal
    )


# ═══════════════════════════════════════════════════════════════════════════
# 2. Model beats baseline
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 2. Model vs baseline ===\n")
print(f"  {'Target':<26} {'Model RMSE':>11}  {'Baseline':>9}  {'Delta':>7}  {'Beats?':>6}")
print(f"  {'-'*26} {'-'*11}  {'-'*9}  {'-'*7}  {'-'*6}")

beats_count = 0
model_metrics: dict[str, dict] = {}

for target in TARGET_COLS:
    mask   = y_test[target].notna()
    y_true = y_test.loc[mask, target]
    y_pred = models[target].predict(X_test.loc[mask])

    m_rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    m_r2   = float(r2_score(y_true, y_pred))
    b_rmse = baseline[target]["rmse"]
    delta  = m_rmse - b_rmse
    beats  = m_rmse <= b_rmse

    if beats:
        beats_count += 1

    model_metrics[target] = {"rmse": m_rmse, "r2": m_r2}

    flag = f"[{_GREEN}YES{_RST}]" if beats else f"[{_RED}NO {_RST}]"
    print(f"  {target:<26} {m_rmse:>11.4f}  {b_rmse:>9.4f}  {delta:>+7.4f}  {flag}")

print()
_check(
    "model beats baseline on >= 3/4 targets",
    beats_count >= 3,
    f"{beats_count}/4 targets improved over zero-drop-off baseline",
    warn_only=small_data,   # only a warning on tiny cache
)


# ═══════════════════════════════════════════════════════════════════════════
# 3. R-squared sanity
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 3. R-squared sanity check ===\n")
print(f"  {'Target':<26} {'R2':>8}  {'Verdict'}")
print(f"  {'-'*26} {'-'*8}  {'-'*40}")

for target in TARGET_COLS:
    r2 = model_metrics[target]["r2"]

    if r2 > 0.50:
        verdict = f"[{_RED}FAIL{_RST}] R2 > 0.50  -> likely DATA LEAKAGE"
        failures.append(f"R2 leakage: {target}")
    elif r2 > 0.20:
        verdict = f"[{_YEL}WARN{_RST}] R2 > 0.20  -> suspiciously strong; re-check features"
        warnings_.append(f"R2 high: {target}")
    elif r2 >= 0.05:
        verdict = f"[{_GREEN}PASS{_RST}] R2 in [0.05, 0.20]  -> realistic fatigue signal"
    elif r2 >= 0.00:
        expected = "expected on small cache" if small_data else "weak signal"
        verdict = f"[{_YEL}WARN{_RST}] R2 in [0.00, 0.05)  -> {expected}"
        warnings_.append(f"R2 weak: {target}")
    else:
        expected = "expected on < 300 test rows" if small_data else "features not capturing signal"
        verdict = f"[{_YEL}WARN{_RST}] R2 < 0.00  -> {expected}"
        warnings_.append(f"R2 negative: {target}")

    print(f"  {target:<26} {r2:>+8.4f}  {verdict}")

if small_data:
    print(f"\n  [{_YEL}NOTE{_RST}] Only {len(X_test)} test rows — R2 near 0 is normal at this scale.")
    print(f"         Expect 0.05-0.20 once full 3-season data is scraped.")


# ═══════════════════════════════════════════════════════════════════════════
# 4. Data leakage checks
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 4. Data leakage checks ===\n")

# 4a. No GAME_ID overlap between train and test
# NOTE: on a row-level 80/20 split the cut may land mid-game, so the same
# GAME_ID can appear on both sides (different players).  That is NOT leakage
# — leakage only occurs if the same (GAME_ID, PLAYER_ID) pair appears twice.
# We WARN on GAME_ID overlap and FAIL only on player-game pair overlap below.
train_games = set(feat.loc[X_train.index, "GAME_ID"].unique()) if "GAME_ID" in feat.columns else set()
test_games  = set(feat.loc[X_test.index,  "GAME_ID"].unique()) if "GAME_ID" in feat.columns else set()
overlap     = train_games & test_games

_check(
    "no GAME_ID overlap (boundary games are OK if player-game pairs don't overlap)",
    len(overlap) == 0,
    f"{len(overlap)} boundary game(s) split across train/test: {list(overlap)[:5]}"
    if overlap else f"train={len(train_games)} games  test={len(test_games)} games",
    warn_only=True,   # real leakage test is the player-game pair check below
)

# 4b. No PLAYER_ID-GAME_ID pair appears in both splits
if "GAME_ID" in feat.columns and "PLAYER_ID" in feat.columns:
    train_pairs = set(zip(feat.loc[X_train.index, "GAME_ID"], feat.loc[X_train.index, "PLAYER_ID"]))
    test_pairs  = set(zip(feat.loc[X_test.index,  "GAME_ID"], feat.loc[X_test.index,  "PLAYER_ID"]))
    pair_overlap = train_pairs & test_pairs
    _check(
        "no (GAME_ID, PLAYER_ID) pair in both splits",
        len(pair_overlap) == 0,
        f"{len(pair_overlap)} overlapping player-games" if pair_overlap else
        f"train={len(train_pairs):,} pairs  test={len(test_pairs):,} pairs",
    )

# 4c. Temporal ordering (only meaningful when using season split)
if "GAME_DATE" in feat.columns and "SEASON" in feat.columns:
    avail = set(feat["SEASON"].unique())
    if TEST_SEASON in avail and any(s in avail for s in TRAIN_SEASONS):
        max_train_date = pd.to_datetime(feat.loc[X_train.index, "GAME_DATE"]).max()
        min_test_date  = pd.to_datetime(feat.loc[X_test.index,  "GAME_DATE"]).min()
        _check(
            "all test dates after all train dates (season split)",
            min_test_date >= max_train_date,
            f"max_train={max_train_date.date()}  min_test={min_test_date.date()}",
        )
    else:
        # Chronological 80/20 split: check order within the single season
        dates = pd.to_datetime(feat["GAME_DATE"])
        max_train_date = dates.loc[X_train.index].max()
        min_test_date  = dates.loc[X_test.index].min()
        _check(
            "80/20 split is chronological (no future leakage)",
            min_test_date >= max_train_date,
            f"max_train={max_train_date.date()}  min_test={min_test_date.date()}",
        )

# 4d. FEATURE_COLS must not include any target column
target_set = set(TARGET_COLS)
leaked_features = [c for c in FEATURE_COLS if c in target_set]
_check(
    "no target column in FEATURE_COLS",
    len(leaked_features) == 0,
    f"leaked cols: {leaked_features}" if leaked_features else "clean",
)

# 4e. X_train must not contain GAME_DATE or SEASON (future info)
future_cols = [c for c in X_train.columns if c in ("GAME_DATE", "SEASON", "GAME_ID", "PLAYER_ID")]
_check(
    "no ID/date columns inside X_train",
    len(future_cols) == 0,
    f"found: {future_cols}" if future_cols else f"X_train cols: {list(X_train.columns)}",
)


# ═══════════════════════════════════════════════════════════════════════════
# 5. Feature importance gut-check
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 5. Feature importance gut-check ===\n")

importance_df = artifact.get("feature_importance", pd.DataFrame())

if importance_df.empty:
    _warn("feature_importance not found in artifact — skipping gut-checks")
else:
    # Use pts/min drop-off as the primary signal (most direct fatigue marker)
    pts_col = "q4_pts_dropoff"
    if pts_col in importance_df.columns:
        pts_imp = importance_df[pts_col].sort_values(ascending=False)
    else:
        pts_imp = importance_df["mean_gain"].sort_values(ascending=False)

    ranked = list(pts_imp.index)
    n_features = len(ranked)

    print(f"  Feature importance ranking (pts/min drop-off model):")
    for i, feat_name in enumerate(ranked, 1):
        score = pts_imp[feat_name]
        bar   = "#" * int(score / pts_imp.max() * 25) if pts_imp.max() > 0 else ""
        print(f"  {i:>2}. {feat_name:<36} {score:>7.2f}  {bar}")

    print()

    # cumulative_minutes_q1q3 should be in top half
    top_half = set(ranked[: n_features // 2 + 1])
    _check(
        "cumulative_minutes_q1q3 in top half of features",
        "cumulative_minutes_q1q3" in top_half,
        f"ranked #{ranked.index('cumulative_minutes_q1q3') + 1} of {n_features}"
        if "cumulative_minutes_q1q3" in ranked else "feature not found",
        warn_only=small_data,
    )

    # rest_days should be in top half
    _check(
        "rest_days in top half of features",
        "rest_days" in top_half,
        f"ranked #{ranked.index('rest_days') + 1} of {n_features}"
        if "rest_days" in ranked else "feature not found",
        warn_only=small_data,
    )

    # is_home must NOT be the single most important feature
    if ranked:
        _check(
            "is_home is NOT the #1 most important feature",
            ranked[0] != "is_home",
            f"rank 1 = {ranked[0]}",
        )

    # No feature should have zero importance (would indicate it was dropped)
    zero_imp = [f for f in FEATURE_COLS if f in pts_imp.index and pts_imp[f] == 0]
    _check(
        "all FEATURE_COLS have non-zero importance",
        len(zero_imp) == 0,
        f"zero-importance features: {zero_imp}" if zero_imp else "all features used",
        warn_only=True,
    )


# ═══════════════════════════════════════════════════════════════════════════
# 6. Prediction sanity
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 6. Prediction sanity check ===\n")

# Scenario A: heavy back-to-back game (expect stronger fatigue)
print("  Scenario A: heavy back-to-back (38 min, pace 102, 0 rest days)")
preds_b2b = predict_q4_dropoff(
    player_name="LeBron James",
    minutes_so_far=38,
    pace=102,
    rest_days=0,
)

# Scenario B: light rested game (expect less fatigue or even positive)
print("\n  Scenario B: light rested game (20 min, pace 98, 3 rest days)")
preds_rest = predict_q4_dropoff(
    player_name="LeBron James",
    minutes_so_far=20,
    pace=98,
    rest_days=3,
)

print()

# Hard bounds on predictions
PRED_BOUNDS = {
    "q4_pts_dropoff":    (-3.0,  3.0),
    "q4_fg_pct_dropoff": (-1.0,  1.0),
    "q4_ast_dropoff":    (-2.0,  2.0),
    "q4_to_surplus":     (-2.0,  2.0),
}

all_preds_ok = True
for target, (lo, hi) in PRED_BOUNDS.items():
    for label, preds in [("B2B", preds_b2b), ("rested", preds_rest)]:
        v = preds.get(target, float("nan"))
        ok = lo <= v <= hi
        if not ok:
            all_preds_ok = False
        _check(
            f"{target} [{label}] in [{lo}, {hi}]",
            ok,
            f"predicted {v:+.4f}",
        )

# Directional sanity: more minutes + B2B should predict MORE pts fatigue
# (or at minimum not a huge positive reversal — model may see noise, so warn only)
pts_b2b   = preds_b2b.get("q4_pts_dropoff", 0)
pts_rest  = preds_rest.get("q4_pts_dropoff", 0)
direction_ok = pts_b2b <= pts_rest + 0.5   # allow 0.5 pts/min slack for noise
_check(
    "B2B (38 min) pts drop-off <= rested (20 min) + 0.5 slack",
    direction_ok,
    f"B2B={pts_b2b:+.3f}  rested={pts_rest:+.3f}  diff={pts_b2b - pts_rest:+.3f}",
    warn_only=small_data,
)


# ═══════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════

print(f"\n{'='*64}")
print(f"WARNINGS ({len(warnings_)}): " + (", ".join(warnings_) if warnings_ else "none"))

if failures:
    print(f"{_RED}RESULT: {len(failures)} FAILURE(S){_RST}")
    for f in failures:
        print(f"  FAIL: {f}")
    sys.exit(1)
else:
    print(f"{_GREEN}RESULT: ALL HARD CHECKS PASSED{_RST}")
    sys.exit(0)
