import type { ProgressLog as ProgressLogType } from '../types';

interface ProgressLogProps {
  logs: ProgressLogType[];
}

const levelColors = {
  info: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ProgressLog({ logs }: ProgressLogProps) {
  if (logs.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '50px 20px',
          color: 'var(--text-muted)',
          background: 'var(--surface-dim)',
          borderRadius: 'var(--radius-xl)',
          border: '2px dashed var(--border-default)',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.5 }}>📝</div>
        <p style={{ fontSize: '14px', fontWeight: '500' }}>아직 로그가 없습니다</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--surface-dim)',
        borderRadius: 'var(--radius-xl)',
        padding: '18px',
        maxHeight: '450px',
        overflowY: 'auto',
        border: '2px solid var(--border-default)',
        boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
      }}
    >
      {logs.map((log, index) => {
        const color = levelColors[log.level];
        return (
          <div
            key={index}
            style={{
              display: 'flex',
              gap: '14px',
              padding: '12px 0',
              borderBottom: index < logs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              animation: 'fadeIn 0.3s ease',
            }}
          >
            <div
              style={{
                width: '5px',
                background: `linear-gradient(180deg, ${color}, ${color}80)`,
                borderRadius: 'var(--radius-sm)',
                flexShrink: 0,
                boxShadow: `0 0 8px ${color}40`,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: '600',
                  }}
                >
                  {formatTime(log.timestamp)}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: `linear-gradient(135deg, ${color}30, ${color}20)`,
                    color: color,
                    textTransform: 'uppercase',
                    fontWeight: '700',
                    letterSpacing: '0.05em',
                    border: `1px solid ${color}40`,
                  }}
                >
                  {log.level}
                </span>
              </div>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  lineHeight: '1.6',
                  fontWeight: '500',
                }}
              >
                {log.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
