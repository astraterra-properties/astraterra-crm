'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', padding: '40px', background: '#0f1623', color: 'white' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ color: '#C9A96E' }}>CRM Error — Diagnosis</h2>
          <p style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: '14px', fontFamily: 'monospace', background: '#1a2035', padding: '16px', borderRadius: '8px', wordBreak: 'break-all' }}>
            {error?.message || 'Unknown error'}
          </p>
          {error?.stack && (
            <pre style={{ color: '#aaa', fontSize: '11px', overflow: 'auto', background: '#1a2035', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
              {error.stack.split('\n').slice(0, 8).join('\n')}
            </pre>
          )}
          <p style={{ color: '#888', fontSize: '12px' }}>Digest: {error?.digest || 'none'}</p>
          <button onClick={reset} style={{ marginTop: '16px', padding: '10px 20px', background: '#C9A96E', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
