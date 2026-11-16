# Agama alternative web UI

A proof-of-concept, deliberately flashy web UI for [Agama](https://agama-project.github.io/). It is
a standalone single-page app (TypeScript, React 18, PatternFly 6, Vite) that talks to a remote Agama
server over HTTP. See [SPECIFICATION.md](SPECIFICATION.md) for the details.

Workflow: choose a server → trust its certificate → log in → pick a product → summary.

## Usage

```sh
npm install
npm run dev        # http://localhost:5173 (the port is fixed)
npm run build      # type check + production build into dist/
npm run preview    # serve the production build on the same port
npm run typecheck
npm run lint
npm test
```

## Server requirements

The UI is served from a different origin than the Agama server, so the server **must** have CORS
enabled. Either use the boot option or the command line option of the web server:

- boot option: `inst.cors=*` (or `inst.cors=http://localhost:5173`)
- `agama-web-server serve --enable-cors '*'`

Notes:

- The UI authenticates with `Authorization: Bearer <token>` (cookies cannot be used cross-origin
  because the server does not send `Access-Control-Allow-Credentials`).
- Only `https://` servers are supported, the default is `https://agama.local`.
- The token is kept in `sessionStorage` only (gone when the tab is closed), the password is never
  stored.

## Known limitations

- **No WebSocket / event stream and no debug panel.** The server's `/api/ws` cannot be
  authenticated from a cross-origin page (browsers cannot set the `Authorization` header on a
  WebSocket and the `agamaToken` cookie is not sent cross-site).
- **Certificate trust step.** Browsers do not allow accepting a self-signed certificate from
  JavaScript, so the UI asks you to open the server in a new tab and accept the warning there; it
  then polls `/api/ping` until the server becomes reachable. An iframe cannot be used for this.
  A failed `fetch` looks the same for an untrusted certificate, a CORS problem and an unreachable
  server, so the UI shows troubleshooting hints.
- Only the product `id` is sent: license acceptance, registration and mode selection are not
  implemented, and nothing beyond selecting the product (no installation).
- English only, no accessibility/keyboard-navigation work, desktop browsers only.
