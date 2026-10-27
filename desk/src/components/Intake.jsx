import { useState } from 'react';
import { supabase, must } from '../lib/supabase.js';
import { dayTime, PRODUCTS, DETAIL_LABELS } from '../lib/format.js';
import { hostName } from '../lib/video.js';

// What the person sent, read-only.
export function IntakeDetails({ sub }) {
  const rows = [
    ['Product', PRODUCTS[sub.product]],
    ['Email', sub.email && <a href={`mailto:${sub.email}`}>{sub.email}</a>],
    ['Phone / WhatsApp', sub.phone && (
      <a href={`https://wa.me/${sub.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer">{sub.phone}</a>
    )],
    ['Country / time zone', sub.country],
    ['Level', sub.level],
    ['Footage', sub.footage_link && (
      <a href={sub.footage_link} target="_blank" rel="noopener noreferrer">Open clip ({hostName(sub.footage_link)})</a>
    )],
    ["What's in it", sub.footage_note],
    ['Surf frequency, next trip', sub.surf_frequency],
    ["What's frustrating them", sub.frustration],
    ...Object.entries(sub.details || {}).map(([k, v]) => [DETAIL_LABELS[k] || k, v]),
    ['Arrived', dayTime(sub.created_at)],
    ['Source', sub.source],
  ].filter(([, v]) => v);
  return (
    <dl className="facts">
      {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
    </dl>
  );
}

// Current consent state, with the full log and a way to record a withdrawal.
export function Consents({ clientId, log, onChange }) {
  const [busy, setBusy] = useState(false);
  const latest = (kind) => log.filter((c) => c.kind === kind)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  async function withdraw(kind) {
    const note = prompt(kind === 'footage_use'
      ? 'Record that footage-use consent is withdrawn. How did they tell you? (e.g. "email, 3 Oct")'
      : 'Record that they no longer want training notes. How did they tell you?');
    if (note === null) return;
    setBusy(true);
    try {
      await must(supabase.from('consents').insert({ client_id: clientId, kind, action: 'withdrawn',
        recorded_by: 'coach', note: note.trim() || null }));
      await onChange();
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  const row = (kind, title) => {
    const c = latest(kind);
    const on = c?.action === 'given';
    return (
      <div className={'consent-row' + (on ? ' on' : '')}>
        <div>
          <b>{title}</b>
          <span>
            {!c && 'Not given'}
            {c && on && `Given ${dayTime(c.created_at)}${c.credit_as ? `, credit as ${c.credit_as}` : ''}`}
            {c && !on && `Withdrawn ${dayTime(c.created_at)}${c.note ? ` (${c.note})` : ''}`}
          </span>
        </div>
        {on && <button className="btn btn-ghost small" disabled={busy} onClick={() => withdraw(kind)}>Record withdrawal</button>}
      </div>
    );
  };

  return (
    <div className="consents">
      {row('footage_use', 'Use of the clip')}
      {row('newsletter', 'Training notes emails')}
      {log.length > 0 && (
        <details>
          <summary>Consent log ({log.length})</summary>
          <ul className="log">
            {log.map((c) => (
              <li key={c.id}>
                {dayTime(c.created_at)}: {c.kind === 'footage_use' ? 'clip use' : 'training notes'} {c.action}
                {c.recorded_by === 'coach' ? ' (recorded by coach)' : ' (website form)'}
                {c.wording && <q>{c.wording}</q>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
