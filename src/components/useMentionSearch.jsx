import { useRef, useState } from "react";
import { authFetch } from "./authFetch";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 150;

export function useMentionSearch(API) {
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const lastQueryRef = useRef("");

  function extractMention(text) {
    if (!text) return null;
    const last = text.split(" ").pop();
    if (last?.startsWith("@") && last.length > MIN_CHARS) {
      return last.slice(1);
    }
    return null;
  }

  async function fetchUsers(q) {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const res = await authFetch(
        `${API}/users/search?q=${q}`,
        { signal: abortRef.current.signal }
      );
      const data = await res.json();
      setSuggestions(data || []);
    } catch (e) {
      if (e.name !== "AbortError") console.error(e);
    }
  }

  function handleInputChange(text) {
    const query = extractMention(text);

    if (!query) {
      setSuggestions([]);
      lastQueryRef.current = "";
      return;
    }

    // ✅ Prevent same query from firing again
    if (query === lastQueryRef.current) return;

    lastQueryRef.current = query;

    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      fetchUsers(query);
    }, DEBOUNCE_MS);
  }

  function insertUser(input, username) {
    const parts = input.split(" ");
    parts[parts.length - 1] = username;
    setSuggestions([]);
    return parts.join(" ") + " ";
  }

  return {
    suggestions,
    handleInputChange,
    insertUser,
    setSuggestions
  };
}