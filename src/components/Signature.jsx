import React, { useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { authFetch } from "./authFetch";

export default function SignatureEditor() {
  const [html, setHtml] = useState("");
  const token = localStorage.getItem("access_token");

  const saveSignature = async () => {
    await authFetch(`${API}/signature/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        html_signature: html,
        text_signature: html.replace(/<[^>]+>/g, "")
      })
    });

    alert("Signature saved");
  };

  return (
    <div>
      <h3>Email Signature</h3>
      <ReactQuill value={html} onChange={setHtml} />
      <button onClick={saveSignature}>Save</button>

      <h4>Preview</h4>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

