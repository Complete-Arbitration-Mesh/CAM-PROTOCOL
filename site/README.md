# CAM-PROTOCOL Landing Page

Static marketing site for CAM-PROTOCOL. Tailwind CSS via CDN, no build step required.
Deploy to Vercel (preferred) or Cloudflare Pages.

## Files

| File           | Purpose |
|----------------|---------|
| `index.html`   | Main landing page — hero, problem, features, pricing, quick start, footer |
| `success.html` | Post-Stripe-checkout thank you page |
| `vercel.json`  | Vercel deploy config (cleanUrls, security headers, redirects) |
| `README.md`    | This file |

---

## Before You Deploy — Stripe Setup (required for Pro checkout)

The Pro button currently falls back to `mailto:` until you configure Stripe.
To enable live Stripe Checkout:

1. Log into [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Create a product:**
   - Products > Add product
   - Name: `CAM-PROTOCOL Pro`
   - Pricing: Recurring, $99.00 USD / month
   - Save and copy the **Price ID** (starts with `price_`)
3. **Get your publishable key:**
   - Developers > API keys
   - Copy the **Publishable key** (starts with `pk_live_`)
4. **Edit `index.html`** — find these two lines near the bottom and replace the placeholders:

```javascript
const STRIPE_PK       = 'pk_live_REPLACE_ME';   // <-- your publishable key
const STRIPE_PRICE_ID = 'price_REPLACE_ME';      // <-- your price ID
```

5. Redeploy.

While `REPLACE_ME` is in place, clicking "Get Pro" opens a pre-filled email to
`EdwardsTechPros@Outlook.com` instead of redirecting to Stripe — so you can still
take manual sign-ups before Stripe is wired.

### Test Stripe before going live

Use a `pk_test_...` key and test price ID first. Stripe test cards:
- `4242 4242 4242 4242` — succeeds
- `4000 0000 0000 0002` — declined

Verify `/success` renders correctly after checkout. Then swap to `pk_live_...`.

---

## Deploy to Vercel (recommended)

### Option A — Vercel CLI

```bash
cd C:\Users\Mrdru\CAM-PROTOCOL\site
npx vercel --prod
```

On first run, Vercel will ask:
- Project name: `cam-protocol`
- Framework: Other
- Root directory: `.` (the site/ folder itself)
- Build command: leave blank
- Output directory: `.`

### Option B — Vercel dashboard + Git

1. Push `CAM-PROTOCOL` to GitHub (it's already there)
2. [vercel.com/new](https://vercel.com/new) > Import repository
3. Set **Root Directory** to `site/`
4. Build command: *(leave blank)*
5. Output directory: `.`
6. Deploy

`cleanUrls: true` in `vercel.json` means `/success` serves `success.html` automatically.

---

## Deploy to Cloudflare Pages

1. Dashboard > Pages > Create a project > Connect to Git
2. Select the `CAM-PROTOCOL` repo
3. Build settings:
   - Build command: *(leave blank)*
   - Build output directory: `site`
4. Deploy

---

## Custom domain

After deploying on Vercel:
1. Project settings > Domains > Add `cam-protocol.dev`
2. Add the DNS records Vercel shows you (usually a CNAME to `cname.vercel-dns.com`)
3. SSL is automatic via Let's Encrypt

---

## Local preview

No build step needed — open `index.html` directly in a browser.
Tailwind CDN and Stripe.js load from the internet, so you need a network connection.

For local Stripe testing, use the browser dev tools to verify the JS wires up correctly
without actually hitting Stripe's API.

---

## What the Pro button does (technical detail)

```javascript
const STRIPE_PK       = 'pk_live_REPLACE_ME';
const STRIPE_PRICE_ID = 'price_REPLACE_ME';

// If placeholders are still in place: opens mailto fallback
// If configured: calls stripe.redirectToCheckout() with the price ID
// Success URL: window.location.origin + '/success'
// Cancel URL:  window.location.origin + '/#pricing'
```

Stripe.js is loaded synchronously in `<head>` (not `async`) so it's guaranteed
to be available when the button is clicked.
