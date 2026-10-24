import { useState, useEffect, useRef } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./../styles/emailassistant.css";
import { authFetch } from "./authFetch";

export default function Documents({ goBack }) {
  const API = process.env.REACT_APP_URL;
  const sessionId = sessionStorage.getItem("session_id");

  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Hi! I'm your document assistant. Tell me which document we need to modify.",
    },
  ]);

  const [text, setText] = useState("");
  const [fileList, setFileList] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(true);
  const [isDateMode, setIsDateMode] = useState(false);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // -----------------------------
  // FORMAT DATE
  // -----------------------------
  const formatDate = (date) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };

  // -----------------------------
  // LOAD FILE LIST
  // -----------------------------
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API}/autofill/files`);
        const data = await res.json();
        setFileList(data.filenames || []);
      } catch {
        console.error("Failed to load files");
      }
    })();
  }, [API]);

  // -----------------------------
  // AUTO SCROLL
  // -----------------------------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, showFilePicker]);

  // -----------------------------
  // SELECT FILE
  // -----------------------------
  const handleFileSelect = async (value) => {
    if (!value) return;

    setSelectedFile(value);
    setShowFilePicker(false);

    setMessages((prev) => [
      ...prev,
      { from: "user", text: `Selected file: ${value}` },
    ]);

    try {
      setLoading(true);

      const res = await authFetch(`${API}/autofill/select-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          template_path: value,
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { from: "bot", text: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "Failed to load file." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // SEND MESSAGE
  // -----------------------------
  const sendMessageWithValue = async (value) => {
    if (loading) return;

    try {
      setLoading(true);

      const res = await authFetch(`${API}/autofill/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: value,
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { from: "user", text: value },
        {
          from: "bot",
          text: data.reply,
          preview: data.preview,
          download: data.download_url,
        },
      ]);

      setIsDateMode(data.reply?.toLowerCase().includes(" date"));
      setText("");

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      if (data.completed) {
        setSelectedFile("");
        setShowFilePicker(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "Something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = () => {
    if (!text.trim() || loading) return;
    sendMessageWithValue(text);
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="chatWrapper">
      <div className="chatHeader">
        <h2>📄 Smart Document Assistant</h2>
      </div>

      <div className="chatBox">
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;

          return (
            <div
              key={i}
              className={`msgBubble ${
                m.from === "user" ? "userMsg" : "botMsg"
              }`}
            >
              {m.text}

              {/* Calendar for Date Input */}
              {m.from === "bot" && isLast && isDateMode && !loading && (
                <div className="inline-calendar-container">
                  <Calendar
                    onChange={(date) =>
                      sendMessageWithValue(formatDate(date))
                    }
                  />
                </div>
              )}

              {m.preview && <pre className="previewBox">{m.preview}</pre>}

              {m.download && (
                <button
                  className="downloadBtn"
                  onClick={async () => {
                    const res = await authFetch(`${API}${m.download}`);

                    const disposition = res.headers.get("content-disposition");
                    let filename = "document.pdf";

                    if (disposition && disposition.includes("filename=")) {
                      filename = disposition
                        .split("filename=")[1]
                        .replace(/"/g, "")
                        .trim();
                    }

                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);

                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;  
                    a.click();

                    URL.revokeObjectURL(url);
                  }}
                >
                  ⬇ Download Document
                </button>
              )}

            </div>
          );
        })}

        {showFilePicker && (
          <div className="filePickerBubble">
            Select the file you want to edit
            <select
              className="fileSelect"
              value={selectedFile}
              onChange={(e) => handleFileSelect(e.target.value)}
            >
              <option value="">Select a file</option>
              {fileList.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && <div className="msgBubble botMsg">Processing...</div>}
        <div ref={chatEndRef} />
      </div>

      <div className="inputArea">
        <div className="composer">
          <textarea
            ref={textareaRef}
            className="composerInput"
            rows="1"
            placeholder={
              showFilePicker
                ? "Please select a file first..."
                : "Type your response..."
            }
            value={text}
            disabled={showFilePicker || isDateMode}
            onChange={(e) => setText(e.target.value)}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            className="sendBtn"
            disabled={loading || showFilePicker || isDateMode || !text.trim()}
            onClick={sendMessage}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
