import { day } from '../lib/format.js';

// Renders a frozen report. Used for the client's link and the coach preview,
// so what the coach previews is exactly what the client gets.
export default function ReportView({ report, preview = false }) {
  return (
    <article className="report">
      <header className="report-head">
        <img className="report-logo" src="/logo-horiz-white.png" alt="Concrete Surfers" />
        <span className="kicker">{report.title}</span>
        {report.name && <h1>{report.name}</h1>}
        {report.date && <p className="report-date">{day(report.date)}</p>}
      </header>

      {report.sections.map((s, i) => (
        <section key={i} className={'report-sec' + (s.highlight ? ' highlight' : '')}>
          <h2>{s.heading}</h2>
          {s.moments && (
            <ul className="moments">
              {s.moments.map((m, j) => (
                <li key={j}>
                  {m.href
                    ? <a className="time" href={m.href} target="_blank" rel="noopener noreferrer">{m.time}</a>
                    : <span className="time">{m.time}</span>}
                  <span>{m.note}</span>
                </li>
              ))}
            </ul>
          )}
          {s.body && s.body.split(/\n{2,}/).map((p, j) => <p key={j}>{p}</p>)}
          {s.cta && (
            <p><a className="btn" href={s.cta.href} target="_blank" rel="noopener noreferrer">{s.cta.label}</a></p>
          )}
        </section>
      ))}

      <footer className="report-foot">
        <p>Vasco Rodrigues, Concrete Surfers</p>
        <p><a href="https://concrete-surfers.com">concrete-surfers.com</a> · <a href="mailto:info@concrete-surfers.com">info@concrete-surfers.com</a></p>
        {!preview && (
          <button className="btn btn-ghost no-print" onClick={() => window.print()}>Save as PDF</button>
        )}
      </footer>
    </article>
  );
}
