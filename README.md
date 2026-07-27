# NBA Fatigue Dashboard

A full-stack web app that backtests an XGBoost model predicting fourth-quarter performance drop-off in the NBA. Built by Dhruv Parekh — CMU ECE '28.

**Stack:** FastAPI + pandas (Railway) · React + Vite + Tailwind + Recharts (Vercel)

<!-- TODO: add live demo link -->


## What it does

- **Dashboard** — pick any game date, see every game, expand to view per-player fatigue predictions against actuals
- **Accuracy Tracker** — season-long cumulative accuracy chart plus segment breakdowns (role, rest, age, minutes load)
- **Player Profile** — search any player for a season fatigue timeline, highest-fatigue games, and a sortable game log

## Screenshots

Deployment screenshots of all three pages are in [Nba-Dashboard-Deployment-Pictures](./Nba-Dashboard-Deployment-Pictures).

## Results

Measured on the **787 real player-games** in the backtest (2024-25 season, Oct 22–30):

| metric | value |
|---|---|
| Directional accuracy (did the model call the sign of the Q4 change?) | **63.2%** |
| Majority-class baseline (always predict the more common direction) | 55.0% |
| Lift | **+8.2 pts** |

Regression performance on the held-out split (n = 158) is much weaker — the model explains almost none of the variance:

| target | RMSE | baseline RMSE | R² | improvement |
|---|---|---|---|---|
| `q4_pts_dropoff` | 0.4183 | 0.4211 | 0.009 | +0.66% |
| `q4_fg_pct_dropoff` | 0.3778 | 0.3795 | −0.026 | +0.44% |
| `q4_ast_dropoff` | 0.1329 | 0.1309 | −0.058 | −1.54% |
| `q4_to_surplus` | 0.0890 | 0.0895 | −0.008 | +0.57% |

The model gets the *direction* right more often than chance, but its magnitude estimates are near-worthless. See [Known limitations](#known-limitations) — that section is deliberately detailed.

## Architecture

Predictions are **batch-scored offline**, not computed per request. The model is not in the request path; the API is a read-only analytics layer over materialized results.

```
NBA Stats API  (nba_api)
      ↓  ml/src/scraper.py     — per-quarter box scores, Parquet cache
data/box_scores/*.parquet
      ↓  ml/src/features.py    — 11 pre-Q4 features, 4 targets
feature_matrix.parquet
      ↓  ml/src/model.py       — XGBoost, chronological split
fatigue_model.pkl
      ↓  ml/src/evaluate.py    — batch scoring (offline)
backtest_2024_25.parquet          ← predictions materialized here
      ↓  loaded into memory at startup
FastAPI  (Railway)                 ← aggregations computed live per request
      ↓  JSON over HTTPS
React SPA  (Vercel)
```

The API *does* compute in real time — groupbys, segment splits, and cumulative accuracy run in pandas on every request against an in-memory DataFrame. What it does not do is run the model. Adding an online inference endpoint is the top roadmap item.

## Tech stack

| Layer | Tech |
|---|---|
| ML | XGBoost — 4 regressors, 11 features |
| Backend | FastAPI, pandas, Pydantic, Parquet/PyArrow — deployed on Railway |
| Frontend | React 18, Vite, Tailwind CSS, Recharts, Framer Motion, React Router — deployed on Vercel |

## The model

Four independent `XGBRegressor`s, one per target, stored together in `backend/data/fatigue_model.pkl`:

| target | definition |
|---|---|
| `q4_pts_dropoff` | Q4 points/min − Q1–Q3 points/min |
| `q4_fg_pct_dropoff` | Q4 FG% − Q1–Q3 FG% |
| `q4_ast_dropoff` | Q4 assists/min − Q1–Q3 assists/min |
| `q4_to_surplus` | Q4 turnovers/min − Q1–Q3 turnovers/min |

Targets are **per-minute rates**, so a player who sits most of the fourth quarter isn't automatically scored as fatigued.

**All 11 features** (each knowable before Q4 tips — no outcome leakage):

```
cumulative_minutes_q1q3    pace_q1q3                 usage_trend
fg_pct_trend               rest_days                 season_minutes_load
game_pace                  score_diff_entering_q4    is_home
player_age                 minutes_per_game_season_avg
```

**Hyperparameters:** 500 estimators, `max_depth=4`, `learning_rate=0.05`, `subsample=0.8`, `colsample_bytree=0.8`, `min_child_weight=5`, `reg_alpha=0.1`, `reg_lambda=1.0`, `objective=reg:squarederror`, early stopping at 30 rounds.

**Training data:** 629 train / 158 test. The trainer prefers a cross-season split (2022-23 + 2023-24 → held-out 2024-25) and falls back to an 80/20 **chronological** split when only one season is cached. Only 2024-25 is currently scraped, so the fallback is what ran.

**The full pipeline lives in [`ml/`](ml/)** — scraper, feature engineering, training, backtesting, visualization, and a prediction CLI. See [ml/README.md](ml/README.md).

```bash
cd ml
python predict.py --scrape --seasons 2022-23 2023-24 2024-25   # ~2.5 h, cached & resumable
python predict.py --features                                    # build feature matrix
python predict.py --train                                       # train the 4 regressors
python predict.py --backtest --season 2024-25                   # produce backtest parquet
python predict.py --player "LeBron James" --minutes-so-far 32 --pace 98 --rest-days 1
```

> The repo ships a **59-game development cache**, so every step above except `--scrape` runs immediately from a fresh clone. Current metrics come from that cache; the 3-season scrape is the real test.

## Fatigue risk score

The 0–100 score shown in the UI is a **hand-authored heuristic, not a model output.** It is computed in [`_add_derived_columns`](backend/data_loader.py#L94-L106) and never feeds a prediction:

```
fatigue = min(minutes_q1q3, 36)/36 × 60   +   (7 − min(rest_days, 7))/7 × 40
```

Two additive terms, weighted 60/40 between workload and rest deficit, clipped to [0, 100]. UI bands: **High ≥ 70**, **Med 45–69**, **Low < 45**.

It exists to make rows sortable and visually triageable. It is *not* validated against outcomes — see limitations.

## API

All routes are prefixed `/api`.

| endpoint | returns |
|---|---|
| `GET /dates` | every date with games |
| `GET /games/{date}` | game summaries for a date, with per-game accuracy |
| `GET /predictions/{date}` | per-player predictions vs. actuals for a date |
| `GET /player/{name}` | season profile and full game log |
| `GET /players/search?q=` | typeahead name search |
| `GET /accuracy/cumulative` | daily and cumulative accuracy series |
| `GET /accuracy/segments` | accuracy split by role, rest, age, minutes load |
| `GET /stats/overview` | headline totals and baseline comparison |

Responses are typed with Pydantic models in [`backend/api/schemas.py`](backend/api/schemas.py), so the OpenAPI docs at `/docs` are generated and accurate.

## Data

| file | contents |
|---|---|
| `backend/data/backtest_2024_25.parquet` | **787 real player-games** with predictions and actuals (Oct 22–30, 2024) |
| `backend/data/feature_matrix.parquet` | 787 rows × 55 engineered columns |
| `backend/data/game_ids/game_ids_2024-25.parquet` | 1,225 games — team IDs, abbreviations, dates |
| `backend/data/fatigue_model.pkl` | the four trained regressors plus metrics and feature profiles |

> **⚠️ The dashboard displays synthetic data alongside real results.**
> The real backtest covers nine days. To develop and stress-test the UI at full-season scale, [`_extend_to_full_season`](backend/data_loader.py#L122) generates synthetic player-games for Nov–Apr from a seeded RNG, bringing the served dataset to ~12,600 rows. **Roughly 94% of what the dashboard shows is synthetic.** Synthetic predictions are constructed as `prediction = truth + noise`, so their accuracy is an artifact of that construction, not model skill. Real-only numbers are the ones reported under [Results](#results).

## Known limitations

Documented rather than hidden — these are the honest state of the project.

1. ~~**The headline accuracy figure blends synthetic rows.**~~ **Fixed.** Rows now carry an `is_synthetic` flag, and `/api/stats/overview` reports real backtest rows in the headline (63.2%) while returning the synthetic (82.9%) and combined (81.7%) splits alongside. Both are displayed in the UI, with the synthetic figure labelled as an artifact of construction.
2. **The backtest view mixes train and test rows.** The split itself is sound — the trainer prefers a cross-season split (2022-23 + 2023-24 train, 2024-25 holdout) and falls back to an 80/20 **chronological** split sorted by `GAME_DATE` when only one season is cached. That fallback is what ran, so the 158 test rows are genuinely held out in time. The limitation is downstream: the dashboard renders all 787 backtest rows together, so ~80% of what it displays are rows the model trained on. Reported metrics come from the 158-row holdout; displayed accuracy does not distinguish them.
3. **The sample is thin.** 787 player-games over nine days, against 11 features. This is the most likely explanation for R² ≈ 0.
4. **Training objective ≠ evaluation metric.** The model minimizes squared error on a continuous target; the dashboard grades it on the *sign* of that target. Directional accuracy is measured post-hoc, not optimized for.
5. **The fatigue score is not calibrated or validated.** On real data its correlation with actual Q4 drop-off is **0.032**, and the ordering runs backwards — the "High" band shows a slightly *positive* mean change. Both denominators are also mis-scaled: `36` assumes a player never leaves the floor in Q1–Q3 (real median is 21.8 min), and `7` assumes a rest range the data never exercises (real values are only 0–3).
6. ~~**Two inconsistent baselines.**~~ **Fixed.** The API previously computed an "always predict up" baseline (45.0%) while the Accuracy page hardcoded a 50% coin flip. Both now use majority class (**55.0%**) — the correct floor for a binary directional call. The old baseline scored *below* chance, which roughly doubled the apparent lift.
7. **Home/away teams are guessed.** [`get_games`](backend/api/routes.py#L60) sorts the two team abbreviations alphabetically and labels the first as home, so the matchup orientation is frequently wrong.
8. **No CI, and the API is untested.** [`ml/`](ml/) ships seven verifier scripts — four run offline against the cached data and pass (`test_phase2`, `test_phase2_verify`, `test_phase3_verify`, `test_phase4_verify`); three hit the live NBA API and are unsuitable for automation. `test_phase1` currently **fails**: per-quarter box scores don't reconcile with full-game totals (PTS 14/21, MIN 9/21 on the sample), a boundary-attribution quirk in the NBA API's `range_type=2` mode that [`scraper.py`](ml/src/scraper.py#L64-L69) partially compensates for. Nothing covers the FastAPI layer.

## Local development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# http://localhost:8000  ·  docs at /docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173 — proxies /api to localhost:8000 via vite.config.js
```

## Deployment

**Backend → Railway.** Connect the repo, set root directory to `/backend`. Nixpacks auto-detects Python; the start command in `railway.json` is `uvicorn main:app --host 0.0.0.0 --port $PORT`. Health check is `GET /`.

**Frontend → Vercel.** Import the repo, set root directory to `/frontend`. `vercel.json` rewrites `/api/*` to the Railway URL, so the browser makes same-origin requests and no CORS preflight is needed in production. For a direct-to-backend setup instead, set `VITE_API_URL` — note it's read at *build* time, not runtime.

Both deploy automatically on push to `main`.

## Roadmap

- [x] Report real-data accuracy in the headline metric; label synthetic rows in the UI
- [x] Switch to a majority-class baseline and use it consistently across API and frontend
- [x] Commit the scraping and training pipeline (now in [`ml/`](ml/))
- [ ] Run the full 3-season scrape and retrain with a cross-season holdout
- [ ] `POST /api/predict` for online inference — the pickle already stores per-player feature profiles for this
- [ ] GitHub Actions CI with API tests
- [ ] Derive home/away from the game index instead of alphabetical order
