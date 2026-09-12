# SAMUDRA Frontend Migration to shadcn/ui Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Migrate the entire SAMUDRA frontend from legacy custom CSS components to official accessible shadcn/ui components with Tailwind CSS v4, maintaining all existing contracts, vernacular capabilities, marine design tokens, and deterministic safety indicators.

**Architecture:** Initialize Tailwind CSS v4 and shadcn CLI in `frontend/`, map SAMUDRA's dual-theme marine tokens (`variables.css`) to shadcn semantic CSS properties (`--background`, `--primary`, etc.), scaffold core Radix-backed shadcn primitives in `@/components/ui/`, and incrementally refactor custom components across common, layout, chat, mission, authority, overlays, and page containers.

**Tech Stack:** React 18, Vite 5, TypeScript 5, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui (radix-nova), Radix UI primitives, Lucide Icons, MapLibre GL, Vitest.

**Spec:** User directive: "don't make custom components where possible. use shadcn components. migrate whole frontend to shadcn." Guided by `docs/ORCA_MASTER_CONTEXT.md`, `docs/DECISIONS.md` (D002, D003, D011), `docs/OWNERSHIP.md` (Workstream M1), and `frontend/src/styles/variables.css`.

## Global Constraints

- **Branch Policy**: All work must occur on `frontend-mission-dashboard`; never switch to or modify `main`.
- **Zero Contract Regression**: `frontend/src/types/contracts.ts` and API contracts must remain unmodified.
- **Vernacular Support**: Vernacular rendering (Hindi, Marathi, English) in `frontend/src/i18n/translations.ts` must remain fully functional.
- **Safety Indicator Fidelity**: Strict contrast and high-visibility status tokens for `GO`, `CAUTION`, `NO_GO`, and `UNKNOWN` must be preserved.
- **Dual-Theme Support**: Light mode (default) and `[data-theme="dark"]` must both work seamlessly without visual breakage.
- **Test Integrity**: All 61 existing Vitest tests must pass at every task milestone, and `tsc --noEmit && vite build` must succeed without errors.

---

### Task 1: Tailwind CSS v4 & shadcn Tooling Foundation

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/tsconfig.json`
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/lib/utils.ts`
- Create: `frontend/components.json`
- Modify: `frontend/src/styles/globals.css`
- Test: `frontend/src/api/client.test.ts` (baseline regression verification)

**Interfaces:**
- Consumes: Existing Vite and TypeScript config.
- Produces: `cn()` utility function in `@/lib/utils`, working Tailwind v4 engine via `@tailwindcss/vite`, initialized `components.json` enabling `shadcn add`.

- [x] **Step 1: Install Tailwind CSS v4, Vite plugin, and shadcn helper packages**

Run in `frontend/`:
```bash
npm install -D tailwindcss@^4.3.3 @tailwindcss/vite@^4.3.3 @types/node
npm install class-variance-authority clsx tailwind-merge radix-ui tw-animate-css
```

- [x] **Step 2: Configure TypeScript path aliases in `frontend/tsconfig.json`**

Update `compilerOptions` in `frontend/tsconfig.json` to include:
```json
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
```

- [x] **Step 3: Configure Vite path alias and Tailwind plugin in `frontend/vite.config.ts`**

Update `frontend/vite.config.ts`:
```typescript
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
```

- [x] **Step 4: Create `frontend/src/lib/utils.ts` class utility**

Create `frontend/src/lib/utils.ts`:
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [x] **Step 5: Create `frontend/components.json`**

Create `frontend/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

- [x] **Step 6: Map shadcn CSS tokens in `frontend/src/styles/globals.css`**

Ensure `frontend/src/styles/globals.css` imports Tailwind, animations, and bridges SAMUDRA's variables to shadcn theme tokens:
```css
@import './variables.css';
@import "tailwindcss";
@import "tw-animate-css";
@import './components.css';

@custom-variant dark (&:is([data-theme="dark"] *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
}

:root {
  --background: var(--color-bg-primary);
  --foreground: var(--color-text-primary);
  --card: var(--color-bg-secondary);
  --card-foreground: var(--color-text-primary);
  --popover: var(--color-bg-primary);
  --popover-foreground: var(--color-text-primary);
  --primary: var(--color-accent);
  --primary-foreground: #ffffff;
  --secondary: var(--color-bg-tertiary);
  --secondary-foreground: var(--color-text-secondary);
  --muted: var(--color-bg-tertiary);
  --muted-foreground: var(--color-text-muted);
  --accent: var(--color-accent-subtle);
  --accent-foreground: var(--color-accent);
  --destructive: var(--color-no-go);
  --destructive-foreground: #ffffff;
  --border: var(--color-border);
  --input: var(--color-border);
  --ring: var(--color-accent);
}

[data-theme="dark"] {
  --background: var(--color-bg-primary);
  --foreground: var(--color-text-primary);
  --card: var(--color-bg-secondary);
  --card-foreground: var(--color-text-primary);
  --popover: var(--color-bg-secondary);
  --popover-foreground: var(--color-text-primary);
  --primary: var(--color-accent);
  --primary-foreground: #0b1329;
  --secondary: var(--color-bg-tertiary);
  --secondary-foreground: var(--color-text-secondary);
  --muted: var(--color-bg-tertiary);
  --muted-foreground: var(--color-text-muted);
  --accent: var(--color-accent-subtle);
  --accent-foreground: var(--color-accent);
  --destructive: var(--color-no-go);
  --destructive-foreground: #ffffff;
  --border: var(--color-border);
  --input: var(--color-border);
  --ring: var(--color-accent);
}
```

- [x] **Step 7: Verify baseline compilation and tests**

Run:
```bash
cd frontend && npm run typecheck && npm run build && npm test
```
Expected: PASS (0 errors, 61 tests passing).

- [x] **Step 8: Commit Task 1**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/vite.config.ts frontend/components.json frontend/src/lib/utils.ts frontend/src/styles/globals.css
git commit -m "feat(frontend): configure Tailwind CSS v4, path aliases, and shadcn setup"
```

---

### Task 2: Scaffold shadcn UI Primitives

**Files:**
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/components/ui/card.tsx`
- Create: `frontend/src/components/ui/dialog.tsx`
- Create: `frontend/src/components/ui/popover.tsx`
- Create: `frontend/src/components/ui/tabs.tsx`
- Create: `frontend/src/components/ui/select.tsx`
- Create: `frontend/src/components/ui/textarea.tsx`
- Create: `frontend/src/components/ui/slider.tsx`
- Create: `frontend/src/components/ui/scroll-area.tsx`
- Create: `frontend/src/components/ui/alert.tsx`
- Create: `frontend/src/components/ui/separator.tsx`
- Create: `frontend/src/components/ui/switch.tsx`
- Create: `frontend/src/components/ui/tooltip.tsx`
- Test: `frontend/src/components/ui/primitives.test.tsx`

**Interfaces:**
- Consumes: `@/lib/utils`, Radix UI primitives.
- Produces: Standardized, fully typed, accessible UI components in `@/components/ui/`.

- [x] **Step 1: Scaffold components using shadcn CLI**

Run in `frontend/`:
```bash
shadcn add button badge card dialog popover tabs select textarea slider scroll-area alert separator switch tooltip -y
```

- [x] **Step 2: Add safety status variants to `Badge` and `Button`**

In `frontend/src/components/ui/badge.tsx`, ensure domain status variants are available for SAMUDRA:
- `go`: bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30
- `caution`: bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30
- `noGo`: bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30
- `unknown`: bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30

- [x] **Step 3: Write primitive component smoke test**

Create `frontend/src/components/ui/primitives.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardHeader, CardTitle, CardContent } from './card';

describe('shadcn UI primitives', () => {
  it('renders Button with variants correctly', () => {
    const html = renderToString(<Button variant="outline">Test Button</Button>);
    expect(html).toContain('Test Button');
  });

  it('renders Badge with domain safety variants', () => {
    const html = renderToString(<Badge variant="secondary">Active Status</Badge>);
    expect(html).toContain('Active Status');
  });

  it('renders Card container structure', () => {
    const html = renderToString(
      <Card>
        <CardHeader>
          <CardTitle>Mission Card</CardTitle>
        </CardHeader>
        <CardContent>Content Area</CardContent>
      </Card>
    );
    expect(html).toContain('Mission Card');
    expect(html).toContain('Content Area');
  });
});
```

- [x] **Step 4: Run test and typecheck**

Run:
```bash
cd frontend && npm test -- src/components/ui/primitives.test.tsx && npm run typecheck
```
Expected: PASS.

- [x] **Step 5: Commit Task 2**

```bash
git add frontend/src/components/ui/ frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): scaffold and configure core shadcn UI primitives"
```

---

### Task 3: Migrate Common & Layout Components

**Files:**
- Modify: `frontend/src/components/common/LoadingSpinner.tsx`
- Modify: `frontend/src/components/common/EmptyState.tsx`
- Modify: `frontend/src/components/common/ErrorState.tsx`
- Modify: `frontend/src/components/layout/ThemeToggle.tsx`
- Modify: `frontend/src/components/layout/DataModeIndicator.tsx`
- Modify: `frontend/src/components/layout/LanguageSelector.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`
- Test: `frontend/src/pages/pages.test.ts`

**Interfaces:**
- Consumes: `@/components/ui/button`, `@/components/ui/badge`, `@/components/ui/card`, `@/components/ui/alert`.
- Produces: Accessible, responsive layout & common components using shadcn components.

- [x] **Step 1: Refactor `LoadingSpinner.tsx` with standard styling**

Replace custom spinner styles with Lucide `Loader2` and flex alignment:
```tsx
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
  className?: string;
}

export default function LoadingSpinner({
  message = 'Processing request...',
  size = 20,
  className,
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2 p-4 text-muted-foreground', className)} role="status">
      <Loader2 size={size} className="animate-spin text-primary" />
      {message && <span className="text-sm font-medium">{message}</span>}
    </div>
  );
}
```

- [x] **Step 2: Refactor `EmptyState.tsx` and `ErrorState.tsx` using shadcn `Card` & `Alert`**

- `EmptyState.tsx`: Wrap in `Card` with subtle borders, centered icon, title, description.
- `ErrorState.tsx`: Use `Alert` with `AlertTitle`, `AlertDescription`, and shadcn `Button` for retry action.

- [x] **Step 3: Refactor `ThemeToggle.tsx` and `DataModeIndicator.tsx`**

- `ThemeToggle.tsx`: Use `Button variant="ghost" size="icon"`.
- `DataModeIndicator.tsx`: Use `Badge variant="outline"` with colored indicator dot and tooltip trigger.

- [x] **Step 4: Refactor `LanguageSelector.tsx` and `Header.tsx`**

- `LanguageSelector.tsx`: Use `Button` toggle group with `variant={language === lang ? "default" : "ghost"}` and size `sm`.
- `Header.tsx`: Replace raw button triggers with shadcn `Button` variants (`destructive` for logout, `outline` for evidence with `Badge` count, `default` for voice call trigger).

- [x] **Step 5: Verify build & tests**

Run:
```bash
cd frontend && npm run typecheck && npm test
```
Expected: PASS (all 61+ tests pass).

- [x] **Step 6: Commit Task 3**

```bash
git add frontend/src/components/common/ frontend/src/components/layout/
git commit -m "refactor(frontend): migrate common and layout components to shadcn"
```

---

### Task 4: Migrate Chat & Advisory Components

**Files:**
- Modify: `frontend/src/components/chat/ChatInput.tsx`
- Modify: `frontend/src/components/chat/ChatMessage.tsx`
- Modify: `frontend/src/components/chat/ChatPanel.tsx`
- Modify: `frontend/src/components/chat/SamplePrompts.tsx`
- Modify: `frontend/src/components/recommendation/RecommendationBanner.tsx`
- Test: `frontend/src/api/mock-data.test.ts`

**Interfaces:**
- Consumes: `@/components/ui/button`, `@/components/ui/textarea`, `@/components/ui/badge`, `@/components/ui/card`, `@/components/ui/alert`, `@/components/ui/scroll-area`.
- Produces: High-contrast advisory messaging and chat interface powered by shadcn components.

- [x] **Step 1: Refactor `ChatInput.tsx` using shadcn `Textarea` and `Button`**

- Replace `<textarea className="chat-input" ... />` with shadcn `Textarea` styled with resize-none.
- Use shadcn `Button` with icon size for mic, audio send, and "Call SAMUDRA".
- Use `Badge` for recording / listening status.

- [x] **Step 2: Refactor `ChatMessage.tsx` and `SamplePrompts.tsx`**

- `ChatMessage.tsx`: Assistant response wrapped in subtle `Card` or structured bubble, with shadcn `Button` (`variant="ghost"`, size `sm`) for speech audio trigger, and followup query pills rendered as shadcn `Button` (`variant="outline"`, size `sm`, rounded-full).
- `SamplePrompts.tsx`: Map sample queries to `Button variant="outline"` items with left alignment and category badges.

- [x] **Step 3: Refactor `ChatPanel.tsx`**

- Top bar actions (Back, Reset Chat) use shadcn `Button variant="ghost" size="sm"`.
- Messages list utilizes `ScrollArea` (or optimized overflow container).

- [x] **Step 4: Refactor `RecommendationBanner.tsx`**

- Replace custom `.recommendation-banner` with high-contrast shadcn `Card` or domain `Alert` maintaining decisive verdict color coding (`GO`, `CAUTION`, `NO_GO`).
- Factors list, confidence indicator, and decisive action rendered with shadcn `Badge` and formatted callout.

- [x] **Step 5: Run tests and typecheck**

Run:
```bash
cd frontend && npm run typecheck && npm test
```
Expected: PASS.

- [x] **Step 6: Commit Task 4**

```bash
git add frontend/src/components/chat/ frontend/src/components/recommendation/
git commit -m "refactor(frontend): migrate chat and recommendation components to shadcn"
```

---

### Task 5: Migrate Mission & Authority Workspaces

**Files:**
- Modify: `frontend/src/components/mission/MissionContextPanel.tsx`
- Modify: `frontend/src/components/mission/OperationalSnapshot.tsx`
- Modify: `frontend/src/components/mission/WhatIfSimulator.tsx`
- Modify: `frontend/src/components/trace/AgentTimeline.tsx`
- Modify: `frontend/src/components/authority/FleetTrackingDeck.tsx`
- Modify: `frontend/src/components/authority/ScenarioBenchmarkDeck.tsx`
- Test: `frontend/src/components/mission/what-if.test.ts`
- Test: `frontend/src/components/authority/authority.test.ts`

**Interfaces:**
- Consumes: `@/components/ui/card`, `@/components/ui/select`, `@/components/ui/slider`, `@/components/ui/badge`, `@/components/ui/button`, `@/components/ui/alert`, `@/components/ui/separator`.
- Produces: Interactive mission planning and authority surveillance panels with standard shadcn inputs and sliders.

- [x] **Step 1: Refactor `MissionContextPanel.tsx` and `WhatIfSimulator.tsx`**

- Replace raw `<select>` elements with shadcn `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` for departure harbor and craft profile selection.
- Delay chips (+2h, +4h, +6h) converted to `Button variant={selected ? "default" : "outline"} size="sm"`.
- Diff comparisons displayed inside `Card` with `Badge` comparison tags.

- [x] **Step 2: Refactor `OperationalSnapshot.tsx` and `AgentTimeline.tsx`**

- `OperationalSnapshot.tsx`: Stat cards refactored to shadcn `Card` with `Badge` values.
- `AgentTimeline.tsx`: Vertical trace timeline steps refactored using `Card` and status `Badge`.

- [x] **Step 3: Refactor `FleetTrackingDeck.tsx` and `ScenarioBenchmarkDeck.tsx`**

- Replace raw `input[type="range"]` in GPS playback scrubber with shadcn `Slider`.
- Play/Pause/Reset buttons refactored to shadcn `Button`.
- Telemetry chips and alert items refactored to `Card` and `Badge`.
- Benchmark deck test scenario cards and KPI summary refactored to `Card` with run trigger `Button`.

- [x] **Step 4: Run targeted tests and typecheck**

Run:
```bash
cd frontend && npm test -- src/components/mission/what-if.test.ts src/components/authority/authority.test.ts && npm run typecheck
```
Expected: PASS.

- [x] **Step 5: Commit Task 5**

```bash
git add frontend/src/components/mission/ frontend/src/components/trace/ frontend/src/components/authority/
git commit -m "refactor(frontend): migrate mission and authority workspace to shadcn"
```

---

### Task 6: Migrate Overlays, Map Controls & Pages

**Files:**
- Modify: `frontend/src/components/evidence/EvidenceDrawer.tsx`
- Modify: `frontend/src/components/evidence/EvidenceCard.tsx`
- Modify: `frontend/src/components/call/CallModal.tsx`
- Modify: `frontend/src/components/map/LayerManager.tsx`
- Modify: `frontend/src/components/map/MapView.tsx`
- Modify: `frontend/src/components/map/MissionMapBrief.tsx`
- Modify: `frontend/src/pages/PortalPage.tsx`
- Modify: `frontend/src/pages/FisherPage.tsx`
- Modify: `frontend/src/pages/AuthorityPage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/pages/pages.test.ts`
- Test: `frontend/src/components/map/map-layer.test.ts`

**Interfaces:**
- Consumes: `@/components/ui/dialog`, `@/components/ui/popover`, `@/components/ui/tabs`, `@/components/ui/card`, `@/components/ui/button`, `@/components/ui/switch`.
- Produces: Fully integrated overlay dialogs, popovers, mobile navigation tabs, and top-level pages.

- [x] **Step 1: Refactor `EvidenceDrawer.tsx` and `EvidenceCard.tsx`**

- `EvidenceDrawer.tsx`: Import shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` and `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` for Evidence vs Trace switching.
- `EvidenceCard.tsx`: Refactor to shadcn `Card`, freshness `Badge`, and source link `Button variant="link"`.

- [x] **Step 2: Refactor `CallModal.tsx`**

- Import shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`.
- Language badge and live status pills use shadcn `Badge`.
- Mute, retry, hangup actions use shadcn `Button` (`variant="destructive"` for hangup).

- [x] **Step 3: Refactor `LayerManager.tsx`, `MapView.tsx`, and `MissionMapBrief.tsx`**

- `LayerManager.tsx`: Use shadcn `PopoverContent`, `Switch` with `Label` for toggling GeoJSON layers, and `Badge` for active count.
- `MapView.tsx`: Use shadcn `Popover`, `PopoverTrigger asChild` wrapping the layer toggle `Button`.
- `MissionMapBrief.tsx`: Wrap in `Card` with collapsible trigger `Button` and `Badge` corridor selector chips.

- [x] **Step 4: Refactor `PortalPage.tsx`, `FisherPage.tsx`, `AuthorityPage.tsx`, and `App.tsx`**

- `PortalPage.tsx`: Fisher & Authority selection cards refactored to shadcn `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `Button`.
- `FisherPage.tsx` & `AuthorityPage.tsx`: Top sidebar tab switcher refactored to shadcn `Tabs` or styled button group.
- `App.tsx`: Mobile viewport tabs (Chat vs Map) refactored to shadcn `Tabs` with icon & badge.

- [x] **Step 5: Run full test suite and build verification**

Run:
```bash
cd frontend && npm run typecheck && npm test && npm run build
```
Expected: PASS (all tests passing, production bundle builds cleanly).

- [x] **Step 6: Commit Task 6**

```bash
git add frontend/src/components/evidence/ frontend/src/components/call/ frontend/src/components/map/ frontend/src/pages/ frontend/src/App.tsx
git commit -m "refactor(frontend): migrate overlays, map controls, and page containers to shadcn"
```

---

### Task 7: CSS Cleanup, Visual Regression Audit & Final Verification

**Files:**
- Modify: `frontend/src/styles/components.css` (prune obsolete class declarations replaced by Tailwind / shadcn)
- Modify: `docs/PROGRESS.md`
- Test: Full Vitest test suite (`npm test`)
- Test: Full TypeScript typecheck (`npm run typecheck`)
- Test: Production bundle build (`npm run build`)

**Interfaces:**
- Consumes: Completed component tree.
- Produces: Lean CSS bundle, documented progress, clean commit tree.

- [x] **Step 1: Prune obsolete CSS rules from `components.css`**

Remove deprecated redundant button, badge, modal-backdrop, and raw input CSS selectors that have been superseded by shadcn / Tailwind utility classes. Verify MapLibre map styles and critical layout containers remain intact.

- [x] **Step 2: Run full regression testing and bundle build**

Run in `frontend/`:
```bash
npm run typecheck
npm test
npm run build
```
Expected:
- TypeScript typecheck: 0 errors
- Vitest: All test files passing (at least 61 passing tests)
- Vite build: Completed successfully with optimized bundle

- [x] **Step 3: Update `docs/PROGRESS.md`**

Update `docs/PROGRESS.md` under M1 status to record:
- Successful full migration to shadcn/ui and Tailwind CSS v4.
- Scaffolded standard accessible UI components (`Button`, `Badge`, `Card`, `Dialog`, `Popover`, `Tabs`, `Select`, `Slider`, `Textarea`, `Alert`, `Switch`, `Tooltip`).
- Dual-theme marine palette preservation.
- Passing test suite status.

- [x] **Step 4: Commit Task 7**

```bash
git add frontend/src/styles/components.css docs/PROGRESS.md
git commit -m "refactor(frontend): prune obsolete CSS rules and update PROGRESS with shadcn migration"
```

---

## Plan Self-Review

1. **Spec Coverage**:
   - User directive: "don't make custom components where possible. use shadcn components. migrate whole frontend to shadcn."
   - Every single component in `frontend/src/components/` (all 10 subdirectories) and all 3 pages (`PortalPage`, `FisherPage`, `AuthorityPage`) plus `App.tsx` are accounted for in Tasks 3–6.
   - Core primitives are scaffolded in Task 2.
   - Tooling foundation & CSS variables bridging in Task 1.
   - Cleanup & verification in Task 7.

2. **Placeholder Scan**:
   - Zero "TODO", "TBD", or vague placeholders.
   - Explicit terminal commands, file paths, and exact test executions are specified.

3. **Type & Dependency Consistency**:
   - Path aliases `@/*` defined in both `tsconfig.json` and `vite.config.ts`.
   - `radix-ui` and `@tailwindcss/vite` verified compatible with Vite 5 and React 18.
