---
name: Authrix Kinetic
colors:
  surface: '#0c150f'
  surface-dim: '#0c150f'
  surface-bright: '#323c34'
  surface-container-lowest: '#07100a'
  surface-container-low: '#141e17'
  surface-container: '#18221b'
  surface-container-high: '#232c25'
  surface-container-highest: '#2d3730'
  on-surface: '#dae5da'
  on-surface-variant: '#b9cbbc'
  inverse-surface: '#dae5da'
  inverse-on-surface: '#29332b'
  outline: '#849587'
  outline-variant: '#3b4b3f'
  surface-tint: '#00e38a'
  primary: '#f3fff3'
  on-primary: '#00391f'
  primary-container: '#00ff9c'
  on-primary-container: '#007142'
  inverse-primary: '#006d40'
  secondary: '#bdf4ff'
  on-secondary: '#00363d'
  secondary-container: '#00e3fd'
  on-secondary-container: '#00616d'
  tertiary: '#fffaff'
  on-tertiary: '#3b2f00'
  tertiary-container: '#ffdd65'
  on-tertiary-container: '#766000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#56ffa7'
  primary-fixed-dim: '#00e38a'
  on-primary-fixed: '#002110'
  on-primary-fixed-variant: '#00522f'
  secondary-fixed: '#9cf0ff'
  secondary-fixed-dim: '#00daf3'
  on-secondary-fixed: '#001f24'
  on-secondary-fixed-variant: '#004f58'
  tertiary-fixed: '#ffe17a'
  tertiary-fixed-dim: '#e4c44f'
  on-tertiary-fixed: '#231b00'
  on-tertiary-fixed-variant: '#554500'
  background: '#0c150f'
  on-background: '#dae5da'
  surface-variant: '#2d3730'
typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h2:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h3:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0em
  body-base:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0.01em
  data-mono:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.5'
    letterSpacing: 0.05em
  label-xs:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 20px
  margin: 32px
---

## Brand & Style

The design system is engineered to evoke the high-stakes environment of a state-of-the-art cybersecurity lab and a futuristic AI command center. It targets elite technical operators who require high-precision data visualization and a sense of absolute control. The aesthetic is "Industrial-Futurism"—combining the raw, structural feel of hardware with the ethereal, cinematic quality of advanced software interfaces.

The brand personality is authoritative, vigilant, and cutting-edge. Every interface element should feel like a piece of high-end equipment rather than a standard web component. The user experience is built on the tension between deep obsidian voids and vibrant, hyper-focused energy emissions (neon glows), creating a sense of immense power being harnessed through a precise digital lens.

## Colors

The palette is anchored in a "Deep Space" foundation, utilizing Zinc-950 and pure blacks to maximize the luminous impact of the accent colors. 

- **Primary Neon Green (#00ff9c):** Used for active states, successful validations, and primary calls to action. It represents "System GO" and operational health.
- **Cyan Secondary (#00e5ff):** Dedicated to data visualization, information overlays, and secondary interactive elements. It provides a "scanning" or "holographic" feel.
- **Alert Red (#ff3e3e):** Reserved strictly for critical system breaches, errors, and destructive actions.
- **Neutrals:** A range of Zinc grays (900 to 400) provide structural hierarchy.

The color application relies heavily on luminescence; colors are rarely flat but are instead accompanied by subtle radial glows and inner shadows to simulate light emitting from within the screen.

## Typography

This design system utilizes **Space Grotesk** across all levels to maintain a cohesive, technical identity. 

- **Headlines:** Use Bold or Semi-Bold weights. High-level headers should feel architectural and commanding.
- **Body Text:** Standard reading weights prioritize legibility against the dark background.
- **Metadata & Technical Readouts:** Use the uppercase "data-mono" styling to simulate terminal outputs and sensor readings.
- **Emphasis:** Rather than italics, use color shifts (to Primary Neon) or weight increases to highlight critical information.

## Layout & Spacing

The design system employs a **Modular Grid System** with a high-density rhythm. The spacing is tight and deliberate, reflecting the efficiency of a command console.

- **Grid:** A 12-column fluid grid for main layouts, with a 20px gutter to ensure data density without crowding.
- **Rhythm:** All margins and padding follow a 4px baseline.
- **Density:** Use "Compact" spacing for data tables and "Spacious" spacing for dashboard overviews.
- **Borders as Spacing:** In many instances, thin 1px borders with 10% opacity are used in place of whitespace to define structural sections, reinforcing the industrial aesthetic.

## Elevation & Depth

Depth in this design system is achieved through **Luminous Layering** rather than traditional shadows.

1.  **Glassmorphism:** Surfaces use a 10-20% opacity fill with a heavy (20px-40px) backdrop blur. This creates a "frosted laboratory glass" effect.
2.  **Inner Shadows:** Use subtle, dark inner shadows on the top and left edges to create an "etched" or "recessed" look for input fields and containers.
3.  **Border Glows:** Elements at higher elevation levels (e.g., modals) feature a 1px solid border with an outer "bloom" or neon glow effect using the Primary or Secondary color.
4.  **Atmospheric Particles:** Background layers should feature very low-opacity animated particles or scan lines to give the UI a sense of "living" energy.

## Shapes

The design system adopts a **Sharp (0px)** philosophy for its core structural elements. This reinforces the industrial, high-precision nature of the brand.

- **Containers & Buttons:** Square corners suggest rigidity and technical accuracy.
- **Active Indicators:** Small 45-degree clipped corners can be used on decorative elements or active "tabs" to add a futuristic, military-spec feel.
- **Icons:** Must be stroke-based, using a consistent 1.5px or 2px weight, echoing the geometric precision of the typography.

## Components

- **Buttons:** Primary buttons feature a solid #00ff9c background with black text. On hover, they emit a strong radial neon glow. Secondary buttons are "Ghost" style with a 1px glowing border.
- **Input Fields:** Recessed into the background using inner shadows. The bottom border "lights up" with Cyan when focused. Use monospace font for input values.
- **Cards:** These are the primary glassmorphic containers. They feature a subtle "Scan Line" animation overlay (a 1px line moving vertically at 2% opacity).
- **Status Chips:** Small, rectangular tags with no border-radius. They use a "pulse" animation for active states (a soft glow that expands and contracts).
- **Data Grids:** High-density tables with subtle horizontal separators. Row hovers should trigger a full-width Cyan highlight at 5% opacity.
- **Command Line Interface (CLI) Modules:** Specialized components for raw data input, featuring a blinking underscore cursor and Primary color text.
- **Progress Gauges:** Circular or linear indicators using "segmented" bars rather than solid fills to emphasize the mechanical, digital readout style.