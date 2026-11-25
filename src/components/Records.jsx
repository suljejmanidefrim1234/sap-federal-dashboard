import React, {useState} from 'react';
import {formatCurrency,formatDate} from '../data/api';
import {SUPPLIER_GROUPS} from '../data/suppliers';
export function Badge({group,children}) {return <span className={'badge '+({SAP:'badge-sap',COMPETITORS:'badge-competitor',SYSTEMS_INTEGRATORS:'badge-si'}[group]||'badge-neutral')}>{children||SUPPLIER_GROUPS[group]?.name}</span>;}
export function Pagination({page,setPage,count,size=5}) {
  const pages=Math.max(1,Math.ceil(count/size));
  if(count<=size)return null;
  return <div className="pagination"><button className="btn btn-secondary" disabled={page===0} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page+1} of {pages} · {count} results</span><button className="btn btn-secondary" disabled={page>=pages-1} onClick={()=>setPage(page+1)}>Next</button></div>;
}
export function Indicators({contract:c}) {return <div className="indicators">{c.isAmendment&&<Badge>Amendment indicator</Badge>}{c.hasOptionMention&&<Badge>Option / extension mention</Badge>}{c.instrument_type==='SOSA'&&<Badge>Standing offer / supply arrangement</Badge>}{c.ambiguousLatest&&<Badge>Same-date disclosures · verify order</Badge>}</div>;}
export function Disclosure({contract:c}) {return <article className="disclosure">
  <div className="contract-header"><a className="contract-link" href={c.sourceUrl} target="_blank" rel="noopener noreferrer">{c.reference_number||'Government dataset'} ↗</a><strong title="Reported total contract value, CAD">{formatCurrency(c.contractValue,true)}</strong></div>
  <p>{c.description}</p>{c.newInRefresh&&<Badge>New in latest refresh</Badge>}<Indicators contract={c}/>
  <dl className="contract-meta"><div><dt>Contract / award date</dt><dd>{formatDate(c.contractDate)}</dd></div><div><dt>Recorded end / delivery</dt><dd>{formatDate(c.endDate)}</dd></div><div><dt>Procurement ID</dt><dd>{c.procurement_id||'Not reported'}</dd></div><div><dt>Vehicle number</dt><dd>{c.standing_offer_number||'Not reported'}</dd></div></dl>
  <div className="small muted">Reported supplier: {c.vendor_name} · {c.instrument_type==='A'?'Amendment instrument':c.instrument_type==='SOSA'?'Standing offer / supply arrangement':c.instrument_type||'Instrument not reported'}{c.amendmentValue!==0&&' · Amendment value '+formatCurrency(c.amendmentValue,true)}</div>
  {c.comments&&<details className="comments"><summary>Disclosed comments</summary><p>{c.comments}</p></details>}
  <div className="keyword-list">{c.solutionAreas.map(a=><span key={a.area}>{a.name}: {a.keywords.join(', ')} · Needs verification</span>)}</div>
  </article>;}
export function ContractCard({contract:c}) {
  const [page,setPage]=useState(0); const disclosures=c.disclosures||[c];
  return <div className="contract-card" data-testid="contract-card"><div className="group-meta">{disclosures.length} disclosure{disclosures.length===1?'':'s'} · {c.groupingMethod||'Individual disclosure'} {c.ambiguousLatest&&<Badge>Same-date disclosures · verify order</Badge>}</div>
    {disclosures.slice(page*3,page*3+3).map(d=><Disclosure key={d.id} contract={d}/>)}
    {disclosures.length>1&&<><p className="small muted">Group total: {formatCurrency(c.contractValue,true)} from the most recent in-scope disclosure. Repeated total values are not added.</p><Pagination page={page} setPage={setPage} count={disclosures.length} size={3}/></>}
  </div>;
}
export function Methodology() {return <details className="methodology"><summary>How to interpret this data</summary><div>
  <p><strong>Supplier records are research evidence.</strong> A supplier match does not establish installed products, current usage, an SAP partnership or a buying opportunity. Software vendors and consultants may supply unrelated products or services. Qualtrics is tracked as a separate software vendor; historical ownership is not reconstructed. IBM can supply both software and services.</p>
  <p><strong>Grouping:</strong> exact department + normalized tracked supplier + exact procurement ID, falling back to the disclosure reference; records without either remain separate. Shared vehicle numbers never merge contracts. Supplier aliases are matched as whole words. Consortia, resellers, spelling variants, reused IDs and changed identifiers can cause missed or incorrect grouping. No fuzzy matching is used.</p>
  <p><strong>Values and dates:</strong> use the total value in the most recent in-scope disclosure for each group, without adding amendment totals. Same-date ties use reporting period then reference number, and are flagged. The award-year chart uses the earliest observed in-scope contract date. An amendment date may be reported instead of the original award date. Groups may start before the scope, omit amendments, or contain missing end dates; no historical date or value is inferred.</p>
  <p>The source field is <strong>Contract Period End Date or Delivery Date</strong>. End dates, amendments and option mentions are signals for research, not confirmed renewals or re-competes. Missing solution keywords mean <strong>Unknown</strong>, never confirmed whitespace. Keywords are extracted from disclosed descriptions and comments, not inferred from supplier names.</p>
  <p>Only records with valid reported contract dates in the displayed range and reported total value strictly greater than $10,000 enter the snapshot. The source represents disclosed contracts, not all procurement or confirmed spending. All values are CAD. Direct disclosure link formats are checked against the government’s published routes; destination availability still needs verification.</p>
  </div></details>;}
