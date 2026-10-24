const API = process.env.REACT_APP_URL;

export async function authFetch(url, options = {}) {
  let token = localStorage.getItem("access_token");

  // First attempt
  let res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status !== 401) return res;

  // Try refresh
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) {
    handleSessionExpired();
    return;
  }

  const r = await fetch(`${API}/login/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  if (!r.ok) {
    handleSessionExpired();
    return;
  }

  const data = await r.json();
  localStorage.setItem("access_token", data.access_token);

  // Retry original request
  const retryRes = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${data.access_token}`,
    },
  });

  // 🔥 IMPORTANT FIX
  if (retryRes.status === 401) {
    handleSessionExpired();
    return;
  }

  return retryRes;
}

// --------------------------
function handleSessionExpired() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  sessionStorage.clear();

  // Notify App.js
  window.dispatchEvent(new Event("sessionExpired"));
}
