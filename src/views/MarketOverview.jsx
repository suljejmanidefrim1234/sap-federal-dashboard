import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { formatCurrency, aggregateByYear, aggregateBySupplier } from '../data/api';
import { SUPPLIER_GROUPS } from '../data/suppliers';

const CURRENT_YEAR = new Date().getFullYear();
const CHART_COLORS = {
  SAP: '#2a78d6',
  COMPETITORS: '#eb6834',
  SYSTEMS_INTEGRATORS: '#1baf7a'
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="custom-tooltip">
      <div className="tooltip-label">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="tooltip-item">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span>{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function MarketOverview({ contracts, departments }) {
  const [filters, setFilters] = useState({
    yearStart: CURRENT_YEAR - 5,
    yearEnd: CURRENT_YEAR,
    supplierGroup: ''
  });

  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    result = result.filter(c => {
      if (!c.awardYear) return false;
      return c.awardYear >= filters.yearStart && c.awardYear <= filters.yearEnd;
    });

    if (filters.supplierGroup) {
      result = result.filter(c => c.supplierGroup === filters.supplierGroup);
    }

    return result;
  }, [contracts, filters]);

  const yearlyData = useMemo(() => {
    return aggregateByYear(filteredContracts);
  }, [filteredContracts]);

  const supplierData = useMemo(() => {
    const suppliers = aggregateBySupplier(filteredContracts);
    return suppliers
      .filter(s => s.group)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 15);
  }, [filteredContracts]);

  const departmentData = useMemo(() => {
    const deptMap = new Map();

    for (const contract of filteredContracts) {
      const dept = contract.owner_org;
      const name = contract.owner_org_title?.split(' | ')[0] || dept;

      if (!deptMap.has(dept)) {
        deptMap.set(dept, { code: dept, name, totalValue: 0 });
      }
      deptMap.get(dept).totalValue += contract.contractValue;
    }

    return Array.from(deptMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);
  }, [filteredContracts]);

  const groupBreakdown = useMemo(() => {
    const groups = {
      SAP: { name: 'SAP', value: 0, color: CHART_COLORS.SAP },
      COMPETITORS: { name: 'Competitors', value: 0, color: CHART_COLORS.COMPETITORS },
      SYSTEMS_INTEGRATORS: { name: 'Systems Integrators', value: 0, color: CHART_COLORS.SYSTEMS_INTEGRATORS }
    };

    for (const contract of filteredContracts) {
      if (contract.supplierGroup && groups[contract.supplierGroup]) {
        groups[contract.supplierGroup].value += contract.contractValue;
      }
    }

    return Object.values(groups).filter(g => g.value > 0);
  }, [filteredContracts]);

  const stats = useMemo(() => {
    const totalValue = filteredContracts.reduce((sum, c) => sum + c.contractValue, 0);
    const sapValue = filteredContracts.filter(c => c.supplierGroup === 'SAP')
      .reduce((sum, c) => sum + c.contractValue, 0);
    const competitorValue = filteredContracts.filter(c => c.supplierGroup === 'COMPETITORS')
      .reduce((sum, c) => sum + c.contractValue, 0);
    const siValue = filteredContracts.filter(c => c.supplierGroup === 'SYSTEMS_INTEGRATORS')
      .reduce((sum, c) => sum + c.contractValue, 0);

    return {
      totalContracts: filteredContracts.length,
      totalValue,
      sapValue,
      competitorValue,
      siValue
    };
  }, [filteredContracts]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const years = [];
  for (let y = CURRENT_YEAR - 5; y <= CURRENT_YEAR; y++) {
    years.push(y);
  }

  return (
    <div>
      <div className="disclaimer">
        This overview covers <strong>tracked suppliers only</strong> (SAP, competitors, systems integrators)
        — not the entire federal IT market or SAP addressable opportunity.
        Reported contract values are disclosures, not confirmed spending.
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalContracts.toLocaleString()}</div>
          <div className="stat-label">Tracked Contracts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: CHART_COLORS.SAP }}>
            {formatCurrency(stats.sapValue)}
          </div>
          <div className="stat-label">SAP Supplier Value</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: CHART_COLORS.COMPETITORS }}>
            {formatCurrency(stats.competitorValue)}
          </div>
          <div className="stat-label">Competitor Value</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: CHART_COLORS.SYSTEMS_INTEGRATORS }}>
            {formatCurrency(stats.siValue)}
          </div>
          <div className="stat-label">SI Value</div>
        </div>
      </div>

      <div className="filters" style={{ marginBottom: '24px' }}>
        <select
          className="filter-select"
          value={filters.yearStart}
          onChange={(e) => updateFilter('yearStart', parseInt(e.target.value, 10))}
        >
          {years.map(y => (
            <option key={y} value={y}>From {y}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filters.yearEnd}
          onChange={(e) => updateFilter('yearEnd', parseInt(e.target.value, 10))}
        >
          {years.map(y => (
            <option key={y} value={y}>To {y}</option>
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tracked Contract Value by Award Year</span>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
                  <XAxis
                    dataKey="year"
                    axisLine={{ stroke: '#c3c2b7' }}
                    tickLine={false}
                    tick={{ fill: '#898781', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#898781', fontSize: 12 }}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  />
                  <Bar
                    dataKey="sapValue"
                    name="SAP"
                    stackId="a"
                    fill={CHART_COLORS.SAP}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="competitorValue"
                    name="Competitors"
                    stackId="a"
                    fill={CHART_COLORS.COMPETITORS}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="siValue"
                    name="Systems Integrators"
                    stackId="a"
                    fill={CHART_COLORS.SYSTEMS_INTEGRATORS}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Supplier Group Breakdown</span>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={groupBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                  >
                    {groupBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      background: 'white',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Top Departments by Tracked Contract Value</span>
          </div>
          <div className="card-body">
            {departmentData.length === 0 ? (
              <div className="empty-state">No data available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {departmentData.map((dept, index) => {
                  const maxValue = departmentData[0].totalValue;
                  const percentage = (dept.totalValue / maxValue) * 100;

                  return (
                    <div key={dept.code}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {index + 1}. {dept.name}
                        </span>
                        <span style={{ fontWeight: 500 }}>{formatCurrency(dept.totalValue)}</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--surface-tertiary)', borderRadius: '3px' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${percentage}%`,
                            background: CHART_COLORS.SAP,
                            borderRadius: '3px'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Top Tracked Suppliers</span>
          </div>
          <div className="card-body">
            {supplierData.length === 0 ? (
              <div className="empty-state">No data available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {supplierData.map((supplier, index) => {
                  const maxValue = supplierData[0].totalValue;
                  const percentage = (supplier.totalValue / maxValue) * 100;

                  return (
                    <div key={supplier.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: CHART_COLORS[supplier.group] || 'var(--text-muted)'
                            }}
                          />
                          <span style={{ color: 'var(--text-secondary)' }}>{supplier.name}</span>
                        </span>
                        <span style={{ fontWeight: 500 }}>{formatCurrency(supplier.totalValue)}</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--surface-tertiary)', borderRadius: '3px' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${percentage}%`,
                            background: CHART_COLORS[supplier.group] || 'var(--text-muted)',
                            borderRadius: '3px'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
