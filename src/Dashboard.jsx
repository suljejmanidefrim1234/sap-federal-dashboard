import bundledRfp from './data/rfp-links.json';
import React,{useState,useMemo} from 'react';
import Accounts from './views/Accounts';
import Profile from './views/Profile';
import Signals from './views/Signals';
import Market from './views/Market';
import {Methodology} from './components/Records';
import {prepareSnapshot,aggregateByDepartment,scope,SOURCE_URL,formatDate,today} from './data/api';
import bundledSnapshot from './data/snapshot.json';
export default function Dashboard(){
  const rfp=window.__DASHBOARD_RFP__||bundledRfp;
  const [data,setData]=useState(()=>prepareSnapshot(window.__DASHBOARD_SNAPSHOT__||bundledSnapshot,rfp)),[view,setView]=useState('accounts'),[selected,setSelected]=useState(null),[importError,setImportError]=useState(''),[imported,setImported]=useState(false);
  const {snapshot,contracts,directory}=data,available=snapshot.status==='ready';
  const schedule=import.meta.env.VITE_REFRESH_SCHEDULE;
  const automaticRefresh=!!schedule&&window.location.protocol!=='file:'&&!imported;
  const departments=useMemo(()=>aggregateByDepartment(contracts,directory),[contracts,directory]);
  const dates={...scope(),end:snapshot.asOf&&snapshot.asOf<today()?snapshot.asOf:today()};
  const select=account=>{setSelected(departments.find(d=>d.code===account.code)||account);setView('accounts');window.scrollTo({top:0});};
  async function load(event){const file=event.target.files?.[0];if(!file)return;try{const next=prepareSnapshot(JSON.parse(await file.text()),rfp);setData(next);setImported(true);setSelected(null);setImportError('');setView('accounts');}catch(e){setImportError('Import failed: '+e.message);}event.target.value='';}
  return <div className="app"><aside className="sidebar"><div className="brand"><div className="brand-mark">F</div><div>Federal accounts<small>SAP account planning</small></div></div><div className="sidebar-caption">CANADIAN PUBLIC SECTOR</div><nav aria-label="Main navigation">{[['accounts','Accounts','◫'],['renewals','Renewal signals','◷'],['market','Market overview','▥']].map(([key,label,icon])=><button key={key} className={'nav-btn '+(view===key?'active':'')} aria-current={view===key?'page':undefined} onClick={()=>{setView(key);setSelected(null);window.scrollTo({top:0});}}><span aria-hidden="true">{icon}</span>{label}</button>)}</nav><div className="sidebar-bottom"><span className="status-dot"/> Public records · research evidence<p>Plan across SAP’s portfolio.<br/>Verify every product and opportunity signal.</p><a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Government data source ↗</a></div></aside>
  <div className="workspace"><header className="topbar"><span>Account planning / {selected?selected.name:view==='accounts'?'Accounts':view==='renewals'?'Renewal signals':'Market overview'}</span><label className="btn btn-secondary import-button">Import snapshot<input type="file" accept=".json,application/json" aria-label="Import government snapshot" onChange={load}/></label></header><main className="main">
  {!available&&<div className="data-status" role="status"><strong>Government snapshot unavailable</strong><p>{snapshot.message}</p><span>All supplier activity is Unknown. No real contract records or market totals are shown.</span></div>}
  {available&&<div className="snapshot-strip">Snapshot · {contracts.length.toLocaleString()} tracked contract groups · {snapshot.records.length.toLocaleString()} source disclosures · {snapshot.complete?'Complete eligible tracked subset from the downloaded resource':'Partial snapshot — coverage is incomplete'} · {snapshot.asOf}</div>}
  {available&&snapshot.changes?.comparisonAvailable&&<div className="lookup-info"><strong>{snapshot.changes.newDisclosureCount} newly observed tracked disclosures · {snapshot.changes.changedDisclosureCount} changed disclosures</strong><p>Compared with the previous successful refresh. Newly observed records may be amendments or delayed publications, not newly signed contracts. Use “Accounts with new disclosures” to open the supporting records.</p></div>}
  {available&&snapshot.lastRefreshError&&<div className="data-status"><strong>Latest refresh attempt failed; showing the earlier snapshot.</strong><p>{snapshot.lastRefreshError}</p></div>}
  {available&&<div className="snapshot-strip rfp-status">Tender/RFP enrichment: {rfp.status==='ready'?contracts.filter(c=>c.rfpMatches?.length).length+' contract groups with research links':'Unavailable'} · {rfp.refreshedAt?'Refreshed '+new Date(rfp.refreshedAt).toLocaleString('en-CA',{timeZone:'America/Toronto'})+' Eastern':'No successful refresh'} · Product purchases need verification.</div>}
  {rfp.lastRefreshError&&<div className="data-status"><strong>RFP enrichment refresh failed; earlier matching records may remain available.</strong><p>{rfp.lastRefreshError}</p></div>}
  {rfp.warning&&<div className="data-status"><p>{rfp.warning}</p></div>}
  {importError&&<div className="error-panel" role="alert">{importError}</div>}
  {view==='accounts'&&(selected?<Profile key={selected.code} account={selected} contracts={contracts.filter(c=>c.owner_org===selected.code)} onBack={()=>setSelected(null)} available={available}/>:<Accounts departments={departments} onSelectAccount={select} available={available} directoryComplete={snapshot.directoryComplete}/>)}
  {view==='renewals'&&<Signals contracts={contracts} departments={departments} available={available}/>} {view==='market'&&<Market contracts={contracts} available={available} onSelectAccount={select}/>}
  <Methodology/>
  </main><footer className="footer"><div><a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Government of Canada · Proactive Publication — Contracts over $10,000 ↗</a><span>{available?'Snapshot coverage':'Requested coverage'}: {formatDate(dates.start)} – {formatDate(dates.end)} · reported total &gt; $10,000</span></div><div><strong>{automaticRefresh?'Scheduled source refresh · '+schedule:'Snapshot · not automatically refreshed'}</strong>{automaticRefresh&&<span>Reload the page for the latest published snapshot.</span>}<span>Last successful refresh: {snapshot.refreshedAt?new Date(snapshot.refreshedAt).toLocaleString('en-CA',{timeZone:'America/Toronto'})+' Eastern':'Never — no records loaded'}</span>{snapshot.lastAttemptAt&&<span>Last collection attempt: {snapshot.lastAttemptAt}</span>}</div></footer></div></div>;
}
