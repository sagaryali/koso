# Koso Design System

> Black and white. No accent colors. No gradients. No rounded corners. Premium through restraint — every pixel earns its place. The product should feel like a beautifully typeset book meets a precision instrument. White space is the primary design element.

---

## Table of Contents

1. Foundations
   - Color Palette
   - Typography
   - Spacing
   - Borders & Shapes
   - Shadows
2. Components
   - Buttons
   - Inputs
   - Cards
   - Badges / Tags
   - Command Palette
   - Side Panels
   - Sidebar Navigation
3. Iconography
4. Interaction Principles
5. Layout Principles
6. The Feel

---

# 1. Foundations

## 1.1 Color Palette

### Backgrounds

| Token               | Value     | Usage                          |
|---------------------|-----------|--------------------------------|
| `--bg-primary`      | `#FFFFFF` | Main background                |
| `--bg-secondary`    | `#FAFAFA` | Subtle surface separation      |
| `--bg-tertiary`     | `#F5F5F5` | Cards, panels, input fields    |
| `--bg-inverse`      | `#000000` | Primary buttons, strong emphasis |
| `--bg-hover`        | `#F0F0F0` | Hover states on light surfaces |
| `--bg-active`       | `#E8E8E8` | Active/pressed states          |

### Text

| Token               | Value     | Usage                          |
|---------------------|-----------|--------------------------------|
| `--text-primary`    | `#000000` | Headings, body text            |
| `--text-secondary`  | `#555555` | Supporting text, descriptions  |
| `--text-tertiary`   | `#999999` | Placeholders, timestamps, metadata |
| `--text-inverse`    | `#FFFFFF` | Text on black backgrounds      |

### Borders

| Token               | Value     | Usage                          |
|---------------------|-----------|--------------------------------|
| `--border-default`  | `#E5E5E5` | Standard borders               |
| `--border-strong`   | `#000000` | Emphasized borders, focused inputs |
| `--border-subtle`   | `#F0F0F0` | Faint dividers                 |

### State

| Token               | Value     | Usage                          |
|---------------------|-----------|--------------------------------|
| `--state-error`     | `#D00000` | Errors only — the one exception to B&W |
| `--state-success`   | `#000000` | Success uses black, not green  |

No other colors. Period. If something needs emphasis, use weight, size, or spacing — not color.

---

## 1.2 Typography

### Font

DM Sans — used for everything. Load weights 400, 500, 700.

Google Fonts URL: `https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap`

### Type Scale

| Token        | Size / Line Height | Usage                           |
|--------------|--------------------|---------------------------------|
| `--text-xs`  | 12px / 16px        | Metadata, timestamps, badges    |
| `--text-sm`  | 13px / 18px        | Secondary text, captions        |
| `--text-base`| 15px / 24px        | Body text, editor content       |
| `--text-lg`  | 17px / 26px        | Subheadings, card titles        |
| `--text-xl`  | 22px / 30px        | Section headings                |
| `--text-2xl` | 28px / 36px        | Page titles                     |
| `--text-3xl` | 36px / 44px        | Hero/onboarding headings        |

### Weight Usage

- 400 (Regular) — Body text, descriptions, editor content
- 500 (Medium) — Labels, navigation items, card titles, buttons
- 700 (Bold) — Page headings, strong emphasis (use sparingly)

### Letter Spacing

- Headings (xl and above): `-0.02em` (slight tightening)
- Body: `0` (default)
- All-caps labels (rare): `0.05em`

---

## 1.3 Spacing

4px base unit. Generous spacing is critical to the premium feel.

| Token         | Value |
|---------------|-------|
| `--space-1`   | 4px   |
| `--space-2`   | 8px   |
| `--space-3`   | 12px  |
| `--space-4`   | 16px  |
| `--space-5`   | 20px  |
| `--space-6`   | 24px  |
| `--space-8`   | 32px  |
| `--space-10`  | 40px  |
| `--space-12`  | 48px  |
| `--space-16`  | 64px  |
| `--space-20`  | 80px  |
| `--space-24`  | 96px  |

### Spacing Rules

- Page padding: 48px minimum on sides, 40px top
- Between major sections: 64px
- Between related elements: 16–24px
- Inside cards/containers: 24px padding
- Editor line spacing should feel airy — err on the side of too much space

---

## 1.4 Borders & Shapes

| Token             | Value | Note                              |
|-------------------|-------|-----------------------------------|
| `--radius-none`   | 0px   | DEFAULT — use for almost everything |
| `--radius-sm`     | 2px   | Only for tiny elements like badges |
| `--border-width`  | 1px   |                                   |

Sharp edges everywhere. No border-radius on cards, buttons, inputs, modals, panels. Everything is rectangular and precise.

---

## 1.5 Shadows

Minimal to none. Separation through borders and background color, not shadows.

| Token            | Value                            | Usage                      |
|------------------|----------------------------------|----------------------------|
| `--shadow-sm`    | `0 1px 2px rgba(0,0,0,0.04)`    | Subtle lift, use rarely    |
| `--shadow-modal` | `0 4px 24px rgba(0,0,0,0.08)`   | Modals/command palette only |

---

# 2. Components

## 2.1 Buttons

| Variant   | Background | Border          | Text        | Hover          |
|-----------|------------|-----------------|-------------|----------------|
| Primary   | `#000`     | None            | White, 500  | `#222`         |
| Secondary | `#FFF`     | 1px `#000`      | Black, 500  | `#F5F5F5` bg   |
| Ghost     | None       | None            | Black       | `#F5F5F5` bg   |

### Sizing

| Size | Height | Horizontal Padding | Text   |
|------|--------|--------------------|--------|
| sm   | 36px   | 12px               | 13px   |
| md   | 40px   | 16px               | 13px   |
| lg   | 44px   | 20px               | 13px   |

Text weight: 500, no text-transform. No transitions on color — instant state change.

---

## 2.2 Inputs

- White bg, 1px `#E5E5E5` border, 0 radius
- On focus: border goes black. No glow, no ring, no shadow. Just the border color change.
- Label above, 13px weight 500
- Height: 40px
- Padding: 12px horizontal

---

## 2.3 Cards

- White bg (or `#FAFAFA` for contrast), 1px `#E5E5E5` border, 0 radius
- Hover: border goes `#000000`
- Padding: 24px
- No shadow

---

## 2.4 Badges / Tags

- `#F5F5F5` bg, no border, 2px radius (the one exception), 12px text, weight 500
- Padding: 4px 8px

---

## 2.5 Command Palette (Cmd+K)

- Centered overlay, white bg, 1px black border, 0 radius
- Subtle backdrop blur with semi-transparent overlay
- Large input field at top, 17px text
- Results below with clear dividers
- Shadow-modal for lift

---

## 2.6 Side Panels

- Separated by 1px `border-default` on the left edge
- Same bg as main content or very subtle `#FAFAFA`
- Collapsible with clean animation (width transition, 200ms ease)

---

## 2.7 Sidebar Navigation

- `#FAFAFA` bg with right border
- Nav items: 13px, weight 500, full-width hover states with `#F0F0F0` bg
- Active item: black bg, white text
- Section labels: 12px, weight 500, `#999` color, uppercase with `0.05em` tracking

---

# 3. Iconography

Use Lucide icons. 16px default size, 1.5px stroke weight. Always `#000` or `#999` depending on emphasis.

---

# 4. Interaction Principles

- No bouncy animations. Transitions 150–200ms, ease or ease-out.
- Hover states are immediate. Border and background color changes happen without transition.
- Focus is black. Every focused element gets a black border or outline. No blue focus rings.
- Loading states: minimal pulse animation on a thin black line, or skeleton loaders in `#F5F5F5`.

---

# 5. Layout Principles

| Element              | Value              |
|----------------------|--------------------|
| Max content width    | 720px (editor)     |
| Sidebar width        | 240px default, 56px collapsed |
| Context panel width  | 320px default      |
| Alignment            | Left-aligned everything |

No centered layouts except modals and onboarding.

---

# 6. The Feel

Think: Braun product manual. Swiss International Style. A premium architectural magazine. The tool should feel like it costs $200/month even if it doesn't.
