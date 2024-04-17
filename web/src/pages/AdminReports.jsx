import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import AdminOnly from '../components/AdminOnly.jsx';
import BarChart from '../components/BarChart.jsx';
import useLanguage from '../hooks/useLanguage';
import { formatDate } from '../utils/format';
import '../styles/reports.css';

const TABS = ['loans', 'overdue', 'top', 'waitlists'];
const MONTH_CHOICES = [3, 6, 12, 24];

// "2024-03" -> "03/24" (short enough for the chart axis)
function shortMonth(m) {
  return m.slice(5, 7) + '/' + m.slice(2, 4);
}

function useReport(path, query) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const key = path + JSON.stringify(query || {});
  useEffect(() => {
    let alive = true;
    setState(s => ({ data: s.data, error: null, loading: true }));
    api.get(path, { query: query })
      .then(data => alive && setState({ data: data, error: null, loading: false }))
      .catch(err => alive && setState({ data: null, error: err.message, loading: false }));
    return () => {
      alive = false;
    };
  }, [key]);
  return state;
}

function Summary() {
  const { t } = useLanguage();
  const { data } = useReport('/admin/reports/summary');
  if (!data) return null;
  const tiles = [
    ['openLoans', data.openLoans],
    ['overdue', data.overdue],
    ['loansThisMonth', data.loansThisMonth],
    ['waiting', data.waiting]
  ];
  return (
    <div className="c-tiles">
      {tiles.map(([key, value]) => (
        <div key={key} className={'c-tile' + (key === 'overdue' && value > 0 ? ' is-warning' : '')}>
          <div className="c-tile__value">{value}</div>
          <div className="c-tile__label">{t('reports.summary.' + key)}</div>
        </div>
      ))}
    </div>
  );
}

function LoansPerMonth({ months }) {
  const { t } = useLanguage();
  const [split, setSplit] = useState(false);
  const { data, error, loading } = useReport('/admin/reports/loans-per-month', { months: months });
  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="loading">{t('common.loading')}</div>;
  const chart = data.rows.map(r => ({
    label: r.month,
    values: split ? r : { [t('reports.loans.loans')]: r.loans }
  }));
  return (
    <section className={'c-report' + (loading ? ' is-loading' : '')}>
      <div className="c-report__head">
        <h2>{t('reports.loans.title')}</h2>
        <label className="toolbar-check">
          <input type="checkbox" checked={split} onChange={e => setSplit(e.target.checked)} /> {t('reports.loans.byLocation')}
        </label>
      </div>
      <BarChart
        data={chart}
        series={split ? data.locations : [t('reports.loans.loans')]}
        formatLabel={shortMonth}
        title={t('reports.loans.title')}
      />
      <table className="admin-table c-report__table">
        <thead>
          <tr>
            <th>{t('reports.month')}</th>
            <th className="num">{t('reports.loans.loans')}</th>
            <th className="num">{t('reports.loans.returned')}</th>
            {data.locations.map(l => <th key={l} className="num">{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.slice().reverse().map(r => (
            <tr key={r.month}>
              <td>{r.month}</td>
              <td className="num">{r.loans}</td>
              <td className="num">{r.returned}</td>
              {data.locations.map(l => <td key={l} className="num">{r[l] || 0}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="admin-count">{t('reports.loans.total', { total: data.total })}</p>
    </section>
  );
}

function Overdue() {
  const { t } = useLanguage();
  const [location, setLocation] = useState('');
  const { data, error } = useReport('/admin/reports/overdue', { location: location });
  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="loading">{t('common.loading')}</div>;
  return (
    <section className="c-report">
      <div className="c-report__head">
        <h2>{t('reports.overdue.title')}</h2>
        <select value={location} onChange={e => setLocation(e.target.value)} aria-label={t('reports.location')}>
          <option value="">{t('reports.allLocations')}</option>
          <option>Hamburg</option>
          <option>Berlin</option>
          <option>München</option>
        </select>
        <button type="button" className="c-report__print" onClick={() => window.print()}>{t('reports.print')}</button>
      </div>
      {data.length === 0 ? (
        <div className="empty">{t('reports.overdue.none')}</div>
      ) : (
        <table className="admin-table c-report__table">
          <thead>
            <tr>
              <th>{t('reports.overdue.book')}</th>
              <th>{t('reports.overdue.reader')}</th>
              <th>{t('reports.location')}</th>
              <th>{t('reports.overdue.due')}</th>
              <th className="num">{t('reports.overdue.days')}</th>
              <th className="num">{t('reports.overdue.reminders')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r => (
              <tr key={r.id} className={r.days_overdue > 14 ? 'is-late' : ''}>
                <td>{r.title}<div className="admin-table__sub mono">{r.barcode}</div></td>
                <td>{r.user_name}<div className="admin-table__sub">{r.email}{r.department ? ', ' + r.department : ''}</div></td>
                <td>{r.location}</td>
                <td>{formatDate(r.due_at)}</td>
                <td className="num">{r.days_overdue}</td>
                <td className="num">{r.reminder_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="admin-count"><Link to="/admin/loans">{t('reports.overdue.toLoans')}</Link></p>
    </section>
  );
}

function TopBooks({ months }) {
  const { t } = useLanguage();
  const { data, error } = useReport('/admin/reports/top-books', { months: months, limit: 10 });
  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="loading">{t('common.loading')}</div>;
  return (
    <section className="c-report">
      <h2>{t('reports.top.title')}</h2>
      <BarChart
        data={data.map(b => ({ label: b.title, value: b.loans }))}
        formatLabel={l => (l.length > 12 ? l.slice(0, 11) + '…' : l)}
        title={t('reports.top.title')}
        height={260}
      />
      <ol className="c-report__ranking">
        {data.map(b => (
          <li key={b.id}>
            <Link to={'/books/' + b.isbn}>{b.title}</Link> <span className="u-muted">{b.author}</span>
            <span className="c-report__numbers">
              {t('reports.top.numbers', { loans: b.loans, readers: b.readers, waiting: b.waiting })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Waitlists() {
  const { t } = useLanguage();
  const { data, error } = useReport('/admin/reports/waitlists');
  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="loading">{t('common.loading')}</div>;
  if (!data.length) return <div className="empty">{t('reports.waitlists.none')}</div>;
  return (
    <section className="c-report">
      <h2>{t('reports.waitlists.title')}</h2>
      <table className="admin-table c-report__table">
        <thead>
          <tr>
            <th>{t('reports.overdue.book')}</th>
            <th className="num">{t('reports.waitlists.waiting')}</th>
            <th className="num">{t('reports.waitlists.ready')}</th>
            <th className="num">{t('reports.waitlists.copies')}</th>
            <th className="num">{t('reports.waitlists.perCopy')}</th>
            <th>{t('reports.waitlists.since')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map(r => (
            <tr key={r.id} className={r.per_copy > 2 ? 'is-late' : ''}>
              <td><Link to={'/admin/reservations?isbn=' + encodeURIComponent(r.isbn)}>{r.title}</Link></td>
              <td className="num">{r.waiting}</td>
              <td className="num">{r.ready}</td>
              <td className="num">{r.copies}</td>
              <td className="num">{r.per_copy === null ? '-' : r.per_copy}</td>
              <td>{formatDate(r.waiting_since)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="admin-count">{t('reports.waitlists.hint')}</p>
    </section>
  );
}

export default function AdminReports() {
  const { t } = useLanguage();
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return TABS.indexOf(hash) !== -1 ? hash : 'loans';
  });
  const [months, setMonths] = useState(12);

  function choose(next) {
    setTab(next);
    window.history.replaceState(null, '', '#' + next);
  }

  return (
    <AdminOnly>
      <div className="c-reports">
        <h1>{t('reports.title')}</h1>
        <Summary />
        <div className="c-reports__bar">
          <div className="c-tabs" role="tablist">
            {TABS.map(name => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                className={'c-tabs__tab' + (tab === name ? ' is-active' : '')}
                onClick={() => choose(name)}
              >
                {t('reports.tabs.' + name)}
              </button>
            ))}
          </div>
          {(tab === 'loans' || tab === 'top') && (
            <label className="c-reports__months">
              {t('reports.period')}{' '}
              <select value={months} onChange={e => setMonths(parseInt(e.target.value, 10))}>
                {MONTH_CHOICES.map(m => <option key={m} value={m}>{t('reports.months', { n: m })}</option>)}
              </select>
            </label>
          )}
        </div>
        {tab === 'loans' && <LoansPerMonth months={months} />}
        {tab === 'overdue' && <Overdue />}
        {tab === 'top' && <TopBooks months={months} />}
        {tab === 'waitlists' && <Waitlists />}
      </div>
    </AdminOnly>
  );
}
