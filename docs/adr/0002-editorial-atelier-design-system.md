# ADR 0002: Editorial Atelier Design System & FOUC-Free Dual Theme

- **Status:** Accepted
- **Date:** 2026-11-23
- **Context:** Frontend architecture, typography, and WCAG 2.1 AA ergonomics

## 1. Motivation

Developer-built SaaS prototypes frequently default to dark-blue slate backgrounds (`#0f172a`), neon purple accents, and uniform sans-serif typography, creating visual fatigue during long-form technical writing. CollabNotes adopts an **Editorial Atelier & Precision Tooling** direction inspired by print typography and tactile engineering instruments.

## 2. Token & Typography Architecture

- **Warm Paper (Default Light Theme):** Canvas `#FAF8F5`, Surface `#F2EFE9`, Ink `#1A1917` (contrast ratio `15.8:1`, exceeding WCAG AAA), Hairline `#E5E0D5`.
- **Obsidian Ink (Dark Theme):** Canvas `#111110`, Surface `#181816`, Ink `#F2EFE9` (contrast ratio `16.2:1`, zero blue/indigo cast).
- **Semantic Accents:**
  - Primary Action: Editorial Terracotta (`#C84B31` light / `#E0654A` dark)
  - Synchronized State: Sage Pine (`#2A6F4E` light / `#4CA97C` dark)
  - Concurrency / RLS Notice: Ochre Amber (`#B87314` light / `#E09B3D` dark)
- **Tri-Font Hierarchy (`next/font/google`):**
  1. `Instrument Serif` — Brand wordmark, view headers, and auto-resizing document titles.
  2. `Plus Jakarta Sans` (`-0.015em`) — Calm body copy and UI controls.
  3. `JetBrains Mono` (`font-variant-numeric: tabular-nums`) — Version counters (`v4 -> v5`), timestamps, and the collapsible `⌘I` Precision Inspector so live counters never jitter horizontally.

## 3. FOUC-Free Theme Hydration & Tab Isolation

An inline synchronous script in `src/app/layout.tsx` resolves `?theme=dark|light` -> `sessionStorage` -> `localStorage` prior to React hydration, preventing white/dark flashes and allowing side-by-side demo panes to preview distinct themes independently.
