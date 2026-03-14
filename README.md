# Private Wiki

[Next.js](https://nextjs.org)로 구축된 개인용 마크다운 위키입니다.

## 시작하기

개발 서버 실행:

```bash
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

## 주요 명령어

```bash
pnpm dev        # 개발 서버 시작
pnpm build      # 프로덕션 빌드
pnpm lint       # ESLint 실행
pnpm test       # Jest 테스트 실행
```

단일 테스트 파일 실행:

```bash
pnpm test -- __tests__/your-test.spec.ts
```

## 기술 스택

- **Next.js 16 App Router** — 페이지 라우팅
- **Tiptap 3** — 리치 텍스트 에디터 (마크다운 저장)
- **Tailwind CSS v4** — 스타일링
- **파일 시스템** — 데이터베이스 없이 `.md` 파일로 데이터 저장
