# Dev 1 — Frontend & Geospatial UX Implementation Plan

**Goal:** Build the complete SAMUDRA frontend: chat interface, MapLibre map with GeoJSON layers, recommendation banners, evidence drawer, agent trace timeline, and multilingual UI.

**Architecture:** React + Vite + TypeScript SPA with left panel (chat + recommendation) and right panel (MapLibre GL JS map). All data flows through FastAPI backend.

**Tech Stack:** React 18, TypeScript, Vite, MapLibre GL JS, Lucide React icons, clsx, Vitest

**Spec:** `orca.md` (sections 5, 10, 11, 12) and `docs/API_CONTRACTS.md`

## Tasks

1. Project Structure, CSS Foundation & API Client
2. Chat Panel — Input, Messages & Sample Prompts
3. Recommendation Banner — GO/CAUTION/NO_GO/UNKNOWN
4. MapLibre Integration — Base Map & GeoJSON Layer Manager
5. Evidence Drawer — Source Provenance & Freshness
6. Agent Trace Timeline
7. Header, Language Selector & Data Mode Indicator
8. Error, Loading & Empty States
9. Responsive Layout & Accessibility Pass
10. Documentation Updates
