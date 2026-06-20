import { useEffect } from 'react';
import { useMetaStore } from '@/state/metaStore';

const overlay: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(7,10,15,0.62)',
  fontFamily: 'system-ui, sans-serif',
  color: '#fff',
  textAlign: 'center',
};

const card: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  padding: '30px 40px',
  borderRadius: 16,
  background: 'rgba(13,17,23,0.85)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
};

const button: React.CSSProperties = {
  pointerEvents: 'auto',
  cursor: 'pointer',
  border: 'none',
  borderRadius: 10,
  padding: '12px 26px',
  fontSize: 18,
  fontWeight: 800,
  background: '#FFD23F',
  color: '#1a1500',
};

/** Start / Pause / Full-time overlays + their key handling. */
export function Menu() {
  const started = useMetaStore((s) => s.started);
  const paused = useMetaStore((s) => s.paused);
  const phase = useMetaStore((s) => s.phase);
  const scoreHome = useMetaStore((s) => s.scoreHome);
  const scoreAway = useMetaStore((s) => s.scoreAway);
  const reduceMotion = useMetaStore((s) => s.reduceMotion);

  const fullTime = phase === 'FULL_TIME';

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const st = useMetaStore.getState();
      if (!st.started && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        st.start();
      } else if (st.started && st.phase !== 'FULL_TIME' && e.code === 'Escape') {
        st.setPaused(!st.paused);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (started && !paused && !fullTime) return null;

  return (
    <div style={overlay}>
      <div style={card}>
        {!started && (
          <>
            <h1 style={{ margin: 0, fontSize: 44, letterSpacing: 1 }}>k-football</h1>
            <p style={{ margin: 0, opacity: 0.75, fontSize: 14, lineHeight: 1.6 }}>
              Move <b>WASD / arrows</b> · Pass <b>J</b> · Shoot <b>K / Space</b> · Tackle <b>Shift</b>
              <br />
              Auto-switch to the nearest player · Esc to pause
            </p>
            <button style={button} onClick={() => useMetaStore.getState().start()}>
              Kick off
            </button>
            <MotionToggle reduceMotion={reduceMotion} />
          </>
        )}

        {started && paused && !fullTime && (
          <>
            <h2 style={{ margin: 0, fontSize: 30 }}>Paused</h2>
            <button style={button} onClick={() => useMetaStore.getState().setPaused(false)}>
              Resume
            </button>
            <MotionToggle reduceMotion={reduceMotion} />
            <button style={{ ...button, background: '#2a2f3a', color: '#fff' }} onClick={() => location.reload()}>
              Restart
            </button>
          </>
        )}

        {fullTime && (
          <>
            <h2 style={{ margin: 0, fontSize: 22, opacity: 0.8 }}>Full Time</h2>
            <div style={{ fontSize: 40, fontWeight: 800 }}>
              {scoreHome} — {scoreAway}
            </div>
            <div style={{ fontSize: 18, opacity: 0.85 }}>
              {scoreHome === scoreAway ? 'Draw' : scoreHome > scoreAway ? 'Home wins' : 'Away wins'}
            </div>
            <button style={button} onClick={() => location.reload()}>
              Rematch
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MotionToggle({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <button
      style={{
        pointerEvents: 'auto',
        cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 8,
        padding: '6px 14px',
        fontSize: 13,
        background: 'transparent',
        color: '#cdd6e0',
      }}
      onClick={() => useMetaStore.getState().toggleReduceMotion()}
    >
      Reduce motion: {reduceMotion ? 'ON' : 'OFF'}
    </button>
  );
}
