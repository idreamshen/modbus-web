# AGENTS.md

## Commands
- Install with `npm install`; this repo uses `package-lock.json` and has no other workspace/package manager config.
- Run the dev server with `npm run dev`; Vite is configured for host `0.0.0.0` on port `5173`.
- Verify changes with `npm run build`; it runs `vue-tsc --noEmit` before `vite build`.
- The root `Makefile` only provides aliases for the npm scripts: `make install`, `make dev`, `make build`, and `make preview`.
- There are no configured test, lint, or formatter scripts in `package.json`; do not invent `npm test`/`npm run lint` as verification.

## App Shape
- This is a single Vite + Vue 3 + Vuetify app, not a monorepo. Entry point is `src/main.ts`, mounted from `index.html`.
- `@` resolves to `/src` via `vite.config.ts`, but existing source mostly uses relative imports.
- Vuetify setup is centralized in `src/plugins/vuetify.ts`; Vite uses `vite-plugin-vuetify` with `autoImport: true`.

## Modbus Flow
- Serial I/O is in `src/serial/serial-port.ts`; it uses the browser Web Serial API, so real connection testing needs a Chromium-family browser with Web Serial support and user port selection.
- Incoming serial bytes are buffered into RTU frames using a fixed `FRAME_TIMEOUT_MS = 20` inter-frame timeout before parsing.
- Request flow is `serial-port.ts` -> `parseRequest` in `src/modbus/parser.ts` -> `handleRequest` in `src/modbus/handler.ts` -> register store in `src/store/registers.ts`.
- Supported function codes are only FC 03, 04, 06, and 10; parser rejects unknown codes or invalid CRC before handler dispatch.
- Broadcast address `0` is accepted for writes but responses are only written for non-broadcast requests.
- Register values are masked/clamped to 16-bit unsigned values; address ranges must exist in the store or handlers return Modbus exception responses.

## State And UI
- Shared app state is a Vue `reactive` singleton exported as `store` from `src/store/registers.ts`; there is no Pinia/Vuex layer.
- `src/App.vue` initializes default holding/input registers on mount by calling `initDefaultRegisters()`.
- Device templates in `src/templates/devices.ts` replace all registers and set `store.slaveAddress` through `applyTemplate()`.
- Communication logs are kept in memory only and capped at 200 entries in `addLogEntry()`.
