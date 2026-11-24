# Whiteboard Studio

A polished, production-ready collaborative whiteboard for brainstorming, planning, teaching,
and running meetings. Built with **Next.js 15 (App Router)**, **TypeScript**, and **Tailwind CSS**,
with a hand-written canvas engine (no drawing library) so every interaction, export, and shortcut
is fully under our control.

> **Live app:** see the deployment link shared with this project.
> **Local:** `npm install && npm run dev` → http://localhost:3000

---

## ✨ Features

### Canvas
- **Infinite, pannable, zoomable canvas** with trackpad pan, `⌘/Ctrl + scroll` zoom-at-pointer,
  minimap navigation, live zoom percentage, fit-to-screen and reset-view.
- **Tools:** select/move, hand/pan, pen, highlighter, eraser, line, arrow, rectangle, ellipse,
  diamond, sticky note, text, and shape-to-shape **connectors**.
- **Object editing:** move, resize (8 handles), rotate, duplicate, delete, group/ungroup,
  lock/unlock, and reorder (front/back/forward/backward).
- **Styling:** stroke & fill colours (with custom colour pickers), stroke width, dashed/dotted
  lines, hachure fill, opacity, three font families, seven sizes, bold/italic, alignment.
- **Sticky notes** with eight paper colours and inline editing.
- **Connectors** attach to a specific side/offset of a shape and follow it when it moves,
  resizes, or rotates. Deleting a shape removes its dangling connectors.
- **Snapping + alignment guides** while dragging (hold `Alt` to disable), marquee + shift multi-select.
- **Unlimited undo/redo**, keyboard shortcuts, context menus, clear-selection action.
- **Empty state** with one-click quick-start tour, and six built-in templates.

### Boards & workspace
- **Dashboard** with thumbnail cards, search, sorting (recent / newest / A–Z), create, rename,
  duplicate, and delete (with confirmation).
- **Templates:** blank, quick-start tour, brainstorm, flowchart, kanban, mind map, meeting notes.
- **Board header:** inline title editing, canvas background presets + custom colour, light/dark theme.
- **Autosave** with a visible save state (`Saved · 14:32`, `Saving…`, `Unsaved changes`, `Save failed`).
- Boards survive reloads and browser restarts.

### Collaboration (honest scope — please read)
- **Share links that actually work, with no account.** A snapshot of the board (elements,
  background, title) is encoded into the URL **hash fragment**, so it is never sent to a server.
  Recipients open a read-only view, can pan/zoom, export, and duplicate the board into their
  own workspace.
- **Permission model:** *Can view*, *Can review*, and *Can edit a copy* — each produces a
  differently-scoped link. The data model (`SharedBoardPayload.permission`, per-board IDs) is
  ready for server-enforced permissions once auth exists.
- **What is *not* implemented:** real-time multiplayer (live cursors, presence, concurrent edit
  merging). That requires a realtime backend (WebSocket server, Liveblocks, PartyKit, or
  Supabase Realtime) plus auth. We deliberately did **not** fake it. The cursor/presence UI
  surfaces are in place for a future integration; see *Roadmap* below.

### Upload & export
- **Image upload** via toolbar picker or **drag-and-drop anywhere on the board**.
  Type (PNG/JPEG/WebP/GIF) and size (≤ 6 MB) validation with clear, per-file error toasts.
  SVG uploads are rejected on purpose (XSS risk). Uploaded images can be moved, resized, and rotated.
- **PNG export** at 2× (aspect-safe, capped at 8192 px), rendered from the same geometry as the canvas.
- **SVG export** — true vector output, zoom-independent, tight content bounds, background included.
- **Print / PDF** via a dedicated print stylesheet and a vector print surface (browser → *Save as PDF*).
- **JSON export/import** for backup and transfer, with a strict validator that rejects malformed
  files, unknown element types, non-data image URLs, and future schema versions.

---

## 🏗 Architecture

```
src/
├─ app/
│  ├─ layout.tsx            Theme bootstrap (no flash), toast provider, metadata
│  ├─ page.tsx              Dashboard: board list, search, templates, import
│  ├─ board/[id]/page.tsx   Editor shell: header, toolbar, canvas, overlays, print view
│  ├─ board/example/        Seeds the quick-start board and redirects
│  ├─ globals.css           Design tokens (light/dark), component classes
│  ├─ error.tsx / not-found.tsx
├─ components/
│  ├─ board/                Canvas, toolbar, header, share, minimap, zoom, context menu…
│  ├─ dashboard/            Board cards, template gallery
│  ├─ ui/                   Accessible Modal + Popover primitives
│  ├─ ThemeProvider.tsx     Persisted light/dark theme
│  └─ Toast.tsx             Notification system
├─ hooks/
│  ├─ useEditorSession.ts   Load → hydrate → debounced autosave → share-link mode
│  └─ useKeyboardShortcuts.ts
└─ lib/
   ├─ types.ts              Serialisable document model (Board, BoardElement, bindings…)
   ├─ store.ts              Zustand editor store: history, selection, camera, mutations
   ├─ geometry.ts           Points, rotation, resize math, hit regions, fit-to-view
   ├─ hit.ts                Hit testing, marquee, connector anchor detection
   ├─ render.tsx            React/SVG renderer (single source of truth on screen)
   ├─ svg.ts                String SVG serializer (exports & print) sharing the same geometry
   ├─ text.ts               Canvas-measured word wrap + font stacks
   ├─ snap.ts               Alignment snapping + guide computation
   ├─ templates.ts          Six real board templates with connectors
   ├─ db.ts                 IndexedDB persistence (+ localStorage fallback) and validation
   ├─ exporters.ts          PNG/SVG/JSON export, framing, thumbnails, filenames
   ├─ upload.ts             Image validation/decoding + safe JSON import
   └─ share.ts              Share-link encoding/decoding
```

**Key design decisions**
- **One document model, plain JSON.** Boards are arrays of typed elements with optional
  `textStyle`, `points`, `src`, and connector bindings. Everything serialises, exports, and
  imports without special cases.
- **Rendering is deterministic.** Screen rendering (React SVG) and export rendering (string SVG)
  both consume `geometry.ts` + `text.ts`, so what you see is what you export.
- **History is snapshot-based** (capped at 100 entries) with gesture batching: a whole drag or
  freehand stroke is one undo step. `beginGesture()` snapshots before an interaction mutates; child
  mutations during a gesture don't push more entries.
- **Autosave is debounced (450 ms)** and separates "content dirty" from camera-only changes.

### Data model (abridged)
```ts
type BoardElement = {
  id: string; type: 'rect' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'draw' |
                        'highlighter' | 'sticky' | 'text' | 'image' | 'connector';
  x: number; y: number; width: number; height: number;
  angle: number; opacity: number; locked: boolean; groupId: string | null;
  stroke: string; strokeWidth: number; strokeStyle: 'solid'|'dashed'|'dotted';
  fill: string; fillStyle: 'solid'|'none'|'hachure';
  textStyle?: { text; fontSize; fontFamily; textAlign; bold; italic };
  points?: { x: number; y: number }[];          // freehand & lines (local space)
  src?: string;                                  // image data URL
  start?: Binding | Point; end?: Binding | Point;// connectors
  arrowStart?: 'none'|'arrow'; arrowEnd?: 'none'|'arrow';
};
```

---

## 💾 Persistence and its limits

Boards are stored **in your browser**:

1. **IndexedDB** database `whiteboard-studio`, object store `boards` (primary).
2. **localStorage** fallback when IndexedDB is unavailable (private mode, some embedded webviews).

**What this means**

| Capability | Status |
| --- | --- |
| Survive reload / browser restart, same device & profile | ✅ Yes |
| Survive clearing site data / switching browsers | ❌ No — export JSON first |
| Sync across devices / accounts | ❌ Not implemented (needs auth + database) |
| Multiple users editing one board live | ❌ Not implemented (see below) |

There is **no hidden backend** and no claim of cross-device sync. To move a board, use
**Export → JSON** and **Import JSON** on the other device.

### Adding cloud sync / real accounts
`.env.example` documents the optional variables. A production rollout would:
1. Add auth (NextAuth/Auth.js or Clerk) and scope boards by `userId`.
2. Swap `lib/db.ts` for Postgres (Neon/Supabase/Vercel Postgres) behind the same async interface —
   the rest of the app depends only on `listBoards/getBoard/saveBoard/deleteBoard`.
3. Enforce share permissions server-side instead of in the URL payload.

---

## ⌨️ Keyboard shortcuts

| Action | Keys |
| --- | --- |
| Tools | `V` select · `H`/`Space` pan · `P` pen · `M` highlighter · `E` eraser · `N` sticky · `T` text · `R`/`O`/`D` shapes · `L`/`A`/`C` line/arrow/connector |
| Undo / redo | `⌘/Ctrl+Z`, `⌘/Ctrl+⇧+Z` (or `Ctrl+Y`) |
| Duplicate / delete | `⌘/Ctrl+D`, `⌫` |
| Select all / clear | `⌘/Ctrl+A`, `Esc` |
| Group / ungroup | `⌘/Ctrl+G`, `⌘/Ctrl+⇧+G` |
| Lock / unlock | `⌥/Alt+⌘/Ctrl+L` |
| Layers | `⌘/Ctrl+]` `⌘/Ctrl+[`, with `Alt` for front/back |
| Nudge | Arrow keys (`⇧` = 10 px) |
| Zoom | `⌘/Ctrl +` / `−` / `0`; `⇧1` fit, `⇧0` reset view |
| Edit text | `Enter` / double-click |
| Shortcut sheet | `?` |

---

## ✅ Quality checks

```bash
npm run typecheck   # tsc --noEmit, strict mode
npm run lint        # next lint (ESLint, next/core-web-vitals)
npm test            # 70 Vitest tests (jsdom)
npm run build       # production build
```

The test suite covers:
- **Geometry & camera** – coordinate round-trips, zoom anchoring, clamping, resize from every
  handle, aspect locking, min-size, rotation, selection bounds, fit-to-view, connector anchors.
- **Store** – add/undo/redo, grouping, duplication with new IDs, connector cleanup on delete,
  locking, eraser, layer ordering, view reset, read-only guard.
- **Persistence** – save/load, ordering, rename, duplicate, delete, malformed-record rejection.
- **Export/import** – framing, XML escaping, text/arrow serialisation, filename slugging,
  empty boards, JSON round-trip, invalid/newer/malicious files, image validation, share-link
  encoding with Unicode.
- **Canvas interactions** (real DOM events) – draw shapes, place & edit stickies, drag-move,
  marquee multi-select, freehand strokes, connector binding, eraser, pan, handle resize, read-only.
- **Dashboard** – empty state, listing & ordering, search, rename, duplicate, template creation,
  delete confirmation.
- **Board page integration** – loads a stored board into the editor, renders every element,
  settles autosave to "Saved", switches tools via keyboard, shows the empty-state helper, and
  generates a working share link from the share dialog.

### Accessibility & UX
- Every control has an accessible name; dialogs trap focus, close on `Escape`, and restore focus.
- `aria-pressed` on tool toggles, `aria-live` save status, visible keyboard focus rings.
- Touch-friendly hit targets, `touch-action: none` on the canvas, responsive layout from 360 px up.
- Light/dark themes via CSS custom properties with a no-flash inline bootstrap script.
- Loading, empty, success, and error states for every async path (no dead buttons).

---

## 🔐 Security notes

- No secrets in the client. `.env.example` contains placeholders only.
- Imports are strictly validated (type allow-lists, numeric coercion, size caps, `data:image/`
  only for images) — malformed files produce helpful errors instead of crashes.
- SVG uploads are refused (script-injection vector); raster formats only, 6 MB cap.
- Share payloads live in the URL **fragment**, which browsers never send to servers.
- `dangerouslySetInnerHTML` is used only for our own serializer output (never user HTML).

---

## 🚀 Setup & deployment

```bash
git clone <repo> && cd Whiteboard
npm install
npm run dev          # http://localhost:3000
```

**Deploy to Vercel**

```bash
npm i -g vercel
vercel               # preview
vercel --prod        # production
```
Or import the repository in the Vercel dashboard — the framework preset is auto-detected
(`nextjs`), no environment variables are required, and the build command is `next build`.

---

## 🗺 Roadmap

- Auth + per-user cloud storage (schema and `db.ts` interface are already abstracted).
- Real-time collaboration: presence, collaborator cursors, CRDT/LWW merge, via Liveblocks or a
  PartyKit server; the `permission` field and share routes are ready to be server-enforced.
- Comment threads and @mentions.
- Laser pointer for presentations.
