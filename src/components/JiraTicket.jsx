import { useState, useEffect, useRef } from "react";
import "./../styles/emailassistant.css";
import { authFetch } from "./authFetch";

const API = process.env.REACT_APP_URL;

export default function JiraTicketGenerator({ activeSessionId }) {
  /* ================= STATE ================= */
  const [step, setStep] = useState("otp"); // otp | verify | chat
  const [otp, setOtp] = useState("");
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [otpError, setOtpError] = useState("");

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

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

  /* ================= LOAD HISTORY ================= */
  useEffect(() => {
    if (!sessionId || !activeSessionId) {
      setMessages([]);
      return;
    }

    async function loadHistory() {
      try {
        const res = await authFetch(
          `${API}/tool-sessions/${activeSessionId}/messages`,
          { headers: { "X-Session-Id": sessionId,
            "Authorization": `Bearer ${token}`
           },
         }
        );

        const data = await res.json();
        console.log("JIRA HISTORY:", data);

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

    loadHistory();
  }, [sessionId, activeSessionId]);


  /* ================= CHECK JIRA STATUS ================= */
  useEffect(() => {
    if (!sessionId) return;

    async function checkStatus() {
      try {
        const res = await authFetch(`${API}/jira-bot/status`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ session_id: sessionId }),
        });

        const result = await res.json();

        if (res.ok && result.jira_verified) {
          setStep("chat");
        } else {
          setStep("otp");
        }
      } catch {
        setStep("otp");
      } finally {
        setChecking(false);
      }
    }

    checkStatus();
  }, [sessionId]);

  /* ================= INIT JIRA BOT (GREETING ONCE) ================= */
  useEffect(() => {
    if (!sessionId || !activeSessionId) return;

    authFetch(`${API}/jira-bot/start`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        bot_session_id: activeSessionId,
      }),
    });
  }, [sessionId, activeSessionId]);

  // function shouldSearch(text){
  //   if (!text) return null;

  //   const lastToken = text.split(" ").pop();
  //   if (!lastToken) return null;

  //   if (lastToken.startsWith("@") && lastToken.length > 1) {
  //     return lastToken.substring(1);
  //   }

  //   return null;
  // }


  // async function handleChange(e){
  //   const text = e.target.value;
  //   setInput(text);

  //   const query = shouldSearch(text);

  //   if(query){
  //     const res = await authFetch(`${API}/users/search?q=${query}`);
  //     const data = await res.json();
  //     setSuggestions(data);
  //   } else {
  //     setSuggestions([]);
  //   }
  // }

  // function insertUser(username){
  //   const parts = input.split(" ");
  //   const last = parts[parts.length - 1];

  //   if (last.startsWith("@")) {
  //     parts[parts.length - 1] = "@" + username;
  //   } else {
  //     parts[parts.length - 1] = username;
  //   }

  //   setInput(parts.join(" ") + " ");
  //   setSuggestions([]);
  // }

  /* ================= OTP ================= */
  async function requestOtp() {
    if (otpLoading) return;
    setOtpLoading(true);
    setOtpError("");

    try {
      const res = await authFetch(`${API}/jira-bot/request-otp`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ session_id: sessionId }),
      });

      const result = await res.json();

      if (!res.ok) {
        setOtpError(result.detail || "OTP request failed");
        return;
      }

      if (result.already_verified) {
        setStep("chat");
      } else {
        setStep("verify");  
      }

    } catch {
      setOtpError("Network error requesting OTP");
    } finally {
      setOtpLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otp.trim() || otpLoading) return;
    setOtpLoading(true);
    setOtpError("");

    try {
      const res = await authFetch(`${API}/jira-bot/verify-otp`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ session_id: sessionId, otp }),
      });

      const result = await res.json();

      if (!res.ok) {
        // 👇 directly show backend error
        setOtpError(result.detail || "Invalid OTP");
        return;
      }

      setStep("chat");
      setOtp("");

    } catch {
      setOtpError("Network error verifying OTP");
    } finally {
      setOtpLoading(false);
    }
  }

  /* ================= CHAT ================= */
  async function sendMessage() {
    if (!input.trim() || loading) return;

    if (!sessionId || !activeSessionId) {
      setMessages(m => [
        ...m,
        { from: "bot", text: "Session not initialized. Please reopen Jira tool." },
      ]);
      return;
    }

    const userMsg = input.trim();
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }    
    setLoading(true);
    setMessages(m => [...m, { from: "user", text: userMsg }]);

    try {
      const res = await authFetch(`${API}/jira-bot/message`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          session_id: sessionId,
          bot_session_id: activeSessionId,
          message: userMsg,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setMessages(m => [...m, { from: "bot", text: result.detail || "Error" }]);
        return;
      }

      setMessages(m => [...m, { from: "bot", text: result.reply }]);
    } catch {
      setMessages(m => [...m, { from: "bot", text: "Network error" }]);
    } finally {
      setLoading(false);
    }
  }

  /* ================= SAFETY UI (AFTER HOOKS) ================= */
  if (checking) {
    return <div className="chatWrapper">Checking Jira access…</div>;
  }

  if (!sessionId) {
    return <div className="chatWrapper">Session expired</div>;
  }

  /* ================= UI ================= */
  return (
    <div className="chatWrapper">
      <div className="chatHeader">
        <h2>Jira Ticket Generator</h2>
      </div>

      {step === "otp" && (
        <div className="authForm">
          <h3>Verify Jira Access</h3>
          <button onClick={requestOtp} disabled={otpLoading}>
            {otpLoading ? "Sending OTP..." : "Send OTP"}
          </button>
          {otpError && <div className="otpError">{otpError}</div>}
        </div>
      )}

      {step === "verify" && (
        <div className="authForm">
          <h3>Enter OTP</h3>
          <input
            className="inputBox"
            type="text"
            placeholder="6-digit OTP"
            value={otp}
            
            onChange={e => setOtp(e.target.value)}
            maxLength={6}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                verifyOtp();
              }
            }}
            disabled={otpLoading}
          />
          <button onClick={verifyOtp} disabled={otpLoading}>
            {otpLoading ? "Verifying..." : "Verify OTP"}
          </button>
          {otpError && <div className="otpError">{otpError}</div>}
        </div>
      )}

      {step === "chat" && (
        <>
          <div className="chatBox">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`msgBubble ${m.from === "user" ? "userMsg" : "botMsg"}`}
              >
                {m.text}
              </div>
            ))}
            {loading && <div className="msgBubble botMsg">Processing…</div>}
            <div ref={chatEndRef} />
          </div>

          <div className="inputArea">
            {/* {suggestions.length > 0 && (
              <div className="userDropdown">
                {suggestions.map(u => (
                  <div
                    key={u}
                    className="userOption"
                    onClick={() => insertUser(u)}
                  >
                    @{u}
                  </div>
                ))}
              </div>
            )} */}
            <div className="composer">
              <textarea
                ref={textareaRef}
                className="composerInput"
                rows="1"
                placeholder="Describe your Jira issue..."
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
              <button className="sendBtn" onClick={sendMessage} disabled={loading}>
                ➤
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
