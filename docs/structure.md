# 실제 프로젝트 구조

2026-10-27 배포·운영 검증 후 구조입니다. Git 내부·의존성·빌드 출력·비밀값·개인 자료는 생략했습니다.

```text
project-apprenticeship-07/
├── .github/
│   ├── workflows/
│   │   ├── README.md
│   │   └── ci.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── .openai/
│   ├── README.md
│   ├── hosting.example.json
│   └── hosting.json
├── app/
│   ├── api/
│   │   ├── account/
│   │   │   ├── README.md
│   │   │   └── route.ts
│   │   ├── auth/
│   │   │   ├── [action]/
│   │   │   │   └── route.ts
│   │   │   └── README.md
│   │   ├── diary/
│   │   │   └── route.ts
│   │   ├── experiment/
│   │   │   ├── README.md
│   │   │   └── route.ts
│   │   ├── export/
│   │   │   └── route.ts
│   │   └── import/
│   │       ├── README.md
│   │       └── route.ts
│   ├── experiment/
│   │   ├── README.md
│   │   └── page.tsx
│   ├── login/
│   │   ├── README.md
│   │   └── page.tsx
│   ├── settings/
│   │   └── account/
│   │       ├── README.md
│   │       └── page.tsx
│   ├── signup/
│   │   ├── README.md
│   │   └── page.tsx
│   ├── chatgpt-auth.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── contracts/
│   ├── auth/
│   │   ├── README.md
│   │   └── session-v1.json
│   ├── experiment/
│   │   ├── README.md
│   │   └── five-days-v1.json
│   ├── README.md
│   ├── pds-schema-v2.json
│   └── pds-schema-v3.json
├── db/
│   ├── README.md
│   ├── auth-schema.ts
│   ├── experiment-schema.ts
│   ├── index.ts
│   └── schema.ts
├── docs/
│   ├── baseline/
│   │   ├── t06/
│   │   │   ├── evidence/
│   │   │   │   ├── README.md
│   │   │   │   ├── app-preview.png
│   │   │   │   ├── input-retained-local.png
│   │   │   │   ├── next-plan-local.png
│   │   │   │   ├── review-mobile.png
│   │   │   │   └── verification-results.md
│   │   │   ├── PROJECT_README.md
│   │   │   ├── architecture.md
│   │   │   ├── deployment.md
│   │   │   ├── design.md
│   │   │   ├── requirements.md
│   │   │   ├── submission.md
│   │   │   ├── usage.md
│   │   │   └── verification.md
│   │   ├── README.md
│   │   └── provenance.json
│   ├── evidence/
│   │   ├── authentication/
│   │   │   ├── .gitkeep
│   │   │   ├── deployed-login.png
│   │   │   ├── deployed-signup.png
│   │   │   ├── deployment-http-results.json
│   │   │   ├── http-results.json
│   │   │   └── login-screen.png
│   │   ├── data-management/
│   │   │   └── .gitkeep
│   │   ├── experiment/
│   │   │   ├── .gitkeep
│   │   │   └── browser-experiment.png
│   │   ├── ownership/
│   │   │   └── .gitkeep
│   │   ├── passwords/
│   │   │   └── .gitkeep
│   │   ├── sessions/
│   │   │   └── .gitkeep
│   │   ├── README.md
│   │   └── verification-results.md
│   ├── README.md
│   ├── architecture.md
│   ├── authentication.md
│   ├── deployment.md
│   ├── experiment.md
│   ├── five-day-guide.md
│   ├── migration.md
│   ├── requirements.md
│   ├── roadmap.md
│   ├── scope.md
│   ├── structure.md
│   ├── submission.md
│   └── verification.md
├── drizzle/
│   ├── meta/
│   │   ├── 0000_snapshot.json
│   │   ├── 0001_snapshot.json
│   │   └── _journal.json
│   ├── 0000_steep_paladin.sql
│   └── 0001_orange_aaron_stack.sql
├── lib/
│   ├── connector-context.ts
│   ├── connector-contract.mts
│   ├── connector-errors.mts
│   ├── connector-preview.d.ts
│   ├── connectors.ts
│   └── utils.ts
├── public/
│   └── favicon.svg
├── scripts/
│   ├── connector-preview/
│   │   ├── connector-preview-session.mjs
│   │   ├── host-binding.mjs
│   │   ├── protocol.mjs
│   │   └── worker.mjs
│   ├── vite/
│   │   ├── connector-preview-plugin.mjs
│   │   ├── sites-vite-plugin.LICENSE
│   │   └── sites-vite-plugin.ts
│   ├── README.md
│   ├── build-verified.sh
│   ├── execution-profile.mjs
│   ├── install-ci.mjs
│   ├── install-ci.sh
│   ├── install-pnpm.sh
│   ├── migrate-local.mjs
│   ├── npm-install.mjs
│   ├── pnpm-install.mjs
│   ├── run-framework.mjs
│   ├── schema-contract.mjs
│   ├── setup-local.mjs
│   ├── sites-env.mjs
│   ├── sites-env.sh
│   ├── test.mjs
│   └── tool-environment.mjs
├── src/
│   ├── components/
│   │   └── ui/
│   │       └── Modal.tsx
│   ├── features/
│   │   ├── account/
│   │   │   ├── AccountView.tsx
│   │   │   └── README.md
│   │   ├── auth/
│   │   │   ├── AuthForm.tsx
│   │   │   ├── README.md
│   │   │   ├── Workspace.tsx
│   │   │   └── events.ts
│   │   ├── executions/
│   │   │   └── ExecutionForm.tsx
│   │   ├── experiment/
│   │   │   ├── ExperimentView.tsx
│   │   │   └── README.md
│   │   ├── migration/
│   │   │   ├── MigrationView.tsx
│   │   │   └── README.md
│   │   ├── plans/
│   │   │   ├── History.tsx
│   │   │   ├── PlanForm.tsx
│   │   │   └── PlanViews.tsx
│   │   ├── reviews/
│   │   │   └── ReviewView.tsx
│   │   ├── tasks/
│   │   │   ├── TaskDetail.tsx
│   │   │   ├── TaskForm.tsx
│   │   │   └── TaskList.tsx
│   │   └── today/
│   │       └── TodayView.tsx
│   ├── server/
│   │   ├── access-control/
│   │   │   ├── README.md
│   │   │   └── index.ts
│   │   ├── accounts/
│   │   │   ├── README.md
│   │   │   └── index.ts
│   │   ├── auth/
│   │   │   ├── README.md
│   │   │   └── config.ts
│   │   ├── experiment/
│   │   │   ├── README.md
│   │   │   └── index.ts
│   │   ├── migration/
│   │   │   ├── README.md
│   │   │   └── index.ts
│   │   ├── http.ts
│   │   ├── runtime.ts
│   │   └── store.ts
│   ├── shared/
│   │   ├── experiment/
│   │   │   ├── README.md
│   │   │   └── index.ts
│   │   ├── client.ts
│   │   └── domain.ts
│   ├── Diary.tsx
│   └── README.md
├── tests/
│   ├── e2e/
│   │   └── README.md
│   ├── fixtures/
│   │   ├── README.md
│   │   ├── d1.ts
│   │   └── t06-export.json
│   ├── integration/
│   │   ├── auth/
│   │   │   ├── README.md
│   │   │   └── auth.test.ts
│   │   ├── experiment/
│   │   │   ├── README.md
│   │   │   └── flow.test.ts
│   │   ├── migration/
│   │   │   ├── README.md
│   │   │   └── migration.test.ts
│   │   ├── ownership/
│   │   │   ├── README.md
│   │   │   └── ownership.test.ts
│   │   ├── .gitkeep
│   │   ├── http-auth.mjs
│   │   ├── http-flow.mjs
│   │   └── store.test.ts
│   ├── unit/
│   │   ├── auth/
│   │   │   └── README.md
│   │   ├── experiment/
│   │   │   ├── README.md
│   │   │   └── metrics.test.ts
│   │   ├── .gitkeep
│   │   └── domain.test.ts
│   └── README.md
├── worker/
│   └── index.ts
├── .editorconfig
├── .env.example
├── .gitattributes
├── .gitignore
├── .npmrc
├── CONTRIBUTING.md
├── README.md
├── SECURITY.md
├── cloudflare-env.d.ts
├── components.json
├── drizzle.config.ts
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── vite.config.ts
```

[승인 범위](scope.md) · [배포](deployment.md) · [검증 결과](evidence/verification-results.md) · [실제 5일 절차](five-day-guide.md)
