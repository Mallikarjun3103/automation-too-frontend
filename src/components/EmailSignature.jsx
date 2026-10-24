import { useState } from "react";
import "./../styles/emailsignature.css";
import { authFetch } from "./authFetch";

const API = process.env.REACT_APP_URL;

export default function EmailSignature({ goBack }) {
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [saved, setSaved] = useState(false);


  const sessionId = sessionStorage.getItem("session_id");
  const token = localStorage.getItem("access_token");

  async function saveSignature() {
    try {
      const res = await authFetch(`${API}/signature/save`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
         },
        body: JSON.stringify({
          html_signature: html || "",
          text_signature: text || "",
        }),
      });

      if (!res.ok) throw new Error();
      
      setHtml("");
      setText("");
      setFileName("");
      setSaved(true);
    } catch (e) {
      console.error("Save failed", e);
    }
  }

  async function importFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await authFetch(`${API}/signature/import`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: form,
      });

      const data = await res.json();
      setHtml(data.html_signature || "");
      setText(data.text_signature || "");
    } catch (err) {
      console.error("Failed to import signature", err);
    }
  }

  /* ================= SUCCESS STATE ================= */
  if (saved) {
    return (
      <div className="chatBox">
        <h2 style={{color:"black"}}>✅ Signature Saved</h2>
        <p style={{color:"black"}}>Your email signature has been updated successfully.</p>
      </div>
    );
  }

  /* ================= EDITOR STATE ================= */
  return (
    <div className="chatWrapper">
      <div className="ChatHeader">
        <h2 style={{ color: "black" }}>Email Signature</h2>
      </div>
      <div className="chatBox">
          <div className="inputRow">
            <label className="upload-label">
              Import from file (PDF / DOCX)
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={importFile}
                hidden
              />
            </label>
             <button
              className="sendBtn2"
              onClick={saveSignature}
              disabled={!html}
            >
              upload
            </button>
            {fileName && <small className="file-name">{fileName}</small>}
          </div>
        {/* RIGHT : PREVIEW */}
        <div className="signature-preview">
          <hr />
          <div
            className="signature-html-preview"
            dangerouslySetInnerHTML={{
              __html: html || "<em>No preview</em>",
            }}
          />
        </div>
      </div>
    </div>
  );
}
