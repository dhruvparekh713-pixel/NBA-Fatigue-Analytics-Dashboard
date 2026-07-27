"""Phase 2 feature engineering verifier.

Three-layer test (run after test_phase1.py has populated data/box_scores/):

  1. HAND-COMPUTED VERIFICATION
     Selects the highest-Q1Q3-minutes player in a back-to-back game (or
     highest-minutes overall if no B2B is cached).  Replicates every derivable
     feature formula from scratch in pure numpy/pandas, then diffs against
     build_feature_matrix() output.  Numbers must agree to 4 decimal places.

  2. DISTRIBUTION SANITY
     Runs df.describe() on every feature and target column, then asserts hard
     basketball-reality bounds.  Any violation is a FAIL:
       rest_days                : [0, 25]   (0 = B2B; >25 = data glitch)
       cumulative_minutes_q1q3  : [0, 36]   (max 12 min/q × 3 quarters)
       pace_q1q3 / game_pace    : [70, 140] (realistic NBA pace)
       is_home                  : {0.0, 1.0} only
       player_age               : [18, 45]
       season_minutes_load      : >= 0
       score_diff_entering_q4   : [-100, 100]
       q4_pts_dropoff           : [-3.0, 3.0]  (pts/min swing)
       q4_fg_pct_dropoff        : [-1.0, 1.0]
       q4_ast_dropoff           : [-2.0, 2.0]
       q4_to_surplus            : [-2.0, 2.0]

     Also scans for extreme outliers (|z| > 5) and NaN leakage.

  3. VISUAL HISTOGRAMS
     Saves figures/phase2_histograms.png — one panel per feature/target.
     Red dashed lines mark the hard bounds from step 2.
     Inspect for anything that doesn't make basketball sense.

Exit code 0 = all checks passed, 1 = at least one failure.
"""

from __future__ import annotations

import sys
import pathlib
import logging

sys.path.insert(0, ".")
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from src.features import (
    build_feature_matrix,
    FEATURE_COLS, TARGET_COLS,
    FEATURES_PATH,
)
from src.scraper import fetch_game_ids, _merge_game_context, _clean_dtypes

FIGURES_DIR = pathlib.Path("figures")
FIGURES_DIR.mkdir(exist_ok=True)

_GREEN = "\033[32m"
_RED   = "\033[31m"
_YEL   = "\033[33m"
_RST   = "\033[0m"

failures: list[str] = []


def _check(label: str, ok: bool, detail: str = "") -> None:
    tag = f"[{_GREEN}PASS{_RST}]" if ok else f"[{_RED}FAIL{_RST}]"
    suffix = f"  ->  {detail}" if detail else ""
    print(f"  {tag} {label}{suffix}")
    if not ok:
        failures.append(label)


def _warn(msg: str) -> None:
    print(f"  [{_YEL}WARN{_RST}] {msg}")


# ═══════════════════════════════════════════════════════════════════════════
# 0.  Load cached data + build feature matrix
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== Loading cached data ===")
box_files = sorted(pathlib.Path("data/box_scores").glob("*.parquet"))
if not box_files:
    print("ERROR: no cached box scores found — run test_phase1.py first")
    sys.exit(1)

raw_boxes = pd.concat([pd.read_parquet(f) for f in box_files], ignore_index=True)
games_meta = fetch_game_ids("2024-25")          # already cached, no API call
raw = _merge_game_context(raw_boxes, games_meta)
raw = _clean_dtypes(raw)
raw["SEASON"] = "2024-25"

print(f"  {raw['GAME_ID'].nunique()} games  |  "
      f"{len(raw):,} player-quarter rows  |  "
      f"{raw['PLAYER_ID'].nunique()} unique players")

X, y = build_feature_matrix(raw_df=raw, force_refresh=True)
feat = pd.read_parquet(FEATURES_PATH)           # full table (IDs + targets + features)
all_feat = pd.concat([X, y], axis=1)


# ═══════════════════════════════════════════════════════════════════════════
# 1.  Hand-computed verification
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 1. Hand-computed verification ===")

# ── Pick spotlight player-game ────────────────────────────────────────────
# Strategy: find the player-game that (a) is in the feature matrix and
# (b) has the highest Q1-Q3 minutes, preferring back-to-back games.

q1q3_raw = raw[raw["PERIOD"].isin([1, 2, 3])].copy()

player_q1q3_min = (
    q1q3_raw
    .groupby(["GAME_ID", "PLAYER_ID", "PLAYER_NAME"])["MIN_DECIMAL"]
    .sum()
    .reset_index()
    .rename(columns={"MIN_DECIMAL": "q1q3_min"})
)

# Keep only player-games that survived the min-minutes filter
feat_ids = feat[["GAME_ID", "PLAYER_ID"]].drop_duplicates()
candidates = player_q1q3_min.merge(feat_ids, on=["GAME_ID", "PLAYER_ID"], how="inner")

if candidates.empty:
    print("ERROR: feature matrix is empty — nothing to verify")
    sys.exit(1)

# Prefer back-to-back games
b2b_set = set(raw[raw.get("IS_BACK_TO_BACK", pd.Series(False, index=raw.index)) == True]["GAME_ID"].unique()) \
    if "IS_BACK_TO_BACK" in raw.columns else set()

b2b_cands = candidates[candidates["GAME_ID"].isin(b2b_set)]
top = (b2b_cands if not b2b_cands.empty else candidates).sort_values("q1q3_min", ascending=False).iloc[0]

GAME_ID   = top["GAME_ID"]
PLAYER_ID = top["PLAYER_ID"]
PLAYER    = top["PLAYER_NAME"]
b2b_label = "(back-to-back game)" if GAME_ID in b2b_set else "(no B2B in cache — using highest-min player)"

print(f"\n  Spotlight : {PLAYER}")
print(f"  Game      : {GAME_ID}  {b2b_label}")
print(f"  Q1-Q3 min : {top['q1q3_min']:.2f}")

# Convenience slices
p_raw    = raw[(raw["GAME_ID"] == GAME_ID) & (raw["PLAYER_ID"] == PLAYER_ID)]
p_q1q3   = p_raw[p_raw["PERIOD"].isin([1, 2, 3])]
p_q4     = p_raw[p_raw["PERIOD"] == 4]
g_q1q3   = raw[(raw["GAME_ID"] == GAME_ID) & (raw["PERIOD"].isin([1, 2, 3]))]

feat_row = feat[(feat["GAME_ID"] == GAME_ID) & (feat["PLAYER_ID"] == PLAYER_ID)].iloc[0]


# ── 1a. cumulative_minutes_q1q3 ───────────────────────────────────────────
hand_q1q3_min = p_q1q3["MIN_DECIMAL"].sum()
_check(
    "cumulative_minutes_q1q3",
    abs(feat_row["cumulative_minutes_q1q3"] - hand_q1q3_min) < 0.01,
    f"code={feat_row['cumulative_minutes_q1q3']:.4f}  hand={hand_q1q3_min:.4f}",
)


# ── 1b. usage_trend + fg_pct_trend (replicate _slope_3pt) ─────────────────

def _hand_usage(qdf: pd.DataFrame) -> float:
    m = qdf["MIN_DECIMAL"].sum()
    if m <= 0.1:
        return np.nan
    return (qdf["FGA"].sum() + 0.44 * qdf["FTA"].sum() + qdf["TO"].sum()) / max(m, 0.1)


def _hand_fgpct(qdf: pd.DataFrame) -> float:
    fga = qdf["FGA"].sum()
    return qdf["FGM"].sum() / fga if fga >= 1 else np.nan


def _hand_slope(y1: float, y2: float, y3: float) -> float:
    v1, v2, v3 = not np.isnan(y1), not np.isnan(y2), not np.isnan(y3)
    if v1 and v3:
        return (y3 - y1) / 2.0
    if v1 and v2:
        return y2 - y1
    if v2 and v3:
        return y3 - y2
    return np.nan


uq = [_hand_usage(p_raw[p_raw["PERIOD"] == q]) for q in [1, 2, 3]]
fq = [_hand_fgpct(p_raw[p_raw["PERIOD"] == q]) for q in [1, 2, 3]]
hand_usage_trend  = _hand_slope(*uq)
hand_fg_pct_trend = _hand_slope(*fq)

# After imputation in _final_cleanup, NaN slopes become 0
code_usage  = feat_row["usage_trend"]
code_fgpct  = feat_row["fg_pct_trend"]
exp_usage   = 0.0 if np.isnan(hand_usage_trend)  else hand_usage_trend
exp_fgpct   = 0.0 if np.isnan(hand_fg_pct_trend) else hand_fg_pct_trend

_check(
    "usage_trend",
    abs(code_usage - exp_usage) < 1e-4,
    f"code={code_usage:.6f}  hand={exp_usage:.6f}",
)
_check(
    "fg_pct_trend",
    abs(code_fgpct - exp_fgpct) < 1e-4,
    f"code={code_fgpct:.6f}  hand={exp_fgpct:.6f}",
)


# ── 1c. pace_q1q3 (replicate _compute_team_features) ─────────────────────
player_team = p_raw["TEAM_ID"].iloc[0]
team_q1q3 = g_q1q3[g_q1q3["TEAM_ID"] == player_team]

team_fga  = team_q1q3["FGA"].sum()
team_oreb = team_q1q3["OREB"].sum()
team_to   = team_q1q3["TO"].sum()
team_fta  = team_q1q3["FTA"].sum()
team_min  = team_q1q3["MIN_DECIMAL"].sum()

hand_possessions = team_fga - team_oreb + team_to + 0.44 * team_fta
eff_min           = max(team_min / 5, 1.0)
hand_pace_q1q3    = hand_possessions / eff_min * 48

_check(
    "pace_q1q3",
    abs(feat_row["pace_q1q3"] - hand_pace_q1q3) < 0.01,
    f"code={feat_row['pace_q1q3']:.4f}  hand={hand_pace_q1q3:.4f}",
)


# ── 1d. game_pace (mean of both teams' pace) ─────────────────────────────
opp_q1q3  = g_q1q3[g_q1q3["TEAM_ID"] != player_team]
opp_fga   = opp_q1q3["FGA"].sum()
opp_oreb  = opp_q1q3["OREB"].sum()
opp_to    = opp_q1q3["TO"].sum()
opp_fta   = opp_q1q3["FTA"].sum()
opp_min   = opp_q1q3["MIN_DECIMAL"].sum()

opp_poss      = opp_fga - opp_oreb + opp_to + 0.44 * opp_fta
opp_eff_min   = max(opp_min / 5, 1.0)
hand_opp_pace = opp_poss / opp_eff_min * 48
hand_game_pace = (hand_pace_q1q3 + hand_opp_pace) / 2

_check(
    "game_pace",
    abs(feat_row["game_pace"] - hand_game_pace) < 0.01,
    f"code={feat_row['game_pace']:.4f}  hand={hand_game_pace:.4f}",
)


# ── 1e. score_diff_entering_q4 ────────────────────────────────────────────
team_pts   = team_q1q3["PTS"].sum()
all_pts    = g_q1q3["PTS"].sum()
hand_score_diff = team_pts - (all_pts - team_pts)

_check(
    "score_diff_entering_q4",
    abs(feat_row["score_diff_entering_q4"] - hand_score_diff) < 0.01,
    f"code={feat_row['score_diff_entering_q4']:.1f}  hand={hand_score_diff:.1f}",
)


# ── 1f. is_home ───────────────────────────────────────────────────────────
hand_is_home = float(p_raw["IS_HOME"].iloc[0]) if "IS_HOME" in p_raw.columns else np.nan
if not np.isnan(hand_is_home):
    _check(
        "is_home",
        abs(feat_row["is_home"] - hand_is_home) < 0.01,
        f"code={feat_row['is_home']}  hand={hand_is_home}",
    )


# ── 1g. rest_days ─────────────────────────────────────────────────────────
hand_rest = float(p_raw["REST_DAYS"].iloc[0]) if "REST_DAYS" in p_raw.columns else np.nan
if not np.isnan(hand_rest):
    _check(
        "rest_days",
        abs(feat_row["rest_days"] - hand_rest) < 0.01,
        f"code={feat_row['rest_days']}  hand={hand_rest}",
    )


# ── 1h. Q4 drop-off targets ───────────────────────────────────────────────
def _per_min(stat: float, minutes: float) -> float:
    return stat / max(minutes, 0.5)


pts_q4_pm   = _per_min(p_q4["PTS"].sum(), p_q4["MIN_DECIMAL"].sum())
pts_q1q3_pm = _per_min(p_q1q3["PTS"].sum(), p_q1q3["MIN_DECIMAL"].sum())
hand_pts_drop = pts_q4_pm - pts_q1q3_pm

ast_q4_pm   = _per_min(p_q4["AST"].sum(), p_q4["MIN_DECIMAL"].sum())
ast_q1q3_pm = _per_min(p_q1q3["AST"].sum(), p_q1q3["MIN_DECIMAL"].sum())
hand_ast_drop = ast_q4_pm - ast_q1q3_pm

to_q4_pm   = _per_min(p_q4["TO"].sum(), p_q4["MIN_DECIMAL"].sum())
to_q1q3_pm = _per_min(p_q1q3["TO"].sum(), p_q1q3["MIN_DECIMAL"].sum())
hand_to_surplus = to_q4_pm - to_q1q3_pm

_check(
    "q4_pts_dropoff",
    abs(feat_row["q4_pts_dropoff"] - hand_pts_drop) < 0.001,
    f"code={feat_row['q4_pts_dropoff']:+.4f}  hand={hand_pts_drop:+.4f}",
)
_check(
    "q4_ast_dropoff",
    abs(feat_row["q4_ast_dropoff"] - hand_ast_drop) < 0.001,
    f"code={feat_row['q4_ast_dropoff']:+.4f}  hand={hand_ast_drop:+.4f}",
)
_check(
    "q4_to_surplus",
    abs(feat_row["q4_to_surplus"] - hand_to_surplus) < 0.001,
    f"code={feat_row['q4_to_surplus']:+.4f}  hand={hand_to_surplus:+.4f}",
)

fga_q4   = p_q4["FGA"].sum()
fga_q1q3 = p_q1q3["FGA"].sum()
if fga_q4 >= 1 and fga_q1q3 >= 1:
    hand_fg_drop = p_q4["FGM"].sum() / fga_q4 - p_q1q3["FGM"].sum() / fga_q1q3
    _check(
        "q4_fg_pct_dropoff",
        abs(feat_row["q4_fg_pct_dropoff"] - hand_fg_drop) < 0.001,
        f"code={feat_row['q4_fg_pct_dropoff']:+.4f}  hand={hand_fg_drop:+.4f}",
    )
else:
    _warn("q4_fg_pct_dropoff: player had 0 FGA in Q4 or Q1-Q3 — skipping hand-check")


# ── 1i. Full feature vector printout ─────────────────────────────────────
hand_lookup: dict[str, float] = {
    "cumulative_minutes_q1q3":  hand_q1q3_min,
    "pace_q1q3":                hand_pace_q1q3,
    "usage_trend":              exp_usage,
    "fg_pct_trend":             exp_fgpct,
    "game_pace":                hand_game_pace,
    "score_diff_entering_q4":   hand_score_diff,
    "is_home":                  hand_is_home,
    "rest_days":                hand_rest,
    "q4_pts_dropoff":           hand_pts_drop,
    "q4_ast_dropoff":           hand_ast_drop,
    "q4_to_surplus":            hand_to_surplus,
}

print(f"\n  Full feature vector  ({PLAYER} | {GAME_ID}):")
print(f"  {'Feature':<42} {'Code':>10}  {'Hand':>10}")
print(f"  {'-'*42} {'-'*10}  {'-'*10}")
for col in FEATURE_COLS + TARGET_COLS:
    code_val = feat_row.get(col, float("nan"))
    hand_val = hand_lookup.get(col, float("nan"))
    cv = f"{code_val:>+10.4f}" if isinstance(code_val, (int, float)) and not np.isnan(float(code_val)) else f"{'N/A':>10}"
    hv = f"{hand_val:>+10.4f}" if not np.isnan(float(hand_val)) else f"{'--':>10}"
    marker = " *" if col in hand_lookup else ""
    print(f"  {col:<42} {cv}  {hv}{marker}")

print("\n  (* = hand-computed check performed)")


# ═══════════════════════════════════════════════════════════════════════════
# 2.  Distribution sanity checks
# ═══════════════════════════════════════════════════════════════════════════

print(f"\n=== 2. Distribution sanity checks  ({len(X):,} player-games) ===")

# Hard bounds: (col, lo, hi, explanation)
BOUNDS: list[tuple[str, float | None, float | None, str]] = [
    ("rest_days",                  0,    25,  "0=B2B; >25 means data glitch"),
    ("cumulative_minutes_q1q3",    0,    36,  "12 min/q × 3 quarters"),
    ("pace_q1q3",                 70,   140,  "realistic NBA team pace"),
    ("game_pace",                 70,   140,  "realistic NBA game pace"),
    ("is_home",                    0,     1,  "binary flag — no other values"),
    ("player_age",                18,    45,  "NBA player age range"),
    ("season_minutes_load",        0,  None,  "cumulative minutes must be >= 0"),
    ("score_diff_entering_q4",  -100,   100,  "realistic 3-quarter point diff"),
    ("q4_pts_dropoff",           -3.0,  3.0,  "pts/min swing > |3| is extreme"),
    ("q4_fg_pct_dropoff",        -1.0,  1.0,  "FG% lives in [0,1]"),
    ("q4_ast_dropoff",           -2.0,  2.0,  "ast/min swing > |2| is extreme"),
    ("q4_to_surplus",            -2.0,  2.0,  "TO/min swing > |2| is extreme"),
]

print()
for col, lo, hi, why in BOUNDS:
    if col not in all_feat.columns:
        _warn(f"{col:<42} column absent — skipping")
        continue
    col_min = all_feat[col].min()
    col_max = all_feat[col].max()
    ok = (lo is None or col_min >= lo) and (hi is None or col_max <= hi)
    lo_str = f"{lo}" if lo is not None else "-inf"
    hi_str = f"{hi}" if hi is not None else "+inf"
    _check(
        f"{col:<42}",
        ok,
        f"observed [{col_min:.2f}, {col_max:.2f}]  expected [{lo_str}, {hi_str}]  ({why})",
    )

# is_home: must be EXACTLY {0.0, 1.0}
if "is_home" in all_feat.columns:
    bad_home = all_feat["is_home"][~all_feat["is_home"].isin([0.0, 1.0])]
    _check(
        "is_home values in {0.0, 1.0}",
        bad_home.empty,
        f"{len(bad_home)} rows with unexpected values: {bad_home.unique().tolist()}" if not bad_home.empty else "",
    )

# Outlier scan (|z-score| > 5)
print("\n  Outlier scan (|z| > 5 within each feature):")
found_outlier = False
for col in FEATURE_COLS:
    if col not in X.columns:
        continue
    s = X[col].dropna()
    if len(s) < 2 or s.std() == 0:
        continue
    z = (s - s.mean()).abs() / s.std()
    n_ext = int((z > 5).sum())
    if n_ext > 0:
        found_outlier = True
        worst = s[z > 5].abs().max()
        _warn(f"{col}: {n_ext} extreme values (|z|>5)  max_abs={worst:.2f}")
if not found_outlier:
    print(f"  [{_GREEN}PASS{_RST}] no columns with |z| > 5 extreme outliers")

# NaN audit (post-imputation there should be 0 NaNs in features)
print("\n  NaN audit (features should be 0 after imputation):")
nan_feats  = X.isna().sum()
nan_tgts   = y.isna().sum()
nan_found  = False
for col in FEATURE_COLS:
    cnt = int(nan_feats.get(col, 0))
    if cnt > 0:
        nan_found = True
        _warn(f"{col}: {cnt} NaNs ({cnt/len(X)*100:.1f}%)")
_check(
    "zero NaNs in all feature columns",
    not nan_found,
)
for col in TARGET_COLS:
    cnt = int(nan_tgts.get(col, 0))
    if cnt > 0:
        pct = cnt / len(y) * 100
        _warn(f"target {col}: {cnt} NaNs ({pct:.1f}%) — q4_fg_pct_dropoff is expected to have some")

# Full describe
print("\n  describe() — features:")
print(X.describe().T[["mean", "std", "min", "max"]].round(4).to_string())
print("\n  describe() — targets:")
print(y.describe().T[["mean", "std", "min", "max"]].round(4).to_string())


# ═══════════════════════════════════════════════════════════════════════════
# 3.  Histograms
# ═══════════════════════════════════════════════════════════════════════════

print("\n=== 3. Generating feature histograms ===")

bound_map = {col: (lo, hi) for col, lo, hi, _ in BOUNDS}
all_cols  = FEATURE_COLS + TARGET_COLS
ncols_grid = 4
nrows_grid = (len(all_cols) + ncols_grid - 1) // ncols_grid

fig, axes = plt.subplots(nrows_grid, ncols_grid, figsize=(16, nrows_grid * 3.2))
axes = axes.flatten()

for i, col in enumerate(all_cols):
    ax = axes[i]
    is_target = col in TARGET_COLS
    data = all_feat[col].dropna() if col in all_feat.columns else pd.Series(dtype=float)

    if data.empty:
        ax.text(0.5, 0.5, "missing", ha="center", va="center",
                transform=ax.transAxes, fontsize=9, color="gray")
        ax.set_title(col, fontsize=8)
        continue

    color = "#FF9800" if is_target else "#2196F3"
    ax.hist(data, bins=40, color=color, edgecolor="none", alpha=0.85)
    ax.set_title(col, fontsize=8, fontweight="bold")
    ax.tick_params(labelsize=7)
    ax.yaxis.set_major_formatter(
        plt.FuncFormatter(lambda x, _: f"{int(x):,}")
    )

    # Mark hard bounds
    if col in bound_map:
        lo_b, hi_b = bound_map[col]
        if lo_b is not None:
            ax.axvline(lo_b, color="red", lw=1.5, ls="--", alpha=0.8, label=f"lo={lo_b}")
        if hi_b is not None:
            ax.axvline(hi_b, color="red", lw=1.5, ls="--", alpha=0.8, label=f"hi={hi_b}")

    # Annotate mean
    ax.axvline(data.mean(), color="white", lw=1, ls=":", alpha=0.7)

for j in range(i + 1, len(axes)):
    axes[j].set_visible(False)

fig.suptitle(
    "Phase 2 Feature Distributions\n"
    "Blue = features  |  Orange = targets  |  Red dashed = hard bounds  |  White dotted = mean",
    fontsize=10, fontweight="bold",
)
plt.tight_layout()
out_path = FIGURES_DIR / "phase2_histograms.png"
plt.savefig(out_path, dpi=130, bbox_inches="tight")
plt.close()
print(f"  Saved -> {out_path}")


# ═══════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════

print(f"\n{'='*62}")
if failures:
    print(f"{_RED}RESULT: {len(failures)} FAILURE(S){_RST}")
    for f in failures:
        print(f"  FAIL: {f.strip()}")
    sys.exit(1)
else:
    print(f"{_GREEN}RESULT: ALL CHECKS PASSED{_RST}")
    sys.exit(0)
