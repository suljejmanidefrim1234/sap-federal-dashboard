import catalogue from './catalogue.json';
export const SUPPLIER_GROUPS = catalogue.groups;
export const TRACKED_SUPPLIERS = catalogue.suppliers;
export const normalizeText = value => String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const hasWords = (text, words) => (` ${text} `).includes(` ${normalizeText(words)} `);
export function classifyVendor(name) {
  const text = normalizeText(name);
  const supplier = TRACKED_SUPPLIERS.find(s => s.aliases.some(a => hasWords(text, a)));
  return supplier ? { ...SUPPLIER_GROUPS[supplier.group], ...supplier } : null;
}
export const SOLUTION_AREAS = {
  ERP_FINANCE: { name: 'Finance & ERP', keywords: ['ERP','S/4HANA','S4HANA','SAP ECC','FINANCIAL MANAGEMENT','FINANCIAL SYSTEM','GENERAL LEDGER','BUDGETING SOFTWARE','ORACLE FINANCIALS','PEOPLESOFT','JD EDWARDS','DYNAMICS 365 FINANCE'] },
  HCM: { name: 'HR & people', keywords: ['HUMAN CAPITAL','HUMAN RESOURCES SYSTEM','PAYROLL','TALENT MANAGEMENT','LEARNING MANAGEMENT','SUCCESSFACTORS','WORKDAY HCM','ORACLE HCM','DAYFORCE','KRONOS'] },
  PROCUREMENT: { name: 'Procurement', keywords: ['PROCUREMENT SYSTEM','E PROCUREMENT','PROCURE TO PAY','SUPPLIER MANAGEMENT','STRATEGIC SOURCING','CONTRACT MANAGEMENT SOFTWARE','ARIBA','FIELDGLASS','COUPA','JAGGAER'] },
  TRAVEL_EXPENSE: { name: 'Travel & expense', keywords: ['TRAVEL MANAGEMENT','EXPENSE MANAGEMENT','EXPENSE REPORTING','TRAVEL BOOKING','CONCUR','CHROME RIVER','EXPENSIFY','NAVAN'] },
  SUPPLY_CHAIN: { name: 'Supply chain', keywords: ['SUPPLY CHAIN','DEMAND PLANNING','INVENTORY MANAGEMENT','WAREHOUSE MANAGEMENT','TRANSPORTATION MANAGEMENT','INTEGRATED BUSINESS PLANNING','KINAXIS','BLUE YONDER','SAP EWM','SAP IBP'] },
  DATA_ANALYTICS: { name: 'Data & analytics', keywords: ['ANALYTICS','BUSINESS INTELLIGENCE','DATA WAREHOUSE','DATA WAREHOUSING','SAP BW','DATASPHERE','ANALYTICS CLOUD','TABLEAU','POWER BI','QLIK','SNOWFLAKE','DATABRICKS'] },
  INTEGRATION_BTP: { name: 'Business technology & integration', keywords: ['INTEGRATION PLATFORM','SYSTEM INTEGRATION','SYSTEMS INTEGRATION','API MANAGEMENT','MIDDLEWARE','PROCESS AUTOMATION','LOW CODE','BUSINESS TECHNOLOGY PLATFORM','SAP BTP','INTEGRATION SUITE','MULESOFT','BOOMI','INFORMATICA'] },
  CX: { name: 'Customer & constituent experience', keywords: ['CRM','CUSTOMER RELATIONSHIP','CITIZEN ENGAGEMENT','CONSTITUENT','CONTACT CENTER','CONTACT CENTRE','CASE MANAGEMENT SYSTEM','SALES CLOUD','SERVICE CLOUD','COMMERCE CLOUD','SALESFORCE','QUALTRICS'] },
  SUSTAINABILITY: { name: 'Sustainability', keywords: ['SUSTAINABILITY SOFTWARE','CARBON ACCOUNTING','ESG REPORTING','SUSTAINABILITY CONTROL TOWER','SUSTAINABILITY FOOTPRINT'] },
  TRANSFORMATION: { name: 'Business transformation', keywords: ['SIGNAVIO','LEANIX','PROCESS MINING','ENTERPRISE ARCHITECTURE','BUSINESS PROCESS MANAGEMENT'] }
};
// Only disclosed descriptions/comments supply area evidence; supplier names never do.
export function identifySolutionAreas(description) {
  const text = normalizeText(description);
  return Object.entries(SOLUTION_AREAS).flatMap(([area, config]) => {
    const keywords = config.keywords.filter(k => hasWords(text, k));
    return keywords.length ? [{ area, name: config.name, keywords, confidence: 'Needs verification' }] : [];
  });
}
