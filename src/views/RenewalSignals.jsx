import React, { useState, useMemo } from 'react';
import { formatDate, formatCurrency, daysFromNow, getUpcomingEndDates, getPastEndDates } from '../data/api';
import { SUPPLIER_GROUPS, SOLUTION_AREAS } from '../data/suppliers';

export default function RenewalSignals({ contracts, departments }) {
  const [filters, setFilters] = useState({
    department: '',
    supplierGroup: '',
    solutionArea: '',
    timeWindow: '365',
    showPast: false
  });

  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    if (filters.department) {
      result = result.filter(c => c.owner_org === filters.department);
    }

    if (filters.supplierGroup) {
      result = result.filter(c => c.supplierGroup === filters.supplierGroup);
    }

    if (filters.solutionArea) {
      result = result.filter(c =>
        c.solutionAreas.some(sa => sa.area === filters.solutionArea)
      );
    }

    const windowDays = parseInt(filters.timeWindow, 10);

    if (filters.showPast) {
      result = getPastEndDates(result, windowDays);
    } else {
      result = getUpcomingEndDates(result, windowDays);
    }

    return result;
  }, [contracts, filters]);

  const stats = useMemo(() => {
    const now = new Date();
    const upcoming90 = getUpcomingEndDates(contracts, 90);
    const upcoming180 = getUpcomingEndDates(contracts, 180);
    const upcoming365 = getUpcomingEndDates(contracts, 365);

    return {
      total: contracts.length,
      upcoming90: upcoming90.length,
      upcoming180: upcoming180.length,
      upcoming365: upcoming365.length,
      upcoming90Value: upcoming90.reduce((sum, c) => sum + c.contractValue, 0),
      upcoming180Value: upcoming180.reduce((sum, c) => sum + c.contractValue, 0)
    };
  }, [contracts]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <div className="disclaimer">
        Recorded end dates are <strong>research signals</strong>, not confirmed renewal or re-compete opportunities.
        Verify with department contacts and official solicitation notices.
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.upcoming90}</div>
          <div className="stat-label">End dates in 90 days</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.upcoming180}</div>
          <div className="stat-label">End dates in 6 months</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.upcoming365}</div>
          <div className="stat-label">End dates in 12 months</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(stats.upcoming180Value)}</div>
          <div className="stat-label">Value ending in 6 months</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Renewal Signals</span>
        </div>
        <div className="card-body">
          <div className="filters" style={{ marginBottom: '24px' }}>
            <select
              className="filter-select"
              value={filters.department}
              onChange={(e) => updateFilter('department', e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.code} value={d.code}>
                  {d.name?.split(' | ')[0]}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={filters.supplierGroup}
              onChange={(e) => updateFilter('supplierGroup', e.target.value)}
            >
              <option value="">All Supplier Groups</option>
              {Object.entries(SUPPLIER_GROUPS).map(([key, group]) => (
                <option key={key} value={key}>{group.name}</option>
              ))}
            </select>

            <select
              className="filter-select"
              value={filters.solutionArea}
              onChange={(e) => updateFilter('solutionArea', e.target.value)}
            >
              <option value="">All Solution Areas</option>
              {Object.entries(SOLUTION_AREAS).map(([key, area]) => (
                <option key={key} value={key}>{area.name}</option>
              ))}
            </select>

            <select
              className="filter-select"
              value={filters.timeWindow}
              onChange={(e) => updateFilter('timeWindow', e.target.value)}
            >
              <option value="90">90 days</option>
              <option value="180">6 months</option>
              <option value="365">12 months</option>
              <option value="540">18 months</option>
            </select>

            <button
              className={`filter-btn ${filters.showPast ? 'active' : ''}`}
              onClick={() => updateFilter('showPast', !filters.showPast)}
            >
              {filters.showPast ? 'Showing Past' : 'Showing Upcoming'}
            </button>
          </div>

          {filteredContracts.length === 0 ? (
            <div className="empty-state">
              No contracts match your filter criteria
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Department</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                    <th>End Date</th>
                    <th>Days</th>
                    <th>Indicators</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.slice(0, 100).map((contract) => {
                    const days = daysFromNow(contract.endDate);
                    const daysLabel = days >= 0 ? `${days}d` : `${Math.abs(days)}d ago`;
                    const isUrgent = days !== null && days >= 0 && days <= 90;

                    return (
                      <tr key={contract._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: contract.supplierGroupColor || 'var(--text-muted)'
                              }}
                            />
                            <span style={{ fontWeight: 500 }}>{contract.vendor_name}</span>
                          </div>
                        </td>
                        <td style={{ maxWidth: '200px' }}>
                          <span style={{ fontSize: '0.8125rem' }}>
                            {contract.owner_org_title?.split(' | ')[0]}
                          </span>
                        </td>
                        <td style={{ maxWidth: '250px' }}>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {contract.description_en?.substring(0, 80)}
                            {contract.description_en?.length > 80 ? '...' : ''}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>
                          {formatCurrency(contract.contractValue)}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {formatDate(contract.endDate)}
                        </td>
                        <td style={{
                          fontWeight: 500,
                          color: isUrgent ? 'var(--status-warning)' : 'var(--text-secondary)'
                        }}>
                          {daysLabel}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {contract.isAmendment && (
                              <span className="badge badge-neutral">Amend</span>
                            )}
                            {contract.hasOptionMention && (
                              <span className="badge badge-neutral">Option</span>
                            )}
                            {contract.standing_offer_number && (
                              <span className="badge badge-neutral" title={contract.standing_offer_number}>
                                Vehicle
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {contract.sourceUrl && (
                            <a
                              href={contract.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="contract-link"
                            >
                              View
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredContracts.length > 100 && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Showing first 100 of {filteredContracts.length} contracts. Use filters to narrow results.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
