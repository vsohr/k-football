/**
 * App shell. The R3F game canvas + the authoritative loop driver are wired here
 * once the M0 core (loop/time/rng/world) lands. For now a placeholder so the app boots.
 */
export function App() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        color: '#9DC9FF',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <p>k-football — booting…</p>
    </div>
  );
}
