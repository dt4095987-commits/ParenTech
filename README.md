# ParenTech

ParenTech is a family organizer built with HTML, CSS, JavaScript, and a local Node.js account server. The default interface is the multipage app in `frontend/`. It uses the existing account API and the shared browser organizer store, so registered accounts and each account's saved plans remain available.

## Run the app

Install Node.js, open a terminal in this project directory, and run:

```sh
npm start
```

Open **http://localhost:5173**. No packages or build step are required. Keep the Node.js process running while using account features. After updating the server code, restart that process from its original terminal.

The entry page is `frontend/index.html`; Home, Calendar, Grocery, Tasks, Pill Reminders, Profile, and support pages are in `frontend/pages/`. Opening an HTML file directly does not provide the account server. Use the localhost URL for signup, login, and profile changes.

The previous interface remains available at **http://localhost:5173/legacy/index.html**. Its demo is available at **http://localhost:5173/legacy/index.html?demo=1** and uses separate browser data. The legacy interface files are archived in `archive/legacy-frontend/`.

## Accounts and profile updates

Create an account with a name, Philippine mobile number, parental role, and matching password confirmation. Passwords require at least eight characters, one uppercase letter, and one number. Birthday and civil status are optional. Age is calculated from the birthday and is unavailable when no birthday is supplied. Login accepts the same phone number and password after restarting the server.

Accounts and profile changes are saved in **`backend/data/accounts.json`**. Each account contains an ID, profile fields, an optional profile photo, and a salted PBKDF2 password hash. Passwords are never stored as plain text or returned in account responses. The account file is excluded from Git and cannot be downloaded through the web server.

The shared account client transfers accounts from the older browser-only version when needed. It preserves their existing password hashes, avoids overwriting an already registered phone, and removes migrated credentials from browser storage after a successful transfer. Interrupted transfers can be retried.

Login creates an HttpOnly, SameSite cookie. Sessions last up to seven days while the server runs. Restarting clears active sessions; saved accounts remain in the JSON file.

Profile and photo updates send `X-PT-Account` with the ID of the account being displayed. The server verifies that this ID matches the cookie's account before writing. A missing ID returns HTTP 400 `ACCOUNT_ID_REQUIRED`; an account mismatch returns HTTP 409 `SESSION_CHANGED`. This protects an open profile form when another tab signs into a different account. Fields omitted from a partial update are preserved.

For manual account-file edits, stop the server, back up the file, edit valid JSON, and restart. Invalid account data produces a startup error and is preserved rather than overwritten.

## Organizer data

Tasks, pill reminders, groceries, purchase history, profile-view dates, and preferences use the `PTStore` module from `frontend/assets/js/domain.js`. These records remain in this browser's local storage, separately for each account. Both interfaces use that same store on the same localhost origin. Another browser can sign into the same account and have its own organizer data.

Clearing browser storage removes that browser's plans, statistics, and preferences. Server accounts and profile details remain in `backend/data/accounts.json`. Using a different port also creates a different browser storage origin.

Task completion, grocery purchase days, and profile-view streaks are calculated from the account's organizer records. Reminder alerts require an open app and, for desktop notifications, browser permission. Report a Problem shows a local confirmation; it does not send a report to an external service.

## Public files

The server publishes only these frontend locations:

- `/` and `/index.html`: the new login page.
- `/pages/*.html`: new app pages.
- `/assets/css/*.css`, `/assets/js/*.js`, `/assets/img/*`, and `/assets/fonts/*`: regular files with permitted web asset extensions in those named folders.
- `/domain.js`: the existing `PTStore` browser module.
- `/shared/validation.js` and `/validation.js`: the shared validation module.
- `/legacy/*`: the preserved interface and its explicitly permitted assets.

The server does not publish the workspace directory, backend code or data, Git metadata, README, or supplied PDFs. Traversal paths, hidden files, symlinks, and unlisted file types are rejected. Scripts must be served locally; inline JavaScript is blocked by the content security policy. The design's Poppins and Font Awesome stylesheets/fonts use the explicitly permitted Google Fonts and cdnjs URLs.

## Local account API

| Method | Endpoint | Behavior |
| --- | --- | --- |
| POST | `/api/accounts/signup` | Validate details, save an account, and start a session. |
| POST | `/api/accounts/login` | Verify phone/password and start a session. |
| GET | `/api/accounts/session` | Return the signed-in profile or `user: null`. |
| POST | `/api/accounts/logout` | End the session and clear its cookie. |
| PATCH | `/api/accounts/profile` | Update the signed-in profile or photo with its ID in `X-PT-Account`. |
| POST | `/api/accounts/import` | Migrate older account hashes without signing in or replacing an existing phone. |

Account writes accept JSON and return structured `{ code, message, fields }` errors. Validation returns HTTP 422, duplicate phones 409, and incorrect credentials 401. Requests are limited to 3 MiB and the local app's origin. Responses contain no password hashes. See [VALIDATION.md](VALIDATION.md) for field limits and normalization.

## Checks

```sh
npm run check
npm test
```

The syntax check includes both interfaces and the account server. Node's built-in test runner checks validation, JSON account persistence, real HTTP account APIs, public route boundaries, browser migration, organizer records, and form interactions. Backend tests use isolated temporary JSON files and leave the app's account file unchanged. Process isolation is disabled for compatibility with restricted workspaces. DOM harness tests verify script behavior; they do not verify browser layout.

## Project structure

```text
ParenTech/
  frontend/             Main web application
    index.html
    pages/
    assets/
      css/
      js/
      img/
  backend/
    server.cjs          Local HTTP server, public routes, and account sessions
    accounts.cjs        JSON persistence and credential verification
    data/accounts.json  Private local account file
  shared/validation.js  Browser and server validation rules
  archive/              Archived references, PDFs, and legacy prototype
    legacy-frontend/
  tests/
  package.json
  VALIDATION.md
```

`npm start` runs `backend/server.cjs`. New frontend URLs are rooted at `http://localhost:5173`; the frontend uses the same `/api/accounts/*` endpoints as the preserved interface.

