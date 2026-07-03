import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {initializeApp} from 'firebase/app';
import {getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp, query, orderBy} from 'firebase/firestore';
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
const MANAGER_PIN = import.meta.env.VITE_MANAGER_PIN || import.meta.env.MANAGER_PIN || '246810';

const activities = [
  ['Approach', 5], ['Follow-up', 5], ['Appointment Set', 20], ['Financial Planning', 30],
  ['Client Meeting', 30], ['Closed Case', 100], ['Recruitment', 50], ['Training', 10],
  ['Branding / Social Post', 10], ['Referral Asking', 15]
];

function Header(){return <div className="hero"><div className="logo">TJ</div><h1>TEAM JENNA ACTIVITY HUB</h1><p>Simple activity tracking for agents and manager dashboard.</p></div>}
function Home({setPage}){return <><Header/><div className="cards"><button onClick={()=>setPage('agent')} className="card"><b>Agent Activity Form</b><span>Submit daily activities and points</span></button><button onClick={()=>setPage('manager')} className="card gold"><b>Manager Dashboard</b><span>PIN protected summary, rankings, and history</span></button></div></>}
function AgentForm(){
 const [name,setName]=useState(''); const [date,setDate]=useState(new Date().toISOString().slice(0,10)); const [counts,setCounts]=useState(Object.fromEntries(activities.map(([a])=>[a,0]))); const [notes,setNotes]=useState(''); const [msg,setMsg]=useState('');
 const total=activities.reduce((s,[a,p])=>s+(Number(counts[a]||0)*p),0);
 async function submit(e){e.preventDefault(); if(!name.trim()) return setMsg('Please enter agent name.');
  const items=activities.map(([activity,points])=>({activity,count:Number(counts[activity]||0),pointsPerUnit:points,total:Number(counts[activity]||0)*points})).filter(x=>x.count>0);
  if(!items.length) return setMsg('Please add at least one activity.');
  await addDoc(collection(db,'activities'),{agentName:name.trim(),date,items,totalPoints:total,notes,createdAt:serverTimestamp(),submittedAt:new Date().toISOString()});
  setCounts(Object.fromEntries(activities.map(([a])=>[a,0]))); setNotes(''); setMsg('Activity submitted successfully!');
 }
 return <main><Header/><section className="panel"><h2>Agent Activity Form</h2><form onSubmit={submit}><label>Agent Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name"/></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><div className="grid">{activities.map(([a,p])=><label key={a}>{a} <small>{p} pts each</small><input type="number" min="0" value={counts[a]} onChange={e=>setCounts({...counts,[a]:e.target.value})}/></label>)}</div><label>Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional notes"/></label><div className="total">Total Points: {total}</div><button className="primary">Submit Activity</button>{msg&&<p className="msg">{msg}</p>}</form></section></main>
}
function Manager(){ const [pin,setPin]=useState(''); const [ok,setOk]=useState(sessionStorage.getItem('tj_manager')==='yes'); if(!ok) return <main><Header/><section className="panel login"><h2>Manager Access</h2><input type="password" placeholder="Enter Manager PIN" value={pin} onChange={e=>setPin(e.target.value)}/><button className="primary" onClick={()=>{if(pin===MANAGER_PIN){sessionStorage.setItem('tj_manager','yes');setOk(true)}else alert('Invalid PIN')}}>Open Dashboard</button></section></main>; return <Dashboard logout={()=>{sessionStorage.removeItem('tj_manager');setOk(false)}}/> }
function Dashboard({logout}){ const [rows,setRows]=useState([]); const [agent,setAgent]=useState(''); const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
 useEffect(()=>onSnapshot(query(collection(db,'activities'),orderBy('submittedAt','desc')),snap=>setRows(snap.docs.map(d=>({id:d.id,...d.data()})))),[]);
 const filtered=rows.filter(r=>(!agent||r.agentName?.toLowerCase().includes(agent.toLowerCase()))&&(!month||r.date?.startsWith(month)));
 const leaderboard=useMemo(()=>Object.values(filtered.reduce((acc,r)=>{let k=r.agentName||'Unknown'; acc[k]=acc[k]||{name:k,points:0,entries:0}; acc[k].points+=Number(r.totalPoints||0); acc[k].entries++; return acc;},{})).sort((a,b)=>b.points-a.points),[filtered]);
 const totals=filtered.reduce((a,r)=>{a.points+=Number(r.totalPoints||0); a.entries++; (r.items||[]).forEach(i=>a.units+=Number(i.count||0)); return a},{points:0,entries:0,units:0});
 async function remove(id){ if(confirm('Delete this entry?')) await deleteDoc(doc(db,'activities',id)); }
 return <main><Header/><section className="panel"><div className="dashHead"><h2>Manager Dashboard</h2><button onClick={logout}>Logout</button></div><div className="filters"><input placeholder="Filter agent" value={agent} onChange={e=>setAgent(e.target.value)}/><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div><div className="stats"><div><b>{totals.entries}</b><span>Submissions</span></div><div><b>{totals.points}</b><span>Total Points</span></div><div><b>{totals.units}</b><span>Activity Units</span></div><div><b>{leaderboard.length}</b><span>Active Agents</span></div></div><h3>Leaderboard</h3><table><thead><tr><th>Rank</th><th>Agent</th><th>Points</th><th>Entries</th></tr></thead><tbody>{leaderboard.map((x,i)=><tr key={x.name}><td>{i+1}</td><td>{x.name}</td><td>{x.points}</td><td>{x.entries}</td></tr>)}</tbody></table><h3>Activity History</h3><div className="history">{filtered.map(r=><div className="entry" key={r.id}><b>{r.agentName}</b><span>{r.date} • {r.totalPoints} pts</span><p>{(r.items||[]).map(i=>`${i.activity}: ${i.count}`).join(' | ')}</p>{r.notes&&<em>{r.notes}</em>}<button onClick={()=>remove(r.id)}>Delete</button></div>)}</div></section></main>}
function App(){ const [page,setPage]=useState(location.hash.replace('#','')||'home'); useEffect(()=>{location.hash=page},[page]); return <><nav><button onClick={()=>setPage('home')}>Home</button><button onClick={()=>setPage('agent')}>Agent Form</button><button onClick={()=>setPage('manager')}>Manager</button></nav>{page==='agent'?<AgentForm/>:page==='manager'?<Manager/>:<Home setPage={setPage}/>}</>}

createRoot(document.getElementById('root')).render(<App/>);
