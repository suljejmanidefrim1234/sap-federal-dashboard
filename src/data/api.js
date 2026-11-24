// Government of Canada Open Data API service
// Dataset: Proactive Publication — Contracts over $10,000
// Resource ID: fac950c0-00d5-4ec1-a4d3-9cbebf98a305

const API_BASE = 'https://open.canada.ca/data/api/3/action/datastore_search';
const RESOURCE_ID = 'fac950c0-00d5-4ec1-a4d3-9cbebf98a305';

// Date range: 5 years back from current year
const CURRENT_YEAR = new Date().getFullYear();
const START_DATE = `${CURRENT_YEAR - 5}-01-01`;

import { classifyVendor, identifySolutionAreas, SUPPLIER_GROUPS } from './suppliers.js';

// Build all supplier patterns for filtering
function getAllSupplierPatterns() {
  const patterns = [];
  for (const group of Object.values(SUPPLIER_GROUPS)) {
    patterns.push(...group.patterns);
  }
  return patterns;
}

// Fetch contracts from the API
export async function fetchContracts({
  department = null,
  limit = 100,
  offset = 0,
  vendorSearch = null
}) {
  const params = new URLSearchParams({
    resource_id: RESOURCE_ID,
    limit: limit.toString(),
    offset: offset.toString()
  });

  if (department) {
    params.append('filters', JSON.stringify({ owner_org: department }));
  }

  const response = await fetch(`${API_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error('API returned unsuccessful response');
  }

  return {
    records: data.result.records.map(enrichContract),
    total: data.result.total,
    limit: data.result.limit,
    offset: data.result.offset || 0
  };
}

// Fetch contracts for tracked suppliers only
export async function fetchTrackedSupplierContracts({
  department = null,
  limit = 1000,
  offset = 0
}) {
  // We need to fetch a larger batch and filter client-side
  // since the API doesn't support complex OR queries on vendor names
  const result = await fetchContracts({ department, limit, offset });

  const trackedContracts = result.records.filter(contract => {
    return contract.supplierGroup !== null;
  });

  return {
    ...result,
    records: trackedContracts,
    trackedCount: trackedContracts.length
  };
}

// Enrich contract with classification data
function enrichContract(contract) {
  const supplierClassification = classifyVendor(contract.vendor_name);
  const solutionAreas = identifySolutionAreas(
    contract.description_en,
    contract.vendor_name
  );

  // Parse dates
  const contractDate = contract.contract_date ? new Date(contract.contract_date) : null;
  const endDate = contract.delivery_date ? new Date(contract.delivery_date) : null;
  const startDate = contract.contract_period_start ? new Date(contract.contract_period_start) : null;

  // Parse values
  const contractValue = parseFloat(contract.contract_value) || 0;
  const originalValue = parseFloat(contract.original_value) || 0;
  const amendmentValue = parseFloat(contract.amendment_value) || 0;

  // Determine if this is an amendment
  const isAmendment = amendmentValue !== 0 ||
    (contract.comments_en && contract.comments_en.toLowerCase().includes('amend'));

  // Check for option indicators
  const hasOptionMention = contract.description_en?.toLowerCase().includes('option') ||
    contract.comments_en?.toLowerCase().includes('option');

  return {
    ...contract,
    supplierGroup: supplierClassification?.group || null,
    supplierGroupName: supplierClassification?.name || null,
    supplierGroupColor: supplierClassification?.color || null,
    solutionAreas,
    contractDate,
    endDate,
    startDate,
    contractValue,
    originalValue,
    amendmentValue,
    isAmendment,
    hasOptionMention,
    // Extract year for filtering
    awardYear: contractDate?.getFullYear() || null,
    // Build government source link
    sourceUrl: buildContractSourceUrl(contract)
  };
}

// Build URL to government contract disclosure page
function buildContractSourceUrl(contract) {
  // The contracts dataset links to the proactive disclosure search
  // Using reference_number and owner_org to construct a searchable link
  const baseUrl = 'https://search.open.canada.ca/contracts/';
  const params = new URLSearchParams();

  if (contract.reference_number) {
    params.append('search_text', contract.reference_number);
  }
  if (contract.owner_org) {
    params.append('owner_org', contract.owner_org);
  }

  return `${baseUrl}?${params.toString()}`;
}

// Aggregate contracts by department for the accounts list
export function aggregateByDepartment(contracts) {
  const deptMap = new Map();

  for (const contract of contracts) {
    const deptCode = contract.owner_org;
    const deptName = contract.owner_org_title;

    if (!deptMap.has(deptCode)) {
      deptMap.set(deptCode, {
        code: deptCode,
        name: deptName,
        contracts: [],
        sapContracts: [],
        competitorContracts: [],
        siContracts: [],
        totalValue: 0,
        nextEndDate: null,
        solutionAreas: new Set()
      });
    }

    const dept = deptMap.get(deptCode);
    dept.contracts.push(contract);
    dept.totalValue += contract.contractValue;

    // Track by supplier group
    if (contract.supplierGroup === 'SAP') {
      dept.sapContracts.push(contract);
    } else if (contract.supplierGroup === 'COMPETITORS') {
      dept.competitorContracts.push(contract);
    } else if (contract.supplierGroup === 'SYSTEMS_INTEGRATORS') {
      dept.siContracts.push(contract);
    }

    // Track solution areas
    for (const area of contract.solutionAreas) {
      dept.solutionAreas.add(area.area);
    }

    // Track next end date (future dates only)
    const now = new Date();
    if (contract.endDate && contract.endDate > now) {
      if (!dept.nextEndDate || contract.endDate < dept.nextEndDate) {
        dept.nextEndDate = contract.endDate;
      }
    }
  }

  // Convert Sets to arrays for JSON compatibility
  return Array.from(deptMap.values()).map(dept => ({
    ...dept,
    solutionAreas: Array.from(dept.solutionAreas)
  }));
}

// Aggregate contracts by supplier
export function aggregateBySupplier(contracts) {
  const supplierMap = new Map();

  for (const contract of contracts) {
    const vendor = contract.vendor_name;
    if (!vendor) continue;

    if (!supplierMap.has(vendor)) {
      supplierMap.set(vendor, {
        name: vendor,
        group: contract.supplierGroup,
        groupName: contract.supplierGroupName,
        groupColor: contract.supplierGroupColor,
        contracts: [],
        totalValue: 0,
        departments: new Set()
      });
    }

    const supplier = supplierMap.get(vendor);
    supplier.contracts.push(contract);
    supplier.totalValue += contract.contractValue;
    supplier.departments.add(contract.owner_org_title);
  }

  return Array.from(supplierMap.values()).map(supplier => ({
    ...supplier,
    departments: Array.from(supplier.departments),
    contractCount: supplier.contracts.length
  }));
}

// Get contracts with upcoming end dates
export function getUpcomingEndDates(contracts, windowDays = 365) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + windowDays);

  return contracts
    .filter(c => c.endDate && c.endDate >= now && c.endDate <= futureDate)
    .sort((a, b) => a.endDate - b.endDate);
}

// Get contracts with past end dates
export function getPastEndDates(contracts, windowDays = 365) {
  const now = new Date();
  const pastDate = new Date();
  pastDate.setDate(now.getDate() - windowDays);

  return contracts
    .filter(c => c.endDate && c.endDate < now && c.endDate >= pastDate)
    .sort((a, b) => b.endDate - a.endDate);
}

// Aggregate by year for market overview charts
export function aggregateByYear(contracts) {
  const yearMap = new Map();

  for (const contract of contracts) {
    if (!contract.awardYear) continue;

    if (!yearMap.has(contract.awardYear)) {
      yearMap.set(contract.awardYear, {
        year: contract.awardYear,
        totalValue: 0,
        sapValue: 0,
        competitorValue: 0,
        siValue: 0,
        contractCount: 0
      });
    }

    const year = yearMap.get(contract.awardYear);
    year.totalValue += contract.contractValue;
    year.contractCount++;

    if (contract.supplierGroup === 'SAP') {
      year.sapValue += contract.contractValue;
    } else if (contract.supplierGroup === 'COMPETITORS') {
      year.competitorValue += contract.contractValue;
    } else if (contract.supplierGroup === 'SYSTEMS_INTEGRATORS') {
      year.siValue += contract.contractValue;
    }
  }

  return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
}

// Format currency for display
export function formatCurrency(value) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

// Format date for display
export function formatDate(date) {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Calculate days until/since a date
export function daysFromNow(date) {
  if (!date) return null;
  const now = new Date();
  const diffTime = date - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
