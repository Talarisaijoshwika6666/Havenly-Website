# Havenly AI

Havenly AI is a frontend interior-design and furniture application prototype built with HTML, CSS, and JavaScript.

## Product areas

The experience has three distinct modes:
- **Public website:** `index.html`, `about.html`, `features.html`, `roadmap.html`, and `pricing.html` use public marketing navigation; `contact.html` remains public.
- **Authentication:** focused sign-in, account creation, password recovery, and first-time onboarding screens live in `login.html`, `signup.html`, `forgot-password.html`, `reset-password.html`, and `onboarding.html`.
- **Application:** authenticated users land on `dashboard.html`; application navigation and account controls replace public navigation. Dashboard, onboarding, profile, saved designs, orders, settings, checkout, and order details require a demo session.

Sign-up creates a local account and starts a temporary prototype session so the user can personalize their experience. Onboarding runs once, saves room/style/mood/budget preferences, and then enters the dashboard. Returning users go to the dashboard after sign-in unless they requested a protected page. Signing out returns to the public home page. Pages render navigation from the shared `js/auth.js` module rather than duplicating separate navigation templates.

## Highlights
- Application-style screens, compact desktop layouts, dedicated detail pages, tabs, modals, pagination, and a responsive mobile layout
- Product search, recent search history, catalog filters, six-item pagination, product details, cart, and wishlist
- Seven-step AI Studio and floating assistant (rules-based/deterministic frontend demos, not live model inference)
- Demo user account lifecycle: signup, login, logout, password recovery, profile editing, settings, and protected account pages
- User-scoped saved designs, favorite styles, and demo orders; guest cart, wishlist, and saved styles are retained and merged on login
- Separate premium public marketing pages, focused auth screens, four-step onboarding, and an account-personalized application dashboard
- Notification panel, profile initials/photo, account dropdown, appearance preferences, and AI design preferences
- Five-step checkout demonstration; it does not collect/process payment
- FSD Lab demonstrations for semantic HTML, links, gallery thumbnails, iframe, audio/video, CSS modes, JavaScript/DOM/events, forms, validation, tables, localStorage, and sessionStorage
- Interactive SDLC page retains Agile as Havenly's recommended process; account and saved-design/order work can be treated as follow-on sprints
- Keyboard-operable tabs and overlays, Escape-to-close menus/modals, and visible focus states

## Run
Open `index.html` directly in a browser or use VS Code Live Server.

## Frontend Authentication Prototype
Authentication is a **Frontend Authentication Prototype**, not secure production authentication. `js/auth.js` centralizes registration, login, session selection, account updates, and password changes so its API can later be replaced with a backend client.

The prototype stores demo accounts and their passwords in browser `localStorage`; the password values are **not hashed**. A remembered demo session uses `localStorage`; a non-remembered session uses `sessionStorage`. Account-specific saved designs, favorite styles, wishlist, cart, preferences, and orders are stored in the local demo account object. Guest cart, wishlist, and saved styles are preserved separately and merged into an account at login. Browser storage is device-local, editable by the user, and must not be used for production credentials or private data. OAuth buttons are intentionally disabled because no provider integration exists.

Password recovery changes the local demo password directly. It does not send email or use a secure reset token. Checkout order records and status labels are illustrative and do not correspond to real shipments or payments.

Production authentication and account data require a backend, database, password hashing, server-managed secure sessions/tokens, authorization checks, and secure password recovery. Payments, email delivery, and order fulfillment also require trusted services.

## AI prototype
AI Studio, product match percentages, recommendations, and the assistant are local frontend demonstrations. No AI inference API is connected. Recommendation and matching labels are rules-based illustrative content.

## Storage keys
The application keeps established keys such as `havenly-cart`, `havenly-wishlist`, `havenly-theme`, `havenly-studio`, and `havenly-designs` (logged-in AI Studio drafts are scoped by user). Account data uses `havenly_users` and `havenly_current_user`; guest copies use `havenly_guest_cart`, `havenly_guest_wishlist`, and `havenly-favorite-styles`. Recent searches and recently viewed products use `havenly-search-history` and `havenly-recently-viewed`; comparison selection uses `havenly-compare`; contact submissions are kept locally under `havenly-demo-messages`. Onboarding saves preferences to the account and reuses the AI Studio's existing preference fields. `js/main.js` retains the existing shopping, AI Studio, gallery, and FSD demonstrations; `js/auth.js` owns account-specific behavior and shared navigation.

## Future full-stack architecture
Keep the current frontend and replace its demo storage adapter with a REST API client:

```text
HTML + CSS + JavaScript frontend
            ↓ REST API
Node.js/Express or Python/Django backend
            ↓
PostgreSQL/MySQL database
            ↓
AI services and payment gateway
```

Do not expose credentials, AI provider secrets, payment secrets, or authorization decisions in frontend JavaScript.
