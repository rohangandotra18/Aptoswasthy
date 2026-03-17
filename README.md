# 🏥 AptoSwasthy

**Fit · Healthy · Aware**

A health and wellness web application that consolidates fragmented health data into a unified dashboard with disease risk prediction, biomarker tracking, sleep/recovery monitoring, nutrition logging, and AI-generated habit recommendations.

*AptoSwasthy* derives from Sanskrit — "Apto" (fit/apt) + "Swasthy" (health).

## Features

- **Dashboard** — Recovery, Strain, and Nutrition circles with percentage metrics and relationship connectors showing energy balance
- **Body Metrics** — Age, Height, Weight, BMI, Waist, Body Fat (estimated), Resting Metabolic Rate, Max HR, family history tags
- **Sleep & Recovery** — Sleep stage breakdown (Deep/REM/Light/Awake with % of total), weekly score trends, HRV, SpO2, skin temperature
- **Nutrition** — Calorie tracking vs goal %, macro balance pie chart, weekly protein/carbs/fat trends, fiber/sugar/sodium as % of daily limits
- **Biomarkers** — 16 lab markers with range visualization, filterable by category, color-coded status, overall biomarker health %
- **Disease Risk** — Prediction engine computing risk % for Type 2 Diabetes, Cardiovascular Disease, Hypertension, Vitamin D Deficiency, Metabolic Syndrome, and Thyroid Disorders
- **Habits** — AI-generated daily habit recommendations based on data gaps, with check-off tracking and projected 90-day impact
- **Goals** — Custom health goals with progress bars, achievement tracking, and auto-suggested goals from your data
- **Trends** — Weekly summary reports with sleep/nutrition/fitness/risk trend charts and % comparisons
- **Search** — Global search across all metrics, biomarkers, goals, habits, and profile data
- **Data Import** — CSV and JSON import for Apple Health, MyFitnessPal, Fitbit, Garmin exports
- **Backend API** — Express + SQLite with JWT auth, full CRUD for all data types, server-side risk computation, weekly report generation

## Tech Stack

**Frontend:** React 18, Recharts, Vite
**Backend:** Express, SQLite (better-sqlite3), JWT, bcryptjs
**Design:** DM Sans + Fraunces typography, sage/teal/coral/lavender palette

## Quick Start

### Frontend

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`

### Backend

```bash
cd backend
cp .env.example .env    # then edit JWT_SECRET
npm install
node server.js
```

Runs at `http://localhost:3001`

### Additionally
```
# 1. Clone the repo
git clone https://github.com/rohangandotra18/Aptoswasthy.git

# 2. Go into the folder
cd Aptoswasthy

# 3. Install dependencies
npm install

# 4. Run it
npm run dev
```
## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, get JWT |
| GET/PUT | `/api/profile` | User profile & body metrics |
| GET/POST | `/api/biomarkers` | Lab results (latest, history) |
| GET/POST | `/api/sleep` | Sleep entries (single, bulk) |
| GET/POST | `/api/nutrition` | Nutrition entries (single, bulk) |
| GET/POST | `/api/fitness` | Fitness entries (single, bulk) |
| GET/POST | `/api/goals` | Health goals CRUD |
| GET/POST | `/api/habits/:date` | Daily habit tracking |
| GET | `/api/risks` | Computed disease risk scores |
| GET | `/api/reports/weekly` | Auto-generated weekly report |
| GET | `/api/trends?days=30` | 30-day trend data |
| GET/POST | `/api/export` `/api/import` | Full data export/import |

## Project Structure

```
aptoswasthy/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── index.css
│   └── App.jsx          ← Main application (all components)
├── backend/
│   ├── server.js         ← Express API server
│   ├── package.json
│   ├── .env.example
│   └── aptoswasthy.db   ← SQLite (auto-created, gitignored)
└── .gitignore
```

## Authors

- **Rohan** — Backend architecture, disease risk engine
- **Vansh** — Frontend, nutrition module, biomarkers

## Disclaimer

AptoSwasthy is for informational and educational purposes only. Always consult your healthcare provider for medical advice. This application is not a substitute for professional medical care.

---

*DS440 · Penn State · 2026*
