import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

// ─── Design Tokens ───────────────────────────────────────────
const C = {
  bg: "#F6F4EE", bgWarm: "#EEEBE3", card: "#FFFFFF", cardAlt: "#FAFAF7",
  sage: "#7BA68A", sageDark: "#5E8A6E", sageLight: "#B8D4C2", sageMuted: "#E8F0EB",
  teal: "#5A9EA6", tealDark: "#3D7A82", tealLight: "#B3D8DC",
  coral: "#D4836A", coralLight: "#F0C4B6",
  amber: "#C9A84C", amberLight: "#F0DFA0",
  lavender: "#9B8EC4", lavenderLight: "#D4CCE8",
  text: "#2C3E36", textMuted: "#6B7C74", textLight: "#97A59E",
  border: "#E2DED6", white: "#FFFFFF",
  success: "#6AAF7B", warning: "#D4A84C", danger: "#C46B6B",
};

// ─── Storage Keys ────────────────────────────────────────────
const STORAGE = {
  USER_PROFILE: "apto_user_profile",
  HEALTH_DATA: "apto_health_data",
  HABITS: "apto_habits",
  CONNECTIONS: "apto_connections",
  GOALS: "apto_goals",
};

// ─── Health Prediction Engine ────────────────────────────────
const HealthEngine = {
  computeDiabetesRisk(data) {
    let risk = 5;
    if (data.biomarkers?.fastingGlucose > 95) risk += 12;
    else if (data.biomarkers?.fastingGlucose > 90) risk += 6;
    if (data.biomarkers?.hba1c > 5.6) risk += 15;
    else if (data.biomarkers?.hba1c > 5.3) risk += 5;
    if (data.biomarkers?.triglycerides > 150) risk += 8;
    if (data.profile?.familyHistory?.diabetes) risk += 12;
    if (data.fitness?.weeklyActiveMinutes < 150) risk += 8;
    if (data.nutrition?.avgDailySugar > 50) risk += 6;
    if (data.profile?.bmi > 30) risk += 15;
    else if (data.profile?.bmi > 25) risk += 8;
    return Math.min(95, Math.max(2, Math.round(risk)));
  },

  computeCardioRisk(data) {
    let risk = 5;
    if (data.biomarkers?.ldl > 130) risk += 15;
    else if (data.biomarkers?.ldl > 100) risk += 8;
    if (data.biomarkers?.hdl < 40) risk += 12;
    if (data.biomarkers?.totalCholesterol > 240) risk += 12;
    else if (data.biomarkers?.totalCholesterol > 200) risk += 6;
    if (data.biomarkers?.crp > 3) risk += 10;
    if (data.fitness?.restingHR > 80) risk += 8;
    if (data.profile?.familyHistory?.heartDisease) risk += 15;
    if (data.profile?.smoker) risk += 20;
    if (data.sleep?.avgScore < 70) risk += 6;
    return Math.min(95, Math.max(2, Math.round(risk)));
  },

  computeHypertensionRisk(data) {
    let risk = 4;
    if (data.nutrition?.avgDailySodium > 2300) risk += 12;
    if (data.fitness?.weeklyActiveMinutes < 100) risk += 10;
    if (data.profile?.bmi > 30) risk += 12;
    if (data.biomarkers?.cortisol > 20) risk += 8;
    if (data.sleep?.avgScore < 65) risk += 8;
    if (data.profile?.familyHistory?.hypertension) risk += 10;
    return Math.min(95, Math.max(2, Math.round(risk)));
  },

  computeVitDRisk(data) {
    let risk = 10;
    if (data.biomarkers?.vitaminD < 30) risk += 30;
    else if (data.biomarkers?.vitaminD < 40) risk += 15;
    if (data.profile?.outdoorMinutesPerDay < 20) risk += 15;
    if (data.profile?.latitude > 35) risk += 8;
    return Math.min(95, Math.max(2, Math.round(risk)));
  },

  computeMetabolicRisk(data) {
    let risk = 4;
    let factors = 0;
    if (data.biomarkers?.triglycerides > 150) factors++;
    if (data.biomarkers?.hdl < 40) factors++;
    if (data.biomarkers?.fastingGlucose > 100) factors++;
    if (data.profile?.bmi > 30) factors++;
    if (data.profile?.waistCircumference > 40) factors++;
    risk += factors * 12;
    return Math.min(95, Math.max(2, Math.round(risk)));
  },

  computeThyroidRisk(data) {
    let risk = 3;
    if (data.biomarkers?.tsh > 4.0) risk += 20;
    else if (data.biomarkers?.tsh < 0.4) risk += 20;
    if (data.biomarkers?.freeT4 < 0.8 || data.biomarkers?.freeT4 > 1.8) risk += 15;
    if (data.profile?.familyHistory?.thyroid) risk += 10;
    return Math.min(95, Math.max(2, Math.round(risk)));
  },

  generateHabitRecommendations(data, risks) {
    const habits = [];
    const highestRisks = Object.entries(risks).sort((a, b) => b[1] - a[1]).slice(0, 3);

    if (data.sleep?.avgScore < 80) {
      habits.push({ id: "sleep_consistency", category: "Sleep", action: "Go to bed within 30 min of the same time each night", impact: "high", targetRisk: "All", frequency: "daily", tracked: false });
    }
    if (data.fitness?.weeklyActiveMinutes < 150) {
      habits.push({ id: "active_minutes", category: "Fitness", action: `Add ${Math.max(10, Math.round((150 - (data.fitness?.weeklyActiveMinutes || 0)) / 7))} more active minutes per day`, impact: "high", targetRisk: "Cardiovascular, Diabetes", frequency: "daily", tracked: false });
    }
    if (data.nutrition?.avgDailyFiber < 25) {
      habits.push({ id: "fiber_intake", category: "Nutrition", action: "Add a serving of vegetables or legumes to lunch and dinner", impact: "medium", targetRisk: "Metabolic, Diabetes", frequency: "daily", tracked: false });
    }
    if (data.biomarkers?.vitaminD < 40) {
      habits.push({ id: "sun_exposure", category: "Lifestyle", action: "Get 20 min of midday sun exposure without sunscreen", impact: "high", targetRisk: "Vitamin D Deficiency", frequency: "daily", tracked: false });
    }
    if (data.biomarkers?.ldl > 100) {
      habits.push({ id: "omega3", category: "Nutrition", action: "Eat fatty fish (salmon, sardines) at least 2x per week", impact: "high", targetRisk: "Cardiovascular", frequency: "weekly", tracked: false });
    }
    if (data.nutrition?.avgDailySugar > 35) {
      habits.push({ id: "reduce_sugar", category: "Nutrition", action: "Replace one sugary drink or snack with whole fruit", impact: "medium", targetRisk: "Diabetes, Metabolic", frequency: "daily", tracked: false });
    }
    if (data.sleep?.avgHRV < 50) {
      habits.push({ id: "stress_mgmt", category: "Recovery", action: "Practice 10 min of breathwork or meditation before bed", impact: "medium", targetRisk: "Cardiovascular, Hypertension", frequency: "daily", tracked: false });
    }
    habits.push({ id: "hydration", category: "Nutrition", action: "Drink at least 2.5L of water throughout the day", impact: "low", targetRisk: "All", frequency: "daily", tracked: false });

    return habits;
  },

  computeAllRisks(data) {
    return {
      diabetes: this.computeDiabetesRisk(data),
      cardiovascular: this.computeCardioRisk(data),
      hypertension: this.computeHypertensionRisk(data),
      vitaminD: this.computeVitDRisk(data),
      metabolic: this.computeMetabolicRisk(data),
      thyroid: this.computeThyroidRisk(data),
    };
  }
};

// ─── Default Data (pre-populated for demo, overwritten by imports) ──
const DEFAULT_DATA = {
  profile: {
    name: "Rohan", age: 22, sex: "male", height: 175, weight: 72,
    bmi: 23.5, waistCircumference: 33, smoker: false,
    outdoorMinutesPerDay: 15, latitude: 40.8,
    familyHistory: { diabetes: true, heartDisease: false, hypertension: false, thyroid: false },
  },
  biomarkers: {
    hemoglobin: 14.8, vitaminD: 32, b12: 480, iron: 95, ferritin: 78,
    tsh: 2.1, freeT4: 1.2, totalCholesterol: 198, hdl: 58, ldl: 118,
    triglycerides: 110, fastingGlucose: 92, hba1c: 5.4, crp: 1.2,
    cortisol: 16, testosterone: 620,
    lastTested: "2026-01-28",
  },
  sleep: {
    weekly: [
      { day: "Mon", deep: 1.8, rem: 2.1, light: 3.2, awake: 0.4, total: 7.5, score: 82 },
      { day: "Tue", deep: 2.1, rem: 1.9, light: 3.5, awake: 0.3, total: 7.8, score: 88 },
      { day: "Wed", deep: 1.5, rem: 2.3, light: 3.0, awake: 0.5, total: 7.3, score: 76 },
      { day: "Thu", deep: 2.3, rem: 2.0, light: 3.4, awake: 0.2, total: 7.9, score: 91 },
      { day: "Fri", deep: 1.9, rem: 1.7, light: 3.6, awake: 0.6, total: 7.8, score: 79 },
      { day: "Sat", deep: 2.5, rem: 2.4, light: 3.8, awake: 0.2, total: 8.9, score: 94 },
      { day: "Sun", deep: 2.2, rem: 2.1, light: 3.3, awake: 0.3, total: 7.9, score: 87 },
    ],
    avgScore: 85, avgHRV: 54, restingHR: 58,
  },
  fitness: {
    weeklyActiveMinutes: 185, restingHR: 58,
    weeklyStrain: [
      { day: "Mon", strain: 12.4, calories: 2340, activeMin: 32 },
      { day: "Tue", strain: 15.8, calories: 2680, activeMin: 45 },
      { day: "Wed", strain: 8.2, calories: 2050, activeMin: 18 },
      { day: "Thu", strain: 17.1, calories: 2890, activeMin: 52 },
      { day: "Fri", strain: 10.5, calories: 2200, activeMin: 25 },
      { day: "Sat", strain: 19.3, calories: 3100, activeMin: 60 },
      { day: "Sun", strain: 6.8, calories: 1950, activeMin: 12 },
    ],
    heartRate: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      hr: Math.round(i < 6 ? 56 + Math.random() * 6 : i < 9 ? 68 + Math.random() * 12 : i < 12 ? 72 + Math.random() * 18 : i < 14 ? 70 + Math.random() * 8 : i < 18 ? 78 + Math.random() * 25 : i < 21 ? 72 + Math.random() * 12 : 59 + Math.random() * 8),
      hrv: Math.round(i < 6 ? 68 + Math.random() * 12 : i < 12 ? 48 + Math.random() * 18 : i < 18 ? 42 + Math.random() * 12 : 58 + Math.random() * 18),
    })),
  },
  nutrition: {
    weekly: [
      { day: "Mon", protein: 142, carbs: 220, fat: 68, fiber: 28, sugar: 38, sodium: 2100, calories: 2050 },
      { day: "Tue", protein: 165, carbs: 195, fat: 72, fiber: 32, sugar: 32, sodium: 1950, calories: 2090 },
      { day: "Wed", protein: 138, carbs: 240, fat: 65, fiber: 25, sugar: 45, sodium: 2300, calories: 2100 },
      { day: "Thu", protein: 155, carbs: 210, fat: 70, fiber: 30, sugar: 35, sodium: 2050, calories: 2080 },
      { day: "Fri", protein: 148, carbs: 230, fat: 75, fiber: 27, sugar: 42, sodium: 2200, calories: 2150 },
      { day: "Sat", protein: 170, carbs: 260, fat: 80, fiber: 22, sugar: 52, sodium: 2500, calories: 2430 },
      { day: "Sun", protein: 130, carbs: 200, fat: 60, fiber: 35, sugar: 28, sodium: 1800, calories: 1860 },
    ],
    avgDailySugar: 39, avgDailyFiber: 28.4, avgDailySodium: 2129, calorieGoal: 2200,
  },
};

// ─── Utility Components ──────────────────────────────────────
function CircularProgress({ value, max, size = 120, strokeWidth = 10, color, label, sublabel, displayValue }) {
  const [progress, setProgress] = useState(0);
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - ((progress / max) * circ);
  const pct = Math.min(100, Math.round((value / max) * 100));
  const innerText = displayValue !== undefined ? displayValue : `${pct}%`;
  const showSubPct = displayValue !== undefined && !String(displayValue).includes('%');

  useEffect(() => {
    const t = setTimeout(() => setProgress(value), 150);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={strokeWidth} opacity={0.3} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }} />
        </svg>
        {/* Text overlay positioned absolutely on top of SVG */}
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", pointerEvents: "none",
        }}>
          <span style={{ fontSize: size * 0.22, fontWeight: 700, color: C.text, fontFamily: "'DM Sans',sans-serif", lineHeight: 1 }}>
            {innerText}
          </span>
          {showSubPct && (
            <span style={{ fontSize: size * 0.12, fontWeight: 600, color, lineHeight: 1, marginTop: 2 }}>
              {pct}%
            </span>
          )}
        </div>
      </div>
      {label && <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</span>}
      {sublabel && <span style={{ fontSize: 11, color: C.textMuted, marginTop: -4 }}>{sublabel}</span>}
    </div>
  );
}

function Card({ children, style, hoverable = false, onClick }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => hoverable && setH(true)} onMouseLeave={() => hoverable && setH(false)}
      style={{
        background: C.card, borderRadius: 20, padding: 24, border: `1px solid ${C.border}`,
        boxShadow: h ? "0 8px 32px rgba(44,62,54,0.08)" : "0 2px 12px rgba(44,62,54,0.03)",
        transition: "all 0.3s", transform: h ? "translateY(-2px)" : "none",
        cursor: onClick ? "pointer" : "default", ...style,
      }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0, fontFamily: "'Fraunces',serif" }}>{title}</h2>
      </div>
      {subtitle && <p style={{ fontSize: 13, color: C.textMuted, margin: "4px 0 0 30px" }}>{subtitle}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { normal: [C.success, "Normal"], "low-normal": [C.warning, "Low-Normal"], borderline: [C.warning, "Borderline"], elevated: [C.danger, "Elevated"], low: [C.sage, "Low"], high: [C.coral, "High"] };
  const [color, label] = map[status] || [C.textLight, status];
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 8, background: color + "18", color }}>{label}</span>;
}

function BiomarkerBar({ marker }) {
  const parts = marker.range.replace(/[<>]/g, "").split("-");
  let pct = 50;
  if (parts.length === 2) { const lo = parseFloat(parts[0]), hi = parseFloat(parts[1]); pct = ((marker.value - lo) / (hi - lo)) * 100; }
  else if (marker.range.startsWith("<")) pct = (marker.value / parseFloat(parts[0])) * 100;
  else if (marker.range.startsWith(">")) pct = Math.min(100, (marker.value / (parseFloat(parts[0]) * 2)) * 100);
  pct = Math.max(5, Math.min(95, pct));
  const sColor = { normal: C.sage, "low-normal": C.amber, borderline: C.amber, elevated: C.coral }[marker.status] || C.sage;

  return (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}22` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: sColor, display: "inline-block" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{marker.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: sColor }}>{marker.value}</span>
          <span style={{ fontSize: 11, color: C.textMuted }}>{marker.unit}</span>
        </div>
      </div>
      <div style={{ position: "relative", height: 6, background: `linear-gradient(90deg, ${C.coralLight}44, ${C.sageMuted}, ${C.sageMuted}, ${C.coralLight}44)`, borderRadius: 3 }}>
        <div style={{ position: "absolute", left: `calc(${pct}% - 5px)`, top: -2, width: 10, height: 10, borderRadius: "50%", background: sColor, border: `2px solid ${C.white}`, boxShadow: `0 1px 4px ${sColor}44`, transition: "left 0.8s ease" }} />
      </div>
      <div style={{ fontSize: 10, color: C.textLight, marginTop: 4, textAlign: "right" }}>Range: {marker.range} {marker.unit}</div>
    </div>
  );
}

function RiskGauge({ name, risk, icon, factors, trend }) {
  const riskColor = risk < 15 ? C.sage : risk < 30 ? C.amber : C.coral;
  const trendMap = { stable: ["Stable", C.textMuted], improving: ["Improving", C.sage], low: ["Low Risk", C.sage], watch: ["Monitor", C.amber], worsening: ["Worsening", C.coral] };
  const [tLabel, tColor] = trendMap[trend] || ["—", C.textMuted];

  return (
    <Card hoverable style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{name}</span>
        </div>
        <span style={{ fontSize: 11, color: tColor, fontWeight: 600, background: tColor + "15", padding: "2px 8px", borderRadius: 10 }}>{tLabel}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 8, background: C.border + "44", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${risk}%`, height: "100%", background: `linear-gradient(90deg, ${riskColor}88, ${riskColor})`, borderRadius: 4, transition: "width 1s ease" }} />
        </div>
        <span style={{ fontSize: 18, fontWeight: 800, color: riskColor, minWidth: 40, textAlign: "right" }}>{risk}%</span>
      </div>
      {factors && <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {factors.map((f, i) => (
          <span key={i} style={{ fontSize: 11, color: C.textMuted, paddingLeft: 8, borderLeft: `2px solid ${riskColor}22` }}>{f}</span>
        ))}
      </div>}
    </Card>
  );
}

function MacroPie({ protein, carbs, fat }) {
  const data = [
    { name: "Protein", value: protein, color: C.teal },
    { name: "Carbs", value: carbs, color: C.amber },
    { name: "Fat", value: fat, color: C.coral },
  ];
  const total = protein * 4 + carbs * 4 + fat * 9;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <ResponsiveContainer width={90} height={90}>
        <PieChart><Pie data={data} innerRadius={28} outerRadius={40} paddingAngle={3} dataKey="value" strokeWidth={0}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie></PieChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
            <span style={{ fontSize: 12, color: C.textMuted }}>{d.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{d.value}g</span>
            <span style={{ fontSize: 10, color: C.textLight }}>({Math.round((d.value * (d.name === "Fat" ? 9 : 4) / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.text, padding: "8px 12px", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
      <p style={{ color: C.textLight, fontSize: 11, margin: 0 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "#fff", fontSize: 13, fontWeight: 600, margin: "2px 0 0" }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Data Import Modals ──────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(44,62,54,0.4)", backdropFilter: "blur(4px)" }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: "relative", background: C.card, borderRadius: 24, padding: 32, maxWidth: 560,
        width: "90%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 64px rgba(44,62,54,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: "'Fraunces',serif", margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: C.textMuted, cursor: "pointer", padding: 4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConnectionCard({ name, icon, description, connected, onConnect, onImport }) {
  return (
    <div style={{
      padding: 20, borderRadius: 16, border: `1px solid ${connected ? C.sage + "44" : C.border}`,
      background: connected ? C.sageMuted + "44" : C.cardAlt, display: "flex", gap: 16, alignItems: "center",
      marginBottom: 12,
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: C.bgWarm, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{name}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{description}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {connected && <button onClick={onImport} style={{
          padding: "8px 16px", borderRadius: 12, border: `1px solid ${C.sage}`, background: C.sageMuted,
          color: C.sageDark, fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>Sync Now</button>}
        <button onClick={onConnect} style={{
          padding: "8px 16px", borderRadius: 12, border: "none",
          background: connected ? C.border + "44" : `linear-gradient(135deg, ${C.sage}, ${C.teal})`,
          color: connected ? C.textMuted : C.white, fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>{connected ? "Connected" : "Connect"}</button>
      </div>
    </div>
  );
}

// ─── Biomarker Input Form ────────────────────────────────────
function BiomarkerInput({ biomarkers, onChange }) {
  const fields = [
    { key: "hemoglobin", label: "Hemoglobin", unit: "g/dL", range: "13.5-17.5" },
    { key: "vitaminD", label: "Vitamin D", unit: "ng/mL", range: "30-100" },
    { key: "b12", label: "B12", unit: "pg/mL", range: "200-900" },
    { key: "iron", label: "Iron", unit: "µg/dL", range: "60-170" },
    { key: "ferritin", label: "Ferritin", unit: "ng/mL", range: "20-250" },
    { key: "tsh", label: "TSH", unit: "mIU/L", range: "0.4-4.0" },
    { key: "freeT4", label: "Free T4", unit: "ng/dL", range: "0.8-1.8" },
    { key: "totalCholesterol", label: "Total Cholesterol", unit: "mg/dL", range: "<200" },
    { key: "hdl", label: "HDL", unit: "mg/dL", range: ">40" },
    { key: "ldl", label: "LDL", unit: "mg/dL", range: "<100" },
    { key: "triglycerides", label: "Triglycerides", unit: "mg/dL", range: "<150" },
    { key: "fastingGlucose", label: "Fasting Glucose", unit: "mg/dL", range: "70-100" },
    { key: "hba1c", label: "HbA1c", unit: "%", range: "<5.7" },
    { key: "crp", label: "CRP", unit: "mg/L", range: "<3.0" },
    { key: "cortisol", label: "Cortisol", unit: "µg/dL", range: "6-23" },
    { key: "testosterone", label: "Testosterone", unit: "ng/dL", range: "300-1000" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
      {fields.map(f => (
        <div key={f.key}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 4 }}>
            {f.label} <span style={{ fontWeight: 400, color: C.textLight }}>({f.range} {f.unit})</span>
          </label>
          <input type="number" step="any" value={biomarkers[f.key] || ""} onChange={e => onChange(f.key, parseFloat(e.target.value) || 0)}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
              fontSize: 14, fontWeight: 600, color: C.text, background: C.cardAlt,
              outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── CSV Parser for MyFitnessPal / Apple Health Exports ──────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = isNaN(vals[i]) ? vals[i] : parseFloat(vals[i]); });
    return obj;
  });
}

// ─── Habit Tracker Component ─────────────────────────────────
function HabitTracker({ habits, onToggle, onReset }) {
  const completedToday = habits.filter(h => h.tracked).length;
  const total = habits.length;
  const pct = total > 0 ? Math.round((completedToday / total) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text, fontFamily: "'Fraunces',serif" }}>{completedToday}/{total}</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>habits completed today</div>
        </div>
        <CircularProgress value={pct} max={100} size={80} strokeWidth={8} color={pct > 70 ? C.sage : pct > 40 ? C.amber : C.coral} />
      </div>
      <div style={{ height: 6, background: C.border + "33", borderRadius: 3, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${C.sage}, ${C.teal})`, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {habits.map((habit, i) => (
          <div key={habit.id} onClick={() => onToggle(i)} style={{
            padding: "14px 16px", borderRadius: 14, border: `1px solid ${habit.tracked ? C.sage + "44" : C.border}`,
            background: habit.tracked ? C.sageMuted + "33" : C.cardAlt, cursor: "pointer",
            display: "flex", alignItems: "flex-start", gap: 12, transition: "all 0.2s",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 7, border: `2px solid ${habit.tracked ? C.sage : C.border}`,
              background: habit.tracked ? C.sage : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 1, transition: "all 0.2s",
            }}>
              {habit.tracked && <span style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>✓</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, textDecoration: habit.tracked ? "line-through" : "none", opacity: habit.tracked ? 0.6 : 1 }}>{habit.action}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 6, background: C.tealLight + "44", color: C.tealDark }}>{habit.category}</span>
                <span style={{ fontSize: 10, color: C.textLight }}>Impact: {habit.impact}</span>
                <span style={{ fontSize: 10, color: C.textLight }}>→ {habit.targetRisk}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onReset} style={{
        marginTop: 16, padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.border}`,
        background: "transparent", color: C.textMuted, fontSize: 12, cursor: "pointer", width: "100%",
      }}>Reset Today's Habits</button>
    </div>
  );
}

// ─── Main Application ────────────────────────────────────────
const TABS = ["Overview", "Sleep & Recovery", "Nutrition", "Biomarkers", "Disease Risk", "Habits", "Goals", "Trends", "Connect"];

export default function AptoSwasthy() {
  const [tab, setTab] = useState("Overview");
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState(DEFAULT_DATA);
  const [risks, setRisks] = useState({});
  const [habits, setHabits] = useState([]);
  const [bioCategory, setBioCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const [showBioInput, setShowBioInput] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [connections, setConnections] = useState({ appleHealth: false, myFitnessPal: false, fitbit: false, garmin: false });
  const [importStatus, setImportStatus] = useState("");
  const fileInputRef = useRef(null);
  const [importTarget, setImportTarget] = useState("");
  const [goals, setGoals] = useState([
    { id: 1, category: "Fitness", title: "Weekly Active Minutes", target_value: 150, current_value: 185, unit: "min", deadline: "2026-04-30", status: "active" },
    { id: 2, category: "Nutrition", title: "Daily Protein Target", target_value: 150, current_value: 130, unit: "g", deadline: "2026-04-30", status: "active" },
    { id: 3, category: "Sleep", title: "Average Sleep Score", target_value: 90, current_value: 85, unit: "pts", deadline: "2026-05-15", status: "active" },
    { id: 4, category: "Health", title: "Reduce LDL Cholesterol", target_value: 100, current_value: 118, unit: "mg/dL", deadline: "2026-07-01", status: "active" },
    { id: 5, category: "Nutrition", title: "Daily Fiber Intake", target_value: 30, current_value: 28.4, unit: "g", deadline: "2026-04-30", status: "active" },
    { id: 6, category: "Health", title: "Vitamin D Level", target_value: 50, current_value: 32, unit: "ng/mL", deadline: "2026-06-01", status: "active" },
  ]);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({ category: "Fitness", title: "", target_value: "", unit: "", deadline: "" });
  const API_BASE = "http://localhost:3001/api";

  // Initialize
  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
    // Load from persistent storage
    try {
      const saved = window.localStorage?.getItem?.(STORAGE.HEALTH_DATA);
      if (saved) setData(JSON.parse(saved));
      const savedConn = window.localStorage?.getItem?.(STORAGE.CONNECTIONS);
      if (savedConn) setConnections(JSON.parse(savedConn));
      const savedHabits = window.localStorage?.getItem?.(STORAGE.HABITS);
      if (savedHabits) setHabits(JSON.parse(savedHabits));
    } catch (e) { /* storage not available */ }
  }, []);

  // Compute risks whenever data changes
  useEffect(() => {
    const computed = HealthEngine.computeAllRisks(data);
    setRisks(computed);
    if (habits.length === 0) {
      setHabits(HealthEngine.generateHabitRecommendations(data, computed));
    }
  }, [data]);

  // Persist data
  const persist = useCallback((key, val) => {
    try { window.localStorage?.setItem?.(key, JSON.stringify(val)); } catch (e) {}
  }, []);

  useEffect(() => { persist(STORAGE.HEALTH_DATA, data); }, [data, persist]);
  useEffect(() => { persist(STORAGE.CONNECTIONS, connections); }, [connections, persist]);
  useEffect(() => { persist(STORAGE.HABITS, habits); }, [habits, persist]);

  const updateBiomarker = (key, value) => {
    setData(prev => ({ ...prev, biomarkers: { ...prev.biomarkers, [key]: value } }));
  };

  const toggleHabit = (index) => {
    setHabits(prev => prev.map((h, i) => i === index ? { ...h, tracked: !h.tracked } : h));
  };

  const resetHabits = () => {
    setHabits(prev => prev.map(h => ({ ...h, tracked: false })));
  };

  // File import handler
  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        if (file.name.endsWith(".csv")) {
          const parsed = parseCSV(text);
          if (importTarget === "nutrition" && parsed.length > 0) {
            // Map MFP-style CSV to our format
            const mapped = parsed.slice(0, 7).map((row, i) => ({
              day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i % 7],
              protein: row.Protein || row.protein || 0,
              carbs: row.Carbohydrates || row.carbs || row.Carbs || 0,
              fat: row.Fat || row.fat || 0,
              fiber: row.Fiber || row.fiber || 25,
              sugar: row.Sugar || row.sugar || 35,
              sodium: row.Sodium || row.sodium || 2000,
              calories: row.Calories || row.calories || 2000,
            }));
            setData(prev => ({
              ...prev,
              nutrition: {
                ...prev.nutrition,
                weekly: mapped,
                avgDailySugar: Math.round(mapped.reduce((s, d) => s + d.sugar, 0) / mapped.length),
                avgDailyFiber: Math.round(mapped.reduce((s, d) => s + d.fiber, 0) / mapped.length * 10) / 10,
                avgDailySodium: Math.round(mapped.reduce((s, d) => s + d.sodium, 0) / mapped.length),
              },
            }));
            setImportStatus("Nutrition data imported successfully!");
          } else if (importTarget === "fitness" && parsed.length > 0) {
            // Map fitness CSV
            const mapped = parsed.slice(0, 7).map((row, i) => ({
              day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i % 7],
              strain: row.Strain || row.strain || row.Intensity || 10,
              calories: row.Calories || row.calories || row.CaloriesBurned || 2000,
              activeMin: row.ActiveMinutes || row.activeMinutes || row.Duration || 30,
            }));
            setData(prev => ({
              ...prev,
              fitness: {
                ...prev.fitness,
                weeklyStrain: mapped,
                weeklyActiveMinutes: mapped.reduce((s, d) => s + d.activeMin, 0),
              },
            }));
            setImportStatus("Fitness data imported successfully!");
          } else if (importTarget === "sleep" && parsed.length > 0) {
            const mapped = parsed.slice(0, 7).map((row, i) => ({
              day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i % 7],
              deep: row.Deep || row.deep || 2,
              rem: row.REM || row.rem || 2,
              light: row.Light || row.light || 3.5,
              awake: row.Awake || row.awake || 0.3,
              total: row.Total || row.total || (row.Deep || 2) + (row.REM || 2) + (row.Light || 3.5) + (row.Awake || 0.3),
              score: row.Score || row.score || row.Quality || 80,
            }));
            setData(prev => ({
              ...prev,
              sleep: {
                ...prev.sleep,
                weekly: mapped,
                avgScore: Math.round(mapped.reduce((s, d) => s + d.score, 0) / mapped.length),
              },
            }));
            setImportStatus("Sleep data imported successfully!");
          }
        } else if (file.name.endsWith(".json")) {
          const json = JSON.parse(text);
          // Handle Apple Health export JSON format
          if (json.data || json.metrics || json.records) {
            setImportStatus("Apple Health JSON detected. Mapping data...");
            // Map Apple Health structure
            const healthData = json.data || json.metrics || json;
            if (healthData.heart_rate || healthData.HeartRate) {
              const hrData = healthData.heart_rate || healthData.HeartRate;
              setData(prev => ({
                ...prev,
                fitness: { ...prev.fitness, restingHR: Math.round(hrData.resting || hrData.average || 60) },
                sleep: { ...prev.sleep, restingHR: Math.round(hrData.resting || hrData.average || 60) },
              }));
            }
            setImportStatus("Apple Health data mapped successfully!");
          } else {
            // Try as direct data format
            setData(prev => ({ ...prev, ...json }));
            setImportStatus("Data imported from JSON!");
          }
        }
        setTimeout(() => setImportStatus(""), 3000);
      } catch (err) {
        setImportStatus("Error importing file. Check format and try again.");
        setTimeout(() => setImportStatus(""), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Simulate Apple Health OAuth flow
  const connectAppleHealth = () => {
    // In production: window.open('https://developer.apple.com/healthkit/...', '_blank')
    setConnections(prev => ({ ...prev, appleHealth: true }));
    setImportStatus("Apple Health connected! In production, this uses HealthKit via a native bridge or Apple Health REST API.");
    setTimeout(() => setImportStatus(""), 4000);
  };

  const connectMyFitnessPal = () => {
    // In production: OAuth2 flow with MFP API
    setConnections(prev => ({ ...prev, myFitnessPal: true }));
    setImportStatus("MyFitnessPal connected! Import nutrition data using the Sync button or upload a CSV export.");
    setTimeout(() => setImportStatus(""), 4000);
  };

  // Derived values
  const todayNutrition = data.nutrition.weekly[data.nutrition.weekly.length - 1];
  const todaySleep = data.sleep.weekly[data.sleep.weekly.length - 1];
  const todayStrain = data.fitness.weeklyStrain[data.fitness.weeklyStrain.length - 1];
  const avgRecovery = Math.round(data.sleep.weekly.reduce((s, d) => s + d.score, 0) / data.sleep.weekly.length);

  const biomarkersList = [
    { name: "Hemoglobin", value: data.biomarkers.hemoglobin, unit: "g/dL", range: "13.5-17.5", status: data.biomarkers.hemoglobin >= 13.5 && data.biomarkers.hemoglobin <= 17.5 ? "normal" : "elevated", category: "Blood" },
    { name: "Vitamin D", value: data.biomarkers.vitaminD, unit: "ng/mL", range: "30-100", status: data.biomarkers.vitaminD < 30 ? "low-normal" : data.biomarkers.vitaminD < 40 ? "low-normal" : "normal", category: "Vitamins" },
    { name: "B12", value: data.biomarkers.b12, unit: "pg/mL", range: "200-900", status: "normal", category: "Vitamins" },
    { name: "Iron", value: data.biomarkers.iron, unit: "µg/dL", range: "60-170", status: "normal", category: "Minerals" },
    { name: "Ferritin", value: data.biomarkers.ferritin, unit: "ng/mL", range: "20-250", status: "normal", category: "Minerals" },
    { name: "TSH", value: data.biomarkers.tsh, unit: "mIU/L", range: "0.4-4.0", status: data.biomarkers.tsh >= 0.4 && data.biomarkers.tsh <= 4.0 ? "normal" : "elevated", category: "Thyroid" },
    { name: "Free T4", value: data.biomarkers.freeT4, unit: "ng/dL", range: "0.8-1.8", status: "normal", category: "Thyroid" },
    { name: "Total Cholesterol", value: data.biomarkers.totalCholesterol, unit: "mg/dL", range: "<200", status: data.biomarkers.totalCholesterol >= 200 ? "borderline" : "normal", category: "Lipids" },
    { name: "HDL", value: data.biomarkers.hdl, unit: "mg/dL", range: ">40", status: data.biomarkers.hdl > 40 ? "normal" : "low-normal", category: "Lipids" },
    { name: "LDL", value: data.biomarkers.ldl, unit: "mg/dL", range: "<100", status: data.biomarkers.ldl > 130 ? "elevated" : data.biomarkers.ldl > 100 ? "borderline" : "normal", category: "Lipids" },
    { name: "Triglycerides", value: data.biomarkers.triglycerides, unit: "mg/dL", range: "<150", status: data.biomarkers.triglycerides < 150 ? "normal" : "elevated", category: "Lipids" },
    { name: "Fasting Glucose", value: data.biomarkers.fastingGlucose, unit: "mg/dL", range: "70-100", status: data.biomarkers.fastingGlucose <= 100 ? "normal" : "elevated", category: "Metabolic" },
    { name: "HbA1c", value: data.biomarkers.hba1c, unit: "%", range: "<5.7", status: data.biomarkers.hba1c < 5.7 ? "normal" : "elevated", category: "Metabolic" },
    { name: "CRP", value: data.biomarkers.crp, unit: "mg/L", range: "<3.0", status: data.biomarkers.crp < 3 ? "normal" : "elevated", category: "Inflammation" },
    { name: "Cortisol", value: data.biomarkers.cortisol, unit: "µg/dL", range: "6-23", status: "normal", category: "Hormones" },
    { name: "Testosterone", value: data.biomarkers.testosterone, unit: "ng/dL", range: "300-1000", status: "normal", category: "Hormones" },
  ];

  const bioCategories = ["All", ...new Set(biomarkersList.map(b => b.category))];
  const filteredBio = bioCategory === "All" ? biomarkersList : biomarkersList.filter(b => b.category === bioCategory);

  const diseaseRiskData = [
    { name: "Type 2 Diabetes", risk: risks.diabetes || 12, icon: "🩸", trend: "stable",
      factors: [
        data.biomarkers.fastingGlucose > 90 ? "Fasting glucose near upper range" : "Fasting glucose normal",
        data.profile.familyHistory.diabetes ? "Family history present" : "No family history",
      ] },
    { name: "Cardiovascular", risk: risks.cardiovascular || 18, icon: "❤️", trend: data.biomarkers.ldl > 130 ? "watch" : "improving",
      factors: [
        data.biomarkers.ldl > 100 ? `LDL elevated at ${data.biomarkers.ldl}` : "LDL within range",
        data.biomarkers.totalCholesterol > 200 ? "Total cholesterol borderline" : "Cholesterol managed",
      ] },
    { name: "Hypertension", risk: risks.hypertension || 8, icon: "🫀", trend: "low",
      factors: [data.sleep.avgHRV > 50 ? "Good HRV" : "HRV needs improvement", "Active lifestyle"] },
    { name: "Vitamin D Deficiency", risk: risks.vitaminD || 35, icon: "☀️", trend: data.biomarkers.vitaminD < 30 ? "watch" : "stable",
      factors: [
        `Vitamin D at ${data.biomarkers.vitaminD} ng/mL`,
        data.profile.outdoorMinutesPerDay < 20 ? "Limited sun exposure" : "Adequate sun exposure",
      ] },
    { name: "Metabolic Syndrome", risk: risks.metabolic || 10, icon: "⚡", trend: "low",
      factors: ["Triglycerides normal", `HDL at ${data.biomarkers.hdl} (good)`] },
    { name: "Thyroid Disorder", risk: risks.thyroid || 5, icon: "🦋", trend: "low",
      factors: [`TSH at ${data.biomarkers.tsh} (within range)`, "Normal T4 levels"] },
  ];

  const radarData = [
    { metric: "Sleep", value: Math.min(100, avgRecovery), fullMark: 100 },
    { metric: "Nutrition", value: Math.min(100, Math.round((todayNutrition.fiber / 30) * 50 + (todayNutrition.protein / 150) * 50)), fullMark: 100 },
    { metric: "Fitness", value: Math.min(100, Math.round((data.fitness.weeklyActiveMinutes / 200) * 100)), fullMark: 100 },
    { metric: "Recovery", value: Math.min(100, Math.round((data.sleep.avgHRV / 65) * 100)), fullMark: 100 },
    { metric: "Biomarkers", value: Math.min(100, Math.round((biomarkersList.filter(b => b.status === "normal").length / biomarkersList.length) * 100)), fullMark: 100 },
    { metric: "Risk", value: Math.min(100, 100 - Math.round(Object.values(risks).reduce((s, v) => s + v, 0) / Object.values(risks).length)), fullMark: 100 },
  ];

  // ─── Search Index ─────────────────────────────────────────
  const searchIndex = [
    ...biomarkersList.map(b => ({ type: "Biomarker", title: b.name, detail: `${b.value} ${b.unit} (${b.status})`, tab: "Biomarkers", category: b.category })),
    ...diseaseRiskData.map(d => ({ type: "Disease Risk", title: d.name, detail: `${d.risk}% risk — ${d.trend}`, tab: "Disease Risk" })),
    ...habits.map(h => ({ type: "Habit", title: h.action, detail: `${h.category} · ${h.impact} impact · ${h.tracked ? "Done" : "Pending"}`, tab: "Habits" })),
    ...goals.map(g => ({ type: "Goal", title: g.title, detail: `${g.current_value}/${g.target_value} ${g.unit} (${Math.min(100, Math.round((g.current_value / g.target_value) * 100))}%)`, tab: "Goals" })),
    { type: "Metric", title: "Sleep Score", detail: `${todaySleep.score}% today, ${avgRecovery}% avg`, tab: "Sleep & Recovery" },
    { type: "Metric", title: "Heart Rate", detail: `${data.sleep.restingHR} bpm resting`, tab: "Sleep & Recovery" },
    { type: "Metric", title: "HRV", detail: `${data.sleep.avgHRV} ms average`, tab: "Sleep & Recovery" },
    { type: "Metric", title: "Calories", detail: `${todayNutrition.calories} kcal today (${Math.round((todayNutrition.calories / data.nutrition.calorieGoal) * 100)}% of goal)`, tab: "Nutrition" },
    { type: "Metric", title: "Protein", detail: `${todayNutrition.protein}g today (${Math.round((todayNutrition.protein / 150) * 100)}% of goal)`, tab: "Nutrition" },
    { type: "Metric", title: "Fiber", detail: `${todayNutrition.fiber}g today (${Math.round((todayNutrition.fiber / 30) * 100)}% of goal)`, tab: "Nutrition" },
    { type: "Metric", title: "Strain", detail: `${todayStrain.strain}/21 today (${Math.round((todayStrain.strain / 21) * 100)}%)`, tab: "Overview" },
    { type: "Metric", title: "Active Minutes", detail: `${data.fitness.weeklyActiveMinutes} min/week (${Math.round((data.fitness.weeklyActiveMinutes / 150) * 100)}% of goal)`, tab: "Overview" },
    { type: "Profile", title: "BMI", detail: `${data.profile.bmi} (${data.profile.bmi < 25 ? "Normal" : "Overweight"})`, tab: "Overview" },
    { type: "Profile", title: "Weight", detail: `${data.profile.weight} kg`, tab: "Overview" },
    { type: "Profile", title: "Height", detail: `${data.profile.height} cm`, tab: "Overview" },
    { type: "Profile", title: "Age", detail: `${data.profile.age} years`, tab: "Overview" },
    { type: "Connection", title: "Apple Health", detail: connections.appleHealth ? "Connected" : "Not connected", tab: "Connect" },
    { type: "Connection", title: "MyFitnessPal", detail: connections.myFitnessPal ? "Connected" : "Not connected", tab: "Connect" },
  ];

  const searchResults = searchQuery.trim().length > 0
    ? searchIndex.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.detail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.type.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  // ─── Render Sections ──────────────────────────────────────

  const renderOverview = () => {
    const recoveryPct = todaySleep.score;
    const strainPct = Math.round((todayStrain.strain / 21) * 100);
    const nutritionPct = Math.round((todayNutrition.calories / data.nutrition.calorieGoal) * 100);

    return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, opacity: loaded ? 1 : 0, transition: "opacity 0.6s" }}>

      {/* Top Metrics Row with % connectors */}
      <Card style={{ gridColumn: "1 / 4", padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around" }}>
          {/* Recovery */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Recovery</div>
            <CircularProgress value={todaySleep.score} max={100} size={130} strokeWidth={11} color={C.sage} label="Recovery" sublabel={`${todaySleep.total}h sleep`} />
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>{avgRecovery}%</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>7-day avg</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.sage }}>{Math.round((data.sleep.avgHRV / 65) * 100)}%</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>HRV optimal</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.lavender }}>{Math.round(((80 - data.sleep.restingHR) / 30) * 100)}%</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>RHR fitness</div>
              </div>
            </div>
          </div>

          {/* Connector: Recovery → Strain */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 8px" }}>
            <div style={{ width: 60, height: 2, background: `linear-gradient(90deg, ${C.sage}, ${C.teal})`, borderRadius: 1 }} />
            <div style={{ padding: "4px 10px", borderRadius: 10, background: C.cardAlt, border: `1px solid ${C.border}33` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: recoveryPct >= 80 && strainPct < 80 ? C.sage : C.amber }}>
                {recoveryPct >= 80 && strainPct < 80 ? "↑ Room to push" : recoveryPct < 70 ? "↓ Rest needed" : "≈ Balanced"}
              </span>
            </div>
            <div style={{ fontSize: 9, color: C.textLight }}>Recovery vs Strain</div>
          </div>

          {/* Strain */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Strain</div>
            <CircularProgress value={todayStrain.strain} max={21} size={130} strokeWidth={11} color={C.teal} label="Strain" sublabel={`${todayStrain.calories} cal`} />
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>{Math.round((data.fitness.weeklyStrain.reduce((s, d) => s + d.strain, 0) / data.fitness.weeklyStrain.length / 21) * 100)}%</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>Avg strain</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.sage }}>{Math.round((data.fitness.weeklyActiveMinutes / 150) * 100)}%</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>Active goal</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.coral }}>{Math.round((todayStrain.calories / data.nutrition.calorieGoal) * 100)}%</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>Burn vs eat</div>
              </div>
            </div>
          </div>

          {/* Connector: Strain → Nutrition */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 8px" }}>
            <div style={{ width: 60, height: 2, background: `linear-gradient(90deg, ${C.teal}, ${C.coral})`, borderRadius: 1 }} />
            <div style={{ padding: "4px 10px", borderRadius: 10, background: C.cardAlt, border: `1px solid ${C.border}33` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: nutritionPct > 110 ? C.coral : nutritionPct < 80 ? C.amber : C.sage }}>
                {nutritionPct > 110 ? "↑ Surplus" : nutritionPct < 80 ? "↓ Deficit" : "≈ On target"}
              </span>
            </div>
            <div style={{ fontSize: 9, color: C.textLight }}>Energy balance</div>
          </div>

          {/* Nutrition */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Nutrition</div>
            <CircularProgress value={todayNutrition.calories} max={data.nutrition.calorieGoal} size={130} strokeWidth={11} color={C.coral} label="Nutrition" sublabel={`${todayNutrition.calories} cal`} />
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>{Math.round((todayNutrition.protein / 150) * 100)}%</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>Protein</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.sage }}>{Math.round((todayNutrition.fiber / 30) * 100)}%</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>Fiber</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{Math.round((todayNutrition.sugar / 36) * 100)}%</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>Sugar lim</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Body Metrics & Profile */}
      <Card hoverable style={{ gridColumn: "1 / 4" }}>
        <SectionTitle icon="🧍" title="Body Metrics" subtitle="Physical profile & composition" />
        <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 12 }}>
          {[
            { label: "Age", value: data.profile.age, unit: "yrs", max: 100, color: C.lavender, icon: "🎂" },
            { label: "Height", value: data.profile.height, unit: "cm", max: 200, color: C.teal, icon: "📏" },
            { label: "Weight", value: data.profile.weight, unit: "kg", max: 120, color: C.coral, icon: "⚖️" },
            { label: "BMI", value: data.profile.bmi, unit: "", max: 40, color: data.profile.bmi < 18.5 ? C.amber : data.profile.bmi < 25 ? C.sage : data.profile.bmi < 30 ? C.amber : C.coral, icon: "📊" },
            { label: "Waist", value: data.profile.waistCircumference, unit: "in", max: 50, color: data.profile.waistCircumference < 35 ? C.sage : C.amber, icon: "📐" },
            { label: "Body Fat", value: Math.round((1.20 * data.profile.bmi + 0.23 * data.profile.age - 10.8 * (data.profile.sex === "male" ? 1 : 0) - 5.4) * 10) / 10, unit: "%", max: 40, color: C.amber, icon: "🔬" },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center", minWidth: 110 }}>
              <CircularProgress value={m.value} max={m.max} size={90} strokeWidth={8} color={m.color}
                displayValue={`${m.value}${m.unit && m.unit !== "%" ? "" : "%"}`}
                label={m.label} sublabel={m.unit && m.unit !== "%" ? m.unit : undefined} />
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 20, padding: "16px 0 0", borderTop: `1px solid ${C.border}22` }}>
          {[
            { label: "BMI Status", value: data.profile.bmi < 18.5 ? "Underweight" : data.profile.bmi < 25 ? "Normal" : data.profile.bmi < 30 ? "Overweight" : "Obese",
              pct: data.profile.bmi < 25 ? `${Math.round(((25 - data.profile.bmi) / 25) * 100)}% from limit` : `${Math.round(((data.profile.bmi - 25) / 25) * 100)}% over`,
              color: data.profile.bmi < 25 ? C.sage : C.amber },
            { label: "Max Heart Rate", value: `${220 - data.profile.age} bpm`, pct: `Based on age ${data.profile.age}`, color: C.coral },
            { label: "Resting Metabolic", value: `${Math.round(10 * data.profile.weight + 6.25 * data.profile.height - 5 * data.profile.age + (data.profile.sex === "male" ? 5 : -161))} kcal`,
              pct: "Mifflin-St Jeor", color: C.teal },
            { label: "Water Intake", value: `${(data.profile.weight * 0.033).toFixed(1)} L`, pct: `${Math.round((data.profile.weight * 0.033 / 2.5) * 100)}% of 2.5L`, color: C.sage },
          ].map(m => (
            <div key={m.label} style={{ padding: 12, background: C.cardAlt, borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginTop: 2 }}>{m.label}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{m.pct}</div>
            </div>
          ))}
        </div>
        {/* Family History & Lifestyle */}
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          {[
            { label: "Smoker", val: data.profile.smoker, yes: "Yes", no: "No" },
            { label: "Diabetes History", val: data.profile.familyHistory.diabetes, yes: "Yes", no: "No" },
            { label: "Heart Disease History", val: data.profile.familyHistory.heartDisease, yes: "Yes", no: "No" },
            { label: "Hypertension History", val: data.profile.familyHistory.hypertension, yes: "Yes", no: "No" },
            { label: "Thyroid History", val: data.profile.familyHistory.thyroid, yes: "Yes", no: "No" },
            { label: "Outdoor Exposure", val: data.profile.outdoorMinutesPerDay >= 20, yes: `${data.profile.outdoorMinutesPerDay} min/day`, no: `${data.profile.outdoorMinutesPerDay} min/day` },
          ].map(item => (
            <div key={item.label} style={{
              padding: "6px 14px", borderRadius: 10,
              background: item.val ? (item.label === "Smoker" || item.label.includes("History") ? C.coralLight + "33" : C.sageMuted + "44") : C.sageMuted + "44",
              border: `1px solid ${item.val && (item.label === "Smoker" || item.label.includes("History")) ? C.coral + "33" : C.sage + "22"}`,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.val && (item.label === "Smoker" || item.label.includes("History")) ? C.coral : C.sage }} />
              <span style={{ fontSize: 11, color: C.text }}>{item.label}:</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: item.val && (item.label === "Smoker" || item.label.includes("History")) ? C.coral : C.sage }}>{item.val ? item.yes : item.no}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Health Radar */}
      <Card hoverable>
        <SectionTitle icon="🎯" title="Health Score" subtitle="Multi-dimensional overview" />
        {(() => { const overallPct = Math.round(radarData.reduce((s, d) => s + d.value, 0) / radarData.length); return (
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: overallPct >= 75 ? C.sage : overallPct >= 50 ? C.amber : C.coral, fontFamily: "'Fraunces',serif" }}>{overallPct}%</span>
            <span style={{ fontSize: 12, color: C.textMuted, display: "block" }}>Overall Health Score</span>
          </div>
        ); })()}
        <ResponsiveContainer width="100%" height={180}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={C.border + "44"} />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: C.textMuted }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name="Score" dataKey="value" stroke={C.sage} fill={C.sage} fillOpacity={0.2} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
          {radarData.map(d => (
            <div key={d.metric} style={{ textAlign: "center", padding: "4px 0" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: d.value >= 75 ? C.sage : d.value >= 50 ? C.amber : C.coral }}>{d.value}%</span>
              <span style={{ fontSize: 9, color: C.textLight, display: "block" }}>{d.metric}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Heart Rate */}
      <Card hoverable style={{ gridColumn: "2 / 4" }}>
        <SectionTitle icon="💓" title="Heart Rate (24h)" subtitle="Continuous monitoring" />
        {(() => {
          const hrs = data.fitness.heartRate.map(d => d.hr);
          const avgHR = Math.round(hrs.reduce((s, v) => s + v, 0) / hrs.length);
          const maxHR = 220 - (data.profile.age || 22);
          const restZone = hrs.filter(h => h < maxHR * 0.5).length;
          const fatBurn = hrs.filter(h => h >= maxHR * 0.5 && h < maxHR * 0.7).length;
          const cardioZone = hrs.filter(h => h >= maxHR * 0.7).length;
          const total = hrs.length;
          return (
            <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ padding: "6px 14px", background: C.cardAlt, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.coral }}>{Math.round((avgHR / maxHR) * 100)}%</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Avg of max HR</div>
              </div>
              <div style={{ padding: "6px 14px", background: C.cardAlt, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.sage }}>{Math.round((restZone / total) * 100)}%</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Rest zone</div>
              </div>
              <div style={{ padding: "6px 14px", background: C.cardAlt, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.amber }}>{Math.round((fatBurn / total) * 100)}%</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Fat burn</div>
              </div>
              <div style={{ padding: "6px 14px", background: C.cardAlt, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.coral }}>{Math.round((cardioZone / total) * 100)}%</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Cardio zone</div>
              </div>
            </div>
          );
        })()}
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data.fitness.heartRate}>
            <defs>
              <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.coral} stopOpacity={0.25} />
                <stop offset="100%" stopColor={C.coral} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border + "33"} />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: C.textLight }} tickLine={false} axisLine={false} interval={3} />
            <YAxis tick={{ fontSize: 10, fill: C.textLight }} tickLine={false} axisLine={false} domain={[45, 110]} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="hr" stroke={C.coral} fill="url(#hrGrad)" strokeWidth={2} dot={false} name="Heart Rate" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Disease Risk Summary */}
      <Card hoverable style={{ gridColumn: "1 / 3" }}>
        <SectionTitle icon="🛡️" title="Disease Risk Overview" subtitle="Computed from your biomarkers, fitness & nutrition data" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {diseaseRiskData.slice(0, 3).map(d => (
            <div key={d.name} style={{ padding: 14, background: C.cardAlt, borderRadius: 14, border: `1px solid ${C.border}33` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{d.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{d.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 6, background: C.border + "33", borderRadius: 3 }}>
                  <div style={{ width: `${d.risk}%`, height: "100%", background: d.risk < 15 ? C.sage : d.risk < 30 ? C.amber : C.coral, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: d.risk < 15 ? C.sage : d.risk < 30 ? C.amber : C.coral }}>{d.risk}%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Habit Quick View */}
      <Card hoverable onClick={() => setTab("Habits")} style={{ cursor: "pointer" }}>
        <SectionTitle icon="✅" title="Daily Habits" subtitle={`${habits.filter(h => h.tracked).length}/${habits.length} done · ${habits.length > 0 ? Math.round((habits.filter(h => h.tracked).length / habits.length) * 100) : 0}%`} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {habits.slice(0, 4).map((h, i) => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: h.tracked ? C.textLight : C.text }}>
              <span style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${h.tracked ? C.sage : C.border}`, background: h.tracked ? C.sage : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: C.white, flexShrink: 0 }}>
                {h.tracked ? "✓" : ""}
              </span>
              <span style={{ textDecoration: h.tracked ? "line-through" : "none", opacity: h.tracked ? 0.5 : 1 }}>{h.action}</span>
            </div>
          ))}
          {habits.length > 4 && <span style={{ fontSize: 11, color: C.teal, fontWeight: 600, marginTop: 4 }}>+{habits.length - 4} more → View All</span>}
        </div>
      </Card>
    </div>
    );
  };

  const renderSleep = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, opacity: loaded ? 1 : 0 }}>
      <Card hoverable style={{ gridColumn: "1 / 3" }}>
        <SectionTitle icon="😴" title="Weekly Sleep Scores" subtitle="Quality trend over 7 days" />
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.sleep.weekly}>
            <defs>
              <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.lavender} stopOpacity={0.3} />
                <stop offset="100%" stopColor={C.lavender} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border + "22"} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.textLight }} tickLine={false} axisLine={false} domain={[60, 100]} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="score" stroke={C.lavender} fill="url(#sleepGrad)" strokeWidth={2.5} dot={{ fill: C.lavender, r: 4, strokeWidth: 2, stroke: C.white }} name="Score" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card hoverable>
        <SectionTitle icon="📊" title="Sleep Stage Breakdown" subtitle="Weekly view" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.sleep.weekly} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border + "22"} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.textLight }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="deep" stackId="a" fill={C.sageDark} name="Deep" />
            <Bar dataKey="rem" stackId="a" fill={C.lavender} name="REM" />
            <Bar dataKey="light" stackId="a" fill={C.tealLight} name="Light" />
            <Bar dataKey="awake" stackId="a" fill={C.coralLight} radius={[4, 4, 0, 0]} name="Awake" />
          </BarChart>
        </ResponsiveContainer>
        {(() => {
          const avgDeep = data.sleep.weekly.reduce((s, d) => s + d.deep, 0) / data.sleep.weekly.length;
          const avgRem = data.sleep.weekly.reduce((s, d) => s + d.rem, 0) / data.sleep.weekly.length;
          const avgLight = data.sleep.weekly.reduce((s, d) => s + d.light, 0) / data.sleep.weekly.length;
          const avgAwake = data.sleep.weekly.reduce((s, d) => s + d.awake, 0) / data.sleep.weekly.length;
          const avgTotal = avgDeep + avgRem + avgLight + avgAwake;
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 12, padding: "12px 0 0", borderTop: `1px solid ${C.border}22` }}>
              {[
                { label: "Deep", pct: Math.round((avgDeep / avgTotal) * 100), color: C.sageDark, ideal: "15-20%" },
                { label: "REM", pct: Math.round((avgRem / avgTotal) * 100), color: C.lavender, ideal: "20-25%" },
                { label: "Light", pct: Math.round((avgLight / avgTotal) * 100), color: C.tealLight, ideal: "45-55%" },
                { label: "Awake", pct: Math.round((avgAwake / avgTotal) * 100), color: C.coralLight, ideal: "<5%" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.pct}%</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{s.label}</div>
                  <div style={{ fontSize: 9, color: C.textLight }}>Ideal: {s.ideal}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </Card>

      <Card hoverable>
        <SectionTitle icon="💗" title="Heart Rate Variability" subtitle="24-hour trend" />
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data.fitness.heartRate}>
            <defs>
              <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.sage} stopOpacity={0.3} />
                <stop offset="100%" stopColor={C.sage} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border + "22"} />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: C.textLight }} tickLine={false} axisLine={false} interval={3} />
            <YAxis tick={{ fontSize: 11, fill: C.textLight }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="hrv" stroke={C.sage} fill="url(#hrvGrad)" strokeWidth={2} dot={false} name="HRV (ms)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card hoverable style={{ gridColumn: "1 / 3" }}>
        <SectionTitle icon="🎯" title="Recovery Metrics" subtitle="Today's breakdown" />
        <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 16 }}>
          <CircularProgress value={todaySleep.score} max={100} size={100} strokeWidth={9} color={C.sage} label="Recovery" sublabel="of 100" />
          <CircularProgress value={todaySleep.total} max={8} size={100} strokeWidth={9} color={C.lavender} displayValue={`${todaySleep.total}h`} label="Sleep" sublabel="of 8h goal" />
          <CircularProgress value={data.sleep.avgHRV} max={65} size={100} strokeWidth={9} color={C.teal} displayValue={`${data.sleep.avgHRV}`} label="HRV" sublabel="ms (65 optimal)" />
          <CircularProgress value={Math.max(0, 80 - data.sleep.restingHR)} max={30} size={100} strokeWidth={9} color={C.coral} displayValue={`${data.sleep.restingHR}`} label="RHR" sublabel="bpm" />
          <CircularProgress value={97} max={100} size={100} strokeWidth={9} color={C.amber} label="SpO2" sublabel="saturation" />
          <CircularProgress value={36.4} max={37} size={100} strokeWidth={9} color={C.sageDark} displayValue="36.4°" label="Skin Temp" sublabel="of 37° baseline" />
        </div>
      </Card>
    </div>
  );

  const renderNutrition = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, opacity: loaded ? 1 : 0 }}>
      <Card hoverable>
        <SectionTitle icon="🍽️" title="Calorie Intake" subtitle="Weekly overview" />
        {(() => {
          const avgCal = Math.round(data.nutrition.weekly.reduce((s, d) => s + d.calories, 0) / data.nutrition.weekly.length);
          const avgPct = Math.round((avgCal / data.nutrition.calorieGoal) * 100);
          const todayPct = Math.round((todayNutrition.calories / data.nutrition.calorieGoal) * 100);
          return (
            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <div style={{ padding: "6px 14px", background: C.cardAlt, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: todayPct > 105 ? C.coral : C.sage }}>{todayPct}%</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Today vs goal</div>
              </div>
              <div style={{ padding: "6px 14px", background: C.cardAlt, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: avgPct > 105 ? C.coral : C.sage }}>{avgPct}%</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Weekly avg vs goal</div>
              </div>
              <div style={{ padding: "6px 14px", background: C.cardAlt, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.amber }}>{avgCal}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Avg daily cal</div>
              </div>
            </div>
          );
        })()}
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.nutrition.weekly} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border + "22"} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.textLight }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="calories" radius={[8, 8, 0, 0]} name="Calories">
              {data.nutrition.weekly.map((_, i) => <Cell key={i} fill={i === data.nutrition.weekly.length - 1 ? C.coral : C.coralLight + "88"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card hoverable>
        <SectionTitle icon="🥗" title="Macro Balance" subtitle="Today's breakdown" />
        <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
          <MacroPie protein={todayNutrition.protein} carbs={todayNutrition.carbs} fat={todayNutrition.fat} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16, padding: "16px 0 0", borderTop: `1px solid ${C.border}33` }}>
          {[
            { label: "Calories", value: todayNutrition.calories, unit: "kcal", color: C.coral, goal: data.nutrition.calorieGoal },
            { label: "Fiber", value: todayNutrition.fiber, unit: "g", color: C.sage, goal: 30 },
            { label: "Sugar", value: todayNutrition.sugar, unit: "g", color: C.amber, goal: 36 },
            { label: "Sodium", value: todayNutrition.sodium, unit: "mg", color: C.teal, goal: 2300 },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center", padding: 10, background: C.cardAlt, borderRadius: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}<span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted }}> {m.unit}</span></div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{m.label}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: Math.round((m.value / m.goal) * 100) > 100 ? C.coral : C.sage, marginTop: 3 }}>
                {Math.round((m.value / m.goal) * 100)}% of {m.label === "Sugar" || m.label === "Sodium" ? "limit" : "goal"}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card hoverable style={{ gridColumn: "1 / 3" }}>
        <SectionTitle icon="📈" title="Macro Trends" subtitle="Weekly protein, carbs & fat" />
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.nutrition.weekly}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border + "22"} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.textLight }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="protein" stroke={C.teal} strokeWidth={2.5} dot={{ r: 4, fill: C.teal, stroke: C.white, strokeWidth: 2 }} name="Protein (g)" />
            <Line type="monotone" dataKey="carbs" stroke={C.amber} strokeWidth={2.5} dot={{ r: 4, fill: C.amber, stroke: C.white, strokeWidth: 2 }} name="Carbs (g)" />
            <Line type="monotone" dataKey="fat" stroke={C.coral} strokeWidth={2.5} dot={{ r: 4, fill: C.coral, stroke: C.white, strokeWidth: 2 }} name="Fat (g)" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );

  const renderBiomarkers = () => (
    <div style={{ opacity: loaded ? 1 : 0 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {bioCategories.map(cat => (
          <button key={cat} onClick={() => setBioCategory(cat)} style={{
            padding: "6px 16px", borderRadius: 20, border: `1px solid ${bioCategory === cat ? C.sage : C.border}`,
            background: bioCategory === cat ? C.sageMuted : C.card, color: bioCategory === cat ? C.sageDark : C.textMuted,
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
          }}>{cat}</button>
        ))}
        <button onClick={() => setShowBioInput(true)} style={{
          marginLeft: "auto", padding: "6px 16px", borderRadius: 20, border: "none",
          background: `linear-gradient(135deg, ${C.sage}, ${C.teal})`, color: C.white,
          fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>Update Biomarkers</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card hoverable style={{ gridColumn: "1 / 3" }}>
          <SectionTitle icon="🧬" title="Biomarker Panel" subtitle={`${filteredBio.length} markers · Last tested: ${data.biomarkers.lastTested}`} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
            {filteredBio.map(b => <BiomarkerBar key={b.name} marker={b} />)}
          </div>
        </Card>

        <Card hoverable>
          <SectionTitle icon="📊" title="Status Summary" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Normal", count: biomarkersList.filter(b => b.status === "normal").length, color: C.sage },
              { label: "Low-Normal", count: biomarkersList.filter(b => b.status === "low-normal").length, color: C.amber },
              { label: "Borderline", count: biomarkersList.filter(b => b.status === "borderline").length, color: C.amber },
              { label: "Elevated", count: biomarkersList.filter(b => b.status === "elevated").length, color: C.coral },
            ].map(s => (
              <div key={s.label}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
                  <span style={{ flex: 1, fontSize: 13, color: C.text }}>{s.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.count}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{Math.round((s.count / biomarkersList.length) * 100)}%</span>
                </div>
                <div style={{ height: 4, background: C.border + "22", borderRadius: 2, marginLeft: 20, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round((s.count / biomarkersList.length) * 100)}%`, height: "100%", background: s.color, borderRadius: 2, transition: "width 0.6s ease" }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "12px 0 0", borderTop: `1px solid ${C.border}22`, textAlign: "center" }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: C.sage, fontFamily: "'Fraunces',serif" }}>{Math.round((biomarkersList.filter(b => b.status === "normal").length / biomarkersList.length) * 100)}%</span>
            <span style={{ fontSize: 12, color: C.textMuted, display: "block" }}>Overall biomarker health</span>
          </div>
        </Card>

        <Card hoverable>
          <SectionTitle icon="💡" title="Auto-Recommendations" subtitle="Based on your current values" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              data.biomarkers.vitaminD < 40 && { text: `Vitamin D at ${data.biomarkers.vitaminD} — consider 2000-4000 IU supplementation`, priority: "moderate" },
              data.biomarkers.ldl > 100 && { text: `LDL at ${data.biomarkers.ldl} — increase fiber and omega-3 intake`, priority: "moderate" },
              data.biomarkers.totalCholesterol >= 200 && { text: "Total cholesterol borderline — retest in 3 months", priority: "low" },
              { text: "Maintain current iron and B12 levels — looking good", priority: "positive" },
            ].filter(Boolean).map((rec, i) => (
              <div key={i} style={{
                padding: 12, borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}22`,
                display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <span style={{ fontSize: 14, marginTop: 1 }}>{rec.priority === "positive" ? "✅" : rec.priority === "moderate" ? "⚠️" : "📋"}</span>
                <span style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{rec.text}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={showBioInput} onClose={() => setShowBioInput(false)} title="Update Biomarkers">
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Enter your latest lab results. Risk predictions and habit recommendations will update automatically.</p>
        <BiomarkerInput biomarkers={data.biomarkers} onChange={updateBiomarker} />
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button onClick={() => { setShowBioInput(false); setImportStatus("Biomarkers updated — risks recalculated!"); setTimeout(() => setImportStatus(""), 3000); }}
            style={{ flex: 1, padding: "12px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${C.sage}, ${C.teal})`, color: C.white, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Save & Recalculate Risks
          </button>
          <button onClick={() => setShowBioInput(false)}
            style={{ padding: "12px 24px", borderRadius: 14, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 14, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );

  const renderDiseaseRisk = () => (
    <div style={{ opacity: loaded ? 1 : 0 }}>
      <Card hoverable style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 8 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.sageMuted}, ${C.tealLight}44)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🛡️</div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "'Fraunces',serif" }}>Overall Health Risk Score</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>Computed from your biomarkers, activity data, sleep, nutrition, and family history</p>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "center" }}>
            {(() => {
              const avg = Object.values(risks).reduce((s, v) => s + v, 0) / Math.max(1, Object.values(risks).length);
              const level = avg < 15 ? "Low" : avg < 25 ? "Moderate" : "Elevated";
              const color = avg < 15 ? C.sage : avg < 25 ? C.amber : C.coral;
              return <>
                <div style={{ fontSize: 36, fontWeight: 800, color }}>{level}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 2 }}>{Math.round(avg)}% avg risk</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>Composite Risk Level</div>
              </>;
            })()}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {diseaseRiskData.map(d => <RiskGauge key={d.name} {...d} />)}
      </div>

      <Card hoverable style={{ marginTop: 20 }}>
        <SectionTitle icon="📋" title="Risk Mitigation Actions" subtitle="Personalized from your data" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            data.biomarkers.vitaminD < 40 && { action: "Increase outdoor sun exposure to 20 min/day", target: "Vitamin D Deficiency", urgency: "high", icon: "☀️" },
            data.biomarkers.ldl > 100 && { action: "Add 2 servings of fatty fish per week", target: "Cardiovascular", urgency: "medium", icon: "🐟" },
            data.biomarkers.fastingGlucose > 85 && { action: "Reduce refined carb intake by 15%", target: "Type 2 Diabetes", urgency: "medium", icon: "🍞" },
            { action: `Maintain ${data.fitness.weeklyActiveMinutes}+ active min/week`, target: "All Conditions", urgency: "maintain", icon: "🏃" },
            data.biomarkers.ldl > 100 && { action: "Schedule follow-up lipid panel in 90 days", target: "Cardiovascular", urgency: "medium", icon: "🩺" },
            { action: "Consider adding plant sterols to diet", target: "Cardiovascular", urgency: "low", icon: "🌿" },
          ].filter(Boolean).map((a, i) => (
            <div key={i} style={{
              padding: 14, borderRadius: 14, background: C.cardAlt, border: `1px solid ${C.border}22`,
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{a.action}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: C.textLight }}>→ {a.target}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 6,
                    background: a.urgency === "high" ? C.coralLight + "44" : a.urgency === "maintain" ? C.sageMuted : C.amberLight + "44",
                    color: a.urgency === "high" ? C.coral : a.urgency === "maintain" ? C.sage : C.amber,
                  }}>{a.urgency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderHabits = () => (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, opacity: loaded ? 1 : 0 }}>
      <Card>
        <SectionTitle icon="✅" title="Daily Health Habits" subtitle="AI-generated from your risk profile and data" />
        <HabitTracker habits={habits} onToggle={toggleHabit} onReset={resetHabits} />
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Card>
          <SectionTitle icon="🎯" title="Why These Habits?" />
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>
            Your habit list is computed by the prediction engine based on gaps between your current data and optimal ranges. As you update biomarkers, nutrition, and fitness data, these recommendations automatically adjust.
          </p>
          <div style={{ marginTop: 16, padding: 14, background: C.sageMuted + "44", borderRadius: 12, border: `1px solid ${C.sage}22` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.sageDark, marginBottom: 4 }}>Top Priority</div>
            <div style={{ fontSize: 13, color: C.text }}>
              {risks.vitaminD > 25 ? "Sun exposure — your Vitamin D is at the lower end" :
               risks.cardiovascular > 15 ? "Omega-3 intake — support your lipid profile" :
               "Maintain your current routine — looking solid!"}
            </div>
          </div>
        </Card>
        <Card>
          <SectionTitle icon="📊" title="Habit Impact" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Sleep Quality", impact: "+8%", color: C.lavender },
              { label: "Cardio Risk", impact: "-12%", color: C.coral },
              { label: "Vitamin D", impact: "+18 ng/mL", color: C.amber },
              { label: "Metabolic Health", impact: "+15%", color: C.sage },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}22` }}>
                <span style={{ fontSize: 13, color: C.text }}>{item.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.impact}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: C.textLight, marginTop: 12, fontStyle: "italic" }}>Projected impact if all habits maintained for 90 days</p>
        </Card>
      </div>
    </div>
  );

  const renderConnect = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, opacity: loaded ? 1 : 0 }}>
      <Card style={{ gridColumn: "1 / 3" }}>
        <SectionTitle icon="🔗" title="Connect Your Data Sources" subtitle="Import real data from your health apps and wearables" />
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <ConnectionCard name="Apple Health" icon="🍎"
            description="Sleep, heart rate, HRV, steps, workouts via HealthKit. Requires native iOS bridge or Apple Health REST API."
            connected={connections.appleHealth} onConnect={connectAppleHealth}
            onImport={() => { setImportTarget("fitness"); fileInputRef.current?.click(); }}
          />
          <ConnectionCard name="MyFitnessPal" icon="🥗"
            description="Nutrition data, macros, calories, food diary. Import via CSV export or API."
            connected={connections.myFitnessPal} onConnect={connectMyFitnessPal}
            onImport={() => { setImportTarget("nutrition"); fileInputRef.current?.click(); }}
          />
          <ConnectionCard name="Fitbit" icon="⌚"
            description="Activity, sleep stages, heart rate, SpO2, stress management."
            connected={connections.fitbit} onConnect={() => setConnections(prev => ({ ...prev, fitbit: !prev.fitbit }))}
            onImport={() => { setImportTarget("fitness"); fileInputRef.current?.click(); }}
          />
          <ConnectionCard name="Garmin" icon="🏔️"
            description="Training load, Body Battery, advanced sleep, respiration rate."
            connected={connections.garmin} onConnect={() => setConnections(prev => ({ ...prev, garmin: !prev.garmin }))}
            onImport={() => { setImportTarget("fitness"); fileInputRef.current?.click(); }}
          />
        </div>
        <input ref={fileInputRef} type="file" accept=".csv,.json" style={{ display: "none" }} onChange={handleFileImport} />
      </Card>

      <Card>
        <SectionTitle icon="📤" title="Manual Import" subtitle="Upload CSV or JSON files" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { label: "Nutrition Data (CSV)", target: "nutrition", desc: "Columns: Calories, Protein, Carbs, Fat, Fiber, Sugar, Sodium" },
            { label: "Sleep Data (CSV)", target: "sleep", desc: "Columns: Deep, REM, Light, Awake, Total, Score" },
            { label: "Fitness Data (CSV)", target: "fitness", desc: "Columns: Strain, Calories, ActiveMinutes" },
          ].map(item => (
            <button key={item.target} onClick={() => { setImportTarget(item.target); fileInputRef.current?.click(); }}
              style={{
                padding: 16, borderRadius: 14, border: `1px dashed ${C.border}`, background: C.cardAlt,
                cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 4,
              }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.label}</span>
              <span style={{ fontSize: 11, color: C.textLight }}>{item.desc}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle icon="📥" title="Export Your Data" />
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
          Download your complete health profile including biomarkers, computed risks, and habit history.
        </p>
        <button onClick={() => {
          const exportData = { ...data, risks, habits, exportDate: new Date().toISOString() };
          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `aptoswasthy-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
          URL.revokeObjectURL(url);
        }} style={{
          width: "100%", padding: "12px", borderRadius: 14, border: "none",
          background: `linear-gradient(135deg, ${C.sage}, ${C.teal})`, color: C.white,
          fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>
          Export All Data (JSON)
        </button>
        <button onClick={() => {
          const prev = window.localStorage?.getItem?.(STORAGE.HEALTH_DATA);
          if (prev) {
            const blob = new Blob([prev], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "aptoswasthy-backup.json"; a.click();
          }
        }} style={{
          width: "100%", padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`,
          background: "transparent", color: C.textMuted, fontSize: 13, cursor: "pointer", marginTop: 8,
        }}>
          Backup Local Storage
        </button>
      </Card>

      <Card style={{ gridColumn: "1 / 3" }}>
        <SectionTitle icon="🏗️" title="Integration Architecture" subtitle="How data flows through AptoSwasthy" />
        <div style={{ padding: 20, background: C.cardAlt, borderRadius: 16, border: `1px solid ${C.border}22` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", alignItems: "center", gap: 12, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📱</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Data Sources</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Apple Health · MFP<br/>Fitbit · Garmin · CSV</div>
            </div>
            <div style={{ fontSize: 20, color: C.sage }}>→</div>
            <div>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚙️</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Prediction Engine</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Risk computation<br/>Habit generation<br/>Trend analysis</div>
            </div>
            <div style={{ fontSize: 20, color: C.sage }}>→</div>
            <div>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Dashboard</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Visualizations<br/>Risk gauges<br/>Action items</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: 14, background: C.tealLight + "22", borderRadius: 12, border: `1px solid ${C.teal}22` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.tealDark, marginBottom: 6 }}>For Production Deployment</div>
          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
            <strong>Apple Health:</strong> Requires a native iOS app using HealthKit SDK, or a React Native bridge (react-native-health). Web apps cannot directly access HealthKit — you need a native wrapper that syncs to your backend.<br/>
            <strong>MyFitnessPal:</strong> The official API is deprecated. Use CSV exports from the MFP app, or integrate with a third-party bridge like Nutritionix API for food logging.<br/>
            <strong>Backend:</strong> Your existing API architecture can receive data via POST endpoints. Each source adapter normalizes data into the schema used by the prediction engine.
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans',sans-serif", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:wght@600;700;800&display=swap" rel="stylesheet" />

      {/* Status Toast */}
      {importStatus && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1100,
          padding: "12px 24px", borderRadius: 14, background: C.text, color: C.white,
          fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(44,62,54,0.3)",
          animation: "slideUp 0.3s ease",
        }}>
          {importStatus}
        </div>
      )}

      {/* Header */}
      <header style={{
        background: `linear-gradient(135deg, ${C.card} 0%, ${C.sageMuted}44 100%)`,
        borderBottom: `1px solid ${C.border}`, padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.sage}, ${C.teal})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: C.white, fontWeight: 800, fontSize: 16, fontFamily: "'Fraunces',serif",
            boxShadow: `0 4px 12px ${C.sage}44`,
          }}>A</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: "'Fraunces',serif", color: C.text, letterSpacing: -0.5 }}>
              APTO<span style={{ color: C.sage }}>SWASTHY</span>
            </h1>
            <p style={{ margin: 0, fontSize: 10, color: C.textMuted, letterSpacing: 2, textTransform: "uppercase" }}>Fit · Healthy · Aware</p>
          </div>
        </div>
        {/* Search Bar */}
        <div style={{ position: "relative", flex: "0 1 360px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
            borderRadius: 14, background: C.cardAlt, border: `1px solid ${searchOpen ? C.sage : C.border}`,
            transition: "border-color 0.2s",
          }}>
            <span style={{ fontSize: 14, color: C.textMuted }}>🔍</span>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search metrics, biomarkers, goals..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              style={{
                border: "none", outline: "none", background: "transparent", flex: 1,
                fontSize: 13, color: C.text, fontFamily: "'DM Sans',sans-serif",
              }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                style={{ background: "none", border: "none", fontSize: 14, color: C.textMuted, cursor: "pointer", padding: 0 }}>✕</button>
            )}
          </div>
          {/* Search Results Dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 200,
              background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
              boxShadow: "0 12px 40px rgba(44,62,54,0.12)", overflow: "hidden", maxHeight: 360, overflowY: "auto",
            }}>
              {searchResults.map((result, i) => (
                <div key={i}
                  onMouseDown={() => { setTab(result.tab); setSearchQuery(""); setSearchOpen(false); }}
                  style={{
                    padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${C.border}22`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.sageMuted + "33"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{result.title}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{result.detail}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 8, background: C.tealLight + "44", color: C.tealDark }}>{result.type}</span>
                    <span style={{ fontSize: 10, color: C.textLight }}>→ {result.tab}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {searchOpen && searchQuery.trim().length > 0 && searchResults.length === 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 200,
              background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
              boxShadow: "0 12px 40px rgba(44,62,54,0.12)", padding: "20px 16px", textAlign: "center",
            }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>No results for "{searchQuery}"</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ padding: "6px 14px", borderRadius: 20, background: C.sageMuted, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.sage, animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.sageDark }}>
              {Object.values(connections).filter(Boolean).length} Source{Object.values(connections).filter(Boolean).length !== 1 ? "s" : ""} Connected
            </span>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${C.sage}, ${C.teal})`,
            display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 14, fontWeight: 700,
          }}>{data.profile.name?.[0] || "U"}</div>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{ display: "flex", gap: 4, padding: "12px 32px", background: C.card, borderBottom: `1px solid ${C.border}33`, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 20px", borderRadius: 12, border: "none", whiteSpace: "nowrap",
            background: tab === t ? C.sageMuted : "transparent",
            color: tab === t ? C.sageDark : C.textMuted,
            fontSize: 13, fontWeight: tab === t ? 700 : 500, cursor: "pointer",
            transition: "all 0.25s", fontFamily: "'DM Sans',sans-serif",
          }}>{t}</button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ padding: "24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {tab === "Overview" && renderOverview()}
        {tab === "Sleep & Recovery" && renderSleep()}
        {tab === "Nutrition" && renderNutrition()}
        {tab === "Biomarkers" && renderBiomarkers()}
        {tab === "Disease Risk" && renderDiseaseRisk()}
        {tab === "Habits" && renderHabits()}
        {tab === "Goals" && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, opacity: loaded ? 1 : 0 }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <SectionTitle icon="🎯" title="Health Goals" subtitle={`${goals.filter(g => g.current_value >= g.target_value).length}/${goals.length} achieved`} />
                <button onClick={() => setShowAddGoal(true)} style={{
                  padding: "8px 20px", borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg, ${C.sage}, ${C.teal})`, color: C.white,
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>+ Add Goal</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {goals.map((g, i) => {
                  const pct = g.title.includes("Reduce") ? Math.round(((g.target_value / g.current_value)) * 100) : Math.round((g.current_value / g.target_value) * 100);
                  const isComplete = g.title.includes("Reduce") ? g.current_value <= g.target_value : g.current_value >= g.target_value;
                  const color = isComplete ? C.sage : pct >= 75 ? C.teal : pct >= 50 ? C.amber : C.coral;
                  return (
                    <div key={g.id} style={{ padding: 16, borderRadius: 16, border: `1px solid ${isComplete ? C.sage + "44" : C.border}`, background: isComplete ? C.sageMuted + "22" : C.cardAlt }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{g.title}</span>
                          <span style={{ fontSize: 10, color: C.textLight, marginLeft: 8, padding: "2px 8px", borderRadius: 8, background: C.border + "33" }}>{g.category}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color }}>{Math.min(pct, 100)}%</span>
                          {isComplete && <span style={{ fontSize: 16 }}>✅</span>}
                        </div>
                      </div>
                      <div style={{ height: 8, background: C.border + "33", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: 4, transition: "width 0.8s ease" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted }}>
                        <span>Current: {g.current_value} {g.unit}</span>
                        <span>Target: {g.target_value} {g.unit}</span>
                        {g.deadline && <span>By: {g.deadline}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Card>
                <SectionTitle icon="📊" title="Goal Progress" />
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <CircularProgress value={goals.filter(g => (g.title.includes("Reduce") ? g.current_value <= g.target_value : g.current_value >= g.target_value)).length} max={goals.length} size={120} strokeWidth={12} color={C.sage}
                    label={`${Math.round((goals.filter(g => (g.title.includes("Reduce") ? g.current_value <= g.target_value : g.current_value >= g.target_value)).length / goals.length) * 100)}%`}
                    sublabel="goals achieved" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "On Track", count: goals.filter(g => { const p = g.title.includes("Reduce") ? (g.target_value / g.current_value) * 100 : (g.current_value / g.target_value) * 100; return p >= 75 && p < 100; }).length, color: C.teal },
                    { label: "Needs Work", count: goals.filter(g => { const p = g.title.includes("Reduce") ? (g.target_value / g.current_value) * 100 : (g.current_value / g.target_value) * 100; return p < 75; }).length, color: C.amber },
                    { label: "Completed", count: goals.filter(g => g.title.includes("Reduce") ? g.current_value <= g.target_value : g.current_value >= g.target_value).length, color: C.sage },
                  ].map(s => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                      <span style={{ flex: 1, fontSize: 12, color: C.text }}>{s.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <SectionTitle icon="💡" title="Suggested Goals" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    data.biomarkers.vitaminD < 50 && "Raise Vitamin D to 50 ng/mL",
                    data.sleep.avgHRV < 60 && "Improve HRV to 60ms average",
                    data.fitness.weeklyActiveMinutes < 200 && "Reach 200 active minutes/week",
                    data.nutrition.avgDailyFiber < 30 && "Hit 30g daily fiber consistently",
                  ].filter(Boolean).map((suggestion, i) => (
                    <div key={i} onClick={() => { setNewGoal({ ...newGoal, title: suggestion }); setShowAddGoal(true); }} style={{
                      padding: 10, borderRadius: 10, background: C.cardAlt, border: `1px dashed ${C.border}`,
                      fontSize: 12, color: C.textMuted, cursor: "pointer",
                    }}>+ {suggestion}</div>
                  ))}
                </div>
              </Card>
            </div>
            <Modal open={showAddGoal} onClose={() => setShowAddGoal(false)} title="Add New Goal">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { key: "title", label: "Goal Title", type: "text", placeholder: "e.g., Daily protein target" },
                  { key: "category", label: "Category", type: "text", placeholder: "Fitness, Nutrition, Sleep, Health" },
                  { key: "target_value", label: "Target Value", type: "number", placeholder: "e.g., 150" },
                  { key: "unit", label: "Unit", type: "text", placeholder: "e.g., g, min, mg/dL" },
                  { key: "deadline", label: "Deadline", type: "date", placeholder: "" },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 4 }}>{field.label}</label>
                    <input type={field.type} placeholder={field.placeholder} value={newGoal[field.key] || ""}
                      onChange={e => setNewGoal(prev => ({ ...prev, [field.key]: field.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 14, color: C.text, background: C.cardAlt, outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" }} />
                  </div>
                ))}
                <button onClick={() => {
                  if (newGoal.title && newGoal.target_value) {
                    setGoals(prev => [...prev, { ...newGoal, id: Date.now(), current_value: 0, status: "active" }]);
                    setNewGoal({ category: "Fitness", title: "", target_value: "", unit: "", deadline: "" });
                    setShowAddGoal(false);
                  }
                }} style={{ padding: "12px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${C.sage}, ${C.teal})`, color: C.white, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  Create Goal
                </button>
              </div>
            </Modal>
          </div>
        )}
        {tab === "Trends" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, opacity: loaded ? 1 : 0 }}>
            <Card hoverable style={{ gridColumn: "1 / 3" }}>
              <SectionTitle icon="📈" title="Sleep Score Trend" subtitle="30-day view" />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.sleep.weekly}>
                  <defs>
                    <linearGradient id="trendSleep" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.lavender} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={C.lavender} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border + "22"} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: C.textLight }} tickLine={false} axisLine={false} domain={[60, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="score" stroke={C.lavender} fill="url(#trendSleep)" strokeWidth={2.5} dot={{ fill: C.lavender, r: 3 }} name="Sleep Score" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card hoverable>
              <SectionTitle icon="🍎" title="Nutrition Trend" subtitle="Calorie & macro tracking" />
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.nutrition.weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border + "22"} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: C.textLight }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="protein" stroke={C.teal} strokeWidth={2} dot={{ r: 3 }} name="Protein" />
                  <Line type="monotone" dataKey="fiber" stroke={C.sage} strokeWidth={2} dot={{ r: 3 }} name="Fiber" />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                {(() => {
                  const avgP = Math.round(data.nutrition.weekly.reduce((s, d) => s + d.protein, 0) / data.nutrition.weekly.length);
                  const avgF = Math.round(data.nutrition.weekly.reduce((s, d) => s + d.fiber, 0) / data.nutrition.weekly.length * 10) / 10;
                  return <>
                    <div style={{ flex: 1, textAlign: "center", padding: 8, background: C.cardAlt, borderRadius: 10 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.teal }}>{Math.round((avgP / 150) * 100)}%</div>
                      <div style={{ fontSize: 10, color: C.textMuted }}>Protein goal ({avgP}g avg)</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", padding: 8, background: C.cardAlt, borderRadius: 10 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.sage }}>{Math.round((avgF / 30) * 100)}%</div>
                      <div style={{ fontSize: 10, color: C.textMuted }}>Fiber goal ({avgF}g avg)</div>
                    </div>
                  </>;
                })()}
              </div>
            </Card>

            <Card hoverable>
              <SectionTitle icon="🏋️" title="Fitness Trend" subtitle="Strain & active minutes" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.fitness.weeklyStrain} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border + "22"} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: C.textLight }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="strain" radius={[6, 6, 0, 0]} name="Strain">
                    {data.fitness.weeklyStrain.map((entry, i) => <Cell key={i} fill={entry.strain > 15 ? C.coral : entry.strain > 10 ? C.teal : C.tealLight} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                <div style={{ flex: 1, textAlign: "center", padding: 8, background: C.cardAlt, borderRadius: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.teal }}>{Math.round((data.fitness.weeklyActiveMinutes / 150) * 100)}%</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>of 150 min goal</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", padding: 8, background: C.cardAlt, borderRadius: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.sage }}>{data.fitness.weeklyActiveMinutes} min</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>Total active this week</div>
                </div>
              </div>
            </Card>

            {/* Weekly Summary Report */}
            <Card hoverable style={{ gridColumn: "1 / 3" }}>
              <SectionTitle icon="📋" title="Weekly Summary Report" subtitle="Auto-generated performance report" />
              {(() => {
                const sleepAvg = Math.round(data.sleep.weekly.reduce((s, d) => s + d.score, 0) / data.sleep.weekly.length);
                const calAvg = Math.round(data.nutrition.weekly.reduce((s, d) => s + d.calories, 0) / data.nutrition.weekly.length);
                const proteinAvg = Math.round(data.nutrition.weekly.reduce((s, d) => s + d.protein, 0) / data.nutrition.weekly.length);
                const strainAvg = Math.round(data.fitness.weeklyStrain.reduce((s, d) => s + d.strain, 0) / data.fitness.weeklyStrain.length * 10) / 10;
                const riskAvg = Object.values(risks).length > 0 ? Math.round(Object.values(risks).reduce((s, v) => s + v, 0) / Object.values(risks).length) : 0;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 14 }}>
                    {[
                      { label: "Sleep Quality", value: `${sleepAvg}%`, sub: sleepAvg >= 85 ? "Excellent" : sleepAvg >= 70 ? "Good" : "Needs work", color: sleepAvg >= 85 ? C.sage : C.amber },
                      { label: "Avg Calories", value: `${Math.round((calAvg / data.nutrition.calorieGoal) * 100)}%`, sub: `${calAvg} kcal/day`, color: Math.abs(calAvg - data.nutrition.calorieGoal) < 200 ? C.sage : C.amber },
                      { label: "Protein", value: `${Math.round((proteinAvg / 150) * 100)}%`, sub: `${proteinAvg}g avg`, color: proteinAvg >= 140 ? C.sage : C.amber },
                      { label: "Fitness", value: `${Math.round((data.fitness.weeklyActiveMinutes / 150) * 100)}%`, sub: `${data.fitness.weeklyActiveMinutes} min`, color: data.fitness.weeklyActiveMinutes >= 150 ? C.sage : C.amber },
                      { label: "Risk Level", value: `${riskAvg}%`, sub: riskAvg < 15 ? "Low risk" : "Moderate", color: riskAvg < 15 ? C.sage : C.amber },
                    ].map(item => (
                      <div key={item.label} style={{ textAlign: "center", padding: 16, background: C.cardAlt, borderRadius: 14, border: `1px solid ${C.border}22` }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: item.color, fontFamily: "'Fraunces',serif" }}>{item.value}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{item.sub}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ marginTop: 16, padding: 14, background: C.sageMuted + "33", borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.sageDark, marginBottom: 6 }}>Highlights</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    data.fitness.weeklyActiveMinutes >= 150 ? "✅ Hit 150+ active minutes this week" : `⚠️ ${150 - data.fitness.weeklyActiveMinutes} more active minutes needed`,
                    avgRecovery >= 85 ? "✅ Strong recovery scores all week" : "⚠️ Recovery trending below optimal",
                    `📊 ${biomarkersList.filter(b => b.status === "normal").length}/${biomarkersList.length} biomarkers in normal range (${Math.round((biomarkersList.filter(b => b.status === "normal").length / biomarkersList.length) * 100)}%)`,
                    `🎯 ${goals.filter(g => (g.title.includes("Reduce") ? g.current_value <= g.target_value : g.current_value >= g.target_value)).length}/${goals.length} goals achieved (${Math.round((goals.filter(g => (g.title.includes("Reduce") ? g.current_value <= g.target_value : g.current_value >= g.target_value)).length / goals.length) * 100)}%)`,
                  ].map((h, i) => (
                    <span key={i} style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{h}</span>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}
        {tab === "Connect" && renderConnect()}
      </main>

      <footer style={{ textAlign: "center", padding: "24px 32px", color: C.textLight, fontSize: 11 }}>
        <span>AptoSwasthy © 2026 · Data is for informational purposes · Always consult your healthcare provider</span>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        button:hover { opacity: 0.85; }
        input:focus { border-color: ${C.sage} !important; }
      `}</style>
    </div>
  );
}
