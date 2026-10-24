import { useEffect, useRef, useState } from "react";
import AuthLayout from "./AuthLayout";

const API = process.env.REACT_APP_URL;

export default function FaceFlow({ goBack, onLoginSuccess, selectedRole }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const activeRef = useRef(false);

  const [instruction, setInstruction] = useState("Initializing camera…");
  const [error, setError] = useState("");

  // --------------------------------------------------
  // CAMERA
  // --------------------------------------------------
  async function startCamera() {
    if (activeRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });

    streamRef.current = stream;

    const video = videoRef.current;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await new Promise((resolve) => (video.onloadedmetadata = resolve));
    await video.play();
  }

  function stopCamera() {
    activeRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  // --------------------------------------------------
  // FRAME CAPTURE
  // --------------------------------------------------
  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || video.videoWidth === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.85);
  }

  // --------------------------------------------------
  // LIVENESS
  // --------------------------------------------------
  async function startLiveness() {
    if (activeRef.current) return;
    activeRef.current = true;

    try {
      const res = await fetch(`${API}/login/face/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });

      const data = await res.json();

      if (!data.success) {
        setError("Failed to start face login");
        stopCamera();
        return;
      }

      const loginId = data.login_id;
      setInstruction("Align your face");

      intervalRef.current = setInterval(() => {
        sendFrame(loginId);
      }, 800);
    } catch {
      setError("Network error");
      stopCamera();
    }
  }

  async function sendFrame(loginId) {
    if (!activeRef.current) return;

    const image = captureFrame();
    if (!image) return;

    try {
      const res = await fetch(`${API}/login/face/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_id: loginId,
          image,
        }),
      });

      const data = await res.json();

      if (data.status === "pending") {
        setInstruction(data.instruction);
        return;
      }

      if (data.status === "error") {
        setError(data.message);
        stopCamera();
        return;
      }

      if (data.status === "expired") {
        setError("Session expired. Please try again.");
        stopCamera();
        return;
      }

      if (data.status === "completed") {
        activeRef.current = false;
        clearInterval(intervalRef.current);
        stopCamera();

        sessionStorage.setItem("session_id", data.session_id);
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        sessionStorage.setItem("auth_username", data.username);
        sessionStorage.setItem("role", data.role);
        // 🔁 Notify parent
        onLoginSuccess(
          data.session_id,
          data.access_token,
          data.refresh_token,
          data.username,
          data.role
        );
      }
    } catch (err) {
  console.error("Face login error:", err);
  setError(err.message || "Network error");
  stopCamera();
}
  }

  // --------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------
  useEffect(() => {
    if (!selectedRole) return;

    let mounted = true;

    startCamera()
      .then(() => mounted && startLiveness())
      .catch(() => setError("Camera access denied"));

    return () => {
      mounted = false;
      stopCamera();
    };
  }, []);

  function retry() {
    stopCamera();
    setError("");
    setInstruction("Initializing camera…");

    startCamera()
      .then(() => startLiveness())
      .catch(() => setError("Camera access denied"));
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  const camState = error ? "error" : "scanning";

  return (
    <AuthLayout>
      <div className="ln-card-head">
        <h2>Face Login</h2>
        <p>Look at the camera to verify your identity</p>
      </div>

      {!selectedRole ? (
        <p className="ln-error">Please select a role before face login</p>
      ) : (
        <>
          <div className="ln-role-chip">
            <span className="material-symbols-rounded">badge</span>
            Signing in as <b>{selectedRole.toUpperCase()}</b>
          </div>

          <div className={`ln-cam ${camState}`}>
            <div className="ln-cam-ring" />
            <div className="ln-cam-view">
              <video ref={videoRef} playsInline muted />
              {error && (
                <div className="ln-cam-overlay">
                  <span className="material-symbols-rounded">no_photography</span>
                </div>
              )}
            </div>
          </div>

          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div className={`ln-status ${camState}`} role="status">
            <span className="material-symbols-rounded">
              {error ? "error" : "center_focus_strong"}
            </span>
            <span>{error || instruction}</span>
          </div>

          {error ? (
            <button type="button" className="ln-primary" onClick={retry}>
              <span className="material-symbols-rounded">refresh</span>
              <span>Try again</span>
            </button>
          ) : (
            <ul className="ln-tips">
              <li>Keep your face centred in the circle</li>
              <li>Use good lighting and remove sunglasses</li>
              <li>Make sure only one face is visible</li>
            </ul>
          )}
        </>
      )}

      <div className="ln-footer">
        <button type="button" className="ln-link" onClick={goBack}>
          Back to sign in
        </button>
      </div>
    </AuthLayout>
  );
}
