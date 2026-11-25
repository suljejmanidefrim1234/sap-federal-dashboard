import { classifyVendor, identifySolutionAreas, normalizeText } from './suppliers.js';
export const RESOURCE_ID = 'fac950c0-00d5-4ec1-a4d3-9cbebf98a305';
export const SOURCE_URL = 'https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b/resource/' + RESOURCE_ID;
export const API_URL = 'https://open.canada.ca/data/api/3/action/datastore_search';
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()); }
export function scope(asOf=today()) { return { start:(Number(asOf.slice(0,4))-5)+'-01-01', end:asOf }; }
export function validDate(value) {
  const date=String(value || '').slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date ? date : null;
}
const money=value=>{const n=Number(String(value??'').replace(/[$,\s]/g,''));return Number.isFinite(n)?n:0;};
export function inScope(record,asOf=today()) {
  const dates=scope(asOf),date=validDate(record.contract_date);
  return !!date && date>=dates.start && date<=dates.end && money(record.contract_value)>10000;
}
export function sourceLink(r) {
  return r.owner_org && r.reference_number ? 'https://search.open.canada.ca/contracts/record/'+encodeURIComponent(r.owner_org)+','+encodeURIComponent(r.reference_number) : SOURCE_URL;
}
export function enrichContract(record) {
  const supplier=classifyVendor(record.vendor_name);
  const text=[record.description_en,record.description_fr,record.comments_en,record.comments_fr,record.additional_comments_en,record.additional_comments_fr].filter(Boolean).join(' ');
  const amendmentValue=money(record.amendment_value);
  return {...record,id:record.owner_org+':'+(record.reference_number||record._id||JSON.stringify(record)),
    supplierName:supplier?.name||record.vendor_name||'Undisclosed supplier',supplierGroup:supplier?.group||null,supplierGroupColor:supplier?.color,
    solutionAreas:identifySolutionAreas(text),contractDate:validDate(record.contract_date),endDate:validDate(record.delivery_date),contractValue:money(record.contract_value),amendmentValue,
    isAmendment:record.instrument_type==='A'||amendmentValue!==0||/\b(amendment|amended|avenant|modification)\b/i.test(text),
    hasOptionMention:/\b(options?|optional|extension|extend|renewal|renew|renouvellement|prolongation)\b/i.test(text),
    awardYear:Number(String(record.contract_date).slice(0,4)),sourceUrl:sourceLink(record),
    description:record.description_en||record.description_fr||'Description not reported',
    comments:[record.comments_en||record.comments_fr,record.additional_comments_en||record.additional_comments_fr].filter(Boolean).join(' · '),
    departmentName:String(record.owner_org_title||record.owner_org||'Unknown department').split(' | ')[0]};
}
const identifier=value=>String(value||'').trim().toUpperCase();
const usableID=value=>value && !['NA','N/A','NONE','UNKNOWN','0','-','NOT APPLICABLE'].includes(identifier(value));
// Keep exact procurement identifiers; never join contracts by shared vehicles.
export function groupContracts(records) {
  const groups=new Map();
  for(const record of records) {
    const r=record.solutionAreas?record:enrichContract(record);
    const method=usableID(r.procurement_id)?'Procurement ID':usableID(r.reference_number)?'Disclosure reference':'Ungrouped';
    const key=JSON.stringify([r.owner_org,normalizeText(r.supplierName),method,identifier(method==='Procurement ID'?r.procurement_id:method==='Disclosure reference'?r.reference_number:r.id)]);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
  }
  return [...groups.entries()].map(([id,disclosures])=>{
    const unique=[...new Map(disclosures.map(d=>[d.id,d])).values()].sort((a,b)=>(b.contractDate||'').localeCompare(a.contractDate||'')||String(b.reporting_period||'').localeCompare(String(a.reporting_period||''))||String(b.reference_number||'').localeCompare(String(a.reference_number||'')));
    const latest=unique[0],firstDate=[...unique].sort((a,b)=>a.contractDate.localeCompare(b.contractDate))[0].contractDate;
    return {...latest,id,disclosures:unique,groupingMethod:JSON.parse(id)[2],contractDate:firstDate,awardYear:Number(firstDate.slice(0,4)),latestDisclosureDate:latest.contractDate,
      isAmendment:unique.some(d=>d.isAmendment),hasOptionMention:unique.some(d=>d.hasOptionMention),newInRefresh:unique.some(d=>d.newInRefresh),
      solutionAreas:[...new Map(unique.flatMap(d=>d.solutionAreas).map(a=>[a.area,a])).values()],
      ambiguousLatest:unique.length>1&&unique[0].contractDate===unique[1].contractDate,
      vehicles:[...new Set(unique.map(d=>d.standing_offer_number).filter(Boolean))]};
  });
}
export function aggregateByDepartment(contracts,directory=[]) {
  const empty=d=>({...d,contracts:[],sapContracts:[],competitorContracts:[],siContracts:[],newContracts:[],totalValue:0,nextEndDate:null,solutionAreas:[]});
  const map=new Map(directory.map(d=>[d.code,empty(d)]));
  for(const c of contracts) {
    if(!map.has(c.owner_org))map.set(c.owner_org,empty({code:c.owner_org,name:c.departmentName}));
    const d=map.get(c.owner_org);d.contracts.push(c);d.totalValue+=c.contractValue;
    if(c.supplierGroup==='SAP')d.sapContracts.push(c);
    if(c.supplierGroup==='COMPETITORS')d.competitorContracts.push(c);
    if(c.supplierGroup==='SYSTEMS_INTEGRATORS')d.siContracts.push(c);
    if(c.newInRefresh)d.newContracts.push(c);
    d.solutionAreas=[...new Set([...d.solutionAreas,...c.solutionAreas.map(a=>a.area)])];
    if(c.endDate&&c.endDate>=today()&&(!d.nextEndDate||c.endDate<d.nextEndDate))d.nextEndDate=c.endDate;
  }
  return [...map.values()].sort((a,b)=>b.contracts.length-a.contracts.length||a.name.localeCompare(b.name));
}
export function aggregateBySupplier(contracts) {
  const map=new Map();for(const c of contracts){const name=c.supplierName;if(!map.has(name))map.set(name,{name,group:c.supplierGroup,contracts:[],totalValue:0});const s=map.get(name);s.contracts.push(c);s.totalValue+=c.contractValue;}
  return [...map.values()].map(s=>({...s,contractCount:s.contracts.length})).sort((a,b)=>b.totalValue-a.totalValue);
}
export function aggregateByYear(contracts) {
  const map=new Map();for(const c of contracts){if(!map.has(c.awardYear))map.set(c.awardYear,{year:c.awardYear,totalValue:0,sapValue:0,competitorValue:0,siValue:0});const y=map.get(c.awardYear);y.totalValue+=c.contractValue;const key={SAP:'sapValue',COMPETITORS:'competitorValue',SYSTEMS_INTEGRATORS:'siValue'}[c.supplierGroup];if(key)y[key]+=c.contractValue;}
  return [...map.values()].sort((a,b)=>a.year-b.year);
}
export function formatCurrency(value,full=false){return new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',notation:full?'standard':'compact',maximumFractionDigits:full?2:1}).format(value||0);}
export function formatDate(date){return date?new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date)):'Not reported';}
export function daysFromNow(date,asOf=today()){return date?Math.round((Date.parse(date)-Date.parse(asOf))/86400000):null;}
export function getUpcomingEndDates(contracts,days=365){return contracts.filter(c=>c.supplierGroup&&c.endDate&&daysFromNow(c.endDate)>=0&&daysFromNow(c.endDate)<=days).sort((a,b)=>a.endDate.localeCompare(b.endDate));}
export function getPastEndDates(contracts,days=365){return contracts.filter(c=>c.supplierGroup&&c.endDate&&daysFromNow(c.endDate)<0&&daysFromNow(c.endDate)>=-days).sort((a,b)=>b.endDate.localeCompare(a.endDate));}
// The government exposes datastore_search, but not datastore_search_sql.
function jsonp(params) {
  return new Promise((resolve,reject)=>{
    const callback='__federalLookup_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    let timer;
    function cleanup(){clearTimeout(timer);delete window[callback];script.remove();}
    window[callback]=data=>{cleanup();resolve(data);};
    script.onerror=()=>{cleanup();reject(new Error('Government lookup could not be loaded by this browser. No records were retrieved.'));};
    timer=setTimeout(()=>{cleanup();reject(new Error('Government lookup timed out. Browser cross-origin access may be unavailable. No records were retrieved.'));},25000);
    const query=new URLSearchParams(params);query.set('callback',callback);
    script.src=API_URL+'?'+query;script.referrerPolicy='no-referrer';document.head.appendChild(script);
  });
}
export async function fetchContracts({department,limit=100,scanLimit=500},fetcher=fetch){
  if(!department)throw new Error('Select a department before retrieving records.');
  const safeLimit=Number.isFinite(limit)?Math.max(1,Math.min(100,Math.trunc(limit))):100;
  const scan=Number.isFinite(scanLimit)?Math.max(1,Math.min(500,Math.trunc(scanLimit))):500;
  const params=new URLSearchParams({resource_id:RESOURCE_ID,filters:JSON.stringify({owner_org:department}),sort:'contract_date desc, _id desc',limit:String(scan),offset:'0',include_total:'true'});
  let data;
  try {
    const response=await fetcher(API_URL+'?'+params,{signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw new Error('Government API HTTP '+response.status+'.');
    const text=await response.text();
    if(!text.trim().startsWith('{'))throw new Error('Government endpoint returned a non-JSON rejection page. No records were retrieved.');
    data=JSON.parse(text);
  } catch(error) {
    // CKAN public GET APIs support JSONP on deployments without CORS headers.
    if(error instanceof TypeError && typeof document!=='undefined')data=await jsonp(params);
    else throw error;
  }
  if(!data.success||!Array.isArray(data.result?.records))throw new Error('Government API did not return a valid contract result.');
  const raw=data.result.records;
  if(raw.some(r=>r.owner_org!==department))throw new Error('The API result did not match the selected department; results were rejected.');
  const total=Number(data.result.total);
  if(!Number.isInteger(total)||total<raw.length)throw new Error('The government department result count could not be verified.');
  const eligible=raw.filter(r=>inScope(r));
  return {records:eligible.slice(0,safeLimit).map(enrichContract),total,scanned:raw.length,eligibleInSample:eligible.length,complete:raw.length===total&&eligible.length<=safeLimit,refreshedAt:new Date().toISOString()};
}
export function prepareSnapshot(snapshot){
  if(snapshot?.resourceId!==RESOURCE_ID||!Array.isArray(snapshot.records)||!Array.isArray(snapshot.departments))throw new Error('This is not a snapshot of the specified government resource.');
  if(!['ready','unavailable'].includes(snapshot.status))throw new Error('Snapshot status is invalid.');
  if(snapshot.status==='ready'&&(!validDate(snapshot.asOf)||!snapshot.refreshedAt))throw new Error('Snapshot coverage and refresh date are required.');
  if(snapshot.departments.some(d=>!d||typeof d.code!=='string'||!d.code||typeof d.name!=='string'))throw new Error('Snapshot department directory is invalid.');
  const asOf=snapshot.asOf&&snapshot.asOf<today()?snapshot.asOf:today();
  const newReferences=new Set(snapshot.changes?.newReferences||[]);
  return {snapshot,contracts:groupContracts(snapshot.records.filter(r=>r&&r.owner_org&&inScope(r)&&validDate(r.contract_date)<=asOf).map(enrichContract).map(c=>({...c,newInRefresh:newReferences.has(c.id)})).filter(c=>c.supplierGroup)),directory:snapshot.departments};
}
