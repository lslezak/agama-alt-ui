# Specification for an alternative Agama Web UI

A showcase UI that demonstrates what is possible on top of the Agama HTTP API. It is deliberately
flashy compared to the default "boring" web UI.

## 1. Goals and non-goals

**Goals**

- Standalone single-page app talking to a remote Agama server over HTTP (CORS).
- Lots of eye-candy: animations, transitions, effects, a bit extreme on purpose.
- Complete the workflow: select server → trust certificate → log in → pick a product → summary.

**Non-goals (for now)**

- **WebSocket / event stream and the debug panel are out of scope.** The server's `/api/ws` cannot
  be authenticated from a cross-origin browser page: the browser WebSocket API cannot send an
  `Authorization` header, and the `agamaToken` cookie has no `SameSite` attribute (defaults to Lax,
  so it is not sent cross-site). Re-enable later if the server gains e.g. `/api/ws?token=`
  support. Keep the layout free of anything that depends on it.
- No installation steps beyond selecting a product (no storage, network, l10n, ... screens, no
  starting the installation).
- No i18n (English only), no mobile-first design (desktop browsers; must not break on narrow
  windows).
- No accessibility or keyboard-navigation work: this is a proof of concept.

## 2. Tech stack

- TypeScript (strict mode), React 18, **PatternFly 6** (`@patternfly/react-core`,
  `@patternfly/react-icons`, `@patternfly/patternfly` CSS).
- Vite as the build tool and dev server, npm as the package manager (commit `package-lock.json`).
- Animations: CSS keyframes/transitions plus `framer-motion` for page transitions and staggered
  lists. A full-screen animated background (Canvas or WebGL, e.g. particles/aurora/starfield)
  runs behind all pages.
- Routing: `react-router` (routes below). State: React context + hooks is enough, no state library.
- Lint/format: ESLint + Prettier. `npm run dev`, `npm run build`, `npm run lint`, `npm run
  typecheck` must work.
- Dev server origin is fixed to `http://localhost:5173` (`strictPort: true`) so the server's CORS
  setting can be matched exactly.

## 3. Server and CORS requirements

- The UI is served from a different origin than the Agama server, so the server **must** run with
  CORS enabled (`agama-web-server serve --enable-cors <origin>`, or the `inst.cors=<origin>` boot
  option). The testing server is set up with `inst.cors=*`.
- CORS notes: the server sends a single `Access-Control-Allow-Origin` value and **no**
  `Access-Control-Allow-Credentials`. Therefore:
  - Authenticate with `Authorization: Bearer <token>`, never with cookies.
  - Do not use `fetch(..., { credentials: "include" })`.
- The server uses a self-signed certificate (see section 5).
- Default server URL: `https://agama.local`. Normalise user input: add `https://` if the scheme is
  missing, strip trailing `/` and any path. Accept an optional port. **Only `https://` is
  supported:** Agama redirects plain HTTP to HTTPS anyway (and a redirect would break the CORS
  requests), so an explicit `http://` scheme is rewritten to `https://` or rejected with a
  validation message.

## 4. API summary (what the UI uses)

All paths are relative to the server URL. Every response carries `X-API-Version` (currently `2`).
Errors are RFC 9457 `application/problem+json` (`title`, `detail`, ...); show `detail` to the user
when present.

| Purpose | Request | Notes |
| --- | --- | --- |
| Connectivity / cert check | `GET /api/ping` | Public (no auth). 200 + JSON when reachable. |
| Log in | `POST /api/auth` `{"password": "..."}` | 200 `{"token": "<jwt>"}`; 401 on a wrong password. The user is always `root`. |
| Validate session | `GET /api/auth` | 200 if the token is valid, 401 otherwise. |
| Log out | `DELETE /api/auth` | Requires the token. |
| List products | `GET /api/system` | `products[]`: `id`, `name`, `description`, `icon`, `registration`, `licenses[]`, `desktopSelection?`, `modes[]`. Also `hardware` (`cpu`, `memory` in bytes, `model`) which may be used for decoration. |
| Current config | `GET /api/config` | `product.id` is the currently selected product (if any). |
| Select product | `PATCH /api/config` `{"update": {"product": {"id": "<id>"}}}` | 200 with an empty body on success; 400 on an invalid configuration, 500 on a server error. The changes must be wrapped in `update`, a body without it is accepted but ignored. Use PATCH, not PUT (PUT replaces the whole config). |
| Product logo | `GET /assets/logos/<icon>` | Static file on the server, e.g. `SUSE.svg`. For a dark theme variant insert `-dark` before the extension (`SUSE-dark.svg`). If it fails to load, fall back to a generated/placeholder icon. |

The authoritative reference is the OpenAPI spec:
<https://agama-project.github.io/openapi/nightly/openapi-full.json> (or `../rust/agama-server`
sources, the default UI in `../web/src` as a usage example). Responses flagged
`x-agama-translated` depend on the `Accept-Language` header; not needed here, send nothing special.

Notes on the testing server: `https://agama.local`, password `agama`.

## 5. Workflow and screens

The flow is a linear wizard with an animated stepper (or progress indicator) showing the
current step. Going back to a previous step is allowed. Wizard state is kept in memory.

### Step 1 – Server selection (`/`)

- Text input prefilled with `https://agama.local`; remembered in `localStorage` (the last 5 used
  servers are offered as suggestions). **Never** store the password or token in `localStorage`
  (the token is kept in `sessionStorage` only, see step 3).
- "Connect" button runs the connectivity check (`GET /api/ping`, timeout 5 s).
  Results:
  - success → go to step 3 (skip step 2),
  - network/TLS failure (a `fetch` `TypeError`; the browser does not tell certificate errors
    from other network errors, nor from CORS errors) → go to step 2,
  - HTTP error status → show the error inline.

### Step 2 – Certificate trust (`/trust`)

Browsers refuse `fetch` to a host with an untrusted certificate and there is no API to
detect or accept it from JavaScript. The user has to open the server URL once at top level.

- Explain the problem in plain words and show a prominent "Open server in a new tab" button
  (`target="_blank"`, `rel="noopener"`) pointing to the server URL. The user accepts the
  browser warning there. Iframes are **not** used: browsers (Chrome, Firefox) do not offer the
  "proceed anyway" interstitial in an iframe, so the user cannot accept the certificate there.
- While waiting, automatically retry `GET /api/ping` every 2 s (and immediately when the tab
  regains focus) and advance to the next step as soon as it succeeds, with a success animation.
- If it keeps failing after the user claims to have accepted the certificate, show a
  troubleshooting hint list: server not reachable / wrong URL, **CORS not enabled or the UI origin
  not allowed** (check `inst.cors`), a firewall/VPN.
- Also a "Retry" and a "Change server" button.

### Step 3 – Login (`/login`)

- Password field (masked, with a show/hide toggle, autofocus, Enter submits). No username field
  (always `root`).
- `POST /api/auth`. On success store the token in `sessionStorage` (so reload keeps the session,
  closing the tab drops it) and continue to step 4. On a 401 show "Wrong password" with a shake
  animation. Other errors are shown inline.
- On app start, if a token and server URL exist in `sessionStorage`, validate with
  `GET /api/auth` and skip to step 4 on success; otherwise clear them.
- Any later 401 response anywhere in the app clears the token and sends the user back here with a
  "Session expired" message.
- A "Log out" action (`DELETE /api/auth`, then clear storage) is available from the header on all
  authenticated pages.

### Step 4 – Product selection (`/products`)

- Fetch `GET /api/system` and `GET /api/config` (to preselect the current product).
- Show the products as animated cards (staggered entrance, hover lift/tilt, glow on
  selection): logo, name, description. Description is plain text from the server, render it as
  text (not HTML).
- States: loading (skeleton/animated loader), error (message + retry), empty list (explain
  that the server offers no products).
- Exactly one card can be selected; a "Select" button (disabled until a card is selected)
  sends the selection to the server (see below) and continues to the summary.
- Products with `licenses`, `registration` or multiple `modes` are still selectable and only the
  product `id` is sent; license acceptance, registration and mode selection are **not** handled
  (out of scope). The UI may show small badges (e.g. "registration required").

### Step 5 – Summary (`/summary`)

Shown after the product has been selected (and sent to the server, see step 4). It reads the state
back from the server, so it also works after a page reload.

- Fetch `GET /api/config` and `GET /api/system`. The selected product is the one whose `id`
  matches `product.id` in the config (fall back to the product chosen in the wizard).
- Show with a staggered entrance animation:
  - product logo, name and description,
  - the server URL,
  - a status line: whether the server confirms the selection (`product.id` in the config equals the
    product chosen in the wizard); a warning if the server config has no product or a different one,
  - product details: ID, registration (required / not required), licenses (count), modes (name and
    description), desktop selection if present,
  - hardware of the machine (model, CPU, memory) if the server reports it,
  - the server configuration as pretty-printed JSON in a collapsed "Server configuration" section.
- States: loading, error (message + "Retry").
- Actions: "Choose another product" (back to step 4) and "Log out". The wizard ends here; nothing
  else is sent to the server.

## 6. UI / visual requirements

- PatternFly components for all controls (forms, buttons, cards, alerts, stepper, spinners,
  empty states); custom CSS/animation on top of them.
- Dark theme by default (PatternFly dark theme class `pf-v6-theme-dark`), with a theme toggle
  (light/dark) persisted in `localStorage`.
- Eye-candy checklist (all should be present):
  - animated full-screen background (it must stay readable, content has a translucent/blurred
    "glass" panel),
  - animated page transitions between steps, staggered card entrance,
  - hover/focus micro-interactions, animated success/failure feedback (checkmark, shake),
  - animated logo/title on the first screen.
- Keep the background animation cheap (target 60 fps on a normal laptop, pause when the tab is
  hidden). An optional "Animations: on/off" toggle is nice to have (e.g. for slow machines).
- Accessibility and keyboard navigation are **not** a concern for this proof of concept (no
  `prefers-reduced-motion` handling, ARIA attributes or focus management required). Only keep
  the text readable.

## 7. Code structure and quality

- Suggested layout: `src/{api,components,pages,context,hooks,styles}`; a small typed API
  client (`api/client.ts`) wraps `fetch`, adds the Bearer header, a timeout, parses problem
  details and maps 401 to a global "session expired" handler. Types for used responses are
  written by hand (only the few fields listed above) or generated from the OpenAPI spec.
- The server URL and token come from a single context; no globals.
- No secrets in logs, no `console.log` of the password/token.
- Unit tests (Vitest + Testing Library) for: URL normalisation, the API client (error mapping,
  401 handling), and the login/trust step logic. Mock `fetch`; tests must not need a real server.
- A short `README.md`: how to install/run/build, how to enable CORS on the server (`inst.cors=*`
  boot option or `--enable-cors`), and the known limitations (no WebSocket, certificate trust step).

## 8. Testing

- Manual end-to-end against `https://agama.local`, password `agama` (the server must be started
  with `inst.cors=*`), at least in Firefox and Chromium.
- Verify: unreachable server, untrusted certificate (fresh browser profile) → trust step →
  login with a wrong and a correct password → product list → select → summary, reload
  during the wizard (session restored), expired/invalid token handling.

## 9. Future ideas (not part of this implementation)

- WebSocket event stream with a resizable bottom debug panel (needs server-side token support
  for `/api/ws?token=`).
- Live progress/status view using `GET /api/status`, license acceptance, registration, product
  mode selection, further installation steps.
