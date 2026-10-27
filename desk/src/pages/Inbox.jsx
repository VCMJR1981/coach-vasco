import { useEffect, useState } from 'react';
import { supabase, must, SNAPSHOT_LIMIT } from '../lib/supabase.js';
import { Link } from '../lib/router.jsx';
import { day, monthName, PRODUCTS, STATUSES } from '../lib/format.js';
import { downloadBackup } from '../lib/backup.js';

const statusLabel = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));

export default function Inbox() {
  const [tab, setTab] = useState(() => sessionStorage.getItem('tab') || 'snapshots');
  const [snaps, setSnaps] = useState(null);
  const [enquiries, setEnquiries] = useState(null);
  const [count, setCount] = useState(null);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, s, c] = await Promise.all([
          must(supabase.from('assessments')
            .select('id, kind, status, created_at, clip_received_at, clients(name, email)')
            .in('kind', ['snapshot_surf', 'snapshot_skate'])
            .order('created_at', { ascending: false }).limit(300)),
          must(supabase.from('submissions')
            .select('id, product, name, email, country, created_at, handled_at')
            .not('product', 'like', 'snapshot%')
            .order('created_at', { ascending: false }).limit(300)),
          must(supabase.rpc('snapshot_month_count')),
        ]);
        setSnaps(a); setEnquiries(s); setCount(c);
      } catch (e) { setError(e.message); }
    })();
  }, []);

  function pick(t) { setTab(t); try { sessionStorage.setItem('tab', t); } catch { /* private mode */ } }

  async function backup() {
    setBackingUp(true);
    try { await downloadBackup(); } catch (e) { alert('Backup failed: ' + e.message); }
    setBackingUp(false);
  }

  const open = (snaps || []).filter((a) => showDone || a.status !== 'sent');
  const enq = (enquiries || []).filter((s) => showDone || !s.handled_at);
  const newEnq = (enquiries || []).filter((s) => !s.handled_at).length;
  const openSnaps = (snaps || []).filter((a) => a.status !== 'sent').length;

  return (
    <main className="wrap">
      <section className={'counter' + (count >= SNAPSHOT_LIMIT ? ' full' : '')}>
        <span className="kicker">Snapshots in {monthName()}</span>
        <p className="big">{count ?? '–'} <small>of {SNAPSHOT_LIMIT}</small></p>
        <p className="muted">
          {count >= SNAPSHOT_LIMIT
            ? 'All places used. The website now says the next places open on the 1st.'
            : 'A place counts once the clip is marked as received.'}
        </p>
      </section>

      {error && <p className="error">{error}</p>}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'snapshots'} onClick={() => pick('snapshots')}>
          Snapshots <span className="n">{openSnaps}</span>
        </button>
        <button role="tab" aria-selected={tab === 'enquiries'} onClick={() => pick('enquiries')}>
          Other enquiries <span className="n">{newEnq}</span>
        </button>
      </div>

      <label className="toggle">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
        Show sent and handled
      </label>

      {tab === 'snapshots' && (
        <ul className="list">
          {snaps && open.length === 0 && <li className="empty">Nothing waiting.</li>}
          {open.map((a) => (
            <li key={a.id}>
              <Link to={`/a/${a.id}`} className="row">
                <span className="who">{a.clients?.name || a.clients?.email}</span>
                <span className={'chip s-' + a.status}>{statusLabel[a.status]}</span>
                <span className="meta">
                  {a.kind === 'snapshot_skate' ? 'Surfskate · ' : ''}arrived {day(a.created_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {tab === 'enquiries' && (
        <ul className="list">
          {enquiries && enq.length === 0 && <li className="empty">Nothing waiting.</li>}
          {enq.map((s) => (
            <li key={s.id}>
              <Link to={`/e/${s.id}`} className="row">
                <span className="who">{s.name}</span>
                <span className={'chip' + (s.handled_at ? ' s-sent' : ' s-new')}>
                  {s.handled_at ? 'Handled' : PRODUCTS[s.product]}
                </span>
                <span className="meta">{PRODUCTS[s.product]} · {s.country} · {day(s.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="backup">
        <p className="muted">
          The free database plan keeps no backups you can download. Save one now and then.
        </p>
        <button className="btn btn-ghost" onClick={backup} disabled={backingUp}>
          {backingUp ? 'Preparing…' : 'Download a backup'}
        </button>
      </section>
    </main>
  );
}
