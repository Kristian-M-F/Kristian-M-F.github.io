<<<<<<< HEAD
// Client for the Spring Boot backend (repository finance-tracker-backend).
//
// The website and the backend run on different addresses:
//   published:  https://kristian-m-f.github.io  →  backend on Render (PUBLIC_API_URL)
//   locally:    Live Server (port 5500)         →  backend in IntelliJ (http://localhost:8080)
// Browsers block login cookies between different addresses, so the login token is kept in
// localStorage and sent in the Authorization header.
const PUBLIC_API_URL = "https://finance-os-api.onrender.com/api";
const LOCAL_API_URL = "http://localhost:8080/api";
const RUNS_LOCALLY = ["localhost", "127.0.0.1"].includes(location.hostname);
// The end-to-end tests point the website at their own test backend.
const API_BASE = window.FINANCE_OS_API_URL || (RUNS_LOCALLY ? LOCAL_API_URL : PUBLIC_API_URL);
const TOKEN_KEY = "financeOS_token";

function readToken() {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY));
    return saved && saved.expiresAt > Date.now() ? saved.token : null;
  } catch {
    return null;
  }
}

/** Keeps the token from a login response. */
function rememberLogin(result) {
  if (!result?.token) return;
  const minutes = result.expiresInMinutes || 120;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: result.token, expiresAt: Date.now() + minutes * 60000 }));
  } catch {
    // Without storage the login cannot be kept.
  }
}

/** Request headers, including the login token. */
function requestHeaders(withJsonBody) {
  const headers = withJsonBody ? { "Content-Type": "application/json" } : {};
  // Emails from the backend (confirmation, password reset …) use the website's language.
  if (typeof I18N !== "undefined") headers["Accept-Language"] = I18N.language;
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function forgetLogin() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored.
  }
}
=======
// URL of the Spring Boot backend hosted on Render.
const API_BASE = "https://finance-tracker-backend-5rru.onrender.com/api";
>>>>>>> e00ec3369d7bce9f7f3da3d48624164dc36e1c0b

// Older versions kept the token in localStorage; remove those leftovers.
try {
  localStorage.removeItem("ft_token");
  localStorage.removeItem("ft_user");
} catch {
  // Storage is blocked, nothing to clean up.
}

/**
 * Sends a request to the backend and returns the parsed JSON (or null for 204).
 * The login token is stored in an HttpOnly cookie.
 *
 * credentials: "include" is required because the frontend is hosted on
 * GitHub Pages while the backend is hosted on Render.
 */
async function api(path, { method = "GET", body, redirectOn401 = true } = {}) {
  let response;

  try {
    response = await fetch(API_BASE + path, {
      method,
<<<<<<< HEAD
      credentials: "same-origin",
      headers: requestHeaders(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      RUNS_LOCALLY
        ? "Backend nicht erreichbar – läuft Spring Boot auf Port 8080?"
        : "Server nicht erreichbar – bitte in einer Minute nochmals versuchen.",
    );
=======
      credentials: "include",
      headers: body === undefined
        ? {}
        : { "Content-Type": "application/json" },
      body: body === undefined
        ? undefined
        : JSON.stringify(body),
    });
  } catch {
    throw new Error("Backend nicht erreichbar. Bitte versuche es erneut.");
>>>>>>> e00ec3369d7bce9f7f3da3d48624164dc36e1c0b
  }

  if (response.status === 401) forgetLogin();
  if (response.status === 401 && redirectOn401) {
    location.replace("login.html");
    throw new Error("Bitte neu einloggen");
  }

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      payload?.message || `Fehler ${response.status}`
    );

    error.status = response.status;
    error.code = payload?.code;

    throw error;
  }

  return payload;
}

/**
 * Ends the session on the server and redirects to the login page.
 */
async function logoutAndRedirect() {
  try {
    await api("/auth/logout", {
      method: "POST",
      redirectOn401: false
    });
  } catch {
    // Redirect even if the backend cannot be reached.
  }
<<<<<<< HEAD
  forgetLogin();
=======

>>>>>>> e00ec3369d7bce9f7f3da3d48624164dc36e1c0b
  location.replace("login.html");
}
