# GlassBox Visual Design

Status: Accepted
Date: 2026-07-17

## Understanding summary

- GlassBox is a local security and transparency tool for individual AI-agent users.
- The interface should feel calm, precise, and trustworthy rather than decorative or promotional.
- The accepted visual direction is a single dark monochrome liquid-glass system.
- The canvas is plain black; only foreground surfaces create glass depth.
- Session discovery, refresh, warnings, loading, errors, and read-only messaging remain unchanged.
- The UI must stay readable and responsive with hundreds of sessions on Windows, macOS, and Linux browsers.
- This design does not add navigation, filtering, analysis, or other product behavior.

## Assumptions and constraints

- There is one fixed dark appearance. A light theme and user-selectable themes are not part of the MVP.
- The Web UI uses system fonts and existing React/CSS. It loads no visual dependencies or external assets.
- The canvas contains no grid, glow field, light band, large decorative outline, or colored ambient effect.
- Black, white, and neutral gray define the material. Amber, green, and red appear only for scan, availability, and error meaning and are always paired with text or shape.
- True backdrop blur is limited to the toolbar, hero, telemetry tiles, status panel, and small controls. Session rows do not create individual blur layers.
- Browsers without `backdrop-filter` receive a denser neutral fallback with the same information hierarchy.
- Motion is limited to loading and short interaction feedback and respects `prefers-reduced-motion`.
- Visual changes do not alter the local read-only security boundary.

## Final design: monochrome liquid-glass workbench

1. **Plain canvas** — the page background is solid black with no decorative layer behind the interface.
2. **Glass toolbar** — one floating monochrome pill contains the brand and local read-only state.
3. **Glass hero** — a large transparent surface holds the title, safety explanation, and refresh action. It uses only neutral fill, blur, rim light, and shadow.
4. **Telemetry tiles** — discovery count, default location, and refresh time use three separate glass tiles.
5. **Session workbench** — the inventory is one transparent data slab. Sessions are compact rows rather than independent blurred cards.
6. **Semantic state** — agent identity is neutral. Amber identifies an unscanned state, green identifies local availability, and red remains reserved for errors.

Depth comes from opacity, border luminance, blur, typography, and shadow instead of colored lighting. CSS supplies the material without SVG/WebGL displacement so rendering remains consistent and inexpensive for long lists.

## Accessibility and performance

- Interactive targets remain at least 44 by 44 CSS pixels where space permits.
- Keyboard focus is a high-contrast white outline.
- Text and state labels do not depend on color alone.
- The layout is verified at 375, 768, 1024, and 1440 pixel widths without horizontal scrolling.
- Long Session rows use no backdrop blur, filter, or per-row animation.
- Loading, empty, warning, error, and no-`backdrop-filter` states use the same fixed material system.

## Decision log

| Decision                                      | Alternatives considered                                            | Reason                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Use a TypeScript and CSS-native visual system | Liquid Glass package; SVG/WebGL refraction                         | Keeps the interface small, auditable, cross-browser, and maintainable by AI agents               |
| Use a dark clear-glass base                   | Light daylight glass                                               | Explicitly selected by the user                                                                  |
| Use one workbench for the Session list        | Independent blurred card for every Session                         | Preserves continuity and avoids hundreds of blur layers                                          |
| Explore an aurora prototype first             | Start directly with monochrome                                     | Established the required transparency and material hierarchy                                     |
| Explore a colorless prism prototype second    | Vision-style floating panes; dark instrument HUD                   | Supplied a materially different comparison and was preferred by the user                         |
| Refine the selected prototype to monochrome   | Keep cyan/violet edges; remove even semantic state colors          | The user requested simple black-and-white glass; tiny semantic colors preserve security meaning  |
| Remove all background treatment               | Keep grid, light band, ellipse, and hero lens outline              | The user explicitly requested a plain background without the visible decorative line             |
| Remove the prototype switch and Option 1      | Hide the switch but keep dead code; keep both styles indefinitely  | The user finalized Option 2, so one coherent implementation is easier to understand and maintain |
| Preserve product behavior                     | Add filtering, bulk actions, or navigation during visual iteration | Keeps visual work separate from unfinished product features                                      |
