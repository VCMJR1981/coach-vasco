import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, must, SNAPSHOT_LIMIT } from '../lib/supabase.js';
import { Link, navigate } from '../lib/router.jsx';
import { day, dayTime, firstName, STATUSES } from '../lib/format.js';
import { FIELDS, TEMPLATE, buildReport, missing, internalWords } from '../templates/snapshotSurf.js';
import { IntakeDetails, Consents } from '../components/Intake.jsx';
import ReportView from '../components/ReportView.jsx';
import DeleteClient from '../components/DeleteClient.jsx';

const order = STATUSES.map((s) => s.id);

export default function Snapshot({ id }) {
  const [a, setA] = useState(null);
  const [consents, setConsents] = useState([]);
  const [reports, setReports] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [input, setInput] = useState({});
  const [internal, setInternal] = useState({ internal_classification: '', private_notes: '' });
  const [save, setSave] = useState('saved');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const row = await must(supabase.from('assessments')
        .select('*, clients(*), submissions(*)').eq('id', id).single());
      const [c, r, h] = await Promise.all([
        must(supabase.from('consents').select('*').eq('client_id', row.client_id).order('created_at', { ascending: false })),
        must(supabase.from('reports').select('*').eq('assessment_id', id).order('version', { ascending: false })),
        must(supabase.from('submissions').select('id, product, created_at').eq('client_id', row.client_id)
          .order('created_at', { ascending: false })),
      ]);
      setA(row); setConsents(c); setReports(r); setHistory(h);
      return row;
    } catch (e) { setError(e.message); }
  }, [id]);

  useEffect(() => {
    load().then((row) => {
      if (!row) return;
      setInput(row.coach_input || {});
      setInternal({ internal_classification: row.internal_classification || '', private_notes: row.private_notes || '' });
    });
  }, [load]);

  // Autosave, a moment after the last keystroke
  function persist(nextInput, nextInternal) {
    setSave('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from('assessments').update({
        coach_input: nextInput,
        internal_classification: nextInternal.internal_classification || null,
        private_notes: nextInternal.private_notes || null,
      }).eq('id', id);
      setSave(error ? 'error' : 'saved');
      if (error) setError(error.message);
    }, 700);
  }
  const setField = (k, v) => { const n = { ...input, [k]: v }; setInput(n); persist(n, internal); };
  const setInt = (k, v) => { const n = { ...internal, [k]: v }; setInternal(n); persist(input, n); };

  useEffect(() => {
    const warn = (e) => { if (save !== 'saved') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save]);

  async function setStatus(status) {
    if (status === 'clip_received' && !a.clip_received_at) {
      const used = await must(supabase.rpc('snapshot_month_count'));
      if (used >= SNAPSHOT_LIMIT &&
          !confirm(`${used} Snapshot clips are already in this month. This one would be number ${used + 1}. Continue?`)) return;
    }
    setBusy(true);
    try { await must(supabase.from('assessments').update({ status }).eq('id', id)); await load(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  }

  if (error && !a) return <main className="wrap"><p className="error">{error}</p></main>;
  if (!a) return <main className="wrap"><p className="muted">Loading…</p></main>;

  const sub = a.submissions || {};
  const client = a.clients || {};
  const idx = order.indexOf(a.status);
  const draft = buildReport(input, { firstName: firstName(client.name), clipLink: sub.footage_link, date: new Date().toISOString() });
  const latest = reports[0];
  const same = (x, y) => canonical({ ...x, date: null }) === canonical({ ...y, date: null });
  const unpublished = !latest || !same(latest.content, draft);
  const link = a.share_token && !a.share_revoked_at ? `${location.origin}/r/${a.share_token}` : null;

  async function publish() {
    await flush();
    const gaps = missing(input);
    if (gaps.length) { alert('Still empty:\n\n' + gaps.join('\n')); return; }
    const words = internalWords(input, internal.internal_classification);
    if (words.length && !confirm(`The client text contains what looks like an internal label: ${words.join(', ')}.\n\nPublish anyway?`)) return;
    setBusy(true);
    try {
      await must(supabase.from('reports').insert({
        assessment_id: id, version: (latest?.version || 0) + 1,
        template_key: TEMPLATE.key, template_version: TEMPLATE.version, content: draft,
      }));
      if (!link) await must(supabase.rpc('share_link', { p_assessment: id }));
      if (idx < order.indexOf('in_review')) await must(supabase.from('assessments').update({ status: 'in_review' }).eq('id', id));
      await load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function flush() {
    if (save === 'saved') return;
    clearTimeout(timer.current);
    await must(supabase.from('assessments').update({
      coach_input: input,
      internal_classification: internal.internal_classification || null,
      private_notes: internal.private_notes || null,
    }).eq('id', id));
    setSave('saved');
  }

  async function revoke() {
    if (!confirm('Turn the link off? The client will no longer be able to open the report.')) return;
    await must(supabase.from('assessments').update({ share_revoked_at: new Date().toISOString() }).eq('id', id));
    await load();
  }
  async function newLink() {
    await must(supabase.rpc('share_link', { p_assessment: id }));
    await load();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); alert('Link copied.'); }
    catch { prompt('Copy the link:', link); }
  }

  return (
    <main className="wrap">
      <p className="crumbs"><Link to="/">← Inbox</Link></p>
      <header className="page-head">
        <span className="kicker">{a.kind === 'snapshot_skate' ? 'Surfskate Snapshot' : 'Surf Snapshot'}</span>
        <h1>{client.name}</h1>
        {history.length > 1 && (
          <p className="muted">{history.length} submissions from this person so far.</p>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      <ol className="steps">
        {STATUSES.map((s, i) => (
          <li key={s.id} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
            <span>{s.label}</span>
            <small>{dayTime({ new: a.created_at, clip_received: a.clip_received_at,
              in_review: a.review_started_at, sent: a.sent_at }[s.id])}</small>
          </li>
        ))}
      </ol>
      <div className="step-actions">
        {a.status === 'new' && <button className="btn" disabled={busy} onClick={() => setStatus('clip_received')}>The clip works: mark received</button>}
        {a.status === 'clip_received' && <button className="btn" disabled={busy} onClick={() => setStatus('in_review')}>Start review</button>}
        {a.status === 'in_review' && latest && <button className="btn" disabled={busy} onClick={() => setStatus('sent')}>I sent the link: mark sent</button>}
        {idx > 0 && <button className="link-btn" disabled={busy} onClick={() => setStatus(order[idx - 1])}>Move back a step</button>}
      </div>

      <section className="panel">
        <h2>What they sent</h2>
        <IntakeDetails sub={sub} />
        <h3>Consent</h3>
        <Consents clientId={a.client_id} log={consents} onChange={load} />
      </section>

      <section className="panel coach-form">
        <div className="panel-head">
          <h2>Your review</h2>
          <span className={'save ' + save}>{{ saved: 'Saved', saving: 'Saving…', error: 'Not saved' }[save]}</span>
        </div>

        {FIELDS.map((f) => {
          if (f.id === 'moments') return <Moments key={f.id} f={f} value={input.moments || []} onChange={(v) => setField('moments', v)} />;
          if (f.kind === 'yesno') return (
            <fieldset key={f.id} className="field yesno">
              <legend>{f.label}</legend>
              {['yes', 'no'].map((v) => (
                <label key={v}><input type="radio" name={f.id} checked={input[f.id] === v}
                  onChange={() => setField(f.id, v)} /> {v === 'yes' ? 'Yes' : 'No'}</label>
              ))}
            </fieldset>
          );
          const el = (
            <div key={f.id} className="field">
              <label htmlFor={f.id}>{f.label}</label>
              {f.help && <p className="hint">{f.help}</p>}
              {f.single
                ? <input id={f.id} value={input[f.id] || ''} onChange={(e) => setField(f.id, e.target.value)} />
                : <textarea id={f.id} value={input[f.id] || ''} onChange={(e) => setField(f.id, e.target.value)} />}
            </div>
          );
          // The classification sits next to the breakdown it describes, walled off.
          if (f.id !== 'breakdown') return el;
          return [el, (
            <div key="internal-1" className="field internal">
              <label htmlFor="cls">Failure classification <em>Internal only. Never shown to the client.</em></label>
              <input id="cls" value={internal.internal_classification}
                onChange={(e) => setInt('internal_classification', e.target.value)} />
            </div>
          )];
        })}

        <div className="field internal">
          <label htmlFor="notes">Private notes <em>Internal only. Never shown to the client.</em></label>
          <textarea id="notes" value={internal.private_notes} onChange={(e) => setInt('private_notes', e.target.value)} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Report</h2>
          <button className="link-btn" onClick={() => setPreview(!preview)}>{preview ? 'Hide preview' : 'Preview'}</button>
        </div>
        {preview && <div className="preview-frame"><ReportView report={draft} preview /></div>}

        {link ? (
          <div className="share">
            <p className="kicker">Client link</p>
            <p className="share-url"><a href={link} target="_blank" rel="noopener noreferrer">{link}</a></p>
            <div className="row-btns">
              <button className="btn" onClick={copy}>Copy link</button>
              <a className="btn btn-ghost" href={`https://wa.me/${(sub.phone || '').replace(/[^\d]/g, '')}?text=${encodeURIComponent(link)}`}
                target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <a className="btn btn-ghost" href={`mailto:${client.email}?subject=${encodeURIComponent('Your Snapshot')}&body=${encodeURIComponent(link)}`}>Email</a>
            </div>
            <p className="muted small">
              The link always shows the latest published version.{' '}
              <button className="link-btn" onClick={revoke}>Turn the link off</button>
            </p>
          </div>
        ) : a.share_token ? (
          <p className="muted">The link is off. <button className="link-btn" onClick={newLink}>Make a new link</button> (the old one stays dead).</p>
        ) : null}

        <div className="publish">
          {unpublished
            ? <button className="btn" disabled={busy} onClick={publish}>{latest ? `Publish version ${latest.version + 1}` : 'Publish and create the link'}</button>
            : <p className="muted">Version {latest.version} is live and matches what you typed.</p>}
          {unpublished && latest && <p className="muted small">You have changes since version {latest.version}.</p>}
        </div>

        {reports.length > 0 && (
          <details>
            <summary>Versions ({reports.length})</summary>
            <ul className="log">
              {reports.map((r) => <li key={r.id}>Version {r.version}, published {dayTime(r.created_at)}</li>)}
            </ul>
          </details>
        )}
      </section>

      <DeleteClient client={client} onDone={() => navigate('/')} />
      <p className="muted small">Arrived {day(a.created_at)}.</p>
    </main>
  );
}

// The database stores JSON with its keys re-ordered, so compare with sorted keys.
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  return JSON.stringify(v ?? null);
}

function Moments({ f, value, onChange }) {
  const rows = value.length ? value : [{ time: '', note: '' }];
  const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="field">
      <label>{f.label}</label>
      <p className="hint">{f.help} Times become links for YouTube clips only.</p>
      {rows.map((r, i) => (
        <div key={i} className="moment">
          <input aria-label="Time" placeholder="0:12" value={r.time} inputMode="numeric"
            onChange={(e) => set(i, 'time', e.target.value)} />
          <input aria-label="What happens" placeholder="What happens here" value={r.note}
            onChange={(e) => set(i, 'note', e.target.value)} />
          <button className="link-btn" aria-label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button className="link-btn" onClick={() => onChange([...rows, { time: '', note: '' }])}>+ Add a moment</button>
    </div>
  );
}
