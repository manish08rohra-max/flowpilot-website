# FlowPilot Website

A fast, static, conversion-oriented marketing website for **FlowPilot** — workflow automation & AI solutions (flowpilotai.co.in), serving US businesses with a specialist focus on independent insurance agencies.

**Positioning:** outcome-led. The site sells what businesses can achieve with automation — use cases first, capabilities second, project history only as secondary evidence. Primary CTA: **"Explore Automation Opportunities."**

## Page structure

| Page | File | Role |
|---|---|---|
| Home | `index.html` | Headline, use cases, insurance section, process, About section, FAQ, CTAs |
| Automation Solutions | `services.html` | Problem-led solutions + capability list |
| Insurance Automation | `insurance.html` | Dedicated US-agency landing page (IVANS-adjacent download workflows, AMS ops, data migration, reporting, AI-assisted ops) |
| Contact | `contact.html` | Enquiry form + business contact details |
| Projects & Demonstrations | `projects.html` | **Secondary evidence page** — footer-linked, not in main nav |

No build step, no framework, no runtime dependencies — plain HTML + CSS + one small JS file.

## Local development

```
cd C:\Users\Admin\Projects\flowpilot-website
python -m http.server 8000
```
Open http://localhost:8000 (opening `index.html` directly also works).

## Contact form configuration (REQUIRED before launch)

The form (`contact.html`, handler in `js/main.js`) supports three delivery modes, tried in order:

1. **Formspree** (optional) — set `FORM_ACTION` at the top of `js/main.js` to your endpoint
   (e.g. `"https://formspree.io/f/abcdwxyz"`). No keys are stored in the repo.
2. **Netlify Forms** (default) — works automatically when the site is hosted on Netlify
   (`data-netlify="true"` is already set; the form is named `enquiry`). Netlify emails
   submissions to the account owner; configure notification emails in the Netlify dashboard.
3. **Fallback** — if no provider is available (e.g. local preview), the visitor's email app
   opens pre-filled to `info@flowpilotai.co.in`, and the UI clearly says so. Enquiries are
   never silently dropped.

> ⚠️ **Email delivery is NOT yet verified** — it requires deployment to Netlify (or a
> Formspree account) and a live test. See "Remaining blockers" below.

Spam protection: honeypot field (`company-website`) + client-side validation. Netlify adds
its own spam filtering.

Fields collected: name, business email, company (optional), area of interest, workflow
description. No sensitive data is collected.

## Public business information

- **Email:** `info@flowpilotai.co.in` (everywhere: form target, footers, schema)
- **Phone:** `+91 70201 11850`
- **Location:** "Serving US businesses remotely · Based in Pune, India" — no street address
- **No founder/owner profile** (`.founder-card` CSS retained for later if desired)
- **Compliance framing:** no partnerships claimed (IVANS/Applied Systems disclaimed by name),
  no client deployments, testimonials, or metrics; use cases labelled "potential outcomes";
  internal work labelled Internal R&D / Demo / Prototype on `projects.html`

## Editing content

- **Copy** — edit HTML directly; sections are labelled with comments.
- **Logo** — `assets/logo.svg` is the official FlowPilot lockup (symbol + wordmark, white/cyan). The favicon (`assets/favicon.svg`) is the symbol-only mark. Header/footer display the lockup at 40px height via `.brand-img`.
- **Colors** — CSS variables at the top of `css/styles.css`.
- **Fonts** — Sora + Inter via Google Fonts (each page's `<head>`).
- **Analytics** — none included by design. If added later, document config + privacy impact
  and update the footer "No analytics" line.

## Deployment (Netlify recommended)

1. Push to a Git repo or drag-drop the folder at app.netlify.com/drop.
2. Verify the form appears under **Forms** in the Netlify dashboard; set notification email.
3. Add a custom domain: `flowpilotai.co.in` (the included `_headers` file applies security
   headers automatically on Netlify).
4. Submit `https://flowpilotai.co.in/sitemap.xml` in Google Search Console.

Non-Netlify hosts: `_headers` won't apply (configure headers server-side); the form falls
back to mailto unless Formspree is configured.

## Tests executed (2026-10-19)

| Check | Result |
|---|---|
| Internal link & anchor checker (130 refs, 30 anchor targets, 5 pages) | ✅ all OK |
| All 5 pages load with zero console/page errors (headless Chromium/Edge) | ✅ pass |
| Mobile menu open/close at 375px, no horizontal overflow | ✅ pass |
| CTA destinations present (services.html / contact.html) | ✅ pass |
| FAQ accordion interaction | ✅ pass |
| Form validation flags 3 required fields on empty submit | ✅ pass |
| `?topic=insurance` preselects area of interest | ✅ pass |
| Fallback delivery path shows guidance box (local, no provider) | ✅ pass |
| Nav links keyboard-focusable | ✅ pass |
| Lighthouse scores | ⛔ not executed (no Lighthouse runtime available in this environment) |
| Live form delivery (Netlify/Formspree) | ⛔ blocked until deployment + external config |

## Remaining blockers to production

1. **Form delivery unverified** — deploy to Netlify (or configure Formspree) and submit one
   real test enquiry; confirm it arrives by email.
2. **Logo** — `assets/logo.svg` is a placeholder mark; replace with the approved logo file.
3. **Lighthouse baseline** — run after deployment; static site, no render-blocking JS beyond
   one small file, so scores are expected to be high but must be confirmed.
4. **Domain/DNS** — point `flowpilotai.co.in` at the host; confirm HTTPS certificates.

## Launch checklist

- [ ] Replace `assets/logo.svg` with final approved logo
- [ ] Deploy to Netlify; verify `_headers` applied (securityheaders.com)
- [ ] Submit a live test enquiry; confirm email receipt; then set up form notifications
- [ ] Add `flowpilotai.co.in` custom domain + verify HTTPS
- [ ] Run Lighthouse (target: Perf 90+, A11y 95+, BP 95+, SEO 95+)
- [ ] Submit sitemap to Google Search Console
- [ ] Final proofread of insurance.html (compliance language intact: no partnership/
      deployment/metric claims)
- [ ] Verify footer email/phone still correct after any changes

## Deploying from GitHub

This repo is deploy-ready as-is — `index.html` sits at the root, no build step.

1. **Create the repo** on github.com (e.g. `flowpilot-website`), then:
   ```
   git init
   git add .
   git commit -m "Initial commit — FlowPilot website"
   git branch -M main
   git remote add origin https://github.com/<your-username>/flowpilot-website.git
   git push -u origin main
   ```
2. **Connect the repo** in your hosting platform (Airo / Netlify / Vercel): it should
   auto-detect a **static site** — framework: none, build command: none, output/publish
   directory: **repo root** (`/`). If the platform asks for a build command, use the
   no-op: `npm run build`.
3. **GoDaddy cPanel instead:** download the repo as a ZIP (Code → Download ZIP), upload
   to `public_html`, extract so `index.html` sits directly in `public_html`.

> If a preview URL shows the host's "Coming Soon / application is being prepared" page,
> the files were never deployed — check that the repo is connected and the deploy
> completed, not the site code.

## Structure

```
flowpilot-website/
├── index.html          · Home
├── services.html       · Automation Solutions (problem-led)
├── insurance.html      · Insurance Automation landing page
├── contact.html        · Contact + enquiry form
├── projects.html       · Projects & Demonstrations (secondary evidence)
├── css/styles.css      · All styling (design tokens at top)
├── js/main.js          · Nav, reveal, accordion, form delivery (FORM_ACTION here)
├── assets/logo.svg     · Logo mark (placeholder — replace)
├── assets/favicon.svg
├── _headers            · Netlify security headers
├── robots.txt
├── sitemap.xml
└── README.md
```
