import { useEffect, useState } from 'react';
import { supabase, configured } from './lib/supabase.js';
import { usePath, Link } from './lib/router.jsx';
import Login from './pages/Login.jsx';
import Inbox from './pages/Inbox.jsx';
import Snapshot from './pages/Snapshot.jsx';
import Enquiry from './pages/Enquiry.jsx';
import PublicReport from './pages/PublicReport.jsx';

export default function App() {
  const path = usePath();
  if (!configured) {
    return <main className="wrap"><p className="error">The app is not connected to the database yet (VITE_SUPABASE_URL / VITE_SUPABASE_KEY are empty).</p></main>;
  }
  const report = path.match(/^\/r\/([\w-]+)$/);
  if (report) return <PublicReport token={report[1]} />;
  return <Desk path={path} />;
}

function Desk({ path }) {
  const [session, setSession] = useState(undefined);
  const [coach, setCoach] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Logged in is not enough: the account has to be on the coach list.
  useEffect(() => {
    if (!session) { setCoach(undefined); return; }
    supabase.from('coaches').select('user_id').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setCoach(Boolean(data)));
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Login />;
  if (coach === undefined) return null;
  if (!coach) {
    return (
      <main className="wrap">
        <p className="error">This account has no access to the coach desk.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </main>
    );
  }

  const a = path.match(/^\/a\/([\w-]+)$/);
  const e = path.match(/^\/e\/([\w-]+)$/);
  return (
    <>
      <nav className="top">
        <Link to="/" className="brand"><img src="/logo-horiz-white.png" alt="Concrete Surfers" /></Link>
        <button className="link-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </nav>
      {a ? <Snapshot key={a[1]} id={a[1]} /> : e ? <Enquiry key={e[1]} id={e[1]} /> : <Inbox />}
    </>
  );
}
