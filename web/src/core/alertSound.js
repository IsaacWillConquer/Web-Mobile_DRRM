// Short alert tone for incoming report pings. Uses the Web Audio API so no
// binary asset is needed; playback is best-effort (browsers may block audio
// until the user has interacted with the page).
let context = null;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!context) context = new AudioCtx();
  return context;
}

export function playAlertSound() {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const notes = [
      { at: 0, freq: 880 },
      { at: 0.18, freq: 1175 },
    ];
    notes.forEach(({ at, freq }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + at);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.25, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.18);
    });
  } catch {
    // Sound is a nice-to-have; never let it break the UI.
  }
}
