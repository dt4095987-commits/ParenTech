# Shared input validation

`shared/validation.js` runs in the browser as `PTValidation` and in Node.js through `require('../shared/validation.js')` from files in `backend/`. The forms in `frontend/`, browser organizer data and JSON account backend use this single module. Account APIs return structured field errors for the existing form feedback.

`frontend/index.html` loads `../shared/validation.js`, which also works for a direct file demo. The server exposes this module through `/shared/validation.js` and the `/validation.js` alias; it does not expose the rest of the shared or backend directories. Run `npm start` from the project root to start `backend/server.cjs` and use account actions.

## Rules

| Input | Rules |
| --- | --- |
| Full name | Required, up to 80 characters; Unicode letters and marks, spaces, apostrophes, hyphens and periods. Spaces are normalized. Mononyms are accepted. |
| Mobile phone | Philippine mobile number, normalized to `+639XXXXXXXXX`; accepts `09`, `9`, `639` and `+639` forms with common separators. Raw input is limited to 40 characters. |
| Birthday | Optional actual calendar date, `YYYY-MM-DD`, from 1900 through today; blank is stored as an empty string. |
| Age | Optional integer from 0 through 150; blank is stored as null and shown as N/A. Selecting a birthday can fill the editable age. Older records without an explicit age derive it from their birthday. |
| Civil status / role | Civil status is optional; a nonblank value must match an option. Role is required and must be Mom, Dad, or Solo Parent. |
| Signup password | 8–128 characters, including an uppercase letter and a number. Confirmation must match. Password spaces are preserved; control characters are rejected. |
| Login password | Nonempty, up to 128 characters. Signup strength rules are not reapplied to existing credentials. |
| Task | Title: 1–120 characters; optional description: up to 500. Valid date, required `HH:MM` time and one of the four task categories. Past dates remain valid for historical tasks. An update identifier must be valid. |
| Grocery item | Required, up to 100 characters. Spaces and Unicode composition are normalized; duplicates are compared without letter case. Quantities and ordinary punctuation are allowed. |
| Problem report | Bug / Crash, Feature Request, UI Issue, Account Issue, or Other; nonblank description up to 500 characters, optional valid email up to 150 characters and optional filename metadata up to 255 characters. Submissions are confirmed without being saved or sent. |
| Screenshot | PNG, JPEG or WebP with matching extension and MIME type, nonempty, at most 10 MiB. Filenames cannot contain paths or control characters. |
| Profile photo | Optional PNG, JPEG, or WebP image data URL, up to 2 MiB of image data, with a matching decoded image header. The browser resizes selected photos before the confirmed profile update. |
| Settings | Theme must be light, dark, or system; notification values must be actual Booleans. Strings such as `"false"` are rejected. |

Only allowed fields appear in normalized results. Profile IDs, credentials, task completion flags and timestamps cannot be assigned through these input schemas. Account collisions and account-specific grocery duplicates are also checked by the data layer before it changes saved state. Optional profile values are retained through account APIs and JSON persistence.

## Node.js use

Validate incoming requests on the backend even when the browser has already checked the form:

```js
// From a module in backend/.
const { assert, ValidationError } = require('../shared/validation.js');

try {
  const task = assert('task', requestBody);
  // Save the validated fields using the authenticated user's identity.
} catch (error) {
  if (!(error instanceof ValidationError)) throw error;
  const responseBody = {
    code: error.code,
    message: error.message,
    fields: error.fields
  };
  // Send responseBody with HTTP 422.
}
```

Available schemas are `signup`, `login`, `profile`, `task`, `grocery`, `report` and `settings`. `check(schema, input, context)` returns `{ valid, values, errors }`; `assert(...)` returns normalized values or throws a `ValidationError` with `code` and a `fields` map.

An optional context provides `today` in `YYYY-MM-DD` for the user's calendar date, `groceries` for duplicate checks and `excludeId` when editing an existing grocery item. The backend should load duplicate-check data for the authenticated account.

Signup and login results include the password for hashing or credential verification. Do not log or return these results. Text validation preserves literal markup as text; continue escaping it when rendering HTML. The account repository in `backend/accounts.cjs` stores validated profile details and salted password hashes in the private `backend/data/accounts.json` file.

Problem-report screenshot checks inspect metadata for the form; the report and file are neither stored nor uploaded. Profile photos follow a separate path: their decoded image data is validated and stored with the account only after confirmation.

## Account update binding

`PATCH /api/accounts/profile` accepts only the profile fields explicitly being changed. It requires the session cookie and an `X-PT-Account` header containing the expected account ID. The server verifies their match before applying either profile details or a photo. Fields omitted from a partial update keep their current values.

```js
await fetch('/api/accounts/profile', {
  method: 'PATCH',
  credentials: 'same-origin',
  headers: {
    'Content-Type': 'application/json',
    'X-PT-Account': currentUser.id
  },
  body: JSON.stringify({ name: 'Updated Name' })
});
```

A missing header returns HTTP 400 with `ACCOUNT_ID_REQUIRED`; a header for another signed-in account returns HTTP 409 with `SESSION_CHANGED`. After an account change, retrieve `/api/accounts/session` again and present the current account before retrying. The frontend applies this check to profile and photo updates and ignores responses that belong to a replaced session.

## Form behavior

Forms show errors beside the relevant field, focus the first invalid field, preserve existing hint associations, and update errors when the user corrects a touched field. Password confirmation is checked again when the password changes. A pending submission disables the submit button and rejects a second submission on the same form.

Sign-up also displays live password strength. Optional birthday, age, and civil status do not block registration when blank. A report needs a selected category and nonblank description; completing it shows a confirmation without adding a stored report record.

Phone fields display a fixed `+63` country code, with the editable number and cursor starting beside it. Users enter ten national digits beginning with `9`; the country code cannot be edited or deleted. Complete `+639…`, `639…`, `09…` or national-number pastes and autofill are converted to national digits. Submission adds exactly one `+63` before shared validation and storage. Overlong pastes are rejected without clipping the number; overlong autofill stays visible with a validation error. Input fallback also handles drag-and-drop and completed IME composition. These browser conveniences do not relax the shared backend validation rules.

Run `npm test` for schema boundaries, direct data-layer validation and form interaction checks.
