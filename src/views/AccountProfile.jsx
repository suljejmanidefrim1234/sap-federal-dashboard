import React, { useState, useMemo, useCallback } from 'react';
import { formatDate, formatCurrency, daysFromNow, fetchContracts } from '../data/api';
import { SOLUTION_AREAS, SUPPLIER_GROUPS } from '../data/suppliers';

const CONTRACTS_PER_PAGE = 5;

export default function AccountProfile({ account, contracts, onBack }) {
  const [expandedSuppliers, setExpandedSuppliers] = useState({});
  const [supplierPages, setSupplierPages] = useState({});
  const [liveResults, setLiveResults] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);

  const suppliersByGroup = useMemo(() => {
    const groups = {
      SAP: [],
      COMPETITORS: [],
      SYSTEMS_INTEGRATORS: []
    };

    const supplierMap = new Map();

    for (const contract of contracts) {
      const vendor = contract.vendor_name;
      if (!vendor || !contract.supplierGroup) continue;

      if (!supplierMap.has(vendor)) {
        supplierMap.set(vendor, {
          name: vendor,
          group: contract.supplierGroup,
          groupColor: contract.supplierGroupColor,
          contracts: [],
          totalValue: 0
        });
      }

      const supplier = supplierMap.get(vendor);
      supplier.contracts.push(contract);
      supplier.totalValue += contract.contractValue;
    }

    for (const supplier of supplierMap.values()) {
      supplier.contracts.sort((a, b) => {
        const dateA = a.contractDate || new Date(0);
        const dateB = b.contractDate || new Date(0);
        return dateB - dateA;
      });

      if (groups[supplier.group]) {
        groups[supplier.group].push(supplier);
      }
    }

    for (const group of Object.values(groups)) {
      group.sort((a, b) => b.totalValue - a.totalValue);
    }

    return groups;
  }, [contracts]);

  const solutionAnalysis = useMemo(() => {
    const analysis = {};

    for (const [areaKey, area] of Object.entries(SOLUTION_AREAS)) {
      analysis[areaKey] = {
        name: area.name,
        sapPresent: false,
        competitorPresent: false,
        contracts: []
      };
    }

    for (const contract of contracts) {
      for (const sa of contract.solutionAreas) {
        if (analysis[sa.area]) {
          analysis[sa.area].contracts.push(contract);
          if (contract.supplierGroup === 'SAP') {
            analysis[sa.area].sapPresent = true;
          } else if (contract.supplierGroup === 'COMPETITORS') {
            analysis[sa.area].competitorPresent = true;
          }
        }
      }
    }

    return analysis;
  }, [contracts]);

  const toggleSupplier = (supplierName) => {
    setExpandedSuppliers(prev => ({
      ...prev,
      [supplierName]: !prev[supplierName]
    }));
  };

  const getSupplierPage = (supplierName) => supplierPages[supplierName] || 0;

  const setSupplierPage = (supplierName, page) => {
    setSupplierPages(prev => ({ ...prev, [supplierName]: page }));
  };

  const fetchLiveRecords = useCallback(async () => {
    if (!account?.code) return;

    setLiveLoading(true);
    setLiveError(null);

    try {
      const result = await fetchContracts({
        department: account.code,
        limit: 100,
        offset: 0
      });

      setLiveResults({
        contracts: result.records,
        total: result.total,
        loaded: result.records.length,
        timestamp: new Date()
      });
    } catch (err) {
      setLiveError(err.message);
    } finally {
      setLiveLoading(false);
    }
  }, [account?.code]);

  const renderContractCard = (contract) => (
    <div key={contract._id} className="contract-card">
      <div className="contract-header">
        <span className="contract-value">{formatCurrency(contract.contractValue)}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {contract.isAmendment && (
            <span className="badge badge-neutral">Amendment</span>
          )}
          {contract.hasOptionMention && (
            <span className="badge badge-neutral">Option</span>
          )}
        </div>
      </div>
      <div className="contract-desc">
        {contract.description_en || 'No description available'}
      </div>
      <div className="contract-meta">
        <span>Award: {formatDate(contract.contractDate)}</span>
        <span>End: {formatDate(contract.endDate)}</span>
        {contract.procurement_id && (
          <span>ID: {contract.procurement_id}</span>
        )}
        {contract.standing_offer_number && (
          <span>Vehicle: {contract.standing_offer_number}</span>
        )}
      </div>
      {contract.sourceUrl && (
        <a
          href={contract.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="contract-link"
          style={{ marginTop: '8px', display: 'inline-block' }}
        >
          View on Government of Canada
        </a>
      )}
    </div>
  );

  const renderSupplierSection = (groupKey, groupName, suppliers) => {
    if (suppliers.length === 0) return null;

    const color = SUPPLIER_GROUPS[groupKey]?.color || 'var(--text-muted)';

    return (
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '0.875rem', color: color, marginBottom: '12px', fontWeight: 600 }}>
          {groupName} ({suppliers.length})
        </h4>
        {suppliers.map((supplier) => {
          const isExpanded = expandedSuppliers[supplier.name];
          const page = getSupplierPage(supplier.name);
          const totalPages = Math.ceil(supplier.contracts.length / CONTRACTS_PER_PAGE);
          const visibleContracts = supplier.contracts.slice(
            page * CONTRACTS_PER_PAGE,
            (page + 1) * CONTRACTS_PER_PAGE
          );

          return (
            <div key={supplier.name} className="supplier-item">
              <div
                className="supplier-header"
                onClick={() => toggleSupplier(supplier.name)}
              >
                <span className="supplier-name">{supplier.name}</span>
                <div className="supplier-stats">
                  <span>{supplier.contracts.length} contracts</span>
                  <span>{formatCurrency(supplier.totalValue)}</span>
                  <svg
                    className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>
              {isExpanded && (
                <div className="supplier-contracts">
                  {visibleContracts.map(renderContractCard)}
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setSupplierPage(supplier.name, page - 1)}
                        disabled={page === 0}
                      >
                        Previous
                      </button>
                      <span className="page-info">
                        Page {page + 1} of {totalPages}
                      </span>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setSupplierPage(supplier.name, page + 1)}
                        disabled={page >= totalPages - 1}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div className="back-btn" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to Accounts
      </div>

      <div className="account-header">
        <h2>{account.name?.split(' | ')[0] || account.code}</h2>
        <div className="account-header-meta">
          {contracts.length} tracked contracts | Total reported value: {formatCurrency(account.totalValue)}
        </div>
      </div>

      <div className="account-profile">
        <div className="account-profile-main">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Reported Supplier Activity</span>
            </div>
            <div className="card-body">
              {contracts.length === 0 ? (
                <div className="empty-state">
                  No tracked supplier contracts found in loaded data.
                  Use the Live Lookup to search the full government dataset.
                </div>
              ) : (
                <>
                  {renderSupplierSection('SAP', 'SAP', suppliersByGroup.SAP)}
                  {renderSupplierSection('COMPETITORS', 'Competitors', suppliersByGroup.COMPETITORS)}
                  {renderSupplierSection('SYSTEMS_INTEGRATORS', 'Systems Integrators', suppliersByGroup.SYSTEMS_INTEGRATORS)}
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Latest Government Records</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={fetchLiveRecords}
                disabled={liveLoading}
              >
                {liveLoading ? 'Loading...' : 'Fetch Recent Records'}
              </button>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Query the Government of Canada API for the most recent contract disclosures
                for <strong>{account.name?.split(' | ')[0]}</strong> specifically.
              </p>

              {liveError && (
                <div style={{ color: 'var(--status-critical)', marginBottom: '16px' }}>
                  Error: {liveError}
                </div>
              )}

              {liveResults && (
                <div>
                  <div style={{ fontSize: '0.875rem', marginBottom: '16px', padding: '12px', background: 'var(--surface-secondary)', borderRadius: '4px' }}>
                    <strong>Results:</strong> Retrieved {liveResults.loaded} of {liveResults.total.toLocaleString()} total contracts
                    {liveResults.total > liveResults.loaded && (
                      <span style={{ color: 'var(--text-muted)' }}> (showing sample)</span>
                    )}
                    <br />
                    <span style={{ color: 'var(--text-muted)' }}>
                      Fetched at {liveResults.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {liveResults.contracts.slice(0, 20).map((contract) => (
                      <div key={contract._id} className="contract-card">
                        <div className="contract-header">
                          <span className="contract-value">{formatCurrency(contract.contractValue)}</span>
                          <span className="badge badge-neutral">{contract.vendor_name}</span>
                        </div>
                        <div className="contract-desc">
                          {contract.description_en || 'No description'}
                        </div>
                        <div className="contract-meta">
                          <span>Award: {formatDate(contract.contractDate)}</span>
                          <span>End: {formatDate(contract.endDate)}</span>
                        </div>
                        {contract.sourceUrl && (
                          <a
                            href={contract.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="contract-link"
                          >
                            View source
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="account-profile-sidebar">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Solution Area Research</span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Based on keyword matching in contract descriptions.
                <strong> Unknown</strong> means no evidence found—not confirmed whitespace.
              </p>
              <div className="solution-grid">
                {Object.entries(solutionAnalysis).map(([key, area]) => {
                  let statusClass = 'solution-unknown';
                  let statusText = 'Unknown';

                  if (area.sapPresent) {
                    statusClass = 'solution-sap';
                    statusText = 'SAP detected';
                  } else if (area.competitorPresent) {
                    statusClass = 'solution-competitor';
                    statusText = 'Competitor detected';
                  }

                  return (
                    <div key={key} className={`solution-item ${statusClass}`}>
                      <span className="solution-label">{area.name}</span>
                      <span className="solution-status">{statusText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Quick Stats</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>SAP Contracts</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-sap)' }}>
                    {suppliersByGroup.SAP.reduce((sum, s) => sum + s.contracts.length, 0)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Competitor Contracts</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-competitor)' }}>
                    {suppliersByGroup.COMPETITORS.reduce((sum, s) => sum + s.contracts.length, 0)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>SI Contracts</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-si)' }}>
                    {suppliersByGroup.SYSTEMS_INTEGRATORS.reduce((sum, s) => sum + s.contracts.length, 0)}
                  </span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Next End Date</span>
                  <span style={{ fontWeight: 500 }}>
                    {account.nextEndDate ? formatDate(account.nextEndDate) : 'N/A'}
                  </span>
                </div>
                {account.nextEndDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Days Until</span>
                    <span style={{ fontWeight: 500 }}>
                      {daysFromNow(account.nextEndDate)} days
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
