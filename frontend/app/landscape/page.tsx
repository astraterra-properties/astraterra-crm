'use client';
import { useEffect } from 'react';
export default function LandscapePage() {
  useEffect(() => { window.location.replace('/landscape/index.html'); }, []);
  return (
    <div style={{ background: '#080f1d', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#c9a96e', fontFamily: 'sans-serif' }}>Loading LandscapeAI...</p>
    </div>
  );
}
