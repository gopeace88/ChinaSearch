# Gateway Frontend - Mobile Responsive Web UI

AI 기반 심층 조사 세션을 관리하는 모바일 반응형 웹 인터페이스입니다.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Routing**: React Router DOM 7
- **HTTP Client**: Axios
- **Styling**: CSS-in-JS (Inline Styles) + CSS Variables

## Features

### 📱 Mobile-First Design
- 최대 폭 600px의 모바일 최적화 레이아웃
- 터치 친화적 UI (최소 44px 터치 타겟)
- iOS 안전 영역 지원
- 부드러운 애니메이션 및 전환 효과

### 🎨 Bold Visual Design
- 커스텀 폰트: Syne, Manrope, JetBrains Mono
- 그라데이션 텍스트 애니메이션
- 글로우 효과 및 백드롭 블러
- 다크 테마 기본 적용

### ⚡ Real-time Updates
- 3초 간격 자동 폴링
- 실시간 로그 표시
- 진행률 시각화

### 🔍 Session Management
- 세션 목록 및 필터링
- 세션 생성 및 제어 (일시정지/재개/취소)
- 최종 보고서 다운로드

## Getting Started

### Prerequisites

```bash
Node.js 18+
npm 9+
```

### Installation

```bash
cd /home/jhkim/00.Projects/ChinaSearch/gateway/frontend
npm install
```

### Development

```bash
# Start dev server (http://localhost:3003)
npm run dev
```

API 프록시는 `http://localhost:3001`로 설정되어 있습니다.

### Build

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── pages/
│   ├── SessionList.tsx      # 세션 목록 (필터링)
│   ├── SessionDetail.tsx    # 세션 상세 (실시간 모니터링)
│   └── NewSession.tsx       # 새 세션 생성
├── components/
│   ├── SessionCard.tsx      # 세션 카드
│   ├── ProgressLog.tsx      # 진행 로그
│   └── AnalysisRound.tsx    # 분석 라운드
├── api.ts                   # API 클라이언트
├── types.ts                 # TypeScript 타입
├── App.tsx                  # 라우터
├── main.tsx                 # 엔트리
└── index.css                # 글로벌 스타일
```

## API Endpoints

```typescript
GET    /api/sessions              # 세션 목록
GET    /api/sessions/:id          # 세션 상세
POST   /api/sessions              # 세션 생성
POST   /api/sessions/:id/pause    # 일시정지
POST   /api/sessions/:id/resume   # 재개
POST   /api/sessions/:id/cancel   # 취소
GET    /api/sessions/:id/progress # 진행 상황
GET    /api/sessions/:id/report   # 최종 보고서
```

## Design System

자세한 디자인 가이드라인은 [MOBILE_DESIGN.md](./MOBILE_DESIGN.md)를 참조하세요.

### Color Palette

```css
/* Accents */
--accent-primary: #2563eb
--accent-secondary: #7c3aed

/* Status */
--status-running: #3b82f6 (blue)
--status-paused: #f59e0b (orange)
--status-completed: #10b981 (green)
--status-failed: #ef4444 (red)
```

### Typography

- **Headings**: Syne (700-800)
- **Body**: Manrope (400-800)
- **Code**: JetBrains Mono (400, 600)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Bundle size: ~94KB (gzipped)
- First contentful paint: <1s
- Time to interactive: <2s

## Contributing

1. 새 기능은 별도 브랜치에서 작업
2. 코드 스타일 유지 (ESLint)
3. 모바일 반응형 테스트 필수

## License

MIT
