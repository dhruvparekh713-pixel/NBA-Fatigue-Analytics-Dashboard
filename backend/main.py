"""NBA Fatigue Dashboard — FastAPI backend."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import predictor
from data_loader import load_backtest
from api.routes import router, set_dataframe


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Load the backtest data and the model once, before serving traffic.

    The DataFrame is held in memory for the process lifetime — every
    analytics route aggregates against it per request.
    """
    df = load_backtest()
    set_dataframe(df)
    print(f"Loaded {len(df):,} player-game rows across {df['GAME_ID'].nunique()} games.")

    # Online inference is optional — if xgboost or the artifact is missing the
    # rest of the API still works and /api/predict returns 503.
    if predictor.load_model():
        st = predictor.status()
        print(f"Online inference ready: {len(st['targets'])} targets, {st['known_players']} player profiles.")
    else:
        print(f"Online inference unavailable: {predictor.status().get('error')}")

    yield


app = FastAPI(
    title="NBA Fatigue Dashboard API",
    description="Backtest analytics for NBA Q4 fatigue predictions",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vercel frontend + local dev
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", ""),
    "https://*.vercel.app",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
def health():
    return {"status": "ok", "service": "nba-fatigue-dashboard"}
