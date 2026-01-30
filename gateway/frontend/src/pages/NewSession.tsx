import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../api';

export default function NewSession() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [maxRounds, setMaxRounds] = useState(5);
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim().length < 10) { setError('주제는 최소 10자 이상 입력해주세요.'); return; }
    try {
      setLoading(true);
      setError(null);
      const response = await createSession({ topic: topic.trim(), maxRounds });
      navigate(`/sessions/${response.data.id}`);
    } catch (err) {
      setError('세션 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const roundOptions = [3, 5, 10];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5' }}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: 16 }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, padding: '4px 0', marginBottom: 16 }}
        >
          ← 목록
        </button>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>새 세션</h1>

        <form onSubmit={handleSubmit}>
          {/* Topic */}
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#ccc' }}>
            연구 주제
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 2024년 AI 기술 동향과 산업별 적용 사례"
            rows={4}
            style={{
              width: '100%', padding: 12, background: '#111', border: '1px solid #333',
              borderRadius: 8, color: '#e5e5e5', fontSize: 14, resize: 'vertical',
              fontFamily: 'inherit', lineHeight: 1.6,
            }}
          />
          <div style={{ fontSize: 12, color: topic.length >= 10 ? '#10b981' : '#666', marginTop: 4, marginBottom: 20 }}>
            {topic.length}/10자 이상
          </div>

          {/* Rounds */}
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#ccc' }}>
            반복 횟수
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {roundOptions.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => { setMaxRounds(n); setShowCustom(false); }}
                style={{
                  flex: 1, padding: '10px', fontSize: 14, fontWeight: 600, borderRadius: 6,
                  border: !showCustom && maxRounds === n ? '2px solid #2563eb' : '1px solid #333',
                  background: !showCustom && maxRounds === n ? '#2563eb20' : '#111',
                  color: !showCustom && maxRounds === n ? '#2563eb' : '#999',
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              style={{
                flex: 1, padding: '10px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                border: showCustom ? '2px solid #2563eb' : '1px solid #333',
                background: showCustom ? '#2563eb20' : '#111',
                color: showCustom ? '#2563eb' : '#999',
                cursor: 'pointer',
              }}
            >
              직접입력
            </button>
          </div>
          {showCustom && (
            <input
              type="number"
              min={1}
              max={50}
              value={customInput}
              placeholder="1-50"
              onChange={(e) => {
                setCustomInput(e.target.value);
                const v = Number(e.target.value);
                if (v >= 1 && v <= 50) setMaxRounds(v);
              }}
              autoFocus
              style={{
                width: '100%', padding: 10, background: '#111', border: '1px solid #2563eb',
                borderRadius: 6, color: '#e5e5e5', fontSize: 14, fontFamily: 'monospace',
                marginBottom: 8,
              }}
            />
          )}
          <div style={{ height: 8 }} />

          {error && (
            <div style={{ padding: 10, background: '#ef444420', border: '1px solid #ef4444', borderRadius: 6, color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || topic.trim().length < 10}
            style={{
              width: '100%', padding: 14, background: loading || topic.trim().length < 10 ? '#333' : '#2563eb',
              color: loading || topic.trim().length < 10 ? '#666' : '#fff',
              border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
              cursor: loading || topic.trim().length < 10 ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '생성 중...' : '세션 시작'}
          </button>
        </form>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
