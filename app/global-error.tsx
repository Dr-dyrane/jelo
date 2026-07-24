'use client';

import { useEffect } from 'react';

// Last-resort boundary: it replaces the root layout when the root itself fails,
// so it must render its own html/body and cannot rely on the tokens or fonts.
// Kept minimal and self-contained; a calm message, not a stack.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '2rem', background: '#fffdf9', color: '#2d211f', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '30rem' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b3b35' }}>JeloCare</p>
          <h1 style={{ margin: '0.5rem 0 0.4rem', fontSize: '2rem', fontWeight: 400, lineHeight: 1.05 }}>Something slipped.</h1>
          <p style={{ margin: '0 0 1.5rem', color: '#7a6b66', lineHeight: 1.6 }}>The page could not load. Reload to try again.</p>
          <button type="button" onClick={reset} style={{ padding: '0.8rem 1.4rem', border: 0, borderRadius: '999px', background: '#2d211f', color: '#fff', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}>Reload</button>
          {error.digest ? <p style={{ margin: '1.25rem 0 0', color: '#7a6b66', fontSize: '0.72rem' }}>Reference {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
