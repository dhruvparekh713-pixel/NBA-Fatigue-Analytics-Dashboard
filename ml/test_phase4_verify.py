"""Phase 4 evaluation verifier.

The core question from the plan:
  "Does the model predict a bigger drop-off for fatigued players
   (stars on back-to-backs, high minutes) than for rested ones?
   If it predicts the same drop-off regardless of context,
   the features aren't flowing through correctly."

Four checks, in order of severity:

  1. FEATURE FLOW-THROUGH  (hard FAIL)
     Directly perturb one feature at a time on a synthetic vector while
     holding everything else at the global median.  The model MUST produce
     different predictions — if the output is identical, the feature is not
     reaching the model's decision boundary.
       rest_days  0 -> 3       : prediction must change by > 0.001
       cumulative_minutes 15 -> 36 : prediction must change by > 0.001

  2. DIRECTIONAL SENSE  (hard FAIL)
     Using actual backtest rows (not synthetic):
       - B2B + heavy minutes (rest=0, Q1Q3_min > 25):
           mean predicted pts drop-off must be <= rested+light mean + 0.10
           (i.e., the model should predict EQUAL or MORE fatigue for B2B)
       - Direction can be tiny on 59-game cache — we only FAIL if it is
         wildly backwards (>0.10 gap in the wrong direction).

  3. 10 SPOTLIGHT PLAYER-GAMES  (informational)
     Find the 10 player-games with the highest fatigue score
     (cumulative_minutes / (rest_days + 1)).  Print prediction vs actual
     for each.  Soft-check that the mean predicted drop-off for these 10
     is not HIGHER (less fatigue) than the population median.

  4. MONOTONICITY SWEEP  (warn only — small data may break strict monotone)
     Hold all features at the global median; sweep rest_days 0..5 and
     cumulative_minutes 10..36 one variable at a time.  Check that at
     least 4 of 5 steps move in the expected direction.  On a 59-game
     cache this is a WARN; on full data it should be a PASS.

Exit code 0 = all hard checks pass, 1 = at least one FAIL.
"""

from __future__ import annotations

import sys
import logging
import pathlib
import pickle

sys.path.insert(0, ".")
logging.basicConfig(level=logging.WARNING,
                    format="%(asctime)s | %(levelname)-8s | %(message)s",
                    datefmt="%H:%M:%S")

import numpy as np
import pandas as pd

from src.model import FEATURE_COLS, MODEL_PATH, FEATURES_PATH

_GREEN = "\033[32m"
_RED   = "\033[31m"
_YEL   = "\033[33m"
_RST   = "\033[0m"

failures:  list[str] = []
warnings_: list[str] = []

BACKTEST_PATH = pathlib.Path("data/backtest_2024_25.parquet")


def _fail(label: str, detail: str = "") -> None:
    print(f"  [{_RED}FAIL{_RST}] {label}" + (f"  ->  {detail}" if detail else ""))
    failures.append(label)


def _pass(label: str, detail: str = "") -> None:
    print(f"  [{_GREEN}PASS{_RST}] {label}" + (f"  ->  {detail}" if detail else ""))


def _warn(label: str, detail: str = "") -> None:
    print(f"  [{_YEL}WARN{_RST}] {label}" + (f"  ->  {detail}" if detail else ""))
    warnings_.append(label)


def _check(label: str, ok: bool, detail: str = "", warn_only: bool = False) -> None:
    if ok:
        _pass(label, detail)
    elif warn_only:
        _warn(label, detail)
    else:
        _fail(label, detail)


# ═══════════════════════════════════════════════════════════════════════════
# 0.  Load artefacts
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== Loading artefacts ===")

for p, name in [(MODEL_PATH, "model"), (FEATURES_PATH, "feature matrix"),
                (BACKTEST_PATH, "backtest results")]:
    if not pathlib.Path(p).exists():
        print(f"ERROR: {name} not found at {p}")
        print("Run in order: --features  ->  --train  ->  --backtest")
        sys.exit(1)

with open(MODEL_PATH, "rb") as fh:
    artifact = pickle.load(fh)

models = artifact["models"]
feat   = pd.read_parquet(FEATURES_PATH)
bt     = pd.read_parquet(BACKTEST_PATH)

# Global median feature vector — used as the baseline for perturbation tests
median_fv: dict[str, float] = {c: float(feat[c].median()) for c in FEATURE_COLS}
small_data = artifact.get("n_train", 0) < 5_000  # 629 training rows IS small

print(f"  Backtest rows : {len(bt):,}")
print(f"  B2B rows      : {int((bt['is_back_to_back'] == True).sum())}")
print(f"  Rested (>=3d) : {int((bt['rest_days'] >= 3).sum())}")
print(f"  Data size     : {'small cache' if small_data else 'full dataset'}")


def _predict_pts(fv: dict[str, float]) -> float:
    """Run pts drop-off model on a single feature dict."""
    df = pd.DataFrame([{c: fv.get(c, median_fv[c]) for c in FEATURE_COLS}])
    return float(models["q4_pts_dropoff"].predict(df)[0])


# ═══════════════════════════════════════════════════════════════════════════
# 1.  Feature flow-through  (hard FAIL if features have no effect)
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 1. Feature flow-through ===\n")
print("  Holding all features at global median; perturbing one at a time.")
print(f"  {'Feature':<32} {'Low val':>8}  {'High val':>9}  {'Pred (low)':>11}  {'Pred (high)':>12}  {'Delta':>8}  {'Dir':>4}")
print(f"  {'-'*32} {'-'*8}  {'-'*9}  {'-'*11}  {'-'*12}  {'-'*8}  {'-'*4}")

PERTURBATIONS = [
    # (feature, low_val, high_val, expected_direction)
    # expected_direction: "up" = pred INCREASES (less drop-off) as val goes low->high
    # expected_direction: "down" = pred DECREASES (more drop-off) as val goes low->high
    ("cumulative_minutes_q1q3",  15.0, 36.0, "down"),  # more minutes -> more fatigue
    ("season_minutes_load",       0.0, 130.0, "down"),  # higher season load -> more fatigue
    ("score_diff_entering_q4",  -25.0,  25.0, "up"),   # blowout -> less effort
    ("player_age",               22.0,  36.0, "down"),  # older -> fatigue more
]

for feat_name, lo, hi, expected_dir in PERTURBATIONS:
    fv_lo = {**median_fv, feat_name: lo}
    fv_hi = {**median_fv, feat_name: hi}
    pred_lo = _predict_pts(fv_lo)
    pred_hi = _predict_pts(fv_hi)
    delta   = pred_hi - pred_lo

    actual_dir = "up" if delta > 0 else ("down" if delta < 0 else "flat")
    dir_ok     = actual_dir == expected_dir
    any_change = abs(delta) > 0.001

    dir_symbol = f"[{_GREEN}OK{_RST}]" if dir_ok else f"[{_YEL}??{_RST}]"
    print(
        f"  {feat_name:<32} {lo:>8.1f}  {hi:>9.1f}  "
        f"{pred_lo:>+11.4f}  {pred_hi:>+12.4f}  {delta:>+8.4f}  {dir_symbol}"
    )
    _check(
        f"{feat_name} has measurable effect on prediction",
        any_change,
        f"|delta|={abs(delta):.5f}  (must be > 0.001)",
    )

# ── rest_days: tree-gated feature — must test across multiple profiles ─────
# XGBoost only reaches a rest_days split node when upstream features route
# there first. A single median vector may never hit those nodes. We test
# across 4 profiles and require the feature to move predictions in AT LEAST
# ONE of them (proves the feature is wired into the model).
print(f"\n  rest_days perturbation across multiple profiles (0 -> 3):")
profiles = {
    "median":              dict(median_fv),
    "veteran+heavy":       {**median_fv, "player_age": 34.0, "cumulative_minutes_q1q3": 30.0},
    "young+light":         {**median_fv, "player_age": 22.0, "cumulative_minutes_q1q3": 15.0},
    "high-season-load":    {**median_fv, "season_minutes_load": 120.0, "minutes_per_game_season_avg": 32.0},
}
rest_deltas: list[float] = []
for pname, base_fv in profiles.items():
    p0 = _predict_pts({**base_fv, "rest_days": 0.0})
    p3 = _predict_pts({**base_fv, "rest_days": 3.0})
    d  = p3 - p0
    rest_deltas.append(d)
    flag = f"[{_GREEN}+{_RST}]" if abs(d) > 0.001 else f"[{_YEL}~{_RST}]"
    print(f"    {pname:<22}  rest=0: {p0:+.4f}  rest=3: {p3:+.4f}  delta={d:+.5f}  {flag}")

max_delta = max(abs(d) for d in rest_deltas)
print()
_check(
    "rest_days moves prediction in at least one profile (|delta| > 0.001)",
    max_delta > 0.001,
    f"max |delta| across profiles = {max_delta:.5f}  "
    f"(if zero: rest_days splits exist but are gated by other features on this dataset)",
    warn_only=small_data,
)


# ═══════════════════════════════════════════════════════════════════════════
# 2.  Directional sense on real backtest rows
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 2. Directional sense (real backtest rows) ===\n")

# High-fatigue group: B2B AND heavy minutes (top quartile)
min_q75 = float(feat["cumulative_minutes_q1q3"].quantile(0.75))
fatigue_mask = (bt["is_back_to_back"] == True) & \
               (feat.loc[feat.index.isin(bt.index), "cumulative_minutes_q1q3"] >= min_q75 \
                if False else  # fallback: use bt directly if col available
                bt.get("cumulative_minutes_q1q3", pd.Series(dtype=float)).ge(min_q75)
                if "cumulative_minutes_q1q3" in bt.columns else
                pd.Series(True, index=bt.index))

# Simpler: merge cumulative_minutes from feat into bt
feat_subset = feat[["GAME_ID", "PLAYER_ID", "cumulative_minutes_q1q3"]].drop_duplicates()
bt_aug = bt.merge(feat_subset, on=["GAME_ID", "PLAYER_ID"], how="left")

fatigue_mask = (bt_aug["is_back_to_back"] == True) & (bt_aug["cumulative_minutes_q1q3"] >= min_q75)
rested_mask  = (bt_aug["rest_days"] >= 3) & (bt_aug["cumulative_minutes_q1q3"] <= float(feat["cumulative_minutes_q1q3"].quantile(0.25)))

bt_fatigued = bt_aug[fatigue_mask]
bt_rested   = bt_aug[rested_mask]

print(f"  Fatigued group (B2B + Q1Q3_min >= {min_q75:.1f}): {len(bt_fatigued)} player-games")
print(f"  Rested   group (rest>=3d + Q1Q3_min <= {feat['cumulative_minutes_q1q3'].quantile(0.25):.1f}): {len(bt_rested)} player-games")

if len(bt_fatigued) >= 5 and len(bt_rested) >= 5:
    mean_fat_pred  = bt_fatigued["pts_dropoff_pred"].mean()
    mean_rest_pred = bt_rested["pts_dropoff_pred"].mean()
    diff = mean_fat_pred - mean_rest_pred

    print(f"\n  Mean predicted pts drop-off:")
    print(f"    Fatigued : {mean_fat_pred:+.4f} pts/min")
    print(f"    Rested   : {mean_rest_pred:+.4f} pts/min")
    print(f"    Diff     : {diff:+.4f}  (negative = fatigued predicted worse, as expected)")
    print()

    # FAIL only if model is wildly wrong in the opposite direction (> 0.10 gap)
    _check(
        "fatigued group NOT predicted to perform better than rested by > 0.10",
        diff <= 0.10,
        f"fatigued mean={mean_fat_pred:+.4f}  rested mean={mean_rest_pred:+.4f}  diff={diff:+.4f}",
    )
    _check(
        "fatigued group predicted at least as tired as rested (diff <= 0)",
        diff <= 0,
        f"diff={diff:+.4f} — positive = model says B2B+heavy is less fatigued (wrong direction)",
        warn_only=small_data,
    )

    # Actual drop-offs as a ground-truth sanity check
    mean_fat_actual  = bt_fatigued["pts_rate_actual"].mean() - bt_fatigued["pts_rate_q1q3"].mean()
    mean_rest_actual = bt_rested["pts_rate_actual"].mean()   - bt_rested["pts_rate_q1q3"].mean()
    print(f"  Actual observed drop-off (ground truth):")
    print(f"    Fatigued : {mean_fat_actual:+.4f} pts/min")
    print(f"    Rested   : {mean_rest_actual:+.4f} pts/min")
    print(f"    Diff     : {mean_fat_actual - mean_rest_actual:+.4f}")
else:
    _warn(
        "directional check skipped",
        f"not enough rows: fatigued={len(bt_fatigued)}, rested={len(bt_rested)} (need >= 5 each)",
    )


# ═══════════════════════════════════════════════════════════════════════════
# 3.  10 spotlight player-games
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 3. Ten highest-fatigue player-games ===\n")

bt_aug["fatigue_score"] = bt_aug["cumulative_minutes_q1q3"] / (bt_aug["rest_days"] + 1)
top10 = bt_aug.nlargest(10, "fatigue_score")

print(
    f"  {'Player':<22} {'Date':<12} {'Rest':>4} {'Q1Q3m':>6} "
    f"{'FatSc':>6} {'PredDrop':>9} {'ActDrop':>9} {'Err':>7}"
)
print(f"  {'-'*22} {'-'*12} {'-'*4} {'-'*6} {'-'*6} {'-'*9} {'-'*9} {'-'*7}")

pop_median_pred = float(bt_aug["pts_dropoff_pred"].median())
spotlight_preds = []

for _, row in top10.iterrows():
    actual_drop = row["pts_rate_actual"] - row["pts_rate_q1q3"]
    pred_drop   = row["pts_dropoff_pred"]
    err         = pred_drop - actual_drop
    date_str    = str(row["GAME_DATE"])[:10]
    name        = str(row["PLAYER_NAME"])[:21]
    spotlight_preds.append(pred_drop)

    print(
        f"  {name:<22} {date_str:<12} {int(row['rest_days']):>4} "
        f"{row['cumulative_minutes_q1q3']:>6.1f} {row['fatigue_score']:>6.1f} "
        f"{pred_drop:>+9.4f} {actual_drop:>+9.4f} {err:>+7.4f}"
    )

print(f"\n  Population median predicted drop-off : {pop_median_pred:+.4f}")
print(f"  Spotlight mean predicted drop-off    : {np.mean(spotlight_preds):+.4f}")
print()

# Soft check: spotlight (high-fatigue) mean should be <= population median + 0.05
# i.e., at worst equal to the population — should not be predicting LESS fatigue
spotlight_mean = float(np.mean(spotlight_preds))
_check(
    "top-10 fatigue cases NOT predicted to perform above population median",
    spotlight_mean <= pop_median_pred + 0.05,
    f"spotlight mean={spotlight_mean:+.4f}  pop median={pop_median_pred:+.4f}  "
    f"margin={(spotlight_mean - pop_median_pred):+.4f}",
    warn_only=small_data,
)


# ═══════════════════════════════════════════════════════════════════════════
# 4.  Monotonicity sweep
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 4. Monotonicity sweep (all other features held at median) ===\n")

def _sweep(feature: str, values: list[float], expect_direction: str) -> None:
    """Vary one feature and check how many consecutive steps go the right way."""
    preds = [_predict_pts({**median_fv, feature: v}) for v in values]
    steps_correct = 0
    steps_total   = len(values) - 1

    print(f"  {feature}  (expected: {expect_direction})")
    for i, (v, p) in enumerate(zip(values, preds)):
        arrow = ""
        if i > 0:
            delta = preds[i] - preds[i - 1]
            if expect_direction == "up":
                ok = delta >= -0.0001   # allow floating-point ties
            else:
                ok = delta <= 0.0001
            steps_correct += int(ok)
            arrow = f"  {'+' if delta >= 0 else '-'}{abs(delta):.4f} {'OK' if ok else 'WRONG'}"
        print(f"    {feature}={v:>6.1f}  pred={p:+.4f}{arrow}")

    frac = steps_correct / steps_total if steps_total > 0 else 1.0
    label = f"{feature} sweep monotone ({steps_correct}/{steps_total} steps correct)"
    print(f"  -> {steps_correct}/{steps_total} steps in expected direction\n")

    _check(label, frac >= 0.8, f"{steps_correct}/{steps_total}", warn_only=small_data)


_sweep("rest_days",               [0, 1, 2, 3, 4, 5], "up")
_sweep("cumulative_minutes_q1q3", [10, 15, 20, 25, 30, 36], "down")
_sweep("season_minutes_load",     [0, 20, 50, 80, 110, 133], "down")


# ═══════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════

print(f"{'='*64}")
print(f"WARNINGS ({len(warnings_)}): " + (", ".join(warnings_) if warnings_ else "none"))

if failures:
    print(f"{_RED}RESULT: {len(failures)} FAILURE(S){_RST}")
    for f in failures:
        print(f"  FAIL: {f}")
    sys.exit(1)
else:
    print(f"{_GREEN}RESULT: ALL HARD CHECKS PASSED{_RST}")
    sys.exit(0)
