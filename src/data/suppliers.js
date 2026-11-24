// Supplier classification for Canadian federal government contract analysis
// These patterns are matched against vendor_name field (case-insensitive)

export const SUPPLIER_GROUPS = {
  SAP: {
    name: 'SAP',
    color: '#0070F2', // SAP Blue
    patterns: [
      'SAP CANADA',
      'SAP AMERICA',
      'SAP SE',
      'CONCUR',
      'ARIBA',
      'SUCCESSFACTORS',
      'FIELDGLASS',
      'QUALTRICS',
      'SIGNAVIO'
    ]
  },
  COMPETITORS: {
    name: 'Competitors',
    color: '#E56910',
    patterns: [
      // ERP & Finance
      'ORACLE',
      'MICROSOFT',
      'WORKDAY',
      'INFOR',
      'UNIT4',
      'SAGE',
      // HR/HCM
      'CERIDIAN',
      'DAYFORCE',
      'ADP CANADA',
      'KRONOS',
      'UKG',
      // Procurement
      'COUPA',
      'JAGGAER',
      'GEP',
      // Travel & Expense
      'CHROME RIVER',
      'CERTIFY',
      'EXPENSIFY',
      'NAVAN',
      // Supply Chain
      'KINAXIS',
      'BLUE YONDER',
      'MANHATTAN ASSOCIATES',
      'O9 SOLUTIONS',
      // Data & Analytics
      'SNOWFLAKE',
      'DATABRICKS',
      'PALANTIR',
      'TABLEAU',
      'POWER BI',
      'QLIK',
      'ALTERYX',
      // Integration & BTP
      'MULESOFT',
      'BOOMI',
      'INFORMATICA',
      'TIBCO',
      // CX
      'SALESFORCE',
      'SERVICENOW',
      'ZENDESK',
      'PEGA',
      'DYNAMICS'
    ]
  },
  SYSTEMS_INTEGRATORS: {
    name: 'Systems Integrators',
    color: '#6E56CF',
    patterns: [
      'DELOITTE',
      'IBM CANADA',
      'IBM CONSULTING',
      'ACCENTURE',
      'CGI GROUP',
      'CGI INFORMATION',
      'KPMG',
      'PWC',
      'PRICEWATERHOUSECOOPERS',
      'ERNST & YOUNG',
      'EY CANADA',
      'CAPGEMINI',
      'TATA CONSULTANCY',
      'TCS',
      'INFOSYS',
      'WIPRO',
      'COGNIZANT',
      'NTT DATA',
      'DXC TECHNOLOGY',
      'ATOS',
      'BDO CANADA',
      'MNP',
      'GRANT THORNTON'
    ]
  }
};

// Solution areas aligned with SAP's portfolio
export const SOLUTION_AREAS = {
  ERP_FINANCE: {
    name: 'ERP & Finance',
    description: 'Core ERP, financial management, accounting, budgeting',
    sapProducts: ['S/4HANA', 'ECC', 'Business One', 'Central Finance'],
    keywords: ['ERP', 'FINANCIAL', 'ACCOUNTING', 'LEDGER', 'BUDGETING', 'FISCAL', 'SAP S/4', 'SAP ECC', 'ORACLE FINANCIALS', 'PEOPLESOFT', 'JD EDWARDS'],
    competitors: ['ORACLE', 'MICROSOFT DYNAMICS', 'WORKDAY', 'INFOR', 'UNIT4']
  },
  HCM: {
    name: 'HR & People',
    description: 'Human capital management, payroll, talent, learning',
    sapProducts: ['SuccessFactors', 'HCM', 'Payroll'],
    keywords: ['HUMAN RESOURCES', 'HR SYSTEM', 'PAYROLL', 'TALENT', 'RECRUITING', 'LEARNING MANAGEMENT', 'LMS', 'PERFORMANCE MANAGEMENT', 'SUCCESSFACTORS', 'WORKDAY HCM', 'PEOPLESOFT HCM'],
    competitors: ['WORKDAY', 'CERIDIAN', 'ADP', 'KRONOS', 'UKG', 'ORACLE HCM']
  },
  PROCUREMENT: {
    name: 'Procurement',
    description: 'Sourcing, supplier management, contract management, P2P',
    sapProducts: ['Ariba', 'Fieldglass', 'S/4HANA Procurement'],
    keywords: ['PROCUREMENT', 'SOURCING', 'SUPPLIER MANAGEMENT', 'CONTRACT MANAGEMENT', 'PURCHASE ORDER', 'P2P', 'PROCURE-TO-PAY', 'E-PROCUREMENT', 'ARIBA', 'COUPA', 'JAGGAER'],
    competitors: ['COUPA', 'JAGGAER', 'GEP', 'ORACLE PROCUREMENT']
  },
  TRAVEL_EXPENSE: {
    name: 'Travel & Expense',
    description: 'Travel booking, expense management, invoice automation',
    sapProducts: ['Concur Travel', 'Concur Expense', 'Concur Invoice'],
    keywords: ['TRAVEL', 'EXPENSE', 'INVOICE AUTOMATION', 'AP AUTOMATION', 'ACCOUNTS PAYABLE', 'CONCUR', 'CHROME RIVER', 'CERTIFY', 'EXPENSIFY'],
    competitors: ['CHROME RIVER', 'CERTIFY', 'EXPENSIFY', 'COUPA EXPENSES']
  },
  SUPPLY_CHAIN: {
    name: 'Supply Chain',
    description: 'Planning, logistics, warehouse, transportation management',
    sapProducts: ['IBP', 'TM', 'EWM', 'Ariba Network'],
    keywords: ['SUPPLY CHAIN', 'LOGISTICS', 'WAREHOUSE', 'INVENTORY', 'TRANSPORTATION', 'PLANNING', 'DEMAND PLANNING', 'S&OP', 'KINAXIS', 'BLUE YONDER'],
    competitors: ['KINAXIS', 'BLUE YONDER', 'MANHATTAN', 'O9 SOLUTIONS', 'ORACLE SCM']
  },
  DATA_ANALYTICS: {
    name: 'Data & Analytics',
    description: 'Business intelligence, data warehousing, advanced analytics',
    sapProducts: ['SAC', 'BW/4HANA', 'Datasphere', 'Analytics Cloud'],
    keywords: ['ANALYTICS', 'BUSINESS INTELLIGENCE', 'DATA WAREHOUSE', 'REPORTING', 'DASHBOARD', 'BI TOOL', 'SAP BW', 'TABLEAU', 'POWER BI', 'QLIK', 'SNOWFLAKE', 'DATABRICKS'],
    competitors: ['TABLEAU', 'POWER BI', 'QLIK', 'SNOWFLAKE', 'DATABRICKS', 'PALANTIR']
  },
  INTEGRATION_BTP: {
    name: 'Integration & Platform',
    description: 'Integration, APIs, low-code, process automation',
    sapProducts: ['BTP', 'Integration Suite', 'Build Apps', 'Signavio'],
    keywords: ['INTEGRATION', 'API', 'MIDDLEWARE', 'PROCESS AUTOMATION', 'WORKFLOW', 'BPM', 'LOW-CODE', 'MULESOFT', 'BOOMI', 'INFORMATICA'],
    competitors: ['MULESOFT', 'BOOMI', 'INFORMATICA', 'TIBCO', 'SERVICENOW']
  },
  CX: {
    name: 'Customer Experience',
    description: 'CRM, service management, commerce, citizen engagement',
    sapProducts: ['CX Suite', 'Sales Cloud', 'Service Cloud', 'Commerce Cloud'],
    keywords: ['CRM', 'CUSTOMER RELATIONSHIP', 'CITIZEN ENGAGEMENT', 'SERVICE MANAGEMENT', 'CALL CENTER', 'CONTACT CENTER', 'CASE MANAGEMENT', 'SALESFORCE', 'DYNAMICS CRM', 'SERVICENOW'],
    competitors: ['SALESFORCE', 'SERVICENOW', 'MICROSOFT DYNAMICS', 'ZENDESK', 'PEGA']
  }
};

// Match a vendor name to supplier group
export function classifyVendor(vendorName) {
  if (!vendorName) return null;
  const upper = vendorName.toUpperCase();

  for (const [groupKey, group] of Object.entries(SUPPLIER_GROUPS)) {
    for (const pattern of group.patterns) {
      if (upper.includes(pattern)) {
        return { group: groupKey, name: group.name, color: group.color };
      }
    }
  }
  return null;
}

// Identify potential solution areas from contract description
export function identifySolutionAreas(description, vendorName) {
  if (!description && !vendorName) return [];
  const text = `${description || ''} ${vendorName || ''}`.toUpperCase();
  const matches = [];

  for (const [areaKey, area] of Object.entries(SOLUTION_AREAS)) {
    for (const keyword of area.keywords) {
      if (text.includes(keyword)) {
        matches.push({
          area: areaKey,
          name: area.name,
          keyword: keyword,
          confidence: 'keyword_match'
        });
        break;
      }
    }
  }

  return matches;
}

// Federal departments with their codes (populated from API)
export const MAJOR_DEPARTMENTS = [
  { code: 'aafc-aac', name: 'Agriculture and Agri-Food Canada' },
  { code: 'cbsa-asfc', name: 'Canada Border Services Agency' },
  { code: 'cic', name: 'Immigration, Refugees and Citizenship Canada' },
  { code: 'cra-arc', name: 'Canada Revenue Agency' },
  { code: 'dfo-mpo', name: 'Fisheries and Oceans Canada' },
  { code: 'dnd-mdn', name: 'National Defence' },
  { code: 'ec', name: 'Environment and Climate Change Canada' },
  { code: 'esdc-edsc', name: 'Employment and Social Development Canada' },
  { code: 'dfatd-maecd', name: 'Global Affairs Canada' },
  { code: 'hc-sc', name: 'Health Canada' },
  { code: 'infc', name: 'Infrastructure Canada' },
  { code: 'ised-isde', name: 'Innovation, Science and Economic Development Canada' },
  { code: 'jus', name: 'Department of Justice Canada' },
  { code: 'nrcan-rncan', name: 'Natural Resources Canada' },
  { code: 'pch', name: 'Canadian Heritage' },
  { code: 'phac-aspc', name: 'Public Health Agency of Canada' },
  { code: 'ps-sp', name: 'Public Safety Canada' },
  { code: 'pwgsc-tpsgc', name: 'Public Services and Procurement Canada' },
  { code: 'rcmp-grc', name: 'Royal Canadian Mounted Police' },
  { code: 'ssc-spc', name: 'Shared Services Canada' },
  { code: 'statcan', name: 'Statistics Canada' },
  { code: 'tbs-sct', name: 'Treasury Board of Canada Secretariat' },
  { code: 'tc', name: 'Transport Canada' },
  { code: 'vac-acc', name: 'Veterans Affairs Canada' }
];
