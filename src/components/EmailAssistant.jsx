import { useState, useEffect, useRef, useLayoutEffect } from "react";
import "./../styles/toolchat.css";
import { useMentionSearch } from "./useMentionSearch";

import { authFetch } from "./authFetch";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const API = process.env.REACT_APP_URL;

const TOPICS = [
  { value: "leave", label: "Leave", icon: "beach_access" },
  { value: "work from home", label: "Work From Home", icon: "home_work" },
  { value: "meeting", label: "Meeting Request", icon: "groups" },
  { value: "other", label: "Other", icon: "more_horiz" },
];

export default function EmailAssistant({ activeSessionId, tool, onNewSession, headerActions }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const { suggestions, handleInputChange, insertUser, setSuggestions } = useMentionSearch(API);
  const [activeIndex, setActiveIndex] = useState(0);
  const [emailState, setEmailState] = useState(null);
  const [replying, setReplying] = useState(false);
  const editRef = useRef(null);
  const [editBody, setEditBody] = useState("");
  const [showEditBody, setShowEditBody] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const sessionId = sessionStorage.getItem("session_id");
  const token = localStorage.getItem("access_token");

  const lastMessage = messages[messages.length - 1];
  const shouldShowCalendar =
    lastMessage?.from === "bot" &&
    lastMessage?.text?.toLowerCase().includes(" date");

  // --- Helpers ---
  const formatDate = (date) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const pushBot = (text) => setMessages((m) => [...m, { from: "bot", text }]);
  const pushUser = (text) => setMessages((m) => [...m, { from: "user", text }]);

  // --- Auto Scroll ---
  useLayoutEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, replying, emailState, showEditBody]);

  useEffect(() => {
    if (showEditBody && editRef.current) {
      editRef.current.innerText = editBody || "";
    }
  }, [showEditBody, editBody]);

  useEffect(() => {
    if (!sessionId || !activeSessionId) return;

    async function initialize() {
      try {
        // 1️⃣ Load chat history first
        const historyRes = await authFetch(
          `${API}/tool-sessions/${activeSessionId}/messages`,
          {
            headers: {
              "X-Session-Id": sessionId,
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const historyData = await historyRes.json();

        let msgs = historyData.messages;
        if (typeof msgs === "string") {
          msgs = JSON.parse(msgs);
        }

        if (historyData.success && Array.isArray(msgs)) {
          setMessages(
            msgs.map((m) => ({
              from: m.sender === "user" ? "user" : "bot",
              text: m.text || "",
            }))
          );
        }

        const stateRes = await authFetch(`${API}/mailbot/state/${sessionId}`, {
          headers: authHeaders(),
        });

        const stateData = await stateRes.json();

        if (stateData.success) {
          setEmailState(stateData.state);
        }

        // 2️⃣ THEN call start
        if (!msgs || msgs.length === 0) {
          const startRes = await authFetch(`${API}/mailbot/start`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              session_id: sessionId,
              bot_session_id: activeSessionId,
            }),
          });

          const startData = await startRes.json();

          if (startData.success && startData.reply) {
            setMessages([{ from: "bot", text: startData.reply }]);
            setEmailState(startData.state);
          }
        } 
      }catch (err) {
        console.error(err);
      }
    }

    initialize();
  }, [sessionId, activeSessionId]);

  // --- Handlers ---

  async function handleGenericSubmit(val) {
    const textToSend = val || input;
    if (!textToSend.trim()) return;

    pushUser(textToSend);
    setInput("");
    textareaRef.current?.focus();
    setReplying(true);

    try {
      const res = await authFetch(`${API}/mailbot/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          session_id: sessionId,
          bot_session_id: activeSessionId,
          message: textToSend,
        }),
      });

      const data = await res.json();

      if (data.success) {
        pushBot(data.reply);

        if (data.topics) {
          setEmailState({ ...data.state, flow: "topic_selection" });
        } else {
          setEmailState(data.state);
        }
      }
    } catch (err) {
      console.error(err);
      pushBot("Sorry, something went wrong. Please try again.");
    } finally {
      setReplying(false);
    }
  }
  const openFilePicker = () => fileInputRef.current?.click();

  async function handleFileAttach(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const existing = emailState?.attachments?.length || 0;

    if (existing + files.length > 5) {
      alert("You can add only 5 files to an email");
      e.target.value = "";
      return;
    }

    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);

      const res = await authFetch(
        `${API}/mailbot/attach?session_id=${sessionId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
        }
      );

      const data = await res.json();

      if (data.success) {
        setEmailState((s) => ({
          ...(s || {}),
          attachments: data.attachments.map((f) => ({ filename: f })),
        }));
      }
    }

    e.target.value = "";
  }

  async function removeAttachment(name) {
    const res = await authFetch(
      `${API}/mailbot/attach?session_id=${sessionId}&filename=${encodeURIComponent(name)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();

    if (data.success) {
      setEmailState((prev) => ({
        ...(prev || {}),
        attachments: data.attachments.map((f) => ({ filename: f })),
      }));
    }
  }

  async function submitEditedBody(updatedBody) {
    const res = await authFetch(`${API}/mailbot/chat`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        bot_session_id: activeSessionId,
        message: "edit",
        body: updatedBody,
      }),
    });

    const data = await res.json();

    if (data.success) {
      setEmailState(data.state);
      pushBot(data.reply);
      setShowEditBody(false);
    }
  }

  async function sendEmail() {
    setSendingEmail(true);
    setEmailState(prev => prev ? { ...prev, flow: "sending" } : prev);
    pushUser("send");

    try {
      const res = await authFetch(`${API}/mailbot/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          session_id: sessionId,
          bot_session_id: activeSessionId,
          message: "send",
        }),
      });

      const data = await res.json();

      if (data.success) {
        pushBot(data.reply);
        setEmailState(data.state);
      }
    } catch (err) {
      console.error(err);
      pushBot("Sorry, the email could not be sent. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  }

  const isBusy = replying || sendingEmail;

  return (
    <div className="tc-tool">
      {/* ---------- header ---------- */}
      <header className="tc-head">
        <span className="tc-head-icon" style={{ "--c": tool?.color || "#2563eb" }}>
          <span className="material-symbols-rounded">{tool?.icon || "mail"}</span>
        </span>
        <div>
          <h1>Email Assistant</h1>
          <p>{tool?.desc || "Draft and send emails with AI help"}</p>
        </div>
        <div className="tc-head-actions">
          {headerActions}
          {onNewSession && (
            <button type="button" className="tc-btn primary" onClick={onNewSession}>
              <span className="material-symbols-rounded">edit_square</span>
              New email
            </button>
          )}
        </div>
      </header>

      {/* ---------- conversation ---------- */}
      <section className="tc-chat">
        <div className="tc-thread">
          {messages.length === 0 && (
            <div className="tc-empty">
              <span className="material-symbols-rounded">forward_to_inbox</span>
              <p>
                {activeSessionId
                  ? "Starting your email assistant…"
                  : "Click “New email” to start drafting."}
              </p>
            </div>
          )}

          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const isBot = m.from !== "user";

            return (
              <div key={i} className={`tc-msg ${isBot ? "bot" : "user"}`}>
                {isBot && (
                  <span className="tc-avatar" aria-hidden="true">
                    <span className="material-symbols-rounded">smart_toy</span>
                  </span>
                )}

                <div className="tc-bubble-wrap">
                  <div className="tc-bubble">{m.text}</div>

                  {/* Calendar when the assistant asks for a date */}
                  {isLast && isBot && / date/i.test(m.text || "") && (
                    <div className="tc-calendar">
                      <Calendar
                        onChange={(date) => {
                          handleGenericSubmit(formatDate(date));
                          chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
                        }}
                        tileDisabled={({ date }) => date.getDay() === 0 || date.getDay() === 6}
                      />
                    </div>
                  )}

                  {/* Topic choices */}
                  {isLast && isBot && emailState?.flow === "topic_selection" && (
                    <div className="tc-chips">
                      {TOPICS.map(t => (
                        <button
                          type="button"
                          key={t.value}
                          className="tc-chip"
                          onClick={() => handleGenericSubmit(t.value)}
                          disabled={isBusy}
                        >
                          <span className="material-symbols-rounded">{t.icon}</span>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Inline editor for the email body */}
          {showEditBody && (
            <div className="tc-msg bot">
              <span className="tc-avatar" aria-hidden="true">
                <span className="material-symbols-rounded">edit_note</span>
              </span>
              <div className="tc-bubble-wrap wide">
                <div className="tc-editor">
                  <div className="tc-editor-label">Edit email body</div>
                  <div
                    ref={editRef}
                    className="tc-editor-input"
                    contentEditable
                    suppressContentEditableWarning
                  >
                    {editBody}
                  </div>
                  <div className="tc-editor-actions">
                    <button
                      type="button"
                      className="tc-btn ghost"
                      onClick={() => setShowEditBody(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="tc-btn primary"
                      onClick={() => submitEditedBody(editRef.current.innerText)}
                    >
                      <span className="material-symbols-rounded">check</span>
                      Save changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview actions */}
          {emailState?.flow === "preview" && !showEditBody && (
            <div className="tc-preview-actions">
              <span>Ready to go? Review the draft above.</span>
              <button
                type="button"
                className="tc-btn ghost"
                onClick={() => {
                  setEditBody(emailState?.body || "");
                  setShowEditBody(true);
                }}
              >
                <span className="material-symbols-rounded">edit</span>
                Edit
              </button>
              <button
                type="button"
                className="tc-btn primary"
                onClick={sendEmail}
                disabled={isBusy}
              >
                <span className="material-symbols-rounded">send</span>
                Send email
              </button>
            </div>
          )}

          {/* Typing / sending indicator */}
          {isBusy && (
            <div className="tc-msg bot">
              <span className="tc-avatar" aria-hidden="true">
                <span className="material-symbols-rounded">smart_toy</span>
              </span>
              <div className="tc-bubble tc-typing">
                {sendingEmail ? "Sending email" : "Writing"}
                <span className="tc-dots"><i /><i /><i /></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* ---------- composer ---------- */}
        <div className="tc-composer-wrap">
          {emailState?.attachments?.length > 0 && (
            <div className="tc-attachments">
              {emailState.attachments.map((a, i) => (
                <span key={i} className="tc-attachment">
                  <span className="material-symbols-rounded">attach_file</span>
                  <span className="tc-attachment-name">{a.filename}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${a.filename}`}
                    onClick={() => removeAttachment(a.filename)}
                  >
                    <span className="material-symbols-rounded">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="tc-mentions">
              {suggestions.map((user, idx) => (
                <button
                  type="button"
                  key={user.username}
                  className={`tc-mention ${idx === activeIndex ? "active" : ""}`}
                  onClick={() => {
                    const updated = insertUser(input, user.username);
                    setInput(updated);
                    setSuggestions([]);
                  }}
                >
                  <span className="tc-mention-avatar">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                  {user.username}
                </button>
              ))}
            </div>
          )}

          <div className="tc-composer">
            <button
              type="button"
              className="tc-icon-btn"
              onClick={openFilePicker}
              title="Attach files (max 5)"
              aria-label="Attach files"
            >
              <span className="material-symbols-rounded">attach_file</span>
            </button>

            <textarea
              ref={textareaRef}
              className="tc-input"
              rows="1"
              placeholder="Type your message… use @ to mention a colleague"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                handleInputChange(e.target.value);
              }}
              onKeyDown={(e) => {
                if (suggestions.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex(i => (i < suggestions.length - 1 ? i + 1 : 0));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex(i => (i > 0 ? i - 1 : suggestions.length - 1));
                    return;
                  }
                  if (e.key === "Tab" || e.key === "Enter") {
                    e.preventDefault();
                    const user = suggestions[activeIndex];
                    const updated = insertUser(input, user.username);
                    setInput(updated);
                    setSuggestions([]);
                    return;
                  }
                }

                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleGenericSubmit();
                }
              }}
            />

            <button
              type="button"
              className="tc-send"
              onClick={() => handleGenericSubmit()}
              disabled={!input.trim() || isBusy}
              aria-label="Send message"
            >
              <span className="material-symbols-rounded">send</span>
            </button>
          </div>
          <p className="tc-hint">Enter to send · Shift + Enter for a new line</p>
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileAttach} />
        </div>
      </section>
    </div>
  );
}
