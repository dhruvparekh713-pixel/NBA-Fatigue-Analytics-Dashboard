# NBA Fatigue Dashboard

A full-stack web app visualizing the NBA Fatigue Predictor model's (see previous repo) performance on the 2024-25 NBA season. Built by Dhruv Parekh — CMU ECE '28.

## What it does

- **Dashboard**: Pick any game date → see every game → expand to view per-player fatigue predictions vs actuals
- **Accuracy Tracker**: Full-season cumulative accuracy chart + segment breakdowns (role, rest, age, minutes)  
- **Player Profile**: Search any player → season-long fatigue timeline, worst fatigue games, sortable game history

<img width="956" height="478" alt="Screenshot 2026-05-26 151420" src="https://github.com/user-attachments/assets/209d9358-c2f6-442b-b023-c01997f953e7" />
<img width="932" height="425" alt="Screenshot 2026-05-26 151449" src="https://github.com/user-attachments/assets/e6d69ae8-2577-4630-b145-f6c74fab3043" />
<img width="947" height="472" alt="Screenshot 2026-05-26 151508" src="https://github.com/user-attachments/assets/b150dc3c-10f4-475f-bb40-a01052675814" />
<img width="931" height="357" alt="Screenshot 2026-05-26 151545" src="https://github.com/user-attachments/assets/20a8c3f8-bd0a-4fd3-8a27-e2cc8bca838c" />
<img width="949" height="473" alt="Screenshot 2026-05-26 151602" src="https://github.com/user-attachments/assets/8bbf4c0d-1961-4d6a-a845-01f514e2c46c" />


## Tech stack

| Layer | Tech |
|-------|------|
| ML Model | XGBoost (11 fatigue features, trained on 2022-24 NBA data) |
| Backend | FastAPI + pandas, deployed on Railway |
| Frontend | React + Vite + Tailwind CSS + Recharts, deployed on Vercel |

## Local development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# Runs on http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173 — proxies /api to localhost:8000
```

## Deployment

### Backend → Railway

1. Create new Railway project, connect this repo
2. Set root directory to `/backend`
3. Railway auto-detects Python and runs `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variable: `FRONTEND_URL=https://your-app.vercel.app`

### Frontend → Vercel

1. Import repo to Vercel
2. Set root directory to `/frontend`  
3. Add environment variable: `VITE_API_URL=https://your-app.railway.app`
4. Update `vercel.json` rewrite destination to your Railway URL

## Data

- `backend/data/backtest_2024_25.parquet` — real backtest results (2024-2025 NBA Regular Season)
- Synthetic data is auto-generated for the full season so the dashboard has content immediately
- Replace with a full-season backtest once you have more real data

## Model features

The XGBoost model predicts Q4 pts/min drop-off from 11 pre-Q4 features:
- Cumulative minutes Q1-Q3, usage trend, FG% trend
- Rest days, season minutes load, player age
- Game pace, score differential entering Q4, home/away, avg MPG


