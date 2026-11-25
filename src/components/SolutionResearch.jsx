import React from 'react';
import {SOLUTION_AREAS} from '../data/suppliers';
export default function SolutionResearch({contracts,area,setArea}){
  return <section className="card"><div className="card-header"><h2>Solution-area research</h2></div><div className="card-body"><p className="small muted">Disclosures, linked awards/RFPs and available attachments supply research evidence. Product mentions and skills requirements need verification. Unknown is not confirmed whitespace.</p><div className="solution-grid">
  {Object.entries(SOLUTION_AREAS).map(([key,config])=>{
    const supporting=contracts.filter(c=>c.solutionAreas.some(a=>a.area===key));
    const evidence=supporting.flatMap(c=>c.solutionAreas.find(a=>a.area===key)?.rfpEvidence||[]);
    const sap=supporting.some(c=>c.supplierGroup==='SAP'),competitor=supporting.some(c=>c.supplierGroup==='COMPETITORS');
    const sapProduct=evidence.some(e=>e.productGroup==='SAP'),competitorProduct=evidence.some(e=>e.productGroup==='COMPETITORS');
    const products=[...new Set(evidence.map(e=>e.product).filter(Boolean))];
    const possible=evidence.some(e=>e.matchConfidence?.startsWith('Possible'));
    let text='Unknown';
    if(evidence.length)text=(sapProduct&&competitorProduct?'SAP / competitor product mentions':sapProduct?'SAP product mention':competitorProduct?'Competitor product mention':'Linked RFP area evidence')+(possible?' · Possible award link':'')+' · Needs verification';
    else if(sap||competitor)text=[sap?'SAP supplier + keyword':null,competitor?'Competitor supplier + keyword':null].filter(Boolean).join(' · ')+' · Needs verification';
    else if(supporting.length)text='SI keywords · Needs verification';
    const css=sap||sapProduct?'solution-sap':competitor||competitorProduct?'solution-competitor':'solution-unknown';
    return <button key={key} className={'solution-item '+(area===key?'selected ':'')+css} disabled={!supporting.length} onClick={()=>setArea(area===key?'':key)}><span className="solution-label">{config.name}</span><span className="solution-status">{text}</span>{products.length>0&&<span className="solution-status"><strong>{products.slice(0,3).join(', ')}{products.length>3?' + '+(products.length-3)+' more':''}</strong></span>}{evidence.length>0&&<span className="solution-status">Supplier records: {[sap?'SAP':null,competitor?'Competitor':null,supporting.some(c=>c.supplierGroup==='SYSTEMS_INTEGRATORS')?'Integrator':null].filter(Boolean).join(', ')}</span>}{supporting.length>0&&<span className="support-link">Open {supporting.length} supporting group{supporting.length===1?'':'s'} →</span>}</button>;
  })}</div></div></section>;
}
