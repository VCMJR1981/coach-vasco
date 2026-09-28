import { useState } from 'react';
import { supabase, must } from '../lib/supabase.js';

// For an erasure request: removes the person and everything linked to them.
export default function DeleteClient({ client, onDone }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  if (!client?.id) return null;

  async function remove() {
    if (!confirm('This deletes the person, every submission, consent record, review and report. It cannot be undone. Delete?')) return;
    setBusy(true);
    try { await must(supabase.from('clients').delete().eq('id', client.id)); onDone(); }
    catch (e) { alert(e.message); setBusy(false); }
  }

  return (
    <details className="danger">
      <summary>Delete this person (erasure request)</summary>
      <p className="muted small">
        Removes {client.email} and everything linked to them, including the proof of consent.
        If you have already posted their clip, take the post down first.
      </p>
      <div className="field">
        <label htmlFor="del">Type their email to confirm</label>
        <input id="del" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </div>
      <button className="btn btn-ghost" disabled={busy || typed.trim().toLowerCase() !== client.email} onClick={remove}>
        Delete everything
      </button>
    </details>
  );
}
