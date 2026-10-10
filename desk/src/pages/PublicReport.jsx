import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import ReportView from '../components/ReportView.jsx';

// What the client opens. No login: the long random token in the link is
// the key, and the database only ever hands back the published copy.
export default function PublicReport({ token }) {
  const [report, setReport] = useState(undefined);

  useEffect(() => {
    supabase.rpc('get_report', { p_token: token }).then(({ data, error }) => {
      setReport(error ? null : data);
    });
  }, [token]);

  useEffect(() => { if (report) document.title = `${report.title} | Concrete Surfers`; }, [report]);

  if (report === undefined) return <main className="report-page"><p className="muted">Loading…</p></main>;
  if (!report) {
    return (
      <main className="report-page">
        <article className="report">
          <img className="report-logo" src="/logo-horiz-white.png" alt="Concrete Surfers" />
          <h1>This link isn't active</h1>
          <p>It may have been replaced by a newer one. Write to <a href="mailto:info@concrete-surfers.com">info@concrete-surfers.com</a> and we'll send you the right link.</p>
        </article>
      </main>
    );
  }
  return <main className="report-page"><ReportView report={report} /></main>;
}
