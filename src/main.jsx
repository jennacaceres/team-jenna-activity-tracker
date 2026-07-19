import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle,
  Download,
  Lock,
  LogOut,
  Minus,
  Plus,
  Search,
  Trash2,
  Trophy,
  Users
} from "lucide-react";
import { saveActivity, subscribeActivities, removeActivity, editActivity } from "./firebase";
import {
  BRANDING_MAX_PER_DAY,
  POINT_VALUES,
  WEEKLY_TARGET,
  calculateBonuses,
  calculatePoints,
  currency,
  getMonthKey,
  getCompetitionWeek,
  getProductivity,
  getRewardTier,
  getNextLevelProgress,
  getNextLevelInfo,
  getWeekKey
} from "./points";
import "./style.css";

const MANAGER_PIN = import.meta.env.VITE_MANAGER_PIN || "123456";

const AGENT_NAMES = [
  "Bon, Karen Andrea",
  "Alejandria, Eden",
  "Gutierrez, Richard",
  "Peña, Cezar",
  "Pajarillo, Angela Lou",
  "Francisco, Roshelle",
  "Cemeni, Abegail",
  "Guevara, Ma. Paula Jean",
  "Peña, Kathleen Ann",
  "Naval, Fayzah",
  "Bardon, Haidee",
  "Bon, Eric Ryan",
  "Manio, Isiah Godffrey",
  "Echano, John Philip",
  "Delos Reyes, Jay Ann",
  "Guevara, Jenna Ruth",
  "Garcia, Marites",
  "Cardino, Rechie",
  "Tapan, Justine Louise",
];

const initialForm = {
  date: new Date().toISOString().slice(0, 10),
  agent: "",
  approaches: 0,
  appointments: 0,
  presentation: 0,
  bybTableTop: 0,
  meetTheManager: 0,
  paidExam: 0,
  coded: 0,
  closedCases: 0,
  recruitment: 0,
  training: 0,
  branding: 0,
  teamEngagement: 0,
  notes: "",
  closingDetails: [],
  examDetails: [],
};

const activityRows = [
  ["approaches", "Approaches", "Every prospect approached"],
  ["appointments", "Appointments / BYB Invite", "Booked appointment or invite"],
  ["presentation", "Presentation", "Financial planning or plan presentation"],
  ["bybTableTop", "BYB / Table Top", "Business presentation"],
  ["meetTheManager", "Meet the Manager", "Recruit attended MTM"],
  ["paidExam", "Paid Exam", "Single/Dual popup"],
  ["coded", "Coded", "Licensed / coded recruit"],
  ["closedCases", "Closed Case", "APE popup required"],
  ["training", "Training", "Approved trainings"],
  ["branding", `Branding (max ${BRANDING_MAX_PER_DAY}/day)`, "Posting / personal branding"],
  ["teamEngagement", "Team Engagement", "GC / team activity participation"],
];

function App() {
  const [page, setPage] = useState(location.pathname.includes("admin") ? "admin" : "form");
  useEffect(() => {
    const onPop = () => setPage(location.pathname.includes("admin") ? "admin" : "form");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function nav(next) {
    history.pushState({}, "", next === "admin" ? "/admin" : "/");
    setPage(next);
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Team Jenna</p>
          <h1>Activity Tracker</h1>
        </div>
        <nav>
          <button onClick={() => nav("form")} className={page === "form" ? "active" : ""}>Agent Form</button>
          <button onClick={() => nav("admin")} className={page === "admin" ? "active" : ""}>Manager Dashboard</button>
        </nav>
      </header>
      {page === "admin" ? <AdminPage /> : <AgentForm />}
    </>
  );
}

function CounterRow({ id, label, help, value, onDec, onInc }) {
  return (
    <div className="counter-row">
      <div>
        <div className="row-title">{label}</div>
        <div className="row-help">{help}</div>
        <span className="badge">{POINT_VALUES[id] ?? 0} pt{(POINT_VALUES[id] ?? 0) === 1 ? "" : "s"}</span>
      </div>
      <div className="counter-controls">
        <button type="button" onClick={onDec} className="round"><Minus size={16} /></button>
        <strong>{value}</strong>
        <button type="button" onClick={onInc} className="round plus"><Plus size={16} /></button>
      </div>
    </div>
  );
}

function AgentForm() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [closedModal, setClosedModal] = useState(false);
  const [examModal, setExamModal] = useState(false);
  const [apeInput, setApeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState([]);
  const [standingsError, setStandingsError] = useState("");

  useEffect(() => {
    return subscribeActivities(setActivities, (err) => {
      console.error(err);
      setStandingsError("Could not load the live standings.");
    });
  }, []);

  const points = useMemo(() => calculatePoints(form), [form]);
  const bonuses = useMemo(() => calculateBonuses(form), [form]);
  const currentWeekKey = getCompetitionWeek(new Date().toISOString().slice(0, 10)).key;
  const topFiveAgents = useMemo(() => {
    const currentWeekRows = activities.filter((activity) => getCompetitionWeek(activity.date).key === currentWeekKey);
    return aggregateByAgent(currentWeekRows)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 5);
  }, [activities, currentWeekKey]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function increment(key) {
    if (key === "closedCases") {
      setApeInput("");
      setClosedModal(true);
      return;
    }
    if (key === "paidExam") {
      setExamModal(true);
      return;
    }
    setForm((prev) => ({ ...prev, [key]: Number(prev[key] || 0) + 1 }));
  }

  function decrement(key) {
    setForm((prev) => {
      const next = { ...prev, [key]: Math.max(0, Number(prev[key] || 0) - 1) };
      if (key === "closedCases") next.closingDetails = (prev.closingDetails || []).slice(0, -1);
      if (key === "paidExam") next.examDetails = (prev.examDetails || []).slice(0, -1);
      return next;
    });
  }

  function saveClosing() {
    const ape = Number(apeInput || 0);
    if (!ape || ape < 0) return alert("Please enter a valid APE amount.");
    setForm((prev) => ({
      ...prev,
      closedCases: Number(prev.closedCases || 0) + 1,
      closingDetails: [...(prev.closingDetails || []), { apeAmount: ape }],
    }));
    setClosedModal(false);
  }

  function saveExam(type) {
    setForm((prev) => ({
      ...prev,
      paidExam: Number(prev.paidExam || 0) + 1,
      examDetails: [...(prev.examDetails || []), { type }],
    }));
    setExamModal(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.agent) return alert("Please select your name.");
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        agent: form.agent,
        pointsBreakdown: points.breakdown,
        totalPoints: points.total,
        brandingCounted: points.brandingCounted,
        bonuses,
        weekKey: getWeekKey(form.date),
        competitionWeek: getCompetitionWeek(form.date),
        monthKey: getMonthKey(form.date),
      };
      await saveActivity(payload);
      setMessage(`✅ Activity saved! ${points.total} points. Bonus: ${currency(bonuses.totalBonus)}.`);
      setForm({ ...initialForm, date: new Date().toISOString().slice(0, 10) });
    } catch (error) {
      console.error(error);
      alert("Saving failed. Please check Firebase environment variables and Firestore rules.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="hero-card">
        <p className="eyebrow">Public Agent Link</p>
        <h2>Daily Activity Form</h2>
        <p>Encode activities in less than 30 seconds. Points and bonuses update live.</p>
      </section>

      <form className="grid form-grid" onSubmit={submit}>
        <section className="panel wide">
          <div className="two-col">
            <label>Agent Name
              <select value={form.agent} onChange={(e) => setField("agent", e.target.value)} required>
                <option value="">Select your name</option>
                {AGENT_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label>Date<input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} /></label>
          </div>
          <div className="counter-list">
            {activityRows.map(([id, label, help]) => (
              <CounterRow
                key={id}
                id={id}
                label={label}
                help={help}
                value={form[id]}
                onDec={() => decrement(id)}
                onInc={() => increment(id)}
              />
            ))}
          </div>

          <label>Notes<textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Optional notes" /></label>
          <button className="primary full" disabled={saving}>{saving ? "Saving..." : "Submit Activity"}</button>
          {message && <div className="success">{message}</div>}
        </section>

        <aside className="panel sticky">
          <h3>Live Summary</h3>
          <div className="big-number">{points.total}</div>
          <p className="muted">Total Points</p>
          <div className="summary-list">
            <span>Branding counted</span><strong>{points.brandingCounted}/{BRANDING_MAX_PER_DAY}</strong>
            <span>Closed bonus</span><strong>{currency(bonuses.closingBonus)}</strong>
            <span>Exam bonus</span><strong>{currency(bonuses.examBonus)}</strong>
            <span>Total bonus</span><strong>{currency(bonuses.totalBonus)}</strong>
          </div>

          {!!form.closingDetails.length && (
            <div className="mini-box">
              <strong>Closings</strong>
              {form.closingDetails.map((c, i) => <p key={i}>Case {i+1}: {currency(c.apeAmount)}</p>)}
            </div>
          )}

          {!!form.examDetails.length && (
            <div className="mini-box">
              <strong>Paid Exams</strong>
              {form.examDetails.map((x, i) => <p key={i}>Exam {i+1}: {x.type === "dual" ? "Dual" : "Single"}</p>)}
            </div>
          )}
        </aside>
      </form>

      <section className="panel daily-standings-card public-standings-card">
        <p className="eyebrow">Live Weekly Ranking</p>
        <h3>Top 5 Agents</h3>
        <p className="muted">Rankings update automatically based on total points for the current competition week.</p>
        {standingsError && <div className="error">{standingsError}</div>}
        <div className="standing-grid">
          {topFiveAgents.map((agent, index) => {
            const tier = getRewardTier(agent.totalPoints, agent.hasDiamondRequirement);
            return (
              <div className="standing-item" key={agent.agent}>
                <strong>#{index + 1} {agent.agent}</strong>
                <span>{getTierIcon(tier)} {tier.lockedDiamond ? "Diamond Locked" : tier.label}</span>
                <em>{agent.totalPoints} pts</em>
              </div>
            );
          })}
          {!topFiveAgents.length && !standingsError && <p className="muted">No submissions yet for the current week.</p>}
        </div>
      </section>

      {closedModal && (
        <Modal title="Closed Case APE">
          <label>How much APE did you close?
            <input autoFocus type="number" value={apeInput} onChange={(e) => setApeInput(e.target.value)} placeholder="Example: 52000" />
          </label>
          <div className="modal-actions">
            <button type="button" onClick={() => setClosedModal(false)}>Cancel</button>
            <button type="button" className="primary" onClick={saveClosing}>Save Closing</button>
          </div>
        </Modal>
      )}

      {examModal && (
        <Modal title="Paid Exam Type">
          <p className="muted">Select the license paid by recruit.</p>
          <div className="modal-actions vertical">
            <button type="button" className="primary" onClick={() => saveExam("single")}>Single License — ₱200 bonus</button>
            <button type="button" className="primary" onClick={() => saveExam("dual")}>Dual License — ₱300 bonus</button>
            <button type="button" onClick={() => setExamModal(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Modal({ title, children }) {
  return <div className="modal-backdrop"><div className="modal"><h3>{title}</h3>{children}</div></div>;
}

function AdminPage() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(sessionStorage.getItem("managerAuthed") === "yes");

  if (!authed) {
    return (
      <main className="page center">
        <section className="panel login">
          <Lock size={34} />
          <h2>Manager Dashboard</h2>
          <p className="muted">Enter manager PIN. Default PIN is 123456 unless changed in Vercel.</p>
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Manager PIN" />
          <button className="primary full" onClick={() => {
            if (pin === MANAGER_PIN) {
              sessionStorage.setItem("managerAuthed", "yes");
              setAuthed(true);
            } else {
              alert("Invalid PIN");
            }
          }}>Unlock Dashboard</button>
        </section>
      </main>
    );
  }

  return <Dashboard onLogout={() => { sessionStorage.removeItem("managerAuthed"); setAuthed(false); }} />;
}

function Dashboard({ onLogout }) {
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [weekKey, setWeekKey] = useState(getCompetitionWeek(new Date().toISOString().slice(0, 10)).key);
  const [tab, setTab] = useState("points");
  const [error, setError] = useState("");

  useEffect(() => {
    return subscribeActivities(setActivities, (err) => {
      console.error(err);
      setError("Could not load Firestore activities. Check Firebase env vars and Firestore rules.");
    });
  }, []);

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      const matchesWeek = !weekKey || getCompetitionWeek(a.date).key === weekKey;
      const matchesSearch = !search || (a.agent || "").toLowerCase().includes(search.toLowerCase());
      return matchesWeek && matchesSearch;
    });
  }, [activities, weekKey, search]);

  const availableWeeks = useMemo(() => {
    const weeks = new Map();
    const todayWeek = getCompetitionWeek(new Date().toISOString().slice(0, 10));
    weeks.set(todayWeek.key, todayWeek);
    activities.forEach((a) => {
      const w = getCompetitionWeek(a.date);
      weeks.set(w.key, w);
    });
    return [...weeks.values()].filter((w) => w.number >= 1).sort((a, b) => b.number - a.number);
  }, [activities]);

  const selectedWeek = useMemo(() => availableWeeks.find((w) => w.key === weekKey) || getCompetitionWeek(new Date().toISOString().slice(0, 10)), [availableWeeks, weekKey]);

  const agents = useMemo(() => aggregateByAgent(filtered), [filtered]);
  const ranked = useMemo(() => {
    const key = tab === "bonus" ? "totalBonus" : tab === "productivity" ? "productivity" : tab === "closings" ? "closedCases" : tab === "recruitment" ? "coded" : "totalPoints";
    return [...agents].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  }, [agents, tab]);

  const totals = useMemo(() => filtered.reduce((sum, a) => {
    sum.points += Number(a.totalPoints || 0);
    sum.closings += Number(a.closedCases || 0);
    sum.coded += Number(a.coded || 0);
    sum.bonus += Number(a.bonuses?.totalBonus || 0);
    return sum;
  }, { points: 0, closings: 0, coded: 0, bonus: 0 }), [filtered]);

  function exportCsv() {
    const rows = [
      ["Date","Agent","Points","Productivity %","Closed","Coded","Closing Bonus","Exam Bonus","Total Bonus","Notes"],
      ...filtered.map((a) => [
        a.date,
        a.agent,
        a.totalPoints,
        "",
        a.closedCases,
        a.coded,
        a.bonuses?.closingBonus || 0,
        a.bonuses?.examBonus || 0,
        a.bonuses?.totalBonus || 0,
        (a.notes || "").replaceAll(",", " ")
      ])
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `team-jenna-${weekKey || "report"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <section className="dash-head">
        <div>
          <p className="eyebrow">Private Manager View</p>
          <h2>Dashboard</h2>
          <p className="muted">Weekly levels: Bronze 300 pts • Silver 500 pts • Gold 1,000 pts • Diamond 1,500 pts + closing or converted recruit.</p>
        </div>
        <button onClick={onLogout}><LogOut size={16}/> Logout</button>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="stat-grid">
        <Stat icon={<Users/>} label="Total Agents" value={agents.length} />
        <Stat icon={<BarChart3/>} label="Total Points" value={totals.points} />
        <Stat icon={<CheckCircle/>} label="Closings" value={totals.closings} />
        <Stat icon={<Award/>} label="Total Bonus" value={currency(totals.bonus)} />
      </section>

      <section className="toolbar">
        <label><CalendarDays size={16}/> Week
          <select value={weekKey} onChange={(e) => setWeekKey(e.target.value)}>
            {availableWeeks.map((w) => <option key={w.key} value={w.key}>{w.label}: {w.dateRange}</option>)}
          </select>
        </label>
        <label><Search size={16}/> Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Agent name" /></label>
        <button onClick={exportCsv}><Download size={16}/> Export CSV</button>
      </section>

      <section className="competition-snapshot">
        <div>
          <p className="eyebrow">Team Jenna Weekly Challenge</p>
          <h2>{selectedWeek.label}</h2>
          <p>{selectedWeek.dateRange}</p>
        </div>
        <div className="level-guide">
          <span className="bronze">🥉 Bronze 300</span>
          <span className="silver">🥈 Silver 500</span>
          <span className="gold">🥇 Gold 1,000</span>
          <span className="diamond">💎 Diamond 1,500 + requirement</span>
        </div>
      </section>

      <section className="panel">
        <div className="tabs">
          {[
            ["points", "Total Points"],
            ["productivity", "Productivity"],
            ["closings", "Closings"],
            ["recruitment", "Recruitment"],
            ["bonus", "Total Bonus"],
          ].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}
        </div>
        <div className="leader-list">
          {ranked.map((agent, i) => <AgentCard key={agent.agent} agent={agent} rank={i+1} />)}
          {!ranked.length && <p className="muted">No submissions yet for this period.</p>}
        </div>
      </section>

      <section className="panel">
        <h3>Activity History — {selectedWeek.label}</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Agent</th><th>Level</th><th>Points</th><th>Closed</th><th>Coded</th><th>Bonus</th><th>Summary</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map((a) => (
                <ActivityHistoryRow key={a.id} activity={a} onDelete={() => {
                  if (confirm("Delete this entry?")) removeActivity(a.id);
                }} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function ActivityHistoryRow({ activity, onDelete }) {
  const hasRecruit = Number(activity.meetTheManager || 0) > 0 && Number(activity.paidExam || 0) > 0;
  const hasDiamondRequirement = Number(activity.closedCases || 0) > 0 || hasRecruit;
  const tier = getRewardTier(activity.totalPoints || 0, hasDiamondRequirement);
  const next = getNextLevelInfo(activity.totalPoints || 0, hasDiamondRequirement);
  const levelClass = tier.lockedDiamond ? "locked" : tier.tier;

  return (
    <tr className={`history-row level-${levelClass}`}>
      <td>{activity.date}</td>
      <td>
        <strong>{activity.agent || "Unnamed"}</strong>
        <small>{activity.agentType || "Agent"}</small>
      </td>
      <td><span className={`level-chip level-${levelClass}`}>{getTierIcon(tier)} {tier.lockedDiamond ? "Diamond Locked" : tier.label}</span></td>
      <td><strong>{activity.totalPoints || 0}</strong></td>
      <td>{activity.closedCases || 0}</td>
      <td>{activity.coded || 0}</td>
      <td>{currency(activity.bonuses?.totalBonus || 0)}</td>
      <td>
        <div className="history-summary">
          <span>🎯 {next.label}</span>
          <span>💰 Bonus: {currency(activity.bonuses?.totalBonus || 0)}</span>
        </div>
      </td>
      <td><button className="danger" onClick={onDelete}><Trash2 size={15}/></button></td>
    </tr>
  );
}

function Stat({ icon, label, value }) {
  return <div className="stat">{icon}<span>{label}</span><strong>{value}</strong></div>;
}

function AgentCard({ agent, rank }) {
  const tier = getRewardTier(agent.totalPoints, agent.hasDiamondRequirement);
  const progressInfo = getNextLevelProgress(agent.totalPoints);
  const displayTier = tier.lockedDiamond ? "Diamond Locked" : tier.label;
  const levelClass = tier.lockedDiamond ? "locked" : tier.tier;
  const totalReward = agent.totalBonus + tier.amount;

  return (
    <article className={`agent-card level-${levelClass}`}>
      <div className="agent-main">
        <div className="rank-badge">#{rank}</div>
        <div className="avatar-level">{getTierIcon(tier)}</div>
        <div className="agent-info">
          <h3>{agent.agent}</h3>
          <div className={`current-level-banner level-${levelClass}`}>{getTierIcon(tier)} {displayTier} MEMBER</div>
          <div className="agent-sub">
            <span className="type-pill">{agent.agentType || "Agent"}</span>
            <span>{agent.entries} entries</span>
            <span>avg {agent.entries ? Math.round(agent.totalPoints / agent.entries) : 0} pts</span>
          </div>
          <div className="progress-track">
            <div className={`progress-fill level-${levelClass}`} style={{ width: `${Math.min(100, progressInfo.percent)}%` }} />
          </div>
          <p className="coach-line">{progressInfo.label} • {progressInfo?.label ? `${progressInfo.label} • ${agent.coachInsight}` : agent.coachInsight}</p>
        </div>
        <div className="score-block">
          <strong>{agent.totalPoints}</strong>
          <span>pts</span>
          <em className={`level-chip level-${levelClass}`}>{getTierIcon(tier)} {displayTier}</em>
        </div>
      </div>

      <div className="agent-metrics">
        <span>Weekly Reward <strong>{currency(tier.amount)}</strong></span>
        <span>Closing Bonus <strong>{currency(agent.closingBonus)}</strong></span>
        <span>Exam Bonus <strong>{currency(agent.examBonus)}</strong></span>
        <span>Total Bonus <strong>{currency(totalReward)}</strong></span>
        <span>Closings <strong>{agent.closedCases}</strong></span>
        <span>Coded Recruits <strong>{agent.coded}</strong></span>
        <span>Appointments <strong>{agent.appointments}</strong></span>
        <span>Presentations <strong>{agent.presentation}</strong></span>
      </div>

      {tier.lockedDiamond && (
        <div className="diamond-warning">
          💎 Diamond Locked: needs at least 1 Closing OR 1 converted recruit with MTM + Paid Exam.
        </div>
      )}

      <details>
        <summary>Activity Breakdown</summary>
        <div className="breakdown">
          {Object.entries(agent.rawTotals).map(([key, value]) => <span key={key}>{labelize(key)}: <strong>{value}</strong></span>)}
        </div>
      </details>
    </article>
  );
}

function getTierIcon(tier) {
  if (tier.lockedDiamond) return "🔒";
  if (tier.tier === "diamond") return "💎";
  if (tier.tier === "gold") return "🥇";
  if (tier.tier === "silver") return "🥈";
  if (tier.tier === "bronze") return "🥉";
  return "⚪";
}

function aggregateByAgent(rows) {
  const map = new Map();
  for (const row of rows) {
    const name = row.agent || "Unknown";
    if (!map.has(name)) {
      map.set(name, {
        agent: name,
        totalPoints: 0,
        closedCases: 0,
        coded: 0,
        paidExam: 0,
        meetTheManager: 0,
        presentation: 0,
        appointments: 0,
        approaches: 0,
        closingBonus: 0,
        examBonus: 0,
        totalBonus: 0,
        agentType: row.agentType || "Agent",
        entries: 0,
        breakdown: {},
        rawTotals: {
          approaches: 0,
          appointments: 0,
          presentation: 0,
          bybTableTop: 0,
          meetTheManager: 0,
          paidExam: 0,
          coded: 0,
          recruitment: 0,
          closedCases: 0,
          training: 0,
          branding: 0,
          teamEngagement: 0,
        },
      });
    }
    const a = map.get(name);
    a.entries += 1;
    a.agentType = row.agentType || a.agentType || "Agent";
    a.totalPoints += Number(row.totalPoints || 0);
    a.closedCases += Number(row.closedCases || 0);
    a.coded += Number(row.coded || 0);
    a.paidExam += Number(row.paidExam || 0);
    a.meetTheManager += Number(row.meetTheManager || 0);
    a.presentation += Number(row.presentation || 0);
    a.appointments += Number(row.appointments || 0);
    a.approaches += Number(row.approaches || 0);
    a.closingBonus += Number(row.bonuses?.closingBonus || 0);
    a.examBonus += Number(row.bonuses?.examBonus || 0);
    a.totalBonus += Number(row.bonuses?.totalBonus || 0);
    for (const key of Object.keys(a.rawTotals)) {
      a.rawTotals[key] += Number(row[key] || 0);
    }
    for (const [k, v] of Object.entries(row.pointsBreakdown || {})) {
      a.breakdown[k] = (a.breakdown[k] || 0) + Number(v || 0);
    }
  }

  return [...map.values()].map((a) => {
    const productivity = getProductivity(a.totalPoints);
    const hasRecruit = a.meetTheManager > 0 && a.paidExam > 0;
    const hasDiamondRequirement = a.closedCases > 0 || hasRecruit;
    return {
      ...a,
      productivity,
      hasDiamondRequirement,
      coachInsight: getCoachInsight(a),
    };
  });
}

function getCoachInsight(a) {
  if (a.totalPoints === 0) return "Inactive this period";
  if (a.approaches >= 30 && a.appointments <= 2) return "Needs help converting approaches to appointments";
  if (a.presentation >= 5 && a.closedCases === 0) return "Needs closing support";
  if (a.meetTheManager >= 2 || a.paidExam >= 2 || a.coded >= 1) return "Recruitment-focused";
  if (a.totalPoints >= 1000) return "Top performer";
  return "Active — continue monitoring pipeline";
}

function labelize(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

createRoot(document.getElementById("root")).render(<App />);
