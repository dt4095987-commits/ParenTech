# ParenTech

A family organizer built with plain HTML, CSS, JavaScript, and a local Node.js account server. Its functionality follows the final ParenTech app documentation and user guide. The purple-and-green interface uses the original illustrated logo, script wordmark, and font subsets from `Password.pdf`, stored in `frontend/assets/`.

## Run the app

With Node.js installed, open a terminal in the project root, beside `package.json`, and run:

```sh
npm start
```

Visit **http://localhost:5173**. There are no packages to install or build steps.

Account creation, login and profile updates use the local Node.js server in `backend/`. To preview the demo directly from a file, open `frontend/index.html` and append `?demo=1` to its browser URL. Account actions require the localhost app.

Create an account with your name, Philippine mobile number, parental role, and matching password confirmation. Passwords need at least eight characters, one uppercase letter, and one number; a live strength message helps you meet these rules. Birthday, age, and civil status are optional. A blank age displays as N/A. The `+63` phone prefix stays fixed while you enter the national number.

To explore sample data without changing the login design, open **http://localhost:5173/?demo=1**. The demo data is stored separately from registered accounts.

## Features

- Launch logo and automatic return to Home when a valid account session exists.
- Dashboard with four pending category counts, Today's Tasks, and Upcoming Reminders.
- Task and pill reminder forms start with today's date and the current time. Complete tasks or mark reminders as taken from Home, Calendar, and day sheets; editing, deletion, and category list screens are also available.
- Monthly Calendar with Today, Tomorrow, and later Upcoming Events; selectable day sheets with ADD EVENT; and a scrolling Full Calendar.
- Grocery list with remaining count, editing, deletion, purchase history, and one-tap re-add from Recently Purchased and Recommended.
- Pending-task search suggestions and Enter navigation to the first matching task or untaken reminder's calendar date; a closeable bell reminders card.
- Profile photo selection with a confirmation preview, profile editing, Personal Information, and counters for completed tasks, consecutive profile-view days, and grocery purchase days.
- Remembered Light, Dark, or System Default theme, notification information, and privacy information.
- Expandable Settings & privacy and Help & support menus, four FAQs, and a Report a Problem form that confirms submission without saving or sending it.
- Logout confirmation before returning to Login.

## Account storage

Created accounts and profile updates are saved in **`backend/data/accounts.json`**. The server creates this file if it is missing. Each record contains an ID, profile details, an optional profile photo, and a salted PBKDF2 password hash. Passwords are never stored as plain text or sent back in API responses. The JSON file is excluded from the public web routes and from Git.

Existing accounts from the previous browser-only version transfer automatically when the updated app opens. Their existing password hashes are preserved. Successful transfer removes those hashes from browser storage; interrupted transfers can be retried. Sign in with the same phone number and password after the transfer.

Login uses an HttpOnly, SameSite cookie. Sessions last up to seven days while the server is running; restarting the server clears active sessions, so sign in again. Saved accounts remain available in the JSON file.

For manual edits, stop the server, back up `backend/data/accounts.json`, edit valid JSON, and restart. Invalid or corrupt account data produces an explicit startup error; the server preserves the file instead of replacing it.

## Organizer data and reminders

Tasks, groceries, purchase history, profile-view dates, and preferences remain in this browser's local storage, separately for each account. The demo uses its own browser data. Clearing browser storage removes local plans, statistics, and preferences; saved server accounts remain in `backend/data/accounts.json`. Another browser can log in to the same account and use its own organizer data.

Day Streak counts consecutive calendar days on which the Profile screen is viewed; visiting it repeatedly on one day counts once. Groceries Done counts distinct purchase days, so buying several items on one day adds one day. Tasks Done counts completed tasks.

Enable Task & pill reminder alerts in Profile's Notifications Settings. The open app schedules the next due alert and checks due items when Home opens, when the tab becomes active, and every 15 minutes. Desktop notifications also require browser permission and a supported browser on localhost or HTTPS. Closing the browser app stops its reminder checks, and browser background throttling can delay alerts.

Report a Problem accepts Bug / Crash, Feature Request, UI Issue, Account Issue, or Other. The form shows a submission confirmation only: descriptions, email addresses, and selected screenshots are not saved or sent. Reports saved by an older version remain untouched in existing browser data. No external service credentials are required.

## Tests

The forms and data layer share the JavaScript rules in `shared/validation.js`, also imported by the Node.js backend. See [VALIDATION.md](VALIDATION.md) for field limits, normalization, structured errors, and backend integration. Forms show inline errors and block duplicate submissions.

Run the tests with:

```sh
npm test
```

This uses Node's built-in test runner to check the JSON store, real HTTP account APIs, browser migration, input validation, organizer data, and form interactions. Backend tests use isolated temporary JSON files and leave the app's account file unchanged. Process isolation is disabled for compatibility with restricted workspaces. UI tests execute the actual scripts in a DOM harness; they do not verify browser layout.

## Local account API

| Method | Endpoint | Behavior |
| --- | --- | --- |
| POST | `/api/accounts/signup` | Validate details, save the account, and start a session. |
| POST | `/api/accounts/login` | Verify the phone/password and start a session. |
| GET | `/api/accounts/session` | Return the authenticated profile or `user: null`. |
| POST | `/api/accounts/logout` | End the session and clear its cookie. |
| PATCH | `/api/accounts/profile` | Update the authenticated account's profile or photo, with its ID in `X-PT-Account`. |
| POST | `/api/accounts/import` | Migrate legacy account hashes without signing in or overwriting an existing phone number. |

Account writes accept JSON and return structured `{ code, message, fields }` errors. Signup validation uses HTTP 422, duplicate phones 409, and incorrect credentials 401. Requests are limited to 3 MiB and the local app's origin. Profiles in responses contain no password hashes.

Profile and photo updates require `X-PT-Account` containing the ID of the account currently displayed. Authentication uses the session cookie; the server checks that the header matches that session before changing a record. A missing header returns HTTP 400 `ACCOUNT_ID_REQUIRED`; a different account returns HTTP 409 `SESSION_CHANGED`. The frontend refreshes the server session after an account change so another tab's login cannot apply an old form to the wrong profile. Partial updates preserve fields that were not supplied.

## Project structure

```text
ParenTech/
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── domain.js
│   ├── styles.css
│   ├── layout.css
│   ├── mobile-spacing.css
│   ├── validation.css
│   └── assets/
├── backend/
│   ├── server.cjs
│   ├── accounts.cjs
│   └── data/
│       └── accounts.json
├── shared/
│   └── validation.js
├── tests/
├── package.json
├── README.md
├── VALIDATION.md
└── Password.pdf
```

The frontend contains the browser app. The backend serves it and manages account persistence and sessions. `shared/` holds one validation module used by both, so their input rules stay consistent. `npm start` runs `backend/server.cjs`; browser URLs remain rooted at `http://localhost:5173`.

- `frontend/index.html`: app entry point.
- `frontend/app.js`: screens and interactive controls.
- `frontend/domain.js`: account API client, legacy migration, and browser organizer data.
- `frontend/styles.css`: responsive layouts and theme styles.
- `frontend/layout.css`: page gutters, panel spacing, form alignment, and dialog insets.
- `frontend/mobile-spacing.css`: tablet and phone spacing adjustments.
- `frontend/validation.css`: inline validation feedback in both themes.
- `frontend/assets/logo.png` and `frontend/assets/wordmark.png`: original ParenTech branding.
- `frontend/assets/*.ttf`: font subsets from the supplied PDF, with fallbacks for other characters.
- `frontend/assets/font-faces.css`: combines disjoint PDF font subsets using Unicode ranges.
- `backend/server.cjs`: local web server, account APIs, and sessions.
- `backend/accounts.cjs`: JSON persistence and credential verification.
- `backend/data/accounts.json`: private local account records.
- `shared/validation.js`: shared browser and Node.js input schemas, served only as this public module through `/shared/validation.js` and `/validation.js`.
- `tests/accounts.test.cjs`: JSON persistence and migration tests.
- `tests/api.test.cjs`: HTTP account API tests.
- `tests/server-client.test.cjs`: frontend account client and migration tests.
- `tests/domain.test.cjs`: data-layer tests.
- `tests/app.test.cjs`: screen and interaction integration tests.
- `tests/validation.test.cjs`: validation rules and boundary tests.
- `VALIDATION.md`: validation rules and backend integration contract.
