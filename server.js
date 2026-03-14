// ─── AptoSwasthy Backend API ─────────────────────────────────
// Express server with SQLite persistence, JWT auth, health
// prediction engine, goals tracking, and weekly report generation.
//
// Install: npm install express cors bcryptjs jsonwebtoken better-sqlite3 dotenv
// Run:     node server.js
// ─────────────────────────────────────────────────────────────

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "apto_swasthy_secret_change_in_production";

// ─── Database Setup ──────────────────────────────────────────
const db = new Database(path.join(__dirname, "aptoswasthy.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    age INTEGER,
    sex TEXT,
    height REAL,
    weight REAL,
    bmi REAL,
    waist_circumference REAL,
    smoker BOOLEAN DEFAULT 0,
    outdoor_minutes_per_day INTEGER DEFAULT 15,
    latitude REAL,
    family_history_diabetes BOOLEAN DEFAULT 0,
    family_history_heart BOOLEAN DEFAULT 0,
    family_history_hypertension BOOLEAN DEFAULT 0,
    family_history_thyroid BOOLEAN DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS biomarkers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    hemoglobin REAL, vitamin_d REAL, b12 REAL, iron REAL, ferritin REAL,
    tsh REAL, free_t4 REAL, total_cholesterol REAL, hdl REAL, ldl REAL,
    triglycerides REAL, fasting_glucose REAL, hba1c REAL, crp REAL,
    cortisol REAL, testosterone REAL,
    tested_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sleep_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    deep REAL, rem REAL, light REAL, awake REAL, total REAL,
    score INTEGER, hrv REAL, resting_hr INTEGER,
    spo2 REAL, skin_temp REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS nutrition_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    calories INTEGER, protein REAL, carbs REAL, fat REAL,
    fiber REAL, sugar REAL, sodium REAL, water REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fitness_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    strain REAL, calories_burned INTEGER, active_minutes INTEGER,
    steps INTEGER, resting_hr INTEGER,
    workout_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS heart_rate_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    hour INTEGER,
    hr INTEGER, hrv REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    target_value REAL,
    current_value REAL DEFAULT 0,
    unit TEXT,
    deadline DATE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    habit_id TEXT NOT NULL,
    date DATE NOT NULL,
    completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, habit_id, date)
  );

  CREATE TABLE IF NOT EXISTS weekly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    week_start DATE NOT NULL,
    report_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    connected BOOLEAN DEFAULT 1,
    last_sync DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider)
  );

  CREATE INDEX IF NOT EXISTS idx_sleep_user_date ON sleep_entries(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_nutrition_user_date ON nutrition_entries(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_fitness_user_date ON fitness_entries(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_hr_user_date ON heart_rate_readings(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_habits_user_date ON habit_logs(user_id, date);
`);

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10mb" }));

function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ─── Health Prediction Engine (Server-side) ──────────────────
const HealthEngine = {
  computeRisks(profile, biomarkers, fitness, sleep, nutrition) {
    const data = { profile, biomarkers, fitness, sleep, nutrition };
    return {
      diabetes: this._diabetesRisk(data),
      cardiovascular: this._cardioRisk(data),
      hypertension: this._hypertensionRisk(data),
      vitaminD: this._vitDRisk(data),
      metabolic: this._metabolicRisk(data),
      thyroid: this._thyroidRisk(data),
    };
  },

  _diabetesRisk(d) {
    let r = 5;
    if (d.biomarkers?.fasting_glucose > 95) r += 12;
    else if (d.biomarkers?.fasting_glucose > 90) r += 6;
    if (d.biomarkers?.hba1c > 5.6) r += 15;
    else if (d.biomarkers?.hba1c > 5.3) r += 5;
    if (d.biomarkers?.triglycerides > 150) r += 8;
    if (d.profile?.family_history_diabetes) r += 12;
    if ((d.fitness?.weeklyActiveMinutes || 0) < 150) r += 8;
    if ((d.nutrition?.avgDailySugar || 0) > 50) r += 6;
    if ((d.profile?.bmi || 0) > 30) r += 15;
    else if ((d.profile?.bmi || 0) > 25) r += 8;
    return Math.min(95, Math.max(2, Math.round(r)));
  },

  _cardioRisk(d) {
    let r = 5;
    if (d.biomarkers?.ldl > 130) r += 15;
    else if (d.biomarkers?.ldl > 100) r += 8;
    if (d.biomarkers?.hdl < 40) r += 12;
    if (d.biomarkers?.total_cholesterol > 240) r += 12;
    else if (d.biomarkers?.total_cholesterol > 200) r += 6;
    if (d.biomarkers?.crp > 3) r += 10;
    if ((d.fitness?.restingHR || 60) > 80) r += 8;
    if (d.profile?.family_history_heart) r += 15;
    if (d.profile?.smoker) r += 20;
    if ((d.sleep?.avgScore || 80) < 70) r += 6;
    return Math.min(95, Math.max(2, Math.round(r)));
  },

  _hypertensionRisk(d) {
    let r = 4;
    if ((d.nutrition?.avgDailySodium || 0) > 2300) r += 12;
    if ((d.fitness?.weeklyActiveMinutes || 0) < 100) r += 10;
    if ((d.profile?.bmi || 0) > 30) r += 12;
    if (d.biomarkers?.cortisol > 20) r += 8;
    if ((d.sleep?.avgScore || 80) < 65) r += 8;
    if (d.profile?.family_history_hypertension) r += 10;
    return Math.min(95, Math.max(2, Math.round(r)));
  },

  _vitDRisk(d) {
    let r = 10;
    if (d.biomarkers?.vitamin_d < 30) r += 30;
    else if (d.biomarkers?.vitamin_d < 40) r += 15;
    if ((d.profile?.outdoor_minutes_per_day || 0) < 20) r += 15;
    if ((d.profile?.latitude || 0) > 35) r += 8;
    return Math.min(95, Math.max(2, Math.round(r)));
  },

  _metabolicRisk(d) {
    let r = 4, f = 0;
    if (d.biomarkers?.triglycerides > 150) f++;
    if (d.biomarkers?.hdl < 40) f++;
    if (d.biomarkers?.fasting_glucose > 100) f++;
    if ((d.profile?.bmi || 0) > 30) f++;
    if ((d.profile?.waist_circumference || 0) > 40) f++;
    return Math.min(95, Math.max(2, Math.round(r + f * 12)));
  },

  _thyroidRisk(d) {
    let r = 3;
    if (d.biomarkers?.tsh > 4.0 || d.biomarkers?.tsh < 0.4) r += 20;
    if (d.biomarkers?.free_t4 < 0.8 || d.biomarkers?.free_t4 > 1.8) r += 15;
    if (d.profile?.family_history_thyroid) r += 10;
    return Math.min(95, Math.max(2, Math.round(r)));
  },

  generateHabits(data, risks) {
    const habits = [];
    if ((data.sleep?.avgScore || 80) < 80)
      habits.push({ id: "sleep_consistency", category: "Sleep", action: "Go to bed within 30 min of the same time each night", impact: "high", targetRisk: "All", frequency: "daily" });
    if ((data.fitness?.weeklyActiveMinutes || 0) < 150)
      habits.push({ id: "active_minutes", category: "Fitness", action: `Add ${Math.max(10, Math.round((150 - (data.fitness?.weeklyActiveMinutes || 0)) / 7))} more active minutes per day`, impact: "high", targetRisk: "Cardiovascular, Diabetes", frequency: "daily" });
    if ((data.nutrition?.avgDailyFiber || 0) < 25)
      habits.push({ id: "fiber_intake", category: "Nutrition", action: "Add a serving of vegetables or legumes to lunch and dinner", impact: "medium", targetRisk: "Metabolic, Diabetes", frequency: "daily" });
    if (data.biomarkers?.vitamin_d < 40)
      habits.push({ id: "sun_exposure", category: "Lifestyle", action: "Get 20 min of midday sun exposure", impact: "high", targetRisk: "Vitamin D Deficiency", frequency: "daily" });
    if (data.biomarkers?.ldl > 100)
      habits.push({ id: "omega3", category: "Nutrition", action: "Eat fatty fish at least 2x per week", impact: "high", targetRisk: "Cardiovascular", frequency: "weekly" });
    if ((data.nutrition?.avgDailySugar || 0) > 35)
      habits.push({ id: "reduce_sugar", category: "Nutrition", action: "Replace one sugary snack with whole fruit", impact: "medium", targetRisk: "Diabetes, Metabolic", frequency: "daily" });
    if ((data.sleep?.avgHRV || 60) < 50)
      habits.push({ id: "stress_mgmt", category: "Recovery", action: "Practice 10 min of breathwork before bed", impact: "medium", targetRisk: "Cardiovascular, Hypertension", frequency: "daily" });
    habits.push({ id: "hydration", category: "Nutrition", action: "Drink at least 2.5L of water daily", impact: "low", targetRisk: "All", frequency: "daily" });
    return habits;
  },

  generateWeeklyReport(userId, weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const endStr = weekEnd.toISOString().split("T")[0];

    const sleepRows = db.prepare("SELECT * FROM sleep_entries WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date").all(userId, weekStart, endStr);
    const nutritionRows = db.prepare("SELECT * FROM nutrition_entries WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date").all(userId, weekStart, endStr);
    const fitnessRows = db.prepare("SELECT * FROM fitness_entries WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date").all(userId, weekStart, endStr);
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
    const latestBio = db.prepare("SELECT * FROM biomarkers WHERE user_id = ? ORDER BY tested_date DESC LIMIT 1").get(userId);

    const avgSleep = sleepRows.length > 0 ? Math.round(sleepRows.reduce((s, r) => s + (r.score || 0), 0) / sleepRows.length) : null;
    const avgCalories = nutritionRows.length > 0 ? Math.round(nutritionRows.reduce((s, r) => s + (r.calories || 0), 0) / nutritionRows.length) : null;
    const totalActiveMin = fitnessRows.reduce((s, r) => s + (r.active_minutes || 0), 0);
    const avgStrain = fitnessRows.length > 0 ? Math.round(fitnessRows.reduce((s, r) => s + (r.strain || 0), 0) / fitnessRows.length * 10) / 10 : null;

    const risks = this.computeRisks(profile, latestBio, { weeklyActiveMinutes: totalActiveMin }, { avgScore: avgSleep }, { avgDailySugar: 35, avgDailyFiber: 28, avgDailySodium: 2100 });

    const avgProtein = nutritionRows.length > 0 ? Math.round(nutritionRows.reduce((s, r) => s + (r.protein || 0), 0) / nutritionRows.length) : null;
    const avgFiber = nutritionRows.length > 0 ? Math.round(nutritionRows.reduce((s, r) => s + (r.fiber || 0), 0) / nutritionRows.length * 10) / 10 : null;

    // Trends — compare to previous week
    const prevStart = new Date(weekStart);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevStartStr = prevStart.toISOString().split("T")[0];
    const prevSleep = db.prepare("SELECT AVG(score) as avg FROM sleep_entries WHERE user_id = ? AND date BETWEEN ? AND ?").get(userId, prevStartStr, weekStart);
    const prevFitness = db.prepare("SELECT SUM(active_minutes) as total FROM fitness_entries WHERE user_id = ? AND date BETWEEN ? AND ?").get(userId, prevStartStr, weekStart);

    const sleepTrend = prevSleep?.avg ? Math.round(((avgSleep || 0) - prevSleep.avg) / prevSleep.avg * 100) : null;
    const fitnessTrend = prevFitness?.total ? Math.round((totalActiveMin - prevFitness.total) / prevFitness.total * 100) : null;

    return {
      weekStart, weekEnd: endStr,
      summary: {
        sleepScore: avgSleep, sleepTrendPct: sleepTrend,
        avgCalories, avgProtein, avgFiber,
        totalActiveMinutes: totalActiveMin, activeMinutesTrendPct: fitnessTrend,
        avgStrain,
        daysLogged: { sleep: sleepRows.length, nutrition: nutritionRows.length, fitness: fitnessRows.length },
      },
      risks,
      highlights: [
        avgSleep && avgSleep >= 85 ? "Excellent sleep quality this week" : avgSleep && avgSleep < 70 ? "Sleep quality needs attention" : null,
        totalActiveMin >= 150 ? "Hit your 150-minute active goal!" : `${150 - totalActiveMin} more minutes needed to hit weekly goal`,
        avgProtein && avgProtein >= 140 ? "Strong protein intake" : avgProtein ? "Consider adding more protein" : null,
      ].filter(Boolean),
      sleepData: sleepRows,
      nutritionData: nutritionRows,
      fitnessData: fitnessRows,
    };
  }
};

// ─── Auth Routes ─────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "Email, password, and name required" });
    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)").run(email, hash, name);
    const token = jwt.sign({ id: result.lastInsertRowid, email, name }, JWT_SECRET, { expiresIn: "30d" });
    // Create default profile
    db.prepare("INSERT INTO profiles (user_id, age, sex) VALUES (?, 22, 'male')").run(result.lastInsertRowid);
    res.json({ token, user: { id: result.lastInsertRowid, email, name } });
  } catch (e) {
    if (e.message?.includes("UNIQUE")) return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Profile Routes ──────────────────────────────────────────
app.get("/api/profile", auth, (req, res) => {
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(req.user.id);
  res.json(profile || {});
});

app.put("/api/profile", auth, (req, res) => {
  const p = req.body;
  db.prepare(`
    INSERT INTO profiles (user_id, age, sex, height, weight, bmi, waist_circumference, smoker,
      outdoor_minutes_per_day, latitude, family_history_diabetes, family_history_heart,
      family_history_hypertension, family_history_thyroid, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      age=excluded.age, sex=excluded.sex, height=excluded.height, weight=excluded.weight,
      bmi=excluded.bmi, waist_circumference=excluded.waist_circumference, smoker=excluded.smoker,
      outdoor_minutes_per_day=excluded.outdoor_minutes_per_day, latitude=excluded.latitude,
      family_history_diabetes=excluded.family_history_diabetes, family_history_heart=excluded.family_history_heart,
      family_history_hypertension=excluded.family_history_hypertension, family_history_thyroid=excluded.family_history_thyroid,
      updated_at=CURRENT_TIMESTAMP
  `).run(req.user.id, p.age, p.sex, p.height, p.weight, p.bmi, p.waist_circumference,
    p.smoker ? 1 : 0, p.outdoor_minutes_per_day, p.latitude,
    p.family_history_diabetes ? 1 : 0, p.family_history_heart ? 1 : 0,
    p.family_history_hypertension ? 1 : 0, p.family_history_thyroid ? 1 : 0);
  res.json({ success: true });
});

// ─── Biomarker Routes ────────────────────────────────────────
app.get("/api/biomarkers", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM biomarkers WHERE user_id = ? ORDER BY tested_date DESC").all(req.user.id);
  res.json(rows);
});

app.get("/api/biomarkers/latest", auth, (req, res) => {
  const row = db.prepare("SELECT * FROM biomarkers WHERE user_id = ? ORDER BY tested_date DESC LIMIT 1").get(req.user.id);
  res.json(row || {});
});

app.post("/api/biomarkers", auth, (req, res) => {
  const b = req.body;
  const result = db.prepare(`
    INSERT INTO biomarkers (user_id, hemoglobin, vitamin_d, b12, iron, ferritin, tsh, free_t4,
      total_cholesterol, hdl, ldl, triglycerides, fasting_glucose, hba1c, crp, cortisol, testosterone, tested_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, b.hemoglobin, b.vitamin_d, b.b12, b.iron, b.ferritin, b.tsh, b.free_t4,
    b.total_cholesterol, b.hdl, b.ldl, b.triglycerides, b.fasting_glucose, b.hba1c, b.crp,
    b.cortisol, b.testosterone, b.tested_date || new Date().toISOString().split("T")[0]);
  res.json({ id: result.lastInsertRowid, success: true });
});

// ─── Sleep Routes ────────────────────────────────────────────
app.get("/api/sleep", auth, (req, res) => {
  const { days = 7 } = req.query;
  const rows = db.prepare("SELECT * FROM sleep_entries WHERE user_id = ? ORDER BY date DESC LIMIT ?").all(req.user.id, parseInt(days));
  res.json(rows.reverse());
});

app.post("/api/sleep", auth, (req, res) => {
  const s = req.body;
  const result = db.prepare(`
    INSERT OR REPLACE INTO sleep_entries (user_id, date, deep, rem, light, awake, total, score, hrv, resting_hr, spo2, skin_temp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, s.date, s.deep, s.rem, s.light, s.awake, s.total, s.score, s.hrv, s.resting_hr, s.spo2, s.skin_temp);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.post("/api/sleep/bulk", auth, (req, res) => {
  const insert = db.prepare(`INSERT OR REPLACE INTO sleep_entries (user_id, date, deep, rem, light, awake, total, score, hrv, resting_hr, spo2, skin_temp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const tx = db.transaction((entries) => {
    for (const s of entries) insert.run(req.user.id, s.date, s.deep, s.rem, s.light, s.awake, s.total, s.score, s.hrv, s.resting_hr, s.spo2, s.skin_temp);
  });
  tx(req.body.entries || []);
  res.json({ success: true, count: (req.body.entries || []).length });
});

// ─── Nutrition Routes ────────────────────────────────────────
app.get("/api/nutrition", auth, (req, res) => {
  const { days = 7 } = req.query;
  const rows = db.prepare("SELECT * FROM nutrition_entries WHERE user_id = ? ORDER BY date DESC LIMIT ?").all(req.user.id, parseInt(days));
  res.json(rows.reverse());
});

app.post("/api/nutrition", auth, (req, res) => {
  const n = req.body;
  const result = db.prepare(`
    INSERT OR REPLACE INTO nutrition_entries (user_id, date, calories, protein, carbs, fat, fiber, sugar, sodium, water)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, n.date, n.calories, n.protein, n.carbs, n.fat, n.fiber, n.sugar, n.sodium, n.water);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.post("/api/nutrition/bulk", auth, (req, res) => {
  const insert = db.prepare(`INSERT OR REPLACE INTO nutrition_entries (user_id, date, calories, protein, carbs, fat, fiber, sugar, sodium, water) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const tx = db.transaction((entries) => {
    for (const n of entries) insert.run(req.user.id, n.date, n.calories, n.protein, n.carbs, n.fat, n.fiber, n.sugar, n.sodium, n.water);
  });
  tx(req.body.entries || []);
  res.json({ success: true, count: (req.body.entries || []).length });
});

// ─── Fitness Routes ──────────────────────────────────────────
app.get("/api/fitness", auth, (req, res) => {
  const { days = 7 } = req.query;
  const rows = db.prepare("SELECT * FROM fitness_entries WHERE user_id = ? ORDER BY date DESC LIMIT ?").all(req.user.id, parseInt(days));
  res.json(rows.reverse());
});

app.post("/api/fitness", auth, (req, res) => {
  const f = req.body;
  const result = db.prepare(`
    INSERT OR REPLACE INTO fitness_entries (user_id, date, strain, calories_burned, active_minutes, steps, resting_hr, workout_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, f.date, f.strain, f.calories_burned, f.active_minutes, f.steps, f.resting_hr, f.workout_type);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.post("/api/fitness/bulk", auth, (req, res) => {
  const insert = db.prepare(`INSERT OR REPLACE INTO fitness_entries (user_id, date, strain, calories_burned, active_minutes, steps, resting_hr, workout_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const tx = db.transaction((entries) => {
    for (const f of entries) insert.run(req.user.id, f.date, f.strain, f.calories_burned, f.active_minutes, f.steps, f.resting_hr, f.workout_type);
  });
  tx(req.body.entries || []);
  res.json({ success: true, count: (req.body.entries || []).length });
});

// ─── Heart Rate Routes ───────────────────────────────────────
app.get("/api/heartrate/:date", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM heart_rate_readings WHERE user_id = ? AND date = ? ORDER BY hour").all(req.user.id, req.params.date);
  res.json(rows);
});

app.post("/api/heartrate/bulk", auth, (req, res) => {
  const insert = db.prepare(`INSERT OR REPLACE INTO heart_rate_readings (user_id, date, hour, hr, hrv) VALUES (?, ?, ?, ?, ?)`);
  const tx = db.transaction((entries) => {
    for (const h of entries) insert.run(req.user.id, h.date, h.hour, h.hr, h.hrv);
  });
  tx(req.body.entries || []);
  res.json({ success: true, count: (req.body.entries || []).length });
});

// ─── Goals Routes ────────────────────────────────────────────
app.get("/api/goals", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM goals WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC").all(req.user.id);
  res.json(rows);
});

app.get("/api/goals/all", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json(rows);
});

app.post("/api/goals", auth, (req, res) => {
  const g = req.body;
  const result = db.prepare(`
    INSERT INTO goals (user_id, category, title, target_value, current_value, unit, deadline, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(req.user.id, g.category, g.title, g.target_value, g.current_value || 0, g.unit, g.deadline);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.put("/api/goals/:id", auth, (req, res) => {
  const g = req.body;
  db.prepare(`UPDATE goals SET current_value = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
    .run(g.current_value, g.status || "active", req.params.id, req.user.id);
  res.json({ success: true });
});

app.delete("/api/goals/:id", auth, (req, res) => {
  db.prepare("DELETE FROM goals WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ─── Habit Log Routes ────────────────────────────────────────
app.get("/api/habits/:date", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM habit_logs WHERE user_id = ? AND date = ?").all(req.user.id, req.params.date);
  res.json(rows);
});

app.get("/api/habits/streak/:habit_id", auth, (req, res) => {
  const rows = db.prepare("SELECT date FROM habit_logs WHERE user_id = ? AND habit_id = ? AND completed = 1 ORDER BY date DESC").all(req.user.id, req.params.habit_id);
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (rows[i].date === expected.toISOString().split("T")[0]) streak++;
    else break;
  }
  res.json({ habit_id: req.params.habit_id, streak });
});

app.post("/api/habits", auth, (req, res) => {
  const { habit_id, date, completed } = req.body;
  db.prepare(`INSERT OR REPLACE INTO habit_logs (user_id, habit_id, date, completed) VALUES (?, ?, ?, ?)`)
    .run(req.user.id, habit_id, date, completed ? 1 : 0);
  res.json({ success: true });
});

// ─── Risk Assessment Route ───────────────────────────────────
app.get("/api/risks", auth, (req, res) => {
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(req.user.id);
  const bio = db.prepare("SELECT * FROM biomarkers WHERE user_id = ? ORDER BY tested_date DESC LIMIT 1").get(req.user.id);
  const fitness = db.prepare("SELECT SUM(active_minutes) as weeklyActiveMinutes, AVG(resting_hr) as restingHR FROM fitness_entries WHERE user_id = ? AND date >= date('now', '-7 days')").get(req.user.id);
  const sleep = db.prepare("SELECT AVG(score) as avgScore, AVG(hrv) as avgHRV FROM sleep_entries WHERE user_id = ? AND date >= date('now', '-7 days')").get(req.user.id);
  const nutrition = db.prepare("SELECT AVG(sugar) as avgDailySugar, AVG(fiber) as avgDailyFiber, AVG(sodium) as avgDailySodium FROM nutrition_entries WHERE user_id = ? AND date >= date('now', '-7 days')").get(req.user.id);

  const risks = HealthEngine.computeRisks(profile, bio, fitness, sleep, nutrition);
  const habits = HealthEngine.generateHabits({ profile, biomarkers: bio, fitness, sleep, nutrition }, risks);
  res.json({ risks, habits });
});

// ─── Weekly Report Route ─────────────────────────────────────
app.get("/api/reports/weekly", auth, (req, res) => {
  const { week_start } = req.query;
  const start = week_start || (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() - 7); return d.toISOString().split("T")[0]; })();
  const report = HealthEngine.generateWeeklyReport(req.user.id, start);

  // Cache report
  db.prepare(`INSERT OR REPLACE INTO weekly_reports (user_id, week_start, report_data) VALUES (?, ?, ?)`)
    .run(req.user.id, start, JSON.stringify(report));

  res.json(report);
});

app.get("/api/reports/history", auth, (req, res) => {
  const rows = db.prepare("SELECT id, week_start, created_at FROM weekly_reports WHERE user_id = ? ORDER BY week_start DESC LIMIT 12").all(req.user.id);
  res.json(rows);
});

// ─── Trends Route ────────────────────────────────────────────
app.get("/api/trends", auth, (req, res) => {
  const { days = 30 } = req.query;
  const sleep = db.prepare("SELECT date, score, total, deep, rem, hrv, resting_hr FROM sleep_entries WHERE user_id = ? AND date >= date('now', ? || ' days') ORDER BY date").all(req.user.id, `-${days}`);
  const nutrition = db.prepare("SELECT date, calories, protein, carbs, fat, fiber, sugar FROM nutrition_entries WHERE user_id = ? AND date >= date('now', ? || ' days') ORDER BY date").all(req.user.id, `-${days}`);
  const fitness = db.prepare("SELECT date, strain, calories_burned, active_minutes, steps FROM fitness_entries WHERE user_id = ? AND date >= date('now', ? || ' days') ORDER BY date").all(req.user.id, `-${days}`);
  const biomarkers = db.prepare("SELECT tested_date, total_cholesterol, ldl, hdl, fasting_glucose, hba1c, vitamin_d FROM biomarkers WHERE user_id = ? ORDER BY tested_date DESC LIMIT 10").all(req.user.id);

  res.json({ sleep, nutrition, fitness, biomarkers: biomarkers.reverse() });
});

// ─── Connections Routes ──────────────────────────────────────
app.get("/api/connections", auth, (req, res) => {
  const rows = db.prepare("SELECT provider, connected, last_sync FROM connections WHERE user_id = ?").all(req.user.id);
  res.json(rows);
});

app.post("/api/connections", auth, (req, res) => {
  const { provider, access_token, refresh_token } = req.body;
  db.prepare(`INSERT INTO connections (user_id, provider, access_token, refresh_token, last_sync)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, provider) DO UPDATE SET access_token=excluded.access_token, refresh_token=excluded.refresh_token, connected=1, last_sync=CURRENT_TIMESTAMP
  `).run(req.user.id, provider, access_token, refresh_token);
  res.json({ success: true });
});

app.delete("/api/connections/:provider", auth, (req, res) => {
  db.prepare("UPDATE connections SET connected = 0 WHERE user_id = ? AND provider = ?").run(req.user.id, req.params.provider);
  res.json({ success: true });
});

// ─── Export / Import ─────────────────────────────────────────
app.get("/api/export", auth, (req, res) => {
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(req.user.id);
  const biomarkers = db.prepare("SELECT * FROM biomarkers WHERE user_id = ? ORDER BY tested_date DESC").all(req.user.id);
  const sleep = db.prepare("SELECT * FROM sleep_entries WHERE user_id = ? ORDER BY date DESC LIMIT 90").all(req.user.id);
  const nutrition = db.prepare("SELECT * FROM nutrition_entries WHERE user_id = ? ORDER BY date DESC LIMIT 90").all(req.user.id);
  const fitness = db.prepare("SELECT * FROM fitness_entries WHERE user_id = ? ORDER BY date DESC LIMIT 90").all(req.user.id);
  const goals = db.prepare("SELECT * FROM goals WHERE user_id = ?").all(req.user.id);
  res.json({ profile, biomarkers, sleep, nutrition, fitness, goals, exportDate: new Date().toISOString() });
});

app.post("/api/import", auth, (req, res) => {
  try {
    const data = req.body;
    let counts = { sleep: 0, nutrition: 0, fitness: 0 };

    if (data.sleep?.length) {
      const insert = db.prepare(`INSERT OR REPLACE INTO sleep_entries (user_id, date, deep, rem, light, awake, total, score, hrv, resting_hr) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const tx = db.transaction((entries) => { for (const s of entries) insert.run(req.user.id, s.date, s.deep, s.rem, s.light, s.awake, s.total, s.score, s.hrv, s.resting_hr); });
      tx(data.sleep);
      counts.sleep = data.sleep.length;
    }
    if (data.nutrition?.length) {
      const insert = db.prepare(`INSERT OR REPLACE INTO nutrition_entries (user_id, date, calories, protein, carbs, fat, fiber, sugar, sodium, water) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const tx = db.transaction((entries) => { for (const n of entries) insert.run(req.user.id, n.date, n.calories, n.protein, n.carbs, n.fat, n.fiber, n.sugar, n.sodium, n.water); });
      tx(data.nutrition);
      counts.nutrition = data.nutrition.length;
    }
    if (data.fitness?.length) {
      const insert = db.prepare(`INSERT OR REPLACE INTO fitness_entries (user_id, date, strain, calories_burned, active_minutes, steps, resting_hr, workout_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      const tx = db.transaction((entries) => { for (const f of entries) insert.run(req.user.id, f.date, f.strain, f.calories_burned, f.active_minutes, f.steps, f.resting_hr, f.workout_type); });
      tx(data.fitness);
      counts.fitness = data.fitness.length;
    }

    res.json({ success: true, imported: counts });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Health check ────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🏥 AptoSwasthy API running on http://localhost:${PORT}`);
  console.log(`  📊 Endpoints: /api/auth, /api/profile, /api/biomarkers, /api/sleep,`);
  console.log(`     /api/nutrition, /api/fitness, /api/goals, /api/habits,`);
  console.log(`     /api/risks, /api/reports/weekly, /api/trends, /api/export\n`);
});
