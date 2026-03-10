# PROMPT: CivicStat — Quick fixes + Transparency layer

## Context
CivicStat project — Dutch parliamentary transparency platform.

**Monorepo:** `/Users/koenbekkering/Documents/New project/`  
**Frontend (separate git repo):** `/Users/koenbekkering/Documents/New project/civicstat-web/`  
**Design reference:** `/Users/koenbekkering/Documents/New project/civicstat-transparency.jsx` — READ THIS FIRST

---

## Fix 1: Wire up footer links (~5 min)

**File:** `civicstat-web/app/layout.tsx`

The footer has four links rendered as `<span>` elements with no actual navigation:
```tsx
{["Over", "Methodologie", "Open API", "Governance"].map((l) => (
  <span key={l} className="cursor-pointer hover:text-text-secondary transition-colors">{l}</span>
))}
```

Replace with actual `<Link>` components:
- "Over" → `/` (scroll to the mission section, or just link home for now)
- "Methodologie" → `/transparantie`
- "Open API" → `/api` (if this page exists) or `https://civicstat-api.fly.dev/health`
- "Governance" → `/transparantie` (or remove this one — it's not a real page)

Import `Link` from `next/link` if not already imported. Replace the `.map()` with explicit links.

---

## Fix 2: Clean up nav — remove "Home", add mobile access to Verbinding/Transparantie (~15 min)

**File:** `civicstat-web/components/Nav.tsx`

**Problem:** The CivicStat logo already links to `/`, so "Home" as a nav item is redundant. On mobile, there are 5 bottom nav items (Home, Beloften, Moties, Kamerleden, Partijen) but no way to reach Verbinding or Transparantie.

**Do this:**

1. Remove "Home" from `navItems` array (the logo handles this)
2. Keep `navItems` as: Beloften, Moties, Kamerleden, Partijen
3. On **mobile bottom nav**, show 5 items: Beloften, Moties, Partijen, Verbinding, Transparantie (drop Kamerleden from mobile — it's less important for testers and still accessible via desktop)
4. Add mobile icons for Verbinding (use a handshake or link icon) and Transparantie (use an eye or shield icon)
5. Keep `desktopOnlyItems` array but now render ALL items (navItems + desktopOnlyItems) on desktop nav — they're no longer "desktop only"

The mobile icon SVGs can be simple — for Verbinding use a link/chain icon, for Transparantie use an eye icon. Follow the same pattern as the existing `mobileIcons` record.

---

## Fix 3: Build the Transparency Slide-out Panel (the big one) (~45 min)

This is the core "transparantielaag" — a reusable methodology panel that slides in from the right on any page.

**Design reference:** Read `civicstat-transparency.jsx` — specifically the `MethodologyLegend` component (around line 350+), the `Term` component, and the `glossarySections` data.

### Step A: Create the MethodologyPanel client component

**File:** `civicstat-web/components/MethodologyPanel.tsx` (new file, "use client")

This is a slide-from-right panel (width: `min(440px, 90vw)`) with:
- **Overlay** backdrop that closes on click
- **Header** with "Methodologie & begrippen" title + close button
- **Search bar** to filter glossary terms
- **Accordion sections** — each section is collapsible:
  1. **Begrippen** — MCS, IAS, CAI definitions with formulas
  2. **Match-types** — Expliciet (green badge), Impliciet (grey badge), Tegengesteld (light badge) with definitions
  3. **Specificiteit** — Hoog/Gemiddeld/Laag with badge colors
  4. **Databronnen** — TK OData API, DNPP Repository, Zetelverdeling with source URLs

Each item shows:
- Term name (bold)
- Optional badge (colored pill with text like "EXPLICIET", "IMPLICIET", etc.)
- Definition text
- Optional formula (monospace)
- Optional source URL (external link icon)

Animations:
- Overlay: `fadeIn 0.2s`
- Panel: `slideIn 0.25s` (translateX(100%) → translateX(0))

Use Tailwind classes throughout. The glossary data should be defined inline in this file (or a separate data file). Copy the exact Dutch text from the `glossarySections` array in `civicstat-transparency.jsx`.

Props: `{ open: boolean; onClose: () => void }`

### Step B: Create the Term inline tooltip component

**File:** `civicstat-web/components/Term.tsx` (new file, "use client")

A small inline component that:
- Renders children with `border-bottom: 1px dashed` + `cursor: help`
- On hover (desktop) or click (mobile), shows a floating tooltip above the text
- Tooltip contains: term name (bold) + definition text
- Tooltip is positioned absolutely, max-width 280px, with a small arrow pointing down

Props: `{ children: React.ReactNode; definition: string }`

### Step C: Add a "Begrippen" button to the Nav

**File:** `civicstat-web/components/Nav.tsx`

In the desktop nav's right section (next to search icon and theme toggle), add a button:
```tsx
<button onClick={() => setMethodologyOpen(true)} className="...">
  <BookIcon /> <span className="hidden md:inline">Begrippen</span>
</button>
```

This requires the Nav to manage `methodologyOpen` state and render the `<MethodologyPanel>`.

The button should look like the existing theme toggle: `bg-surface-sub border border-border rounded-[7px] px-3 py-1.5`. Use a book icon (simple SVG).

### Step D: Wire "Methodologie & begrippen" link into content pages

On key pages, add a small footer link that opens the panel:
- `civicstat-web/app/moties/[id]/page.tsx` — after the belofte-kloof section
- `civicstat-web/app/beloften/[id]/page.tsx` — after the methodology note section
- `civicstat-web/app/partijen/[id]/page.tsx` — after the scorecard section

This link is a small text button: `📖 Methodologie & begrippen →` that opens the panel.

Since these are server components but need to trigger client state, the simplest approach is to wrap the link + panel in a small client component:

**File:** `civicstat-web/components/MethodologyLink.tsx` (new file, "use client")
```tsx
"use client";
import { useState } from "react";
import MethodologyPanel from "./MethodologyPanel";

export default function MethodologyLink({ label = "Methodologie & begrippen" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[12px] text-text-tertiary hover:text-text-secondary transition-colors mt-3">
        <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <span className="underline underline-offset-2">{label}</span>
      </button>
      <MethodologyPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

Then in server components just add `<MethodologyLink />` where appropriate.

### Step E: Add `Term` inline tooltips to key content

Use the `Term` component in a few high-visibility places:
- Motion detail page: wrap "stemming met handopsteken" and "hoofdelijke stemming" in `<Term>` with definitions
- Promise detail page: wrap "Expliciet"/"Impliciet" match type labels in `<Term>`
- Party scorecard: wrap "Mandaatconsistentiescore" in `<Term>`

Since `Term` is a client component, it can be imported into server components (Next.js handles this). But for pages that are fully server-rendered, wrap the section containing Terms in a client boundary if needed.

---

## Commit and deploy

```bash
cd /Users/koenbekkering/Documents/New\ project/civicstat-web
git add -A
git commit -m "feat: transparency layer — methodology panel, inline terms, footer links, mobile nav"
git push
```

---

## Glossary content (Dutch text for the panel)

Copy these EXACT definitions from `civicstat-transparency.jsx`:

### Begrippen section:
- **Mandaatconsistentiescore (MCS)**: "Percentage stemmingen waarin een partij consistent stemt met de eigen verkiezingsbeloften. 100% = altijd consistent met beloften. Berekend per thema en als totaalcijfer."  
  Formula: `MCS = consistente stemmen / (consistente + afwijkende stemmen) × 100%`
- **Initiatief Alignment Score (IAS)**: "Meet of een partij zelf wetgeving initieert die past bij de eigen beloften (moties indient), in tegenstelling tot alleen meestemmen met voorstellen van anderen."  
  Formula: `IAS = ingediende moties met belofte-match / totaal relevante beloften × 100%`
- **Coalitie Alignment Index (CAI)**: "Het percentage stemmingen waarin een Kamerlid of partij hetzelfde stemt als de coalitiepartijen. Meet coalitiediscipline versus eigenstandigheid."  
  Formula: `CAI = gelijke stemmen met coalitieblok / totaal stemmingen × 100%`

### Match-types section:
- **Expliciet** (badge: green bg #E8F5F0, text #0F5B4D): "De motie adresseert direct dezelfde concrete toezegging als de belofte. Weegt mee met factor 1.0."
- **Impliciet** (badge: grey bg #EEF1F5, text #4A5468): "De motie valt binnen hetzelfde thema als de belofte, maar er is geen directe tekstuele overeenkomst. Weegt mee met factor 0.5."
- **Tegengesteld** (badge: light bg #F7F8FA, text #8B95A8): "De motie druist in tegen de belofte. De voorspelde stemrichting wordt omgekeerd. Weegt mee met factor 1.0."

### Specificiteit section:
- **Hoog (specifiek)** (badge: "SPECIFIEK"): "Meetbare, concrete toezegging met een duidelijk toetsbaar doel."
- **Gemiddeld** (badge: "GEMIDDELD"): "Duidelijke richting, maar geen exact meetbaar doel."
- **Laag (vaag)** (badge: "VAAG"): "Abstracte of vage toezegging die moeilijk objectief toetsbaar is."

### Databronnen section:
- **Tweede Kamer OData API**: "De officiële open data API van de Tweede Kamer der Staten-Generaal." URL: https://gegevensmagazijn.tweedekamer.nl
- **DNPP Repository**: "Het Documentatiecentrum Nederlandse Politieke Partijen aan de Rijksuniversiteit Groningen." URL: https://dnpprepo.ub.rug.nl
- **Zetelverdeling**: "Gebaseerd op de actuele fractiegrootte volgens de Tweede Kamer, niet op de verkiezingsuitslag."
