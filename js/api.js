// Client for the Spring Boot backend. The pages are served by Spring Boot itself,
// so a relative "/api" base path is enough.
//
// The login token lives in an HttpOnly cookie that JavaScript cannot read, so injected
// scripts cannot steal it. The browser sends the cookie with every request to /api.
const API_BASE = "/api";

// Older versions kept the token in localStorage; remove those leftovers.
try {
  localStorage.removeItem("ft_token");
  localStorage.removeItem("ft_user");
} catch {
  // Storage is blocked, nothing to clean up.
}

/**
 * Sends a request to the backend and returns the parsed JSON (or null for 204).
 * On 401 the user is sent to the login page unless redirectOn401 is false.
 */
async function api(path, { method = "GET", body, redirectOn401 = true } = {}) {
  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Backend nicht erreichbar – läuft Spring Boot auf Port 8080?");
  }

  if (response.status === 401 && redirectOn401) {
    location.replace("login.html");
    throw new Error("Bitte neu einloggen");
  }
  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.message || `Fehler ${response.status}`);
    error.status = response.status;
    error.code = payload?.code; // e.g. "EMAIL_NOT_VERIFIED"
    throw error;
  }
  return payload;
}

/** Ends the session on the server (all devices) and goes to the login page. */
async function logoutAndRedirect() {
  try {
    await api("/auth/logout", { method: "POST", redirectOn401: false });
  } catch {
    // Go to the login page even if the backend does not answer.
  }
  location.replace("login.html");
}
