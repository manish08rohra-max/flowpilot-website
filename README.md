# FlowPilot Website

A fast, static, conversion-oriented marketing website for **FlowPilot** — workflow automation & AI solutions (flowpilotai.co.in), serving US businesses with a specialist focus on independent insurance agencies.

**Positioning:** outcome-led. The site sells what businesses can achieve with automation — use cases first, capabilities second, project history only as secondary evidence. Primary CTA: **"Explore Automation Opportunities."**

## Page structure

| Page | File | Role |
|---|---|---|
| Home | `index.html` | Headline + live workflow pipeline, use cases, insurance section, process, About, FAQ |
| Automation Solutions | `services.html` | Interactive problem explorer (Today vs. With FlowPilot workflow design) + capability list |
| Insurance Automation | `insurance.html` | Dedicated US-agency landing page (download workflows, AMS ops, data migration, reporting, AI-assisted ops) + pain-point picker |
| Contact | `contact.html` | Enquiry form (direct submission) + business contact details |
| Projects & Demonstrations | `projects.html` | **Secondary evidence page** — footer-linked, not in main nav |

No build step, no framework, no runtime dependencies — plain HTML + CSS + one small JS file. `server.js` (Node built-ins only) exists solely for hosts that require a listening process.

## Local development

```
cd C:\Users\Admin\Projects\flowpilot-website
python -m http.server 8000        (option A — simple static server)
node server.js                    (option B — same server the platform runs, PORT env supported)
```
Open http://localhost:8000

## Contact form configuration

**Direct web submission is active.** The form posts via AJAX to FormSubmit
(`https://formsubmit.co/ajax/info@flowpilotai.co.in`) — no account, no API key,
works on any host including GoDaddy and Airo.

**One-time activation (required once):** the first submission makes FormSubmit
email an activation link to `info@flowpilotai.co.in` — click **Activate** in it.
After that, enquiries arrive directly in the inbox. To activate: submit one test
enquiry from the live site, click the activation link, then submit another test
and confirm it arrives.

- **Spam protection:** honeypot field + client-side validation; `_captcha` disabled
  for the AJAX flow (FormSubmit filters server-side too).
- **Formspree alternative:** set `FORM_ACTION` at the top of `js/main.js` to your
  Formspree endpoint — it takes priority over FormSubmit.
- **Failure path:** if delivery fails for any reason, the visitor's email app opens
  pre-filled to `info@flowpilotai.co.in` and an honest error notice explains it.
- **Success UI:** a thank-you modal confirms the submission — no page redirect.

Fields collected: name, business email, company (optional), area of interest,
workflow description. No sensitive data is collected.

## Public business information

- **Email:** `info@flowpilotai.co.in` (everywhere: form target, footers, schema)
- **Phone:** `+91 70201 11850`
- **Location:** "Serving US businesses remotely · Based in Pune, India" — no street address
- **No founder/owner profile** (`.founder-card` CSS retained for later if desired)
- **Compliance framing:** no partnerships claimed (IVANS/Applied Systems disclaimed by
  name), no client deployments, testimonials, or metrics; use cases labelled "potential
  outcomes"; internal work labelled Internal R&D / Demo / Prototype on `projects.html`

## Editing content

- **Copy** — edit HTML directly; sections are labelled with comments.
- **Logo** — `assets/logo.svg` is the official FlowPilot lockup (symbol + wordmark,
  white/cyan). Favicon (`assets/favicon.svg`) is the symbol-only mark.
- **Colors** — CSS variables at the top of `css/styles.css`.
- **Fonts** — Sora + Inter via Google Fonts (each page's `<head>`).
- **Analytics** — none included by design. If added later, document config + privacy
  impact and update the footer "No analytics" line.

## Deploying from GitHub

This repo is deploy-ready as-is — `index.html` sits at the root, no build step.

1. **Create the repo** on github.com, then:
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
3. **Platforms that require a listening process** (e.g. Airo): `npm start` runs
   `server.js` — a zero-dependency Node static server binding `process.env.PORT`.
4. **GoDaddy cPanel instead:** download the repo as a ZIP (Code → Download ZIP), upload
   to `public_html`, extract so `index.html` sits directly in `public_html`.

> If a preview URL shows the host's "Coming Soon / application is being prepared" page,
> the files were never deployed — check that the repo is connected and the deploy
> completed, not the site code.

## Tests executed (2026-10-19)

| Check | Result |
|---|---|
| Internal link & anchor checker (129 refs, 31 anchor targets, 5 pages) | ✅ all OK |
| All 5 pages load with zero console/page errors (headless Chromium/Edge) | ✅ pass |
| Mobile menu open/close at 375px, no horizontal overflow | ✅ pass |
| CTA destinations present (services.html / contact.html) | ✅ pass |
| FAQ accordion interaction | ✅ pass |
| Form validation flags 3 required fields on empty submit | ✅ pass |
| `?topic=insurance` preselects area of interest | ✅ pass |
| Successful submission (mocked endpoint) shows thank-you modal | ✅ pass |
| Failed submission (mocked 500) shows honest error box with mailto handoff | ✅ pass |
| Solutions explorer: tabs switch, deep links (#orchestration) activate tabs | ✅ pass |
| Hero pipeline cycles steps; pauses on hover | ✅ pass |
| server.js: GET 200s with correct MIME, POST 405, traversal 403 | ✅ pass |
| Nav links keyboard-focusable | ✅ pass |
| Lighthouse scores | ⛔ not executed (no Lighthouse runtime available in this environment) |
| Live form delivery end-to-end | ⏳ one-time FormSubmit activation click pending |

## Remaining blockers to production

1. **FormSubmit activation click** — submit one test enquiry on the live site, click the
   activation link emailed to `info@flowpilotai.co.in`, then confirm a second test arrives.
2. **Airo deployment** — repo pushed; redeploy must pick up commit `087d6d7+` (server.js).
3. **Lighthouse baseline** — run after deployment.
4. **Domain/DNS** — point `flowpilotai.co.in` at the host; confirm HTTPS.

## Launch checklist

- [x] Official logo lockup in place (`assets/logo.svg`)
- [ ] FormSubmit activation clicked; live test enquiry confirmed in inbox
- [ ] Airo deploy successful; preview URL serves the real site
- [ ] Add `flowpilotai.co.in` custom domain + verify HTTPS
- [ ] Run Lighthouse (target: Perf 90+, A11y 95+, BP 95+, SEO 95+)
- [ ] Submit sitemap to Google Search Console
- [ ] Final proofread of insurance.html (compliance language intact)
- [ ] Verify footer email/phone still correct after any changes

## Structure

```
flowpilot-website/
├── index.html          · Home
├── services.html       · Automation Solutions (interactive problem explorer)
├── insurance.html      · Insurance Automation landing page (+ pain-point picker)
├── contact.html        · Contact + enquiry form (direct submission + thank-you modal)
├── projects.html       · Projects & Demonstrations (secondary evidence)
├── server.js           · Zero-dependency static server for PORT-binding hosts
├── css/styles.css      · All styling (design tokens at top)
├── js/main.js          · Nav, pipeline, tabs, picker, form delivery (FORM_ACTION here)
├── assets/logo.svg     · Official FlowPilot lockup (symbol + wordmark)
├── assets/favicon.svg  · Symbol-only mark
├── _headers            · Netlify security headers
├── robots.txt
├── sitemap.xml
└── README.md
```
