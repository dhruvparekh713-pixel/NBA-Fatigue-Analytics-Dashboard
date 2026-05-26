"""NBA Fatigue Dashboard — FastAPI backend."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from data_loader import load_backtest
from api.routes import router, set_dataframe

app = FastAPI(
    title="NBA Fatigue Dashboard API",
    description="Backtest analytics for NBA Q4 fatigue predictions",
    version="1.0.0",
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


@app.on_event("startup")
async def startup():
    df = load_backtest()
    set_dataframe(df)
    print(f"Loaded {len(df):,} player-game rows across {df['GAME_ID'].nunique()} games.")


@app.get("/")
def health():
    return {"status": "ok", "service": "nba-fatigue-dashboard"}
