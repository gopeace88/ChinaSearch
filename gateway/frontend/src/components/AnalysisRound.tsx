import { useState } from 'react';
import type { AnalysisRound as AnalysisRoundType } from '../types';

interface AnalysisRoundProps {
  round: AnalysisRoundType;
  index: number;
}

export default function AnalysisRound({ round, index }: AnalysisRoundProps) {
  const [isExpanded, setIsExpanded] = useState(index === 0);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.95) 0%, rgba(35, 35, 35, 0.8) 100%)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        border: '2px solid var(--border-default)',
        marginBottom: '14px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isExpanded ? '0 8px 24px rgba(37, 99, 235, 0.15)' : 'none',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '18px 22px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          background: isExpanded ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
          transition: 'all 0.25s ease',
          borderBottom: isExpanded ? '2px solid var(--border-default)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isExpanded) {
            e.currentTarget.style.background = 'rgba(37, 99, 235, 0.05)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isExpanded) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            fontWeight: '800',
            flexShrink: 0,
            boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
            color: '#fff',
          }}
        >
          {round.round}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              fontSize: '16px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              marginBottom: '6px',
              lineHeight: '1.4',
            }}
          >
            {round.question}
          </h4>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: '500',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            🔍 {round.search_query}
          </p>
        </div>
        <div
          style={{
            fontSize: '18px',
            color: isExpanded ? 'var(--accent-primary)' : 'var(--text-muted)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
          }}
        >
          ▼
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div
          style={{
            padding: '22px',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          {/* Search Results */}
          {round.search_results && round.search_results.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h5
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'var(--text-secondary)',
                  marginBottom: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: '800',
                    color: '#fff',
                  }}
                >
                  {round.search_results.length}
                </span>
                검색 결과
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {round.search_results.slice(0, 5).map((result, idx) => (
                  <a
                    key={idx}
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      padding: '14px 16px',
                      background: 'var(--surface-dim)',
                      borderRadius: 'var(--radius-lg)',
                      border: '2px solid var(--border-default)',
                      textDecoration: 'none',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      animation: `slideUp 0.3s ease ${idx * 0.05}s backwards`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                      e.currentTarget.style.background = 'var(--surface-dim)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: '700',
                        color: 'var(--accent-primary)',
                        marginBottom: '6px',
                        lineHeight: '1.4',
                      }}
                    >
                      {result.title}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        marginBottom: '8px',
                        lineHeight: '1.5',
                      }}
                    >
                      {result.snippet}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: '500',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      🔗 {result.url}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Analysis */}
          {round.analysis && (
            <div>
              <h5
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'var(--text-secondary)',
                  marginBottom: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>✨</span> 분석 결과
              </h5>
              <div
                style={{
                  padding: '18px 20px',
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(124, 58, 237, 0.05))',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid var(--border-default)',
                  fontSize: '14px',
                  lineHeight: '1.8',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.2)',
                }}
              >
                {round.analysis}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
