import { supabase, must } from './supabase.js';

const TABLES = ['clients', 'submissions', 'consents', 'assessments', 'reports'];
const PAGE = 1000;

// Everything, as one JSON file. Pages through each table because the API
// returns at most 1000 rows per request.
export async function downloadBackup() {
  const out = { exported_at: new Date().toISOString() };
  for (const t of TABLES) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const page = await must(supabase.from(t).select('*').order('created_at').range(from, from + PAGE - 1));
      rows.push(...page);
      if (page.length < PAGE) break;
    }
    out[t] = rows;
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `concrete-surfers-backup-${out.exported_at.slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
