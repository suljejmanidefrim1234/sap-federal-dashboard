import React, { useState, useMemo } from 'react';
import { formatDate, formatCurrency } from '../data/api';

export default function AccountsView({ departments, onSelectAccount }) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    hasSAP: false,
    hasCompetitor: false,
    hasUpcomingEnd: false,
    hasSolutionKeywords: false
  });

  const toggleFilter = (key) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredDepartments = useMemo(() => {
    let result = [...departments];

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(d =>
        d.name?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.hasSAP) {
      result = result.filter(d => d.sapContracts.length > 0);
    }
    if (filters.hasCompetitor) {
      result = result.filter(d => d.competitorContracts.length > 0);
    }
    if (filters.hasUpcomingEnd) {
      const now = new Date();
      const sixMonths = new Date();
      sixMonths.setMonth(now.getMonth() + 6);
      result = result.filter(d => d.nextEndDate && d.nextEndDate <= sixMonths);
    }
    if (filters.hasSolutionKeywords) {
      result = result.filter(d => d.solutionAreas.length > 0);
    }

    result.sort((a, b) => {
      const aScore = (a.sapContracts.length * 3) + (a.competitorContracts.length * 2) + a.siContracts.length;
      const bScore = (b.sapContracts.length * 3) + (b.competitorContracts.length * 2) + b.siContracts.length;
      return bScore - aScore;
    });

    return result;
  }, [departments, search, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div>
      <div className="disclaimer">
        This dashboard shows <strong>tracked suppliers only</strong> (SAP, competitors, and systems integrators).
        Contract presence does not confirm product usage. Treat findings as research signals, not verified intelligence.
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body">
          <div className="search-container" style={{ marginBottom: '16px' }}>
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search departments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filters">
            <button
              className={`filter-btn ${filters.hasSAP ? 'active' : ''}`}
              onClick={() => toggleFilter('hasSAP')}
            >
              SAP Records
            </button>
            <button
              className={`filter-btn ${filters.hasCompetitor ? 'active' : ''}`}
              onClick={() => toggleFilter('hasCompetitor')}
            >
              Competitor Records
            </button>
            <button
              className={`filter-btn ${filters.hasUpcomingEnd ? 'active' : ''}`}
              onClick={() => toggleFilter('hasUpcomingEnd')}
            >
              End Date &lt; 6 Months
            </button>
            <button
              className={`filter-btn ${filters.hasSolutionKeywords ? 'active' : ''}`}
              onClick={() => toggleFilter('hasSolutionKeywords')}
            >
              Solution Keywords
            </button>
            {activeFilterCount > 0 && (
              <button
                className="filter-btn"
                onClick={() => setFilters({ hasSAP: false, hasCompetitor: false, hasUpcomingEnd: false, hasSolutionKeywords: false })}
                style={{ color: 'var(--status-critical)' }}
              >
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Federal Departments & Agencies
            <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({filteredDepartments.length} with tracked contracts)
            </span>
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {filteredDepartments.length === 0 ? (
            <div className="empty-state">
              No departments match your filters
            </div>
          ) : (
            <div className="account-list" style={{ padding: '16px' }}>
              {filteredDepartments.map((dept) => (
                <div
                  key={dept.code}
                  className="account-item"
                  onClick={() => onSelectAccount(dept)}
                >
                  <div className="account-name">
                    {dept.name?.split(' | ')[0] || dept.code}
                  </div>
                  <div className="account-meta">
                    <div className="account-badges">
                      {dept.sapContracts.length > 0 && (
                        <span className="badge badge-sap">
                          SAP ({dept.sapContracts.length})
                        </span>
                      )}
                      {dept.competitorContracts.length > 0 && (
                        <span className="badge badge-competitor">
                          Competitors ({dept.competitorContracts.length})
                        </span>
                      )}
                      {dept.siContracts.length > 0 && (
                        <span className="badge badge-si">
                          SI ({dept.siContracts.length})
                        </span>
                      )}
                    </div>
                    {dept.nextEndDate && (
                      <div className="account-end-date">
                        Next end: {formatDate(dept.nextEndDate)}
                      </div>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
