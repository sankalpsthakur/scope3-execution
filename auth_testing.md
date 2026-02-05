# Auth Testing Playbook

This repo supports **cookie auth** (`session_token`) and **token auth** (`Authorization: Bearer ...`).

Auth resolution order (server-side):
1) Cookie `session_token`
2) `Authorization: Bearer <session_token>`

## Demo Mode (Frontend Auto-Auth)

In demo mode (backend TEST_MODE=true), the frontend ProtectedRoute in App.js automatically authenticates by:
1. Trying GET /api/auth/me (existing session)
2. If no session, calling POST /api/auth/test-login with X-Test-Auth: local_dev_token
3. Falling back to a static demo user if the backend is unreachable

This means no manual auth is needed for local development - just start both servers and open http://localhost:3000/dashboard.

### Emergent Script (index.html)

The Emergent auth script in public/index.html has been commented out for demo mode. If re-enabled, it will redirect all navigation to /en/login. For local demo, ensure the script tag remains commented out.

## Step 1: Deterministic auth (recommended for automated testing)

### Option A (preferred): Use the test-login endpoint (deterministic *user*, freshly minted token)
The backend exposes a DEV/TEST-only endpoint that creates a fixed user (`test_user`) and returns a session.

Prereqs:
- `TEST_MODE=true`
- `TEST_AUTH_TOKEN` set to a secret value
- Call with header `X-Test-Auth: <TEST_AUTH_TOKEN>`

```bash
# Returns JSON with { user, session_token } and also sets a cookie:
#   Set-Cookie: session_token=...; HttpOnly; Secure; SameSite=None; Path=/
curl -sS -X POST "http://localhost:8000/api/auth/test-login" \
  -H "X-Test-Auth: $TEST_AUTH_TOKEN"
```

To use the returned token as a deterministic input to test runners, export it:
```bash
export TEST_SESSION_TOKEN="PASTE_SESSION_TOKEN_HERE"
```

### Option B: Fully deterministic token (fixed value) via Mongo
Use this when you need a stable token across runs (e.g., local scripts, reproducible fixtures).

```bash
mongosh --eval "
use('test_database');
var userId = 'test_user';
var sessionToken = 'test_session_deterministic';
db.users.replaceOne(
  { user_id: userId },
  { user_id: userId, email: 'test@example.com', name: 'Test User', picture: null, created_at: new Date() },
  { upsert: true }
);
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
"
```

## Step 2: Create Test User & Session (manual / ad-hoc)
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 3: Test Backend API (Bearer token)
```bash
# Test auth endpoint
curl -X GET "https://your-app.com/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test protected endpoints
curl -X GET "https://your-app.com/api/suppliers" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 4: Cookie-based testing notes (curl + browsers)

### curl with cookies
If you want to exercise cookie auth (and redirects / credentialed requests), use a cookie jar:
```bash
# Save Set-Cookie -> cookies.txt, then replay it
curl -c cookies.txt -sS -X POST "https://your-app.com/api/auth/test-login" \
  -H "X-Test-Auth: $TEST_AUTH_TOKEN"

curl -b cookies.txt -sS "https://your-app.com/api/auth/me"
```

### Browser / Playwright
Cookie attributes matter:
- `Secure` cookies only work over HTTPS (they are not stored/sent on `http://...`).
- `SameSite=None` is required for cross-site XHR, but browsers also require `Secure` in that case.
- `HttpOnly` cookies can’t be read from JS, but can be set via Playwright APIs.

```javascript
// Set cookie and navigate
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "your-app.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}]);
await page.goto("https://your-app.com/dashboard");
```

Tip: If you're testing on plain HTTP locally and cookies aren't sticking, prefer `Authorization: Bearer ...` for local runs (or run the app behind HTTPS).

### Cookie behavior on localhost

The backend detects localhost and uses SameSite=Lax (not None+Secure) so cookies work over plain HTTP. This is handled by `_cookie_settings_for_request()` in server.py.
