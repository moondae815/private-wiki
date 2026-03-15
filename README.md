# Private Wiki

개인용 마크다운 위키 앱. 노트와 할 일 목록을 로컬 `.md` 파일로 관리합니다.

## 기능

- **노트** — Tiptap 리치 텍스트 에디터, 마크다운으로 저장
- **할 일** — GFM 체크박스 목록, 마감일(`@due:YYYY-MM-DD`)·우선순위(`@priority:high|medium|low`) 인라인 메타데이터
- **태그** — 콘텐츠 내 `#태그명` 패턴으로 자동 추출, `#상위/하위` 슬래시 계층 구조
- **비공개 노트** — 비밀번호 기반 AES-GCM 암호화 (Web Crypto API, 클라이언트 전용)
- **전문 검색** — 파일 내용 전체 검색
- **다크 모드**

## 시작하기

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:3000`을 열고 `/notes` 또는 `/todos`로 이동합니다.

## 기술 스택

- **Next.js 16 App Router** · React 19
- **Tiptap 3** + tiptap-markdown
- **Tailwind CSS v4** + @tailwindcss/typography
- 데이터베이스 없음 — `data/notes/`, `data/todos/` 디렉토리에 `.md` 파일로 저장

## 개발 명령어

```bash
pnpm dev        # 개발 서버 시작
pnpm build      # 프로덕션 빌드
pnpm lint       # ESLint 실행
pnpm test       # Jest 테스트 실행
pnpm test -- __tests__/your-test.spec.ts  # 단일 테스트 파일 실행
```
