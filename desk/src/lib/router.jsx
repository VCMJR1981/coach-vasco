import { useEffect, useState } from 'react';

export function navigate(path) {
  if (path === location.pathname) return;
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return path;
}

// <a> that moves inside the app without reloading
export function Link({ to, children, ...rest }) {
  return (
    <a href={to} {...rest} onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); navigate(to);
    }}>{children}</a>
  );
}
