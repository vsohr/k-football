import { useMetaStore } from '@/state/metaStore';

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

const KIT = ['#E8453C', '#2D6CF0'] as const;

/** Top-centre scoreboard + match timer. DOM overlay over the canvas (never occludes the goals). */
export function Hud() {
  const scoreHome = useMetaStore((s) => s.scoreHome);
  const scoreAway = useMetaStore((s) => s.scoreAway);
  const clockSec = useMetaStore((s) => s.clockSec);
  const half = useMetaStore((s) => s.half);
  const toast = useMetaStore((s) => s.toast);

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
        fontFamily: 'system-ui, sans-serif',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '8px 18px',
          borderRadius: 12,
          background: 'rgba(13,17,23,0.72)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 0.5,
          boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
        }}
      >
        <Swatch color={KIT[0]} label="HOME" />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {scoreHome} <span style={{ opacity: 0.5 }}>—</span> {scoreAway}
        </span>
        <Swatch color={KIT[1]} label="AWAY" reverse />
        <span
          style={{
            marginLeft: 10,
            paddingLeft: 14,
            borderLeft: '1px solid rgba(255,255,255,0.18)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 18,
            opacity: 0.92,
          }}
        >
          {formatClock(clockSec)} <span style={{ opacity: 0.55, fontSize: 13 }}>H{half}</span>
        </span>
      </div>
      {toast && (
        <div
          style={{
            padding: '6px 20px',
            borderRadius: 10,
            background: 'rgba(255,210,63,0.95)',
            color: '#1a1500',
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function Swatch({ color, label, reverse }: { color: string; label: string; reverse?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: reverse ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 6,
        fontSize: 14,
        opacity: 0.85,
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
      {label}
    </span>
  );
}
