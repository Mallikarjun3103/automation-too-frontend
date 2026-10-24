/*
 * ngrok's free tier answers browser requests with an HTML warning page
 * instead of the API response. Sending this header skips that page.
 * Only applies when REACT_APP_URL points at ngrok; a no-op otherwise.
 */
const API = process.env.REACT_APP_URL || "";

if (/\.ngrok(-free)?\.(app|dev|io)/.test(API)) {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || String(input);
    if (!url.startsWith(API)) return originalFetch(input, init);

    const headers = new Headers(
      init.headers || (input instanceof Request ? input.headers : undefined)
    );
    headers.set("ngrok-skip-browser-warning", "true");

    return originalFetch(input, { ...init, headers });
  };
}
