# Design System: AI Code Review Assistant

## 1. Visual Theme & Atmosphere
A restrained, cockpit-dense interface with clean symmetric layouts and subtle CSS-based motion. The atmosphere is highly technical yet premium — like a professional code editor or high-end developer tool.

## 2. Color Palette & Roles
- **Canvas White** (`#09090b`, Zinc-950) — Primary background surface
- **Pure Surface** (`#18181b`, Zinc-900) — Card and container fill, glassmorphism base
- **Charcoal Ink** (`#fafafa`, Zinc-50) — Primary text, headings (inverted for dark mode)
- **Muted Steel** (`#71717a`, Zinc-500) — Secondary text, placeholder, metadata
- **Whisper Border** (`rgba(255,255,255,0.05)`) — Card borders, 1px structural lines
- **Sky Blue Accent** (`#0ea5e9`, Sky-500) — Single accent for CTAs, active states, focus rings

*Note: Saturation is controlled. No purple/neon AI slop. Absolute neutral bases (Zinc) with a singular high-contrast accent.*

## 3. Typography Rules
- **Display/Headlines:** System Sans (`Inter` or `Geist`) — Track-tight, controlled scale, weight-driven hierarchy.
- **Body:** System Sans — Relaxed leading, 65ch max-width, neutral secondary color.
- **Mono:** System Mono — For code, metadata, timestamps, line numbers.
- **Banned:** Generic system serif fonts. Serif is entirely banned in this dashboard.

## 4. Component Stylings
* **Buttons:** Flat, no outer glow. Tactile -1px translate (`active:scale-95`) on active. Accent fill for primary, ghost/outline with whisper border for secondary.
* **Cards:** Generously rounded corners (`rounded-2xl`). Diffused dark shadow (`shadow-xl`). Used only when elevation serves hierarchy.
* **Inputs:** Label above, error below. Focus ring in accent color (`focus:ring-brand-500/50`). No floating labels.
* **Loaders:** Skeletal shimmer matching exact layout dimensions.
* **Empty States:** Composed, icon-driven compositions — not just "No data" text.

## 5. Layout Principles
- Grid-first responsive architecture.
- Strict single-column collapse below 768px. Max-width containment (`max-w-7xl`).
- No overlapping elements — every element occupies its own clear spatial zone.
- No centered Hero sections (this is a tool, not a landing page).

## 6. Motion & Interaction
- CSS transitions for all interactive elements (`duration-200`).
- Tactile feedback on buttons (`active:scale-95`).
- Hardware-accelerated transforms only (opacity, transform).
- No GSAP or heavy scroll-hijacking; motion should feel instantaneous and productive.

## 7. Anti-Patterns (Banned)
- No emojis anywhere.
- No generic serif fonts (`Times New Roman`, etc.).
- No pure black (`#000000`).
- No neon glows or AI-purple gradients.
- No 3-column equal card layouts.
- No generic AI copywriting clichés ("Elevate", "Seamless", "Unleash").
- No filler UI text ("Scroll to explore").
