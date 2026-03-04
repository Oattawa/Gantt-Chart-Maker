# CLAUDE.md — Gantt-Chart-Maker

This file provides guidance for AI assistants (Claude Code and others) working on this repository.

---

## Project Overview

**Gantt-Chart-Maker** is a web application for creating, editing, and visualizing Gantt charts — a standard project management tool for displaying tasks, dependencies, and timelines.

### Goals
- Allow users to define tasks with start dates, end dates, and dependencies
- Render interactive Gantt charts in the browser
- Support export (PNG, PDF, or JSON) and import (JSON/CSV)
- Be lightweight, accessible, and framework-agnostic where possible

---

## Repository State

> **Status:** Early initialization — no source code exists yet.
> The project has a single commit with `README.md` only.
> All structure, tooling, and conventions below are the **intended baseline** for new development.

---

## Intended Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Type safety for complex data models (tasks, dependencies, timelines) |
| UI Framework | React 18 | Component model suits chart rendering and interactivity |
| Build Tool | Vite | Fast HMR, minimal config, native ESM |
| Styling | CSS Modules or Tailwind CSS | Scoped styles without runtime overhead |
| Testing | Vitest + React Testing Library | Co-located with Vite; fast unit/integration tests |
| Canvas/SVG | Native SVG (or optionally D3.js for scale) | Gantt charts map naturally to SVG elements |
| State Management | React Context + `useReducer` (no external store unless needed) | Keep dependencies minimal |
| Linting | ESLint + Prettier | Consistent formatting enforced pre-commit |
| Package Manager | npm | Default; use `package-lock.json` for determinism |

---

## Expected Directory Structure

```
Gantt-Chart-Maker/
├── CLAUDE.md                  # This file
├── README.md                  # User-facing documentation
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── index.html                 # Vite entry HTML
├── public/                    # Static assets (favicon, etc.)
└── src/
    ├── main.tsx               # App bootstrap
    ├── App.tsx                # Root component
    ├── types/                 # Shared TypeScript interfaces and types
    │   └── gantt.ts           # Task, Dependency, Chart types
    ├── components/            # Reusable UI components
    │   ├── GanttChart/        # Core chart rendering component
    │   ├── TaskList/          # Sidebar task list
    │   ├── Toolbar/           # Action bar (add task, export, etc.)
    │   └── Modal/             # Generic modal wrapper
    ├── hooks/                 # Custom React hooks
    │   └── useGantt.ts        # Core chart state logic
    ├── utils/                 # Pure utility functions
    │   ├── dateUtils.ts       # Date arithmetic helpers
    │   └── exportUtils.ts     # PNG/PDF/JSON export logic
    ├── store/                 # State management (context + reducer)
    │   ├── GanttContext.tsx
    │   └── ganttReducer.ts
    └── __tests__/             # Or co-located *.test.tsx files
```

Each component folder follows this pattern:
```
ComponentName/
├── index.tsx          # Public export
├── ComponentName.tsx  # Implementation
├── ComponentName.module.css (if using CSS Modules)
└── ComponentName.test.tsx
```

---

## Key Data Models

Define these types early in `src/types/gantt.ts`:

```ts
export interface Task {
  id: string;
  name: string;
  startDate: string;   // ISO 8601 date string: "YYYY-MM-DD"
  endDate: string;     // ISO 8601 date string: "YYYY-MM-DD"
  progress: number;    // 0–100
  color?: string;
  dependencies?: string[];  // IDs of tasks this depends on
}

export interface GanttChart {
  id: string;
  title: string;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}
```

---

## Development Workflow

### Setup

```bash
npm install
npm run dev       # Start dev server at http://localhost:5173
```

### Common Scripts (to be defined in package.json)

```bash
npm run dev       # Vite dev server with HMR
npm run build     # Production build to dist/
npm run preview   # Preview production build locally
npm run test      # Vitest in watch mode
npm run test:run  # Vitest single run (CI)
npm run lint      # ESLint check
npm run format    # Prettier write
npm run typecheck # tsc --noEmit
```

### Before Committing

Always run these in order:
```bash
npm run typecheck
npm run lint
npm run test:run
```

---

## Coding Conventions

### TypeScript
- Enable `strict: true` in `tsconfig.json`
- Prefer `interface` over `type` for object shapes
- Avoid `any`; use `unknown` and narrow with type guards
- Export types explicitly from `src/types/`

### React
- Functional components only — no class components
- Name components with PascalCase; files match component names
- Keep components small and focused on a single responsibility
- Prefer composition over prop drilling; use context for deep shared state
- Co-locate tests next to the files they test

### Naming Conventions
| Item | Convention | Example |
|---|---|---|
| Components | PascalCase | `GanttChart.tsx` |
| Hooks | camelCase prefixed with `use` | `useGantt.ts` |
| Utilities | camelCase | `dateUtils.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_ZOOM_LEVEL` |
| CSS classes (Modules) | camelCase | `styles.chartContainer` |
| Test files | Same name + `.test.tsx` | `GanttChart.test.tsx` |

### Date Handling
- Store all dates as ISO 8601 strings (`"YYYY-MM-DD"`)
- Use native `Date` or a minimal helper in `src/utils/dateUtils.ts`
- Avoid heavy date libraries (moment.js, etc.) unless scale demands it

### Testing
- Every utility function in `src/utils/` must have unit tests
- Every component should have at least a smoke test (renders without crash)
- Use `vi.fn()` for mocks, not manual implementations
- Test behavior, not implementation details

### Git Conventions
- Branch naming: `feature/<description>`, `fix/<description>`, `chore/<description>`
- Commit messages: imperative mood, present tense (`Add task dependency rendering`)
- Keep commits atomic — one logical change per commit
- Never commit directly to `main`; use pull requests

---

## Architecture Notes

### Rendering Strategy
Gantt charts should be rendered using SVG for resolution-independence and accessibility. Key SVG elements:
- `<rect>` for task bars
- `<line>` or `<path>` for dependency arrows
- `<text>` for labels
- A horizontal time axis with configurable granularity (day/week/month)

### State Flow
```
User Action → Dispatch(action) → ganttReducer → Updated State → Re-render
```
- All chart mutations go through the reducer
- Side effects (export, persistence) live in hooks, not components

### Persistence
- Local: `localStorage` for saving charts between sessions
- Import/Export: JSON format matching the `GanttChart` interface

---

## Things to Avoid

- **No jQuery** or other DOM-manipulating libraries alongside React
- **No unnecessary abstractions** — build what the feature needs, not a framework
- **No inline styles** on SVG elements (use CSS classes for theming)
- **No `useEffect` for state derivation** — compute derived values inline or with `useMemo`
- **No barrel re-exports** (`index.ts` files exporting everything) unless explicitly needed for public APIs

---

## AI Assistant Guidelines

When contributing to this codebase:

1. **Read before modifying** — always read the relevant files before making changes
2. **Follow existing patterns** — match the style of surrounding code
3. **Minimal changes** — only modify what is needed for the task; do not refactor unrelated code
4. **No speculative features** — implement exactly what is requested
5. **Run checks** — after code changes, verify with `typecheck`, `lint`, and `test:run`
6. **Commit on the right branch** — use `claude/...` branches; never push to `main`
7. **Small commits** — prefer several focused commits over one large commit

---

## Contact / Ownership

- **Repository:** Oattawa/Gantt-Chart-Maker
- **Initial author:** Thanapakorn (u.thanapakorn@gmail.com)
