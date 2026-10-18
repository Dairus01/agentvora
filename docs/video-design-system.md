# Reconstructed design system

The recording, not a component template, defines the visual direction. Sampling and visual comparison suggest:

| Token | Agentvora implementation | Reference intent |
|---|---|---|
| Background | `#070b12` | Near-black navy; landing nearly black |
| Panel | `#0c121c` | Slightly lighter charcoal |
| Subtle | `#0a1018` | Recessed bands and chart surfaces |
| Border | `#1b2530` | Thin low-contrast separators |
| Primary text | `#e5ecef` | Off-white |
| Muted text | `#7d8996` | Cool gray |
| Positive/accent | `#00d69b` | Emerald/mint |
| Negative | `#ed6470` | Red/coral |
| Secondary | `#3da3d1` | Blue EMA and occasional labels |
| Review state | `#e6bd62` | Amber |
| Green surface | `#06231e` | Selected ticker and active controls |

Closest open typefaces: DM Sans for UI/headings and IBM Plex Mono for financial values, axes and micro-labels, self-hosted via Fontsource. Headings 600, body 400, controls 500/600; major landing heading approximately 90–105 px at the source width. Terminal body 12–14 px; role descriptions 10–11 px; mono metadata 8–11 px. Landing headings 40–64 px. Four-pixel spacing basis, panels typically 16–24 px internal padding. Hero is more spacious, with strong left alignment and an emerald/blue treatment on a single headline word.

Cards use 12–18 px radii on landing; terminal panels 6–8 px; tiny badges 4–5 px. One-pixel borders dominate; avoid heavy shadows except subtle depth on rotated hero market cards. Hero green radial wash is derived from the recording; no background video. SVG heartbeat identity reflects the original icon language while rebranding. Lucide gives consistent small line icons.

Chart: dark plot, faint grid, emerald up/coral down candles, matching wicks, muted volume histogram at bottom, emerald/blue EMA overlays, mono axes, small crosshair labels and right price line. Tables extend the same rhythm with mono headers and financial cells, horizontal scroll on narrow widths. The interval toolbar selects real market history from 1m through 1d; chart styles include derived Heikin Ashi, labeled as such.

Navigation: compact 70–78 px header, green active-route wash, left-aligned brand. Source recording has a large search field; Agentvora uses useful route links and watchlist search instead of a nonfunctional global search. Asset rail retains company labels, right-aligned quote/change and green selected border. Intelligence rail uses outlined role cards, small uppercase statuses and report cards. User can expand each of six desks into the original underlying roles.

Animation: short color transitions, status pulses only during actual node execution, restrained reconnect spinner. No decorative activity is presented as agent execution. Honor reduced-motion. Theme changes cover canvas as well as HTML surfaces. Light palette is pale mint/white with dark text and preserved semantic colors.

At 1920 px the terminal uses approximately 290 / remaining / 430 px. Narrower desktop: 200–240 / remaining / 300–350 px. Below 1024 the desk moves beneath the chart; below 768 the asset rail becomes horizontal, navigation opens through a menu and the page scrolls vertically. These responsive decisions are new: the recording contains only desktop evidence.
