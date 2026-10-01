# Concrete Surfers — website

Static site. No build step, no dependencies. Three files plus assets.

```
site/
  index.html      the whole page
  styles.css      brand tokens + layout
  main.js         menu, booking form, scroll reveals
  assets/
    logo-horizontal.svg   ← replace (nav + footer)
    logo-badge.svg        ← replace (about placeholder)
    favicon.svg           ← replace (browser tab)
    vasco.jpg             ← add (about photo, portrait ~4:5)
    og-image.jpg          ← add (social share, 1200×630)
    fonts/                ← optional, see "Fonts"
```

## Run it locally

```bash
cd site
python3 -m http.server 8000
# open http://localhost:8000
```

## Logo — do this first

The SVGs in `assets/` are **placeholders**, not the real mark. Overwrite them with
your files, keeping the same filenames, and everything picks them up:

| File | Which version to use | Where it shows |
|---|---|---|
| `logo-horizontal.svg` | cream/off-white horizontal | header, footer |
| `logo-badge.svg` | cream/off-white circular | about section fallback |
| `favicon.svg` | dark circular | browser tab |

PNG works too — rename to `.png` and update the three `src=`/`href=` references in
`index.html`. SVG is better: it stays sharp at any size.

## Fonts

The brand fonts are Bely Display (quotes), Bebas Neue (titles) and Agenda (body).
Bebas Neue loads from Google Fonts already. Bely Display and Agenda are licensed —
they're not on any free CDN.

To use them:
1. Convert your licensed files to `.woff2`.
2. Put them in `assets/fonts/` as `BelyDisplay.woff2`, `Agenda-Regular.woff2`,
   `Agenda-Bold.woff2`.
3. Uncomment the `@font-face` block at the top of `styles.css`.

Until then the site falls back to Playfair Display (quotes) and Archivo (body),
which are close enough in feel and load from Google Fonts.

## Prices

Set in `index.html` in the `#coaching` section, and in the `<select id="option">`
of the booking form. Currently:

- Diagnostic — **49€**
- Single online session — **80€** (video analysis, surf or surfskate · surf strength & conditioning)

Change them in both places so the form stays in sync with the cards.

## Booking form

There's no backend. Submitting opens the visitor's email client with everything
filled in, addressed to `info@concrete-surfers.com`. That works everywhere and
costs nothing, but it loses people who use webmail without a mail handler.

To move to a real form, replace the body of the submit handler in `main.js`
(marked with a comment) with a `fetch()` POST to Formspree, Basin, or a
serverless function. Roughly:

```js
await fetch("https://formspree.io/f/YOUR_ID", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ name: name.value, email: email.value, option: option.value, message: message.value })
});
```

## Payments

Not wired up. The flow is: enquiry → you reply with availability and a payment
link. When you want self-serve checkout, create two Stripe Payment Links (49€ and
80€) and point the card buttons at them instead of `#book`.

## Deploy

**Vercel** — from the repo root:
```bash
npx vercel --cwd site --prod
```
Or in the Vercel dashboard: import the repo, set the root directory to `site`,
framework preset "Other", no build command, output directory `.`.

**Netlify** — drag the `site/` folder onto the deploy page, or set base directory
`site` with no build command.

**GitHub Pages** — push and point Pages at `/site` on the default branch.

The site is entirely static, so any of these works with zero configuration.

## Editing copy

Everything lives in `index.html` as plain HTML. Section order:

hero → POV bar → the plateau → coaching & prices → how it works → CSTM method →
retreats/tour/certification → about → FAQ → booking → footer

Voice rules from the brand guide are applied throughout: no "flow", no "vibes",
no corporate surf-brand language.
