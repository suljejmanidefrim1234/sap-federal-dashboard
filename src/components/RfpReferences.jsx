import React from 'react';
import {formatDate} from '../data/api';

export default function RfpReferences({matches=[]}) {
  if(!matches.length)return <p className="rfp-empty">No public tender/RFP linked in the loaded enrichment. Check disclosed text and verify product details.</p>;
  const notices=new Set(matches.flatMap(m=>m.link.tenders.map(t=>t.url))).size;
  return <details className="rfp-references"><summary>Related tender / RFP evidence · {notices} notice{notices===1?'':'s'}</summary><div>
    {matches.map(match=><section className="rfp-match" key={match.linkId}>
      <div className="rfp-match-heading"><strong>{match.link.title}</strong><span className="badge badge-neutral">{match.confidence}</span></div>
      <p className="small muted">Supplier: {match.link.supplier} · Award: {formatDate(match.link.awardDate)} · Contract: {match.link.contractNumber||'Not reported'} · Solicitation: {match.link.solicitationNumber||'Not reported'}</p>
      <a href={match.link.sourceUrl} target="_blank" rel="noopener noreferrer" className="contract-link">Open {match.link.sourceKind.toLowerCase()} source ↗</a>
      {match.flags?.map(flag=><p className="small rfp-warning" key={flag}>{flag}</p>)}
      {!match.allowAreas&&<p className="small rfp-warning">Research link only. This match does not populate solution-area fields.</p>}
      <div className="rfp-notices">{match.link.tenders.length?match.link.tenders.map(tender=><div key={tender.url}>
        <a className="rfp-link" href={tender.url} target="_blank" rel="noopener noreferrer">{tender.noticeType||'Tender / RFP'} · {tender.number} ↗</a><p className="small">{tender.title}</p><p className="small muted">Published: {formatDate(tender.publishedDate)} · Closing: {formatDate(tender.closingDate)} · {tender.linkStatus}</p>
        {tender.portalUrl&&<p className="small"><a href={tender.portalUrl} target="_blank" rel="noopener noreferrer">Original procurement portal ↗</a> · Some documents may require an account.</p>}
        {tender.documents?.map(document=><p className="small" key={document.url}><a href={document.url} target="_blank" rel="noopener noreferrer">{document.name} ↗</a> · {document.status}</p>)}
      </div>):<p className="small muted">No corresponding public tender found in the scanned archives. The procurement may be non-competitive or its documents may be unavailable.</p>}</div>
      <p className="small muted">Purchase context from public text: {match.link.purchaseTypes.join(', ')}. Product mentions do not confirm installed usage or the selected licence line items.</p>
      {match.link.evidence.length>0&&<details className="rfp-quotes"><summary>Product and solution evidence · {match.link.evidence.length} cited excerpts</summary>{match.link.evidence.map((e,index)=><div className="rfp-evidence" key={index}>
        <strong>{e.product||'Solution-area keyword: '+e.keyword}</strong><span className="badge badge-neutral">{e.basis} · Needs verification</span>{e.cached&&<p className="small rfp-warning">Cached from an earlier verified document check{e.verifiedAt?' on '+new Date(e.verifiedAt).toLocaleDateString('en-CA',{timeZone:'America/Toronto'}):''}; verify the current document.</p>}<blockquote>{e.quote}</blockquote><a href={e.url} target="_blank" rel="noopener noreferrer">{e.kind}{e.page?' · page '+e.page:''} ↗</a>
      </div>)}</details>}
    </section>)}
  </div></details>;
}
