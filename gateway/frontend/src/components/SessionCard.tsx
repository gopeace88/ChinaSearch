import type { Session } from '../types';

interface SessionCardProps {
  session: Session;
  onClick: () => void;
}

const statusColors = {
  running: '#3b82f6',
  paused: '#f59e0b',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#6b7280',
};

const statusLabels = {
  running: '진행중',
  paused: '일시정지',
  completed: '완료',
  failed: '실패',
  cancelled: '취소됨',
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${days}일 전`;
}

export default function SessionCard({ session, onClick }: SessionCardProps) {
  const statusColor = statusColors[session.status];
  const statusLabel = statusLabels[session.status];
  const progress = (session.currentRound / session.maxRounds) * 100;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.95) 0%, rgba(35, 35, 35, 0.8) 100%)',
        border: `2px solid ${statusColor}40`,
        borderRadius: 'var(--radius-xl)',
        padding: '22px',
        cursor: 'pointer',
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: `0 4px 16px ${statusColor}20, 0 0 0 0 ${statusColor}00`,
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-6px) scale(1.01)';
        e.currentTarget.style.boxShadow = `0 12px 32px ${statusColor}30, 0 0 0 2px ${statusColor}20`;
        e.currentTarget.style.borderColor = `${statusColor}80`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
        e.currentTarget.style.boxShadow = `0 4px 16px ${statusColor}20, 0 0 0 0 ${statusColor}00`;
        e.currentTarget.style.borderColor = `${statusColor}40`;
      }}
    >
      {/* Background glow effect */}
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          right: '-50%',
          width: '200%',
          height: '200%',
          background: `radial-gradient(circle, ${statusColor}15 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Accent gradient bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${statusColor}, ${statusColor}60, transparent)`,
          boxShadow: `0 0 12px ${statusColor}60`,
        }}
      />

      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', position: 'relative', zIndex: 1 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-lg)',
            fontSize: '12px',
            fontWeight: '700',
            background: `linear-gradient(135deg, ${statusColor}30, ${statusColor}20)`,
            color: statusColor,
            border: `1.5px solid ${statusColor}60`,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            boxShadow: `0 2px 8px ${statusColor}25`,
          }}
        >
          {session.status === 'running' && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: statusColor,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          )}
          {statusLabel}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto', fontWeight: '500' }}>
          {formatRelativeTime(session.createdAt)}
        </span>
      </div>

      {/* Topic */}
      <h3
        style={{
          fontSize: '19px',
          fontWeight: '700',
          marginBottom: '18px',
          color: 'var(--text-primary)',
          lineHeight: '1.4',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {session.topic}
      </h3>

      {/* Progress info */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>진행률</span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: '800',
              color: statusColor,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {session.currentRound} / {session.maxRounds}
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: '8px',
            background: 'var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${statusColor}, ${statusColor}AA)`,
              borderRadius: 'var(--radius-sm)',
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: `0 0 12px ${statusColor}70, inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              position: 'relative',
            }}
          >
            {/* Shimmer effect */}
            {session.status === 'running' && progress < 100 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                  animation: 'shimmer 2s infinite',
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
