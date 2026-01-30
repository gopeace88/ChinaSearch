import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Session, SessionProgress } from '../types';
import { getSession, getProgress, getReport, cancelSession } from '../api';

const STATE_LABELS: Record<string, string> = {
  IDLE: "대기 중",
  WAITING_RESEARCH: "ChatGPT 응답 대기 중...",
  READING_RESULT: "보고서 읽는 중...",
  ANALYZING: "분석 진행 중...",
  INSERTING_QUESTION: "후속 질문 입력 중...",
  WAITING_CONFIRM: "확인 대기",
  AUTO_SUBMIT: "자동 제출 중...",
  WAITING_FINAL_REPORT: "최종 보고서 대기 중...",
};

function elapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}초 전`;
  return `${Math.floor(s / 60)}분 ${s % 60}초 전`;
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadSession();
  }, [id]);

  useEffect(() => {
    if (!id || !session) return;
    if (session.status === 'running' || session.status === 'paused') {
      loadProgress();
      const interval = setInterval(loadProgress, 3000);
      return () => clearInterval(interval);
    } else if (session.status === 'completed') {
      loadReport();
    }
  }, [id, session?.status]);

  const loadSession = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await getSession(id);
      setSession(response.data);
      setError(null);
    } catch (err) {
      setError('세션 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!id) return;
    try {
      const response = await getProgress(id);
      setProgress(response.data);
      if (response.data.session) {
        setSession(response.data.session);
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  };

  const loadReport = async () => {
    if (!id) return;
    try {
      const response = await getReport(id);
      setReport(response.data);
    } catch (err) {
      console.error('Failed to load report:', err);
    }
  };

  const handleCancel = async () => {
    if (!id || actionLoading) return;
    if (!confirm('정말 세션을 취소하시겠습니까?')) return;
    try {
      setActionLoading(true);
      await cancelSession(id);
      navigate('/');
    } catch (err) {
      alert('취소에 실패했습니다.');
      setActionLoading(false);
    }
  };

  const now = Date.now();

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#999', minHeight: '100vh', background: '#0a0a0a' }}>
        로딩중...
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ padding: 20, minHeight: '100vh', background: '#0a0a0a' }}>
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          <div style={{ padding: 16, background: '#1c1c1c', border: '1px solid #333', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ color: '#ef4444', marginBottom: 12 }}>{error || '세션을 찾을 수 없습니다.'}</p>
            <button
              onClick={() => navigate('/')}
              style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
            >
              목록으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isActive = session.status === 'running';
  const stateColor = isActive ? '#2563eb' : session.status === 'completed' ? '#10b981' : session.status === 'failed' ? '#ef4444' : '#6b7280';
  const logs = progress?.logs || [];
  const rounds = progress?.rounds || [];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 0', borderBottom: '1px solid #222' }}>
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, padding: '4px 0', marginBottom: 12 }}
          >
            ← 목록
          </button>

          {/* Status bar - matches Extension's StatusBar */}
          <div style={{
            background: stateColor,
            color: 'white',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 14,
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {(progress?.state === 'ANALYZING' || progress?.state === 'WAITING_FINAL_REPORT') && '⏳ '}
                {STATE_LABELS[progress?.state || ''] || progress?.state || (isActive ? '진행중' : session.status === 'completed' ? '완료' : session.status === 'failed' ? '실패' : '대기')}
              </span>
              <span style={{ fontFamily: 'monospace' }}>
                Round {progress?.round || session.currentRound}/{progress?.maxRounds || session.maxRounds}
              </span>
            </div>
          </div>

          {/* Topic */}
          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, lineHeight: 1.5, color: '#ccc' }}>
            {session.topic}
          </p>

          {/* Action buttons - matches Extension's Cancel */}
          {isActive && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                style={{
                  flex: 1, padding: '10px', background: '#f97316', color: 'white',
                  border: 'none', borderRadius: 6, cursor: actionLoading ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600, opacity: actionLoading ? 0.5 : 1,
                }}
              >
                Cancel (즉시 중단)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 500, margin: '0 auto', padding: 16 }}>
        {/* Progress logs - matches Extension's StatusBar log style */}
        {logs.length > 0 && (
          <div style={{
            marginBottom: 16,
            padding: 12,
            background: '#111',
            border: '1px solid #222',
            borderRadius: 8,
            fontSize: 13,
            maxHeight: 250,
            overflowY: 'auto',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#2563eb', fontSize: 12 }}>진행 상황</div>
            {logs.slice(-10).map((log: any, i: number, arr: any[]) => (
              <div key={i} style={{
                padding: '3px 0',
                color: log.message?.includes('❌') || log.message?.includes('⚠️') ? '#ef4444' : '#d4d4d4',
                opacity: i === arr.length - 1 ? 1 : 0.65,
                fontWeight: i === arr.length - 1 ? 600 : 400,
                fontSize: 12,
                lineHeight: 1.5,
              }}>
                <span>{log.message}</span>
                <span style={{ color: '#555', marginLeft: 6, fontSize: 11 }}>
                  {log.timestamp ? elapsed(now - log.timestamp) : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Analysis rounds - matches Extension's collapsible details style */}
        {rounds.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#999' }}>분석 라운드</h3>
            {[...rounds].reverse().map((round: any, i: number) => (
              <div key={round.round} style={{
                marginBottom: 10,
                padding: 12,
                background: '#111',
                borderRadius: 8,
                border: '1px solid #222',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  Round {round.round}
                </div>
                {round.analysis && (
                  <details style={{ marginBottom: 6 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#999' }}>
                      분석 결과
                    </summary>
                    <pre style={{
                      whiteSpace: 'pre-wrap', fontSize: 12, margin: '6px 0 0', maxHeight: 200,
                      overflow: 'auto', background: '#0a0a0a', padding: 10, borderRadius: 6,
                      border: '1px solid #222', color: '#ccc', lineHeight: 1.6,
                    }}>
                      {round.analysis}
                    </pre>
                  </details>
                )}
                {round.question && (
                  <div style={{
                    background: '#0d1520', padding: 8, borderRadius: 6, fontSize: 13,
                    border: '1px solid #1e3a5f', color: '#93c5fd',
                  }}>
                    <strong>Follow-up:</strong> {round.question}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Completed report */}
        {session.status === 'completed' && report && (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#10b981' }}>최종 보고서</h3>
            <div style={{
              padding: 16, background: '#111', borderRadius: 8, border: '1px solid #222',
              fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#d4d4d4',
            }}>
              {typeof report === 'string' ? report : report.final_synthesis || JSON.stringify(report, null, 2)}
            </div>
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
