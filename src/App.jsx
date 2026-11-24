import React, { useState, useEffect, useCallback } from 'react';
import AccountsView from './views/AccountsView';
import AccountProfile from './views/AccountProfile';
import RenewalSignals from './views/RenewalSignals';
import MarketOverview from './views/MarketOverview';
import { fetchContracts, aggregateByDepartment } from './data/api';

const CURRENT_YEAR = new Date().getFullYear();
const DATA_START_DATE = `${CURRENT_YEAR - 5}-01-01`;

export default function App() {
  const [view, setView] = useState('accounts');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [dataInfo, setDataInfo] = useState({ total: 0, loaded: 0 });

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const allContracts = [];
      let offset = 0;
      const batchSize = 1000;
      let totalRecords = 0;
      let hasMore = true;

      while (hasMore && offset < 50000) {
        const result = await fetchContracts({ limit: batchSize, offset });
        totalRecords = result.total;

        const trackedContracts = result.records.filter(c => c.supplierGroup !== null);
        allContracts.push(...trackedContracts);

        setDataInfo({ total: totalRecords, loaded: offset + result.records.length });

        if (result.records.length < batchSize || offset + batchSize >= 50000) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      }

      const dateFiltered = allContracts.filter(c => {
        if (!c.contract_date) return true;
        return c.contract_date >= DATA_START_DATE;
      });

      setContracts(dateFiltered);
      setDepartments(aggregateByDepartment(dateFiltered));
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleSelectAccount = (account) => {
    setSelectedAccount(account);
    setView('account-profile');
  };

  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    setView('accounts');
  };

  const renderView = () => {
    if (loading) {
      return (
        <div className="loading">
          <div className="spinner" />
          <span>Loading contract data... ({dataInfo.loaded.toLocaleString()} of ~{dataInfo.total.toLocaleString()} records scanned)</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="empty-state">
          <p>Error loading data: {error}</p>
          <button className="btn btn-primary" onClick={loadInitialData} style={{ marginTop: '16px' }}>
            Retry
          </button>
        </div>
      );
    }

    switch (view) {
      case 'accounts':
        return (
          <AccountsView
            departments={departments}
            onSelectAccount={handleSelectAccount}
          />
        );
      case 'account-profile':
        return (
          <AccountProfile
            account={selectedAccount}
            contracts={contracts.filter(c => c.owner_org === selectedAccount?.code)}
            onBack={handleBackToAccounts}
          />
        );
      case 'renewals':
        return (
          <RenewalSignals
            contracts={contracts}
            departments={departments}
          />
        );
      case 'market':
        return (
          <MarketOverview
            contracts={contracts}
            departments={departments}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          <h1>SAP Federal Account Planning</h1>
          <span className="header-subtitle">Canadian Public Sector</span>
        </div>
        <nav className="nav">
          <button
            className={`nav-btn ${view === 'accounts' || view === 'account-profile' ? 'active' : ''}`}
            onClick={() => { setView('accounts'); setSelectedAccount(null); }}
          >
            Accounts
          </button>
          <button
            className={`nav-btn ${view === 'renewals' ? 'active' : ''}`}
            onClick={() => setView('renewals')}
          >
            Renewal Signals
          </button>
          <button
            className={`nav-btn ${view === 'market' ? 'active' : ''}`}
            onClick={() => setView('market')}
          >
            Market Overview
          </button>
        </nav>
      </header>

      <main className="main">
        {renderView()}
      </main>

      <footer className="footer">
        <div>
          <strong>Data Source:</strong> Government of Canada — Proactive Publication, Contracts over $10,000
          {' | '}
          <strong>Date Range:</strong> Jan 1, {CURRENT_YEAR - 5} – Present
          {' | '}
          <strong>Tracked Contracts:</strong> {contracts.length.toLocaleString()}
        </div>
        <div>
          {lastRefresh && (
            <span>Last refreshed: {lastRefresh.toLocaleTimeString()}</span>
          )}
          {' | '}
          <span style={{ color: 'var(--status-warning)' }}>
            Snapshot data — not automatically updated
          </span>
        </div>
      </footer>
    </div>
  );
}
