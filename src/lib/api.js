/**
 * lib/api.js — Centralized API Fetch Helper
 *
 * Why this file exists:
 *   Every API call needs to:
 *     1. Know the backend base URL
 *     2. Attach the JWT token in the Authorization header
 *     3. Handle 401 (expired/invalid token) the same way everywhere
 *
 *   Without this, you'd repeat that logic in every component — messy and error-prone.
 *
 * Usage:
 *   import { apiFetch } from "@/lib/api";
 *
 *   // GET request (token auto-attached)
 *   const data = await apiFetch("/api/auth/me");
 *
 *   // POST request with body
 *   const data = await apiFetch("/api/auth/login", {
 *     method: "POST",
 *     body: JSON.stringify({ email, password }),
 *   });
 */

/* Read backend URL from .env.local — falls back to localhost for development */
const BASE_URL = "";

/**
 * apiFetch — wraps the native fetch() with:
 *   - Automatic base URL prepending
 *   - Auto-attachment of JWT token from localStorage
 *   - JSON Content-Type header
 *   - 401 handling: clears storage and redirects to /auth
 *   - Throws a proper Error with the server's message on failure
 *
 * @param {string} path    — API path, e.g. "/api/auth/login"
 * @param {object} options — standard fetch options (method, body, headers, etc.)
 * @returns {Promise<object>} — parsed JSON response
 */
export async function apiFetch(path, options = {}) {
  /* Read token from localStorage (only available in the browser) */
  const token = typeof window !== "undefined"
    ? localStorage.getItem("token")
    : null;

  /* ── Step 1: Make the network request ── */
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });
  } catch {
    /*
     * fetch() itself threw — this means the server is completely unreachable.
     * Common causes: backend not started, wrong port, firewall.
     */
    throw new Error(
      `Cannot reach the server at ${BASE_URL}. ` +
      `Make sure your backend is running (cd backend && npm run dev).`
    );
  }

  /* ── Step 2: Check the Content-Type BEFORE calling .json() ── */
  /*
   * THE BUG FIX:
   * Old code called response.json() unconditionally.
   * If the server returned HTML (wrong URL, proxy error, CORS block, etc.)
   * that threw: "Unexpected token '<', <!DOCTYPE ... is not valid JSON"
   *
   * Fix: read Content-Type header first. Only call .json() if it's actually JSON.
   */
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let data;
  if (isJson) {
    data = await response.json();
  } else {
    /*
     * Server returned HTML or something else.
     * Log the first 300 chars in the console so you can debug what it actually said.
     */
    const rawText = await response.text();
    console.error(
      `[apiFetch] Expected JSON but got "${contentType}" from ${BASE_URL}${path}\n` +
      `Response preview: ${rawText.slice(0, 300)}`
    );
    throw new Error(
      "Server returned an unexpected response (not JSON). " +
      "Check the browser console and make sure: " +
      "(1) backend is running on port 5000, " +
      "(2) CORS allows http://localhost:3000, " +
      "(3) you restarted 'next dev' after creating .env.local."
    );
  }

  /* ── Step 3: Handle 401 — expired or invalid token ── */
  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/auth";
    return;
  }

  /* ── Step 4: Handle all other HTTP errors ── */
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong. Please try again.");
  }

  return data;
}

/**
 * saveAuthData — stores token + user after login/signup
 *
 * Call this after a successful login or signup response.
 *
 * @param {string} token — JWT token string
 * @param {object} user  — user object { id, username, email }
 */
export function saveAuthData(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

/**
 * clearAuthData — removes all auth data from localStorage
 *
 * Call this on logout.
 */
export function clearAuthData() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

/**
 * getStoredUser — reads the cached user object from localStorage
 *
 * Useful for quickly reading username/email without an API call.
 * Note: this data can be stale — use /api/auth/me for fresh data.
 *
 * @returns {object|null} — user object or null if not logged in
 */
export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * isLoggedIn — quick check for whether a token exists
 *
 * Does NOT validate the token with the server.
 * Use the useAuth hook for a validated check.
 *
 * @returns {boolean}
 */
export function isLoggedIn() {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("token"));
}
