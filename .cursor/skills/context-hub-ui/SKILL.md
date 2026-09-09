---
name: context-hub-ui
description: >-
  Context Hub frontend visual identity — CapCut-like dark editor, anti-Lovable.
  Use when editing apps/web UI, styles, layout, components, routes, Tailwind
  tokens, or when the user asks to redesign, restyle, polish, or improve the look.
---

# Context Hub UI — Studio Editor (CapCut-like)

## Direction

Context Hub UI should feel like a **video/lesson studio editor** — close to CapCut’s dark, dense, panelled chrome — while staying **clearly not a Lovable / generic AI SaaS template**.

Mood: **studio de edição** — near-black stages, layered panels, sharp mint/teal accent, tight spacing.
Product job: browse lessons, scrub context, search, ask.

## Brand test

**Context Hub** must read as the product name on primary surfaces (especially `/`), not a tiny nav label or a “C” logo tile that could be any startup.

## What to KEEP (CapCut energy)

- Dark-first UI (near-black background, elevated charcoal panels)
- Layered editor surfaces with hairline borders
- One vivid accent (mint / teal — CapCut-adjacent), used sparingly on CTAs and active states
- Compact sidebar rail + main stage
- Dense but readable lists; media / transcript as work surfaces

## Hard bans (Lovable / AI-default tells)

Never use these as the identity:

- Purple / indigo / violet gradients or glows
- Rainbow multi-stop “AI” gradients on text or buttons
- Soft cyan halo / glow rings everywhere (`ring-glow` as decoration)
- Gradient square logo mark (“C” in a colorful tile)
- Pill chip *clusters* for example queries / filters as hero decoration
- Floating badges / stickers over media
- Glassmorphism + multi-layer soft shadows stacks
- Inter / Roboto / Arial as the brand voice
- Sora + Manrope combo (overused Lovable default)
- Cream paper + terracotta + display serif “editorial AI” look
- Marketing landing fluff on tool screens (stats strips, promo chips)

## Required look

- **Surfaces:** background ≈ near-black; panels one step lighter; borders white @ ~8–12% opacity
- **Accent:** solid mint/teal primary (oklch teal). CTA = solid fill, not rainbow gradient
- **Typography:** geometric display + clean UI sans — prefer **Space Grotesk** (titles) + **IBM Plex Sans** (UI). Avoid Sora/Manrope/Inter
- **Chrome:** dark sidebar with icons OK; active = solid accent wash, not glow
- **Components:** shadcn as structure only; retoken in `styles.css`
- **Motion:** short opacity/transform on panel focus and status; no perpetual pulse glow

## Tokens

All colors via CSS variables in `apps/web/src/styles.css`. Use semantic classes (`bg-background`, `bg-card`, `text-primary`, `border-border`). Do not hardcode purple or rainbow hexes in components.

## When editing UI

1. Read this skill first.
2. Prefer CapCut density + our mint accent over inventing a new theme.
3. Sanity-check: dark editor yes; Lovable rainbow / purple / logo-tile / pill-clusters no.

## Out of scope

No full design-system package. No extra theme libs unless asked. Keep API wiring intact.
