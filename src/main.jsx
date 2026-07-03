import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { calculatePoints, getClosedCaseBonus, getPaidExamBonus, getProductivity, getRewardTier, WEEKLY_TARGET } from "./points";
import "./style.css";

const ACTIVITIES = [
  ["approaches", "Approaches"],
  ["appointments", "Appointments Set"],
  ["presentation", "Financial Planning / Presentation"],
  ["bybTableTop", "BYB / Table Top"],
  ["closedCases", "Closed Cases"],
  ["meetTheManager", "Meet The Manager"],
  ["paidExam", "Paid Exam"],
  ["coded", "Coded Recruits"],
  ["branding", "Branding Posts (max 3 pts/day)"],
  ["training", "Training"],
  ["teamEngagement", "Team Engagement"],
];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  agent: "",
  agentType: "Agent",
  approaches: 0,
  appointments: 0,
  presentation: 0,
  bybTableTop: 0,
  closedCases: 0,
  recruitment: 0,
  meetTheManager: 0,
  paidExam: 0,
  coded: 0,
  branding: 0,
  training: 0,
  teamEngagement: 0,
  apeAmount: 0,
  paidExamType: "single",
  notes: "",
};

function money(n) { return `₱${Number(n || 0).toLocaleString()}`; }
function num(n) { return Number(n || 0).toLocaleString(); }
function startOfWeek(date = new Date()) { const d = new Date(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }
function startOfMonth(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0,10); }

function Home() {
  return <main className="hero">
    <div className="brand"><div className="logo">TJ</div><h1>TEAM JENNA ACTIVITY HUB</h1><p>Simple activity tracking for agents and manager dashboard.</p></div>
    <div className="cards">
      <a className="card red" href="#/form"><h2>Agent Activity Form</h2><p>Submit daily activities, points, sales, and recruitment.</p></a>
      <a className="card blue" href="#/admin"><h2>Manager Dashboard</h2><p>PIN protected summary, rankings, bonuses, and history.</p></a>
    </div>
  </main>
}

function AgentForm() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const points = calculatePoints(form);
  const closedBonus = Number(form.closedCases || 0) * getClosedCaseBonus(form.apeAmount);
  const examBonus = Number(form.paidExam || 0) * getPaidExamBonus(form.paidExamType);

  const change = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.agent.trim()) return setMessage("Please enter agent name.");
    setSaving(true); setMessage("");
    const computed = calculatePoints(form);
    const payload = {
      ...form,
      agent: form.agent.trim(),
      apeAmount: Number(form.apeAmount || 0),
      closedBonus: Number(form.closedCases || 0) * getClosedCaseBonus(form.apeAmount),
      paidExamBonus: Number(form.paidExam || 0) * getPaidExamBonus(form.paidExamType),
      points: computed.total,
      breakdown: computed.breakdown,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await addDoc(collection(db, "activities"), payload);
    setMessage(`Submitted successfully! Total points: ${computed.total}`);
    setForm({ ...emptyForm, agent: form.agent, agentType: form.agentType });
    setSaving(false);
  }

  return <main className="page"><Nav/><section className="panel">
    <h1>Agent Activity Form</h1><p className="muted">Encode your daily activities. Points and bonuses compute automatically.</p>
    <form onSubmit={submit} className="form">
      <div className="grid"><label>Agent Name<input value={form.agent} onChange={e=>change("agent", e.target.value)} placeholder="Your name" /></label><label>Date<input type="date" value={form.date} onChange={e=>change("date", e.target.value)} /></label><label>Agent Type<select value={form.agentType} onChange={e=>change("agentType", e.target.value)}><option>Agent</option><option>Rookie</option><option>AUM</option><option>UM</option></select></label></div>
      <h3>Activities</h3><div className="grid activities">{ACTIVITIES.map(([key,label]) => <label key={key}>{label}<input type="number" min="0" value={form[key]} onChange={e=>change(key, Number(e.target.value))}/></label>)}</div>
      <h3>Bonus Fields</h3><div className="grid"><label>Total APE Amount for Closed Case/s<input type="number" min="0" value={form.apeAmount} onChange={e=>change("apeAmount", Number(e.target.value))}/></label><label>Paid Exam Type<select value={form.paidExamType} onChange={e=>change("paidExamType", e.target.value)}><option value="single">Single</option><option value="dual">Dual</option></select></label></div>
      <label>Notes<textarea value={form.notes} onChange={e=>change("notes", e.target.value)} placeholder="Optional notes" /></label>
      <div className="summaryBox"><b>Total Points: {points.total}</b><span>Closed Case Bonus: {money(closedBonus)}</span><span>Paid Exam Bonus: {money(examBonus)}</span></div>
      <button className="primary" disabled={saving}>{saving ? "Submitting..." : "Submit Activity"}</button>{message && <p className="msg">{message}</p>}
    </form>
  </section></main>
}

function Nav(){ return <nav className="nav"><a href="#/">Home</a><a href="#/form">Agent Form</a><a href="#/admin">Manager</a></nav> }

function AdminGate({children}) {
  const [ok, setOk] = useState(sessionStorage.getItem("tj_admin") === "yes");
  const [pin, setPin] = useState("");
  const managerPin = import.meta.env.VITE_MANAGER_PIN || "246810";
  if (ok) return children;
  return <main className="page"><Nav/><section className="panel small"><h1>Manager Access</h1><p className="muted">Enter manager PIN to view dashboard.</p><input className="pin" type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Manager PIN"/><button className="primary" onClick={()=>{ if(pin===managerPin){sessionStorage.setItem("tj_admin","yes"); setOk(true)} else alert("Invalid PIN")}}>Enter Dashboard</button></section></main>
}

function useActivities() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const q = query(collection(db, "activities"), orderBy("date", "desc"));
    return onSnapshot(q, snap => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);
  return items;
}

function Dashboard() {
  const rows = useActivities();
  const [from, setFrom] = useState(startOfWeek());
  const [to, setTo] = useState(new Date().toISOString().slice(0,10));
  const [agentFilter, setAgentFilter] = useState("All");
  const filtered = rows.filter(r => (!from || r.date >= from) && (!to || r.date <= to) && (agentFilter === "All" || r.agent === agentFilter));
  const agents = [...new Set(rows.map(r => r.agent).filter(Boolean))].sort();

  const totals = useMemo(() => filtered.reduce((a, r) => {
    a.points += Number(r.points || 0); a.closedCases += Number(r.closedCases || 0); a.coded += Number(r.coded || 0); a.appointments += Number(r.appointments || 0); a.presentation += Number(r.presentation || 0); a.closedBonus += Number(r.closedBonus || 0); a.examBonus += Number(r.paidExamBonus || 0); return a;
  }, {points:0, closedCases:0, coded:0, appointments:0, presentation:0, closedBonus:0, examBonus:0}), [filtered]);

  const leaderboard = useMemo(() => {
    const map = {};
    filtered.forEach(r => { const k = r.agent || "Unknown"; if(!map[k]) map[k] = {agent:k, points:0, entries:0, closedCases:0, coded:0, appointments:0, presentation:0, bonuses:0}; map[k].points += Number(r.points||0); map[k].entries += 1; map[k].closedCases += Number(r.closedCases||0); map[k].coded += Number(r.coded||0); map[k].appointments += Number(r.appointments||0); map[k].presentation += Number(r.presentation||0); map[k].bonuses += Number(r.closedBonus||0)+Number(r.paidExamBonus||0); });
    return Object.values(map).sort((a,b)=>b.points-a.points).map((a,i)=>{ const productivity = getProductivity(a.points); const tier = getRewardTier(productivity); return {...a, rank:i+1, productivity, tier}; });
  }, [filtered]);

  async function remove(id){ if(confirm("Delete this entry?")) await deleteDoc(doc(db,"activities",id)); }
  function exportCsv(){ const header = ["date","agent","points","productivity","closedCases","coded","appointments","presentation","closedBonus","paidExamBonus","notes"]; const lines = [header.join(",")].concat(filtered.map(r => header.map(h => JSON.stringify(r[h] ?? "")).join(","))); const blob = new Blob([lines.join("\n")], {type:"text/csv"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="team-jenna-activities.csv"; a.click(); URL.revokeObjectURL(url); }

  return <AdminGate><main className="page"><Nav/><section className="panel wide"><div className="dashHead"><div><h1>Manager Dashboard</h1><p className="muted">Points, productivity, bonuses, and rankings.</p></div><button className="ghost" onClick={()=>{sessionStorage.removeItem("tj_admin"); location.reload()}}>Logout</button></div>
    <div className="filters"><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Agent<select value={agentFilter} onChange={e=>setAgentFilter(e.target.value)}><option>All</option>{agents.map(a=><option key={a}>{a}</option>)}</select></label><button onClick={()=>{setFrom(startOfWeek());setTo(new Date().toISOString().slice(0,10))}}>This Week</button><button onClick={()=>{setFrom(startOfMonth(new Date()));setTo(new Date().toISOString().slice(0,10))}}>This Month</button><button onClick={exportCsv}>Export CSV</button></div>
    <div className="stats"><Stat label="Total Points" value={num(totals.points)}/><Stat label="Productivity" value={`${Math.round(getProductivity(totals.points))}%`}/><Stat label="Closed Cases" value={num(totals.closedCases)}/><Stat label="Coded Recruits" value={num(totals.coded)}/><Stat label="Appointments" value={num(totals.appointments)}/><Stat label="Presentations" value={num(totals.presentation)}/><Stat label="Bonuses" value={money(totals.closedBonus + totals.examBonus)}/><Stat label="Weekly Target" value={num(WEEKLY_TARGET)}/></div>
    <h2>Leaderboard</h2><div className="tableWrap"><table><thead><tr><th>Rank</th><th>Agent</th><th>Points</th><th>Productivity</th><th>Tier</th><th>Reward</th><th>Closed</th><th>Coded</th><th>Bonus</th></tr></thead><tbody>{leaderboard.map(r=><tr key={r.agent}><td>#{r.rank}</td><td>{r.agent}</td><td>{num(r.points)}</td><td>{Math.round(r.productivity)}%</td><td><span className="pill" style={{background:r.tier.color}}>{r.tier.label}</span></td><td>{money(r.tier.amount)}</td><td>{r.closedCases}</td><td>{r.coded}</td><td>{money(r.bonuses)}</td></tr>)}</tbody></table></div>
    <h2>Activity History</h2><div className="tableWrap"><table><thead><tr><th>Date</th><th>Agent</th><th>Points</th><th>Closed</th><th>Coded</th><th>APE</th><th>Closed Bonus</th><th>Exam Bonus</th><th>Notes</th><th></th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{r.date}</td><td>{r.agent}</td><td>{r.points}</td><td>{r.closedCases}</td><td>{r.coded}</td><td>{money(r.apeAmount)}</td><td>{money(r.closedBonus)}</td><td>{money(r.paidExamBonus)}</td><td>{r.notes}</td><td><button className="danger" onClick={()=>remove(r.id)}>Delete</button></td></tr>)}</tbody></table></div>
  </section></main></AdminGate>
}
function Stat({label,value}){return <div className="stat"><span>{label}</span><b>{value}</b></div>}
function App(){ const route = location.hash || "#/"; if(route.startsWith("#/form")) return <AgentForm/>; if(route.startsWith("#/admin")) return <Dashboard/>; return <Home/>; }

createRoot(document.getElementById("root")).render(<App />);
