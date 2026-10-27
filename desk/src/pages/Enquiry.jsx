import { useCallback, useEffect, useState } from 'react';
import { supabase, must } from '../lib/supabase.js';
import { Link, navigate } from '../lib/router.jsx';
import { dayTime, PRODUCTS } from '../lib/format.js';
import { IntakeDetails, Consents } from '../components/Intake.jsx';
import DeleteClient from '../components/DeleteClient.jsx';

// Any enquiry that is not a Snapshot: read it, answer it, mark it handled.
export default function Enquiry({ id }) {
  const [sub, setSub] = useState(null);
  const [consents, setConsents] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await must(supabase.from('submissions').select('*, clients(*)').eq('id', id).single());
      setSub(s);
      setConsents(await must(supabase.from('consents').select('*').eq('client_id', s.client_id)
        .order('created_at', { ascending: false })));
    } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function mark(handled) {
    try {
      await must(supabase.from('submissions').update({ handled_at: handled ? new Date().toISOString() : null }).eq('id', id));
      await load();
    } catch (e) { setError(e.message); }
  }

  if (error && !sub) return <main className="wrap"><p className="error">{error}</p></main>;
  if (!sub) return <main className="wrap"><p className="muted">Loading…</p></main>;

  return (
    <main className="wrap">
      <p className="crumbs"><Link to="/">← Inbox</Link></p>
      <header className="page-head">
        <span className="kicker">{PRODUCTS[sub.product]}</span>
        <h1>{sub.name}</h1>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="step-actions">
        {sub.handled_at
          ? <><span className="muted">Handled {dayTime(sub.handled_at)}</span>
              <button className="link-btn" onClick={() => mark(false)}>Mark as not handled</button></>
          : <button className="btn" onClick={() => mark(true)}>Mark as handled</button>}
        <a className="btn btn-ghost" href={`mailto:${sub.email}`}>Email</a>
      </div>
      <section className="panel">
        <h2>What they sent</h2>
        <IntakeDetails sub={sub} />
        <h3>Consent</h3>
        <Consents clientId={sub.client_id} log={consents} onChange={load} />
      </section>
      <DeleteClient client={sub.clients} onDone={() => navigate('/')} />
    </main>
  );
}
