# Design tokens — from Figma variables on Mockup 2 (`1:2781`), fetched 2026-09-21

| Figma variable | Value | Proposed CSS custom property |
|---|---|---|
| Background/Primary | `#f7f5ed` | `--color-bg` (page) |
| Background/Secondary | `#ffffff` | `--color-surface` (cards, table) |
| Content/Primary | `#141413` | `--color-text` |
| Content/Secondary | `#14141399` (= rgba(20,20,19,0.6)) | `--color-text-muted` (table month headers, footnotes) |
| Content/Inverse | `#ffffff` | `--color-text-inverse` |
| Outline/Line solid | `#14141314` (= rgba(20,20,19,0.08)) | `--color-line` (row dividers) |
| Outline/Line dotted | `#14141329` (= rgba(20,20,19,0.16)) | `--color-line-dotted` (chart grid) |
| Title | Inter Display Regular 35 / 1.25 | `--font-title` (the "Clients" heading) |
| Body | Inter Regular 14 / 20 | `--font-body` (table cells, legend, axis) |
| Footnote | Inter Regular 12 / 16 | `--font-footnote` (chart axis labels) |
| Body/Body Regular | Test Founders Grotesk 17 / 20 | used only for the hidden "Placeholder" header text — ignore |

Table cells use `font-feature-settings: "lnum" 1, "tnum" 1` (tabular figures) — keep it on every numeric cell.

## Layout metrics (Mockup 2 at 1440 px; Table component `1:2901`)

- Page: content x=16, width 1408; heading at y=24 (h 44); chart card y=84, 1408×430; table card y=530, 1408×280.
- Card: white, `border-radius: 8px`, `overflow: clip`.
- Table header row: h 56, padding 16px top/bottom, 16 left, 24 right, gap 16; first column fixed 264 px; 12 month columns `flex: 1 0 0`, right-aligned, muted colour.
- Data row: h 56, padding 18 top/bottom, 16 left, 24 right, gap 16, bottom border `--color-line` (last row none); name cell 264 px; figures right-aligned, primary colour.
- Level indent: Company 0, Branch 28 px, Adviser 56 px, Attribute (channel) 84 px (28 px per level, inside the 264 px name cell). Chevron 16×16, gap 8 to the name; collapsed = the down chevron rotated −90°; adviser rows carry a 20 px avatar before the name.
- Chart (`1:2814`): plot area 1338×320, y-axis labels 0–400 in 100 steps (footnote font), dotted grid lines, 12 columns 87.5 px wide with 24 px gaps, legend centred beneath (8 px swatch + label, body font).
- Chevron icon: `icon-chevron-down.svg` (downloaded here; Figma asset URLs expire in 7 days).

## Row states — measured from the owner's export of Figma node `0:1533` ("Row"), 2026-09-22

`row-hover-states.png` in this folder (the Figma MCP is capped at 6 calls/month on a Collab seat, so the frame was exported by hand and its pixels decoded).

| State | Row background | Token |
|---|---|---|
| Default | fully transparent — the card's white shows through | none |
| **Hover** | `rgba(26,26,26,0.039)` as exported = 4 % of the text colour | `--color-row-hover: rgba(20, 20, 19, 0.04)` — exactly half `--color-line` |
| **Opened** | identical to default | none — opening changes only the chevron's rotation, never the row's fill |
| Row bottom border | `rgba(26,26,26,0.078)` | confirms `--color-line: rgba(20, 20, 19, 0.08)`, 1 px at the row's bottom |

The design has no focus treatment for rows (it shows mouse states only), and no avatar colour to copy — the design uses photographs, and spec 002 D9 replaces them with initials. Both are ours to define: keep them as named tokens (`--color-row-hover`, `--focus-ring`, `--color-avatar-*`) so they stay one-line swaps.

