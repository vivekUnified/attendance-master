# Attendance Master

A face-recognition-based employee/student attendance Progressive Web App. It works
fully offline after first load: camera-based face detection and matching run
entirely in the browser via MediaPipe Tasks Vision, and all data is stored
locally in a SQLite database (compiled to WebAssembly) persisted to
IndexedDB. An optional background sync pushes records to a remote API when
enabled and the device is online.

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- `@mediapipe/tasks-vision` (`FaceLandmarker`) for real-time face detection
- `sql.js` (SQLite/WASM) + IndexedDB for offline-first local persistence
- `vite-plugin-pwa` for the service worker, manifest, and offline asset caching
- Vitest + Testing Library for unit tests

## Getting started

```bash
nvm use 22
npm install
cp .env.example .env
npm run dev
```

Open the printed local URL over HTTPS or `localhost` (required for camera
access). On first run the app downloads and caches the face-detection model
and SQLite WASM runtime; after that it keeps working offline, including after
a full page reload.

> `npm run dev` / `npm run build` automatically copy the MediaPipe WASM
> runtime from `node_modules` into `public/mediapipe-wasm` (see
> `scripts/copy-mediapipe-assets.mjs`) so it is served statically and cached
> by the service worker for offline use.

### Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build the production bundle (incl. service worker) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the unit test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint the codebase |

## Environment configuration

See [.env.example](./.env.example):

```bash
VITE_DATA_MODE=sqlite   # "sqlite" (default, offline-only) or "api"
VITE_API_BASE_URL=      # required when VITE_DATA_MODE=api
```

These are only used as the **initial defaults**; the data mode and API URL
can also be changed at runtime from the Settings screen, which persists the
choice locally. No API keys or credentials are ever embedded in client code —
if your backend requires authentication, put the token exchange behind a
same-origin proxy rather than shipping a secret in the bundle.

## Project structure

```
src/
  components/   Reusable UI (camera view, nav bar, status banners, etc.)
  db/           sql.js database bootstrap, schema, and IndexedDB persistence
  engine/       MediaPipe FaceLandmarker wrapper + embedding extraction
  hooks/        Camera access, face-detection loop, online/sync status
  pages/        Home (live attendance), Register, History, Users, Settings
  services/     Repository layer (users, attendance, settings, sync queue,
                 API client) + orchestration services (registration,
                 attendance, face matching, sync)
  types/        Shared TypeScript domain types
  utils/        Similarity/date helpers + dev-only demo data seeding
```

## Data model & SQLite schema

The schema is created automatically on first run (`src/db/sqlite.ts`):

- **`users`** — `id` (PK), unique `id_card_number`, `full_name`, `user_type`
  (`employee`/`student`), `face_embedding` (JSON-encoded vector), 
  `registered_at`, `active`. Indexed on `id_card_number` and `active`.
- **`attendance`** — `id` (PK), `user_id` (FK), `id_card_number`, `full_name`,
  `attendance_date` (local `YYYY-MM-DD`), `timestamp`, `status`
  (`present`/`duplicate-rejected`), `source`
  (`face-recognition`/`manual`/`registration`), `confidence`, `synced`.
  Indexed on `(user_id, attendance_date)` and `attendance_date` for fast
  duplicate lookups and history filtering.
- **`settings`** — key/value store for `recognitionThreshold`,
  `allowMultipleAttendancePerDay`, `registrationPassword`, `dataMode`,
  `apiBaseUrl`.
- **`sync_queue`** — outbox of pending `create-user`/`create-attendance`
  operations awaiting upload when API mode is enabled.

The ID card number uniqueness is enforced with a `UNIQUE` SQL constraint.
Duplicate-attendance-per-day prevention is **intentionally** an
application-level rule rather than a hard DB constraint, because it is
configurable (`allowMultipleAttendancePerDay`) — see
`attendanceRepository.markAttendance`.

### Resetting the database

Use **Settings → Danger zone → Reset local database** in the app, or run the
following in the browser devtools console:

```js
await window.seedDemoData?.(); // optional: re-seed sample data (dev builds only)
indexedDB.deleteDatabase('keyval-store'); // idb-keyval's default DB name
```

then reload the page.

### Sample / demo data

In development builds (`npm run dev`), a helper is exposed on `window` to
quickly populate a few sample users without needing a camera:

```js
await window.seedDemoData();
// Seeds EMP-1001 (Asha Rao), EMP-1002 (Rahul Mehta), STU-2001 (Priya Nair)
```

These use synthetic face embeddings (not derived from real photos), so they
are only useful for exercising the UI/history screens — they will not match
against a live camera feed. To test live recognition, register yourself
through the normal **Register** flow using your camera.

## Face detection & recognition approach

MediaPipe's `FaceLandmarker` provides accurate face detection and 478 3D
landmarks per face, but — as called out in the project requirements — it does
not ship an identity-recognition embedding model. This project derives a
lightweight, transparent embedding (`src/engine/faceEngine.ts`) from a stable
subset of landmark geometry (eyes, eyebrows, nose, mouth, jawline), normalized
by inter-ocular distance so it's robust to the subject's distance from the
camera. Matching uses cosine similarity (`src/utils/similarity.ts`) against
all registered, active users, gated by a configurable
`recognitionThreshold` (Settings screen, default 0.82).

This is intentionally simple and swappable: everything downstream only
depends on the `FaceDetectionResult`/`MatchResult` types, so a dedicated
face-recognition model (e.g. a FaceNet-style embedding network) can be
dropped in later without touching the UI or data layer.

**Known limitation:** geometry-based matching is more sensitive to lighting,
pose, and expression than a learned embedding, and does not defend against
presentation attacks (e.g. a photo held up to the camera). Treat recognition
as an identification aid, not proof of identity — see "Security & privacy"
below.

## Attendance & duplicate validation

- A face is only matched when exactly one face is in frame and it's large
  enough in the frame (reduces false low-confidence matches).
- `faceMatchService.identify` returns the best match only if its similarity
  meets the configured threshold; otherwise the face is treated as unknown.
- `attendanceRepository.markAttendance` checks whether the user already has a
  `present` record for the current local date. If one exists and
  `allowMultipleAttendancePerDay` is `false` (default), the attempt is
  reported as a duplicate and not persisted. If `true`, additional entries
  are recorded normally.
- Every attendance record gets a client-generated UUID, which doubles as an
  idempotency key for sync (re-sending the same record to the backend is a
  safe no-op for an upsert-style API).

## PWA & offline support

- The header includes an **Install app** button. On supported browsers it opens
  the native installation prompt; otherwise it shows browser-menu instructions.
  On iPhone/iPad, open the app in Safari and use **Share > Add to Home Screen**.
  The button is hidden when running as an installed standalone app.
  Serve the production build over HTTPS for mobile installation; a plain HTTP
  LAN address is not sufficient (localhost is allowed for desktop testing).
- `vite-plugin-pwa` generates a manifest (`icons/`, theme colors, standalone
  display) and a service worker that precaches the app shell, the MediaPipe
  WASM runtime, and the face-landmarker model (`public/models/face_landmarker.task`).
- All reads/writes always go through the local SQLite database first, so
  registration, recognition, and attendance marking work with no network
  connection once the app has been loaded/installed once.
- The `NavBar` shows a live online/offline indicator and the number of
  attendance/user records pending sync.

## Optional API sync

Set `VITE_DATA_MODE=api` and `VITE_API_BASE_URL` (or configure them from the
Settings screen) to enable background sync. The core workflow is unchanged:
users and attendance are still written to the local database first; a
`sync_queue` outbox additionally records pending uploads, which
`syncService` drains whenever the browser's `online` event fires (or when
triggered after a write). Failed attempts are retried with the error
recorded (`sync_queue.attempts` / `last_error`) rather than being dropped.

### API contract

| Method | Path | Body | Behavior |
| --- | --- | --- | --- |
| `PUT` | `/users` | `User` (JSON) | Idempotent upsert keyed by `id` |
| `PUT` | `/attendance` | `AttendanceRecord` (JSON) | Idempotent upsert keyed by `id` |

Any backend that accepts these two idempotent upsert endpoints can be used;
no specific backend implementation is bundled, keeping this project
backend-agnostic as requested.

## Testing

```bash
npm test
```

Covers:

- User registration & duplicate ID-card validation (`userRepository`,
  `registrationService`)
- Attendance creation and duplicate-per-day prevention, including the
  configurable "allow multiple per day" rule (`attendanceRepository`)
- Face-match threshold behavior and active/inactive user filtering
  (`faceMatchService`)
- Settings persistence/merging (`settingsRepository`)
- Offline sync queue behavior: online/offline gating, successful push +
  queue draining, and failure/retry bookkeeping (`syncService`)
- Similarity math (`cosineSimilarity`)

## Security & privacy notes

- The registration password (`123456` by default) is a **development-only**
  credential, configurable from Settings, and is not a substitute for real
  authentication/authorization in production.
- Face embeddings are stored locally; no raw face images are persisted.
- Face detection alone is not proof of identity — combine with additional
  verification (badge scan, PIN, supervised registration) before relying on
  this system for access control, and consider presentation-attack defenses
  (liveness checks) before production deployment.
- Obtain appropriate consent for biometric data collection and define a
  retention/deletion policy before deploying in a real environment. The
  Settings screen's "Reset local database" control provides a simple way to
  purge all locally stored biometric and attendance data from a device.
