import { useState, useEffect, useRef } from "react";
import "./../styles/emailassistant.css";
import { authFetch } from "./authFetch";
import MarkdownRenderer from "./MarkdownRenderer";

const API = process.env.REACT_APP_URL;

export default function OnboardAssistant({ activeSessionId }) {
  /* ================= STATE ================= */
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // login session (auth / redis)
  const sessionId = sessionStorage.getItem("session_id");
  const token = localStorage.getItem("access_token");
  /* ================= AUTO SCROLL ================= */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);
  
  function authHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };
  }

  useEffect(() => {
  if (!sessionId || !activeSessionId) return;

  async function start() {
    await authFetch(`${API}/onboard/start`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        bot_session_id: activeSessionId,
      }),
    });
  }

  start();
}, [sessionId, activeSessionId]);

  /* ================= LOAD HISTORY ================= */
  useEffect(() => {
    if (!sessionId || !activeSessionId) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      try {
        const res = await authFetch(
          `${API}/tool-sessions/${activeSessionId}/messages`,
          {
            headers: { "X-Session-Id": sessionId,
              "Authorization": `Bearer ${token}`
             },
          }
        );

        const data = await res.json();
        console.log("ONBOARD HISTORY:", data);

        let msgs = data.messages;

        // 🔥 backend sends string
        if (typeof msgs === "string") {
          msgs = JSON.parse(msgs);
        }

        if (data.success && Array.isArray(msgs)) {
          setMessages(
            msgs.map(m => ({
              from: m.sender === "user" ? "user" : "bot",
              text: m.text || "",
            }))
          );
        }
      } catch (err) {
        console.error(err);
        setMessages([]);
      }
    }

    loadMessages();
  }, [sessionId, activeSessionId]);

  /* ================= HELPERS ================= */
  const pushUser = text =>
    setMessages(m => [...m, { from: "user", text }]);

  const pushBot = text =>
    setMessages(m => [...m, { from: "bot", text }]);

  /* ================= SEND QUESTION ================= */
  async function sendMessage() {
    if (!input.trim() || loading) return;

    if (!sessionId || !activeSessionId) {
      pushBot("Session not initialized. Please reopen this tool.");
      return;
    }

    const question = input.trim();
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setLoading(true);

    pushUser(question);

    // Placeholder bot message for incoming stream chunks
    setMessages(m => [...m, { from: "bot", text: "", isStreaming: true }]);

    try {
      const res = await authFetch(`${API}/onboard/ask_hr`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Accept": "text/event-stream, application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          bot_session_id: activeSessionId,
          question,
          stream: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const contentType = res.headers.get("content-type") || "";

      if (res.body && (contentType.includes("text/event-stream") || !contentType.includes("json"))) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith(":")) continue;

            if (line.startsWith("data:")) {
              const dataStr = line.replace(/^data:\s*/, "");
              if (dataStr === "[DONE]") continue;

              let chunk = "";
              try {
                const parsed = JSON.parse(dataStr);
                chunk =
                  parsed.chunk ??
                  parsed.text ??
                  parsed.content ??
                  parsed.answer ??
                  (typeof parsed === "string" ? parsed : "");
              } catch {
                chunk = dataStr;
              }

              if (chunk) {
                accumulated += chunk;
                setMessages(prev => {
                  const copy = [...prev];
                  const lastIdx = copy.length - 1;
                  if (lastIdx >= 0 && copy[lastIdx].from === "bot") {
                    copy[lastIdx] = {
                      ...copy[lastIdx],
                      text: accumulated,
                      isStreaming: true,
                    };
                  }
                  return copy;
                });
              }
            } else {
              accumulated += rawLine + "\n";
              setMessages(prev => {
                const copy = [...prev];
                const lastIdx = copy.length - 1;
                if (lastIdx >= 0 && copy[lastIdx].from === "bot") {
                  copy[lastIdx] = {
                    ...copy[lastIdx],
                    text: accumulated.trimEnd(),
                    isStreaming: true,
                  };
                }
                return copy;
              });
            }
          }
        }

        setMessages(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].from === "bot") {
            copy[lastIdx] = {
              ...copy[lastIdx],
              text: accumulated || "No response received.",
              isStreaming: false,
            };
          }
          return copy;
        });
      } else {
        const data = await res.json();
        const answer = (data && data.answer) || "Sorry, no information regarding this policy.";
        setMessages(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].from === "bot") {
            copy[lastIdx] = {
              ...copy[lastIdx],
              text: answer,
              isStreaming: false,
            };
          }
          return copy;
        });
      }

      window.dispatchEvent(
        new CustomEvent("refreshToolSessions", {
          detail: { tool: "Policies", bot_session_id: activeSessionId },
        })
      );
    } catch (err) {
      console.error("Stream error:", err);
      setMessages(prev => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        if (lastIdx >= 0 && copy[lastIdx].from === "bot") {
          copy[lastIdx] = {
            ...copy[lastIdx],
            text: copy[lastIdx].text || "Network error. Please try again.",
            isStreaming: false,
          };
        }
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  /* ================= GUARD ================= */
  if (!sessionId || !activeSessionId) {
    return <div className="chatWrapper">Loading session…</div>;
  }

  /* ================= UI ================= */
  return (
    <div className="chatWrapper">
      <div className="chatHeader">
        <h2>Niruthi AI HR Policy Assistant</h2>
      </div>

      <div className="chatBox">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`msgBubble ${m.from === "user" ? "userMsg" : "botMsg"}`}
          >
            {m.from === "user" ? (
              m.text
            ) : (
              <MarkdownRenderer content={m.text} isStreaming={m.isStreaming} />
            )}
          </div>
        ))}

        <div ref={chatEndRef} />
      </div>

      <div className="inputArea">
        <div className="composer">
          <textarea
            ref={textareaRef}
            className="composerInput"
            rows="1"
            placeholder="E.g. What is the PIP policy?"
            value={input}
            onChange={e => setInput(e.target.value)}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={loading}
          />

          <button
            className="sendBtn"
            onClick={sendMessage}
            disabled={loading}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
