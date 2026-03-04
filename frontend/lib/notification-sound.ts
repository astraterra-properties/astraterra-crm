/**
 * CRM Notification Sounds — Web Audio API (no external files needed)
 * Works in all modern browsers. Respects browser autoplay policy by
 * lazily creating the AudioContext after first user interaction.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  holdDuration: number,
  fadeDuration: number,
  volume = 0.28
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  // Soft attack + hold + fade out
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.setValueAtTime(volume, startTime + holdDuration);
  gain.gain.linearRampToValueAtTime(0, startTime + holdDuration + fadeDuration);

  osc.start(startTime);
  osc.stop(startTime + holdDuration + fadeDuration + 0.05);
}

/**
 * playNotificationSound('message') — two-tone ascending chime (new chat message)
 * playNotificationSound('alert')   — three quick pings (new lead / system alert)
 * playNotificationSound('success') — warm ascending three-note fanfare (task complete etc.)
 */
export function playNotificationSound(type: 'message' | 'alert' | 'success' = 'message') {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (type === 'message') {
      // G5 → C6 — soft two-tone chime (WhatsApp-style)
      playTone(ctx, 784.0,  now,        0.10, 0.18);
      playTone(ctx, 1046.5, now + 0.13, 0.10, 0.22);

    } else if (type === 'alert') {
      // Three quick pings — new lead / important notification
      playTone(ctx, 880, now,        0.07, 0.10, 0.22);
      playTone(ctx, 880, now + 0.14, 0.07, 0.10, 0.22);
      playTone(ctx, 1108, now + 0.28, 0.09, 0.18, 0.22);

    } else if (type === 'success') {
      // C5 → E5 → G5 — ascending fanfare
      playTone(ctx, 523.25, now,        0.09, 0.12);
      playTone(ctx, 659.25, now + 0.14, 0.09, 0.12);
      playTone(ctx, 783.99, now + 0.28, 0.12, 0.22);
    }
  } catch {
    // Silently ignore — sound is best-effort
  }
}
