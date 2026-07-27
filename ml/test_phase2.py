"""Phase 2 smoke test — run feature engineering on the 5 cached games.

Checks:
  1. build_feature_matrix() runs without error
  2. All FEATURE_COLS and TARGET_COLS are present and numeric
  3. No unexpected NaNs in core features
  4. Spot-check LeBron's row: cumulative_minutes_q1q3 should be ~24.8 min
     (8:19 + 8:26 + 8:01 from Phase 1 verification)
  5. Print the full feature vector for one row so you can read it
"""

import sys, logging
sys.path.insert(0, ".")
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s | %(levelname)-8s | %(message)s",
                    datefmt="%H:%M:%S")

import pandas as pd
import numpy as np
from src.features import build_feature_matrix, FEATURE_COLS, TARGET_COLS
from src.scraper import (
    fetch_game_ids, _merge_game_context, _clean_dtypes,
    GAME_IDS_DIR, BOX_SCORES_DIR, DATA_DIR,
)
import pathlib

# ── Load only the 5 already-cached box scores ──────────────────────────────
# Do NOT call scrape_season — that would attempt to fill the other 1,220 games.
print("Loading 5 cached box score files directly…")
box_files = sorted(pathlib.Path("data/box_scores").glob("*.parquet"))
if not box_files:
    print("ERROR: no cached box scores found — run test_phase1.py first")
    sys.exit(1)

frames = [pd.read_parquet(f) for f in box_files]
raw_boxes = pd.concat(frames, ignore_index=True)

# Attach game context (dates, rest days, home/away) from cached game_ids
games_meta = fetch_game_ids("2024-25")   # already cached, no API call
raw = _merge_game_context(raw_boxes, games_meta)
raw = _clean_dtypes(raw)
raw["SEASON"] = "2024-25"

print(f"Using {raw['GAME_ID'].nunique()} games, {len(raw):,} rows\n")

X, y = build_feature_matrix(raw_df=raw, force_refresh=True)

# ── Check 1: shape and columns ─────────────────────────────────────────────
print("=== Check 1: columns ===")
missing_feat = [c for c in FEATURE_COLS if c not in X.columns]
missing_tgt  = [c for c in TARGET_COLS  if c not in y.columns]
print(f"  Missing feature cols : {missing_feat or 'none'}")
print(f"  Missing target cols  : {missing_tgt  or 'none'}")
print(f"  X shape: {X.shape}")
print(f"  y shape: {y.shape}")

# ── Check 2: NaN audit ────────────────────────────────────────────────────
print("\n=== Check 2: NaN counts ===")
nan_X = X.isna().sum()
nan_y = y.isna().sum()
print("Features:")
print(nan_X.to_string())
print("Targets:")
print(nan_y.to_string())

# ── Check 3: LeBron spot-check ────────────────────────────────────────────
print("\n=== Check 3: LeBron spot-check ===")

# Reload full feat to get player names
from src.features import FEATURES_PATH
feat = pd.read_parquet(FEATURES_PATH)
lebron = feat[feat["PLAYER_NAME"].str.contains("LeBron", na=False)]

if lebron.empty:
    print("  LeBron not found in feature matrix (may not have met min-minutes filter)")
else:
    row = lebron.iloc[0]
    expected_q1q3_min = 8.32 + 8.43 + 8.02   # from Phase 1: 8:19, 8:26, 8:01
    actual = row["cumulative_minutes_q1q3"]
    delta = abs(actual - expected_q1q3_min)
    status = "PASS" if delta < 0.1 else f"FAIL (expected ~{expected_q1q3_min:.2f})"
    print(f"  cumulative_minutes_q1q3 = {actual:.2f}  (expected ~{expected_q1q3_min:.2f})  [{status}]")

    print(f"\n  Full feature vector (game {row['GAME_ID']}, {row.get('GAME_DATE','')}):")
    for col in FEATURE_COLS:
        val = row.get(col, "MISSING")
        print(f"    {col:40s} {val}")

    print(f"\n  Targets:")
    for col in TARGET_COLS:
        val = row.get(col, "MISSING")
        print(f"    {col:40s} {val:+.4f}" if isinstance(val, float) else f"    {col:40s} {val}")

# ── Check 4: sanity ranges ────────────────────────────────────────────────
print("\n=== Check 4: feature ranges ===")
print(X.describe().T[["mean","std","min","max"]].round(3).to_string())

print("\n=== Check 5: target distributions ===")
print(y.describe().T[["mean","std","min","max"]].round(4).to_string())

print("\n--- SMOKE TEST COMPLETE ---")
