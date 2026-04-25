---
name: Authrix Kinetic
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9cbbc'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#849587'
  outline-variant: '#3b4b3f'
  surface-tint: '#00e38a'
  primary: '#f3fff3'
  on-primary: '#00391f'
  primary-container: '#00ff9c'
  on-primary-container: '#007142'
  inverse-primary: '#006d40'
  secondary: '#d3fbff'
  on-secondary: '#00363a'
  secondary-container: '#00eefc'
  on-secondary-container: '#00686f'
  tertiary: '#fffbff'
  on-tertiary: '#680008'
  tertiary-container: '#ffd6d2'
  on-tertiary-container: '#c7041a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#56ffa7'
  primary-fixed-dim: '#00e38a'
  on-primary-fixed: '#002110'
  on-primary-fixed-variant: '#00522f'
  secondary-fixed: '#7df4ff'
  secondary-fixed-dim: '#00dbe9'
  on-secondary-fixed: '#002022'
  on-secondary-fixed-variant: '#004f54'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb3ac'
  on-tertiary-fixed: '#410003'
  on-tertiary-fixed-variant: '#930010'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  h1-display:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h2-technical:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  body-main:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  body-light:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '300'
    lineHeight: '1.5'
    letterSpacing: 0.03em
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.15em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin: 48px
  container-max: 1440px
  grid-overlay: 32px
---

## Brand & Style

The design system is engineered to evoke the atmosphere of a high-security AI research facility—clandestine, powerful, and hyper-intelligent. The visual narrative centers on "The Guardian in the Machine," balancing cold, technical precision with the ethereal glow of advanced neural networks.

The style is a sophisticated fusion of **Cinematic Glassmorphism** and **Technical Minimalism**. It utilizes deep layers of transparency and light to create a sense of infinite digital depth. Every interaction should feel like a high-stakes command within a tactical operations center, blending the sleek automotive precision of Tesla’s interface with the information-dense, holographic aesthetics of futuristic head-up displays (HUDs). 

Targeting high-level security architects and C-suite executives, the UI prioritizes "Perceived Intelligence"—where the interface feels like it is thinking alongside the user through subtle animations, particle transitions, and reactive luminescence.

## Colors

The palette is anchored by a "True Deep" black (#050505) to provide a canvas for light-based hierarchy. 
- **Neon Green (#00ff9c):** The primary kinetic color, used for active states, successful encryptions, and "Safe" status indicators.
- **Cyan Glow (#00f0ff):** Used for secondary accents, data visualization, and soft atmospheric backlighting.
- **Subtle Red (#ff3b3b):** Reserved strictly for critical breaches and system warnings; it should feel alarming but polished, never vibrating against the black background.
- **Grayscale:** Uses high-opacity whites for headings and low-opacity "Oxygen" blues for subtext to maintain the cinematic atmosphere.

## Typography

This design system utilizes a dual-font strategy. **Space Grotesk** provides a technical, geometric edge for headings and data labels, reinforcing the "AI Lab" aesthetic. **Inter** is utilized for body copy and dense technical logs to ensure maximum legibility at smaller scales.

Headings should be treated as structural elements—bold and authoritative. Subtext and secondary labels use lighter weights with increased letter spacing to mimic the look of a digital readout or tactical terminal. All capitalized labels should have a minimum of 0.1em tracking.

## Layout & Spacing

The layout philosophy follows a **Subtle Grid** model. All layouts are based on a 4px baseline unit, ensuring mathematical rhythm. A 12-column fluid grid is used for primary dashboard layouts, but it is visually reinforced by a background "grid mesh"—a very faint 32px x 32px grid pattern (opacity 2-4%) that anchors the UI elements.

Padding is generous to convey a "premium" feel. Layouts should utilize "Safe Zones" around critical data visualizations, allowing the UI to breathe despite high information density. Elements are often grouped in modular clusters to mimic a HUD-style modularity.

## Elevation & Depth

Depth in this design system is achieved through **Luminous Layering** rather than traditional shadows.
- **Glassmorphism:** Primary containers use a 10-20px backdrop blur with a 1px "inner-glow" border (white at 5-10% opacity).
- **Z-Axis Tiering:** Elements closer to the user have a brighter, more defined border and a soft Cyan or Green "under-glow" (box-shadow with 40px spread, 10% opacity).
- **Parallax Particles:** Use a subtle particle background on a separate Z-layer to create a sense of environmental volume.
- **Tonal Stepping:** The background is #050505, cards are "glass" at 3% white, and hovered elements increase to 8% white.

## Shapes

The shape language is "Soft-Technical." We use a **Soft (0.25rem)** base radius to maintain a modern, engineered feel without the aggression of sharp 90-degree corners. 

- **Primary Radius:** 4px for inputs, buttons, and small widgets.
- **Container Radius:** 8px for large dashboard cards.
- **Specialty Shapes:** Use 45-degree chamfered corners (clipped corners) on decorative elements or "Scan" buttons to heighten the futuristic military-grade aesthetic.

## Components

- **Buttons:** Primary buttons feature a solid #00ff9c fill with black text. Secondary buttons are "Ghost" style with a 1px primary border and a soft neon outer glow on hover.
- **Input Fields:** Semi-transparent dark backgrounds with an animated "bottom-line" that expands from the center when focused, glowing in Secondary Cyan.
- **Data Chips:** Small, pill-shaped with high letter-spacing labels. Status chips for "Active" should have a pulsing 4px dot icon.
- **Cards:** Defined by "Glass" surfaces. Use a subtle top-left to bottom-right linear gradient (white at 5% to transparent).
- **Security Scanners:** Custom components including circular progress rings with "rotating data" segments and particle-line scans moving vertically across the component area.
- **Alerts:** Red borders with a low-opacity red background tint. The text should remain white for readability, while the icon carries the red warning color.