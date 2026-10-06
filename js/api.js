// URL of the Spring Boot backend hosted on Render.
const API_BASE = "https://finance-tracker-backend-5rru.onrender.com/api";

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
  }

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

  location.replace("login.html");
}
