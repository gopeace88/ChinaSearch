import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '../types';
import { getSessions } from '../api';

const statusColors: Record<string, string> = {
  running: '#3b82f6',
  paused: '#f59e0b',
  completed: '#10b981',
  failed: '#ef4444',
};

const statusLabels: Record<string, string> = {
  running: '진행중',
  paused: '일시정지',
  completed: '완료',
  failed: '실패',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function SessionList() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessions().then(r => { setSessions(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5' }}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: 16 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Research</h1>
          <p style={{ color: '#888', fontSize: 14 }}>AI 심층 조사</p>
        </div>

        {/* New session button */}
        <button
          onClick={() => navigate('/new')}
          style={{
            width: '100%', padding: 14, background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
            cursor: 'pointer', marginBottom: 20,
          }}
        >
          + 새 세션 시작
        </button>

        {/* Sessions list */}
        {loading && <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>로딩중...</p>}

        {!loading && sessions.length === 0 && (
          <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>아직 세션이 없습니다</p>
        )}

        {sessions.map(s => {
          const color = statusColors[s.status] || '#666';
          const pct = s.maxRounds > 0 ? (s.currentRound / s.maxRounds) * 100 : 0;
          return (
            <div
              key={s.id}
              onClick={() => navigate(`/sessions/${s.id}`)}
              style={{
                padding: 14, marginBottom: 10, background: '#111',
                border: '1px solid #222', borderRadius: 8, cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                  background: `${color}20`, color: color, textTransform: 'uppercase',
                }}>
                  {s.status === 'running' && '● '}{statusLabels[s.status] || s.status}
                </span>
                <span style={{ fontSize: 12, color: '#666' }}>{timeAgo(s.createdAt)}</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
                {s.topic}
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: '#888' }}>진행률</span>
                <span style={{ color: color, fontFamily: 'monospace', fontWeight: 600 }}>
                  {s.currentRound}/{s.maxRounds}
                </span>
              </div>
              <div style={{ height: 4, background: '#222', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            </div>
          );
        })}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
