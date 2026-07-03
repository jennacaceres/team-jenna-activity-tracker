import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {initializeApp} from 'firebase/app';
import {getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp, query, orderBy} from 'firebase/firestore';
import './style.css';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const MANAGER_PIN = import.meta.env.VITE_MANAGER_PIN || '246810';

export const POINT_VALUES = {
  approaches: 1,
  appointments: 5,
  presentation: 20,
  bybTableTop: 20,
  closedCases: 200,
  recruitment: 0,
  meetTheManager: 50,
  paidExam: 50,
  coded: 100,
  branding: 1,
  training: 5,
  teamEngagement: 1,
};

const BRANDING_MAX_PER_DAY = 3;
const WEEKLY_TARGET = 500;

const activityFields = [
  ['approaches', 'Approaches', POINT_VALUES.approaches],
  ['appointments', 'Appointments', POINT_VALUES.appointments],
  ['presentation', 'Presentation / Financial Planning', POINT_VALUES.presentation],
  ['bybTableTop', 'BYB / Table Top', POINT_VALUES.bybTableTop],
  ['closedCases', 'Closed Cases', POINT_VALUES.closedCases],
  ['recruitment', 'Recruitment', POINT_VALUES.recruitment],
  ['meetTheManager', 'Meet the Manager', POINT_VALUES.meetTheManager],
  ['paidExam', 'Paid Exam', POINT_VALUES.paidExam],
  ['coded', 'Coded Recruits', POINT_VALUES.coded],
  ['branding', 'Branding / Social Post', POINT_VALUES.branding],
  ['training', 'Training', POINT_VALUES.training],
  ['teamEngagement', 'Team Engagement', POINT_VALUES.teamEngagement],
];

function getClosedCaseBonus(apeAmount) {
  const ape = Number(apeAmount || 0);
  if (ape >= 80000) return 300;
  if (ape >= 40000) return 200;
  if (ape > 0) return 100;
  return 0;
}
function getPaidExamBonus(examType) {
  return examType === 'dual' ? 300 : 200;
}
function getProductivity(points) {
  return (Number(points || 0) / WEEKLY_TARGET) * 100;
}
function getRewardTier(productivityPercent) {
  if (productivityPercent >= 150) return {label:'Diamond', amount:500};
  if (productivityPercent >= 71) return {label:'Gold', amount:300};
  if (productivityPercent >= 51) return {label:'Silver', amount:200};
  if (productivityPercent >= 30) return {label:'Bronze', amount:100};
  return {label:'No Reward', amount:0};
}
function calculatePoints(data) {
  const breakdown = {};
  activityFields.forEach(([key,, points]) => {
    const count = key === 'branding'
      ? Math.min(Number(data[key] || 0), BRANDING_MAX_PER_DAY)
      : Number(data[key] || 0);
    breakdown[key] = count * points;
  });
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return {breakdown, total};
}
function calculateBonuses(data) {
  const closedCaseBonus = Number(data.closedCases || 0) * getClosedCaseBonus(data.apeAmount);
  const paidExamBonus = Number(data.paidExam || 0) * getPaidExamBonus(data.paidExamType || 'single');
  return {closedCaseBonus, paidExamBonus, totalBonus: closedCaseBonus + paidExamBonus};
}

function Header(){return <div className="hero"><div className="logo">TJ</div><h1>TEAM JENNA ACTIVITY HUB</h1><p>Simple activity tracking for agents and manager dashboard.</p></div>}
function Home({setPage}){return <><Header/><div className="cards"><button onClick={()=>setPage('agent')} className="card"><b>Agent Activity Form</b><span>Submit daily activities and points</span></button><button onClick={()=>setPage('manager')} className="card gold"><b>Manager Dashboard</b><span>PIN protected summary, rankings, productivity, and bonuses</span></button></div></>}

function AgentForm(){
 const emptyCounts = Object.fromEntries(activityFields.map(([key])=>[key,0]));
 const [name,setName]=useState('');
 const [date,setDate]=useState(new Date().toISOString().slice(0,10));
 const [counts,setCounts]=useState(emptyCounts);
 const [apeAmount,setApeAmount]=useState('');
 const [paidExamType,setPaidExamType]=useState('single');
 const [notes,setNotes]=useState('');
 const [msg,setMsg]=useState('');
 const points=calculatePoints(counts);
 const bonuses=calculateBonuses({...counts, apeAmount, paidExamType});
 async function submit(e){
  e.preventDefault();
  if(!name.trim()) return setMsg('Please enter agent name.');
  const items=activityFields.map(([key,label,pointsPerUnit])=>({
    key,label,count:Number(counts[key]||0),pointsPerUnit,total:Number(points.breakdown[key]||0)
  })).filter(x=>x.count>0);
  if(!items.length) return setMsg('Please add at least one activity.');
  await addDoc(collection(db,'activities'),{
    agentName:name.trim(),date,
    ...Object.fromEntries(activityFields.map(([key])=>[key,Number(counts[key]||0)])),
    apeAmount:Number(apeAmount||0),paidExamType,items,
    breakdown:points.breakdown,totalPoints:points.total,
    closedCaseBonus:bonuses.closedCaseBonus,paidExamBonus:bonuses.paidExamBonus,totalBonus:bonuses.totalBonus,
    notes,createdAt:serverTimestamp(),submittedAt:new Date().toISOString()
  });
  setCounts(emptyCounts); setApeAmount(''); setNotes(''); setMsg('Activity submitted successfully!');
 }
 return <main><Header/><section className="panel"><h2>Agent Activity Form</h2><form onSubmit={submit}>
  <label>Agent Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name"/></label>
  <label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
  <div className="grid">{activityFields.map(([key,label,p])=><label key={key}>{label} <small>{p} pts each{key==='branding'?' • max 3/day':''}</small><input type="number" min="0" value={counts[key]} onChange={e=>setCounts({...counts,[key]:e.target.value})}/></label>)}</div>
  <label>APE Amount for Closed Case Bonus<input type="number" min="0" value={apeAmount} onChange={e=>setApeAmount(e.target.value)} placeholder="Example: 40000"/></label>
  <label>Paid Exam Type<select value={paidExamType} onChange={e=>setPaidExamType(e.target.value)}><option value="single">Single License Exam Bonus ₱200</option><option value="dual">Dual License Exam Bonus ₱300</option></select></label>
  <label>Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional notes"/></label>
  <div className="total">Points: {points.total} • Bonus: ₱{bonuses.totalBonus.toLocaleString()}</div>
  <button className="primary">Submit Activity</button>{msg&&<p className="msg">{msg}</p>}
 </form></section></main>
}

function Manager(){ const [pin,setPin]=useState(''); const [ok,setOk]=useState(sessionStorage.getItem('tj_manager')==='yes'); if(!ok) return <main><Header/><section className="panel login"><h2>Manager Access</h2><input type="password" placeholder="Enter Manager PIN" value={pin} onChange={e=>setPin(e.target.value)}/><button className="primary" onClick={()=>{if(pin===MANAGER_PIN){sessionStorage.setItem('tj_manager','yes');setOk(true)}else alert('Invalid PIN')}}>Open Dashboard</button></section></main>; return <Dashboard logout={()=>{sessionStorage.removeItem('tj_manager');setOk(false)}}/> }

function Dashboard({logout}){ const [rows,setRows]=useState([]); const [agent,setAgent]=useState(''); const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
 useEffect(()=>onSnapshot(query(collection(db,'activities'),orderBy('submittedAt','desc')),snap=>setRows(snap.docs.map(d=>({id:d.id,...d.data()})))),[]);
 const filtered=rows.filter(r=>(!agent||r.agentName?.toLowerCase().includes(agent.toLowerCase()))&&(!month||r.date?.startsWith(month)));
 const totals=filtered.reduce((a,r)=>{
   a.points+=Number(r.totalPoints||0); a.bonus+=Number(r.totalBonus||0); a.entries++; 
   activityFields.forEach(([key])=>a[key]=(a[key]||0)+Number(r[key]||0));
   return a;
 },{points:0,bonus:0,entries:0});
 const productivity=getProductivity(totals.points); const reward=getRewardTier(productivity);
 const leaderboard=useMemo(()=>Object.values(filtered.reduce((acc,r)=>{
   let k=r.agentName||'Unknown'; acc[k]=acc[k]||{name:k,points:0,bonus:0,entries:0,closedCases:0,coded:0,appointments:0,presentation:0};
   acc[k].points+=Number(r.totalPoints||0); acc[k].bonus+=Number(r.totalBonus||0); acc[k].entries++;
   acc[k].closedCases+=Number(r.closedCases||0); acc[k].coded+=Number(r.coded||0); acc[k].appointments+=Number(r.appointments||0); acc[k].presentation+=Number(r.presentation||0);
   acc[k].productivity=getProductivity(acc[k].points); acc[k].tier=getRewardTier(acc[k].productivity).label;
   return acc;
 },{})).sort((a,b)=>b.points-a.points),[filtered]);
 async function remove(id){ if(confirm('Delete this entry?')) await deleteDoc(doc(db,'activities',id)); }
 return <main><Header/><section className="panel"><div className="dashHead"><h2>Manager Dashboard</h2><button onClick={logout}>Logout</button></div>
 <div className="filters"><input placeholder="Filter agent" value={agent} onChange={e=>setAgent(e.target.value)}/><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div>
 <div className="stats"><div><b>{totals.entries}</b><span>Submissions</span></div><div><b>{totals.points}</b><span>Total Points</span></div><div><b>{Math.round(productivity)}%</b><span>Productivity</span></div><div><b>{reward.label}</b><span>Reward Tier ₱{reward.amount}</span></div><div><b>₱{totals.bonus.toLocaleString()}</b><span>Total Bonus</span></div><div><b>{leaderboard.length}</b><span>Active Agents</span></div></div>
 <h3>Leaderboard</h3><table><thead><tr><th>Rank</th><th>Agent</th><th>Points</th><th>Productivity</th><th>Tier</th><th>Bonus</th><th>Closed</th><th>Coded</th></tr></thead><tbody>{leaderboard.map((x,i)=><tr key={x.name}><td>{i+1}</td><td>{x.name}</td><td>{x.points}</td><td>{Math.round(x.productivity)}%</td><td>{x.tier}</td><td>₱{x.bonus.toLocaleString()}</td><td>{x.closedCases}</td><td>{x.coded}</td></tr>)}</tbody></table>
 <h3>Productivity Summary</h3><table><thead><tr><th>Metric</th><th>Total</th></tr></thead><tbody>{activityFields.map(([key,label])=><tr key={key}><td>{label}</td><td>{totals[key]||0}</td></tr>)}</tbody></table>
 <h3>Activity History</h3><div className="history">{filtered.map(r=><div className="entry" key={r.id}><b>{r.agentName}</b><span>{r.date} • {r.totalPoints} pts • ₱{Number(r.totalBonus||0).toLocaleString()} bonus</span><p>{(r.items||[]).map(i=>`${i.label||i.activity}: ${i.count}`).join(' | ')}</p>{r.notes&&<em>{r.notes}</em>}<button onClick={()=>remove(r.id)}>Delete</button></div>)}</div></section></main>}

function App(){ const [page,setPage]=useState(location.hash.replace('#','')||'home'); useEffect(()=>{location.hash=page},[page]); return <><nav><button onClick={()=>setPage('home')}>Home</button><button onClick={()=>setPage('agent')}>Agent Form</button><button onClick={()=>setPage('manager')}>Manager</button></nav>{page==='agent'?<AgentForm/>:page==='manager'?<Manager/>:<Home setPage={setPage}/>}</>}

createRoot(document.getElementById('root')).render(<App/>);
