# Tilde – E-Commerce Website (Supabase Architecture Edition)

A responsive, multi-page e-commerce website built with **HTML5, CSS3, vanilla JavaScript and Supabase** as part of the **Web Development Internship at Sysslan IT Solutions**, hardened for production with asynchronous cloud database persistence, Row Level Security (RLS), Supabase Auth, and real-time catalog synchronization.

---

## Architecture Overview
Tilde has transitioned from isolated browser storage (`localStorage`) to a live cloud backend powered by **Supabase**:
- **Cloud Database:** Products are stored in a PostgreSQL table (`public.products`) with strict type constraints, price bounds, and automated `updated_at` timestamps.
- **Unified Client Module (`js/supabase.js`):** Encapsulates Supabase client initialization, parameterized queries (`.select()`, `.insert()`, `.update()`, `.delete()`), and XSS sanitization helpers.
- **Row Level Security (RLS):** Public anonymous users have read-only (`SELECT`) access to active products; all mutating operations (`INSERT`, `UPDATE`, `DELETE`) require authenticated Supabase admin JWT sessions.
- **Admin Authentication:** Client-side hardcoded passwords and `sessionStorage` checks have been deprecated in favor of **Supabase Auth** (`supabase.auth.signInWithPassword`), ensuring devtools cannot bypass administrative gates.
- **Real-Time Synchronization:** Frontend pages (`index.html`, `products.html`, `cart.html`, and `admin.html`) subscribe to database changes via `supabase.channel()` to reflect catalog additions, price changes, and deletions instantly without manual page reloads.
- **Resilient Fallback:** If Supabase credentials are not yet configured, the storefront smoothly falls back to an offline sample catalog while guiding the administrator on setup steps.

---

## Technologies
- **Frontend:** HTML5, CSS3 (variables, Flexbox, CSS Grid, media queries), Vanilla JavaScript (ES6+ async/await, DOM APIs).
- **Backend & Database:** Supabase (@supabase/supabase-js@2 CDN), PostgreSQL with Row Level Security (RLS) and Realtime replication.
- **Typography & Icons:** Google Fonts (Bricolage Grotesque, DM Sans), Lucide-style inline SVGs.

---

## Supabase Setup Guide

### 1. Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com/) and create a new project.
2. Note your **Project URL** and **Anon Public API Key** from **Project Settings → API**.

### 2. Configure Credentials in `js/supabase.js`
Open `ecommerce-website/js/supabase.js` and update the constants at the top:
```javascript
const SUPABASE_URL = 'https://hmktzkrsfmtbmprysavt.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 3. Run the Database Schema & RLS Policies
Navigate to the **SQL Editor** in your Supabase Dashboard and run the entire script provided in **`schema.sql`**:
- Creates the `public.products` table with constraints (`price >= 0`, `rating BETWEEN 0 AND 5`).
- Configures Row Level Security (RLS) policies for public `SELECT` and authenticated `INSERT`/`UPDATE`/`DELETE`.
- Enables Realtime replication (`ALTER PUBLICATION supabase_realtime ADD TABLE public.products;`).
- Seeds the initial 16 core catalog items with proper sequential IDs.

### 4. Create an Admin User
1. Go to **Authentication → Users** in your Supabase Dashboard.
2. Click **Add User → Create User**.
3. Enter an email (e.g., `admin@tilde.example`) and a secure password.
4. Use these credentials to sign in at `admin.html`.

---

## Folder Structure
```
ecommerce-website/
├── index.html               # Storefront landing page (trending, bestsellers, new arrivals, realtime)
├── products.html            # Catalog browse, filter by category/sale/wishlist, search, sorting
├── product-details.html     # Single product detail, quantity selector, related items
├── cart.html                # Cart summary, delivery calculation, live item validation, demo checkout
├── admin.html               # Supabase Auth-gated admin portal for catalog CRUD
├── about.html               # Company overview and values
├── contact.html             # Contact and newsletter validation forms
├── schema.sql               # Full PostgreSQL table schema, RLS policies, and seed data
├── css/
│   ├── style.css            # Base design tokens, typography, layout, header, footer
│   ├── components.css       # Cards, buttons, forms, summary cards, cart drawer, dialogs
│   ├── responsive.css       # Mobile & tablet breakpoints
│   └── admin.css            # Admin shell, catalog table, login box
├── js/
│   ├── supabase.js          # Unified Supabase client, parameterized operations, XSS sanitizers
│   ├── main.js              # Header nav, toast notifications, search suggestions, back-to-top
│   ├── products.js          # Catalog loading, reusable product card, shop filters, realtime sync
│   ├── cart.js              # Cart state, live Supabase synchronization, totals calculation
│   ├── admin.js             # Supabase Auth sign-in, admin dashboard, product modal form
│   └── contact.js           # Form validation rules
└── assets/
    ├── images/              # 16 SVG product images + placeholder.svg fallback
    ├── logo/                # Logo and favicon
    └── icons/
```

---

## Security Hardening Details

1. **SQL Injection Defense:**
   - 100% of database interactions utilize parameterized query builder methods (`.select()`, `.insert()`, `.update()`, `.delete()`).
   - No string concatenation or raw SQL queries exist in client-side code.

2. **Cross-Site Scripting (XSS) Prevention:**
   - All dynamic text values (`name`, `desc`, `cat`, `info`) pass through strict HTML entity escaping (`escapeHTML()`).
   - Search suggestions and toast notices construct DOM nodes safely using `document.createElement()` and `textContent`.
   - Image URLs are sanitized to prevent `javascript:` or malicious data URI pseudo-protocols.

3. **Price Validation Zero-Bug Fix:**
   - In `admin.js`, form validation checks `priceRaw === '' || isNaN(price) || price < 0` instead of `!price`.
   - `0` is officially accepted for free or promotional giveaway items.

4. **Universal ID Compatibility:**
   - Unary `+` coercion has been eliminated across all scripts.
   - Lookups and filters standardize on string matching (`String(p.id) === String(targetId)`), ensuring full compatibility with numeric IDs, UUIDs, and alphanumeric strings.

5. **Image Error Handling:**
   - All product image elements render with `onerror="this.onerror=null;this.src='assets/images/placeholder.svg';"` to gracefully handle broken or missing external links.

---

## Testing & Local Execution
1. Double-click `index.html` or start a local static server:
   ```bash
   python3 -m http.server 8000
   ```
2. Open `http://localhost:8000` in your web browser.
3. Open `admin.html`, sign in with your Supabase credentials, and modify product prices or add new products. Watch the changes appear in real-time on `index.html` and `products.html`!
