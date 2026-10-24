import { useEffect, useRef, useState } from "react";

const API = process.env.REACT_APP_URL;
const MAX_ATTEMPTS = 2;
const ATTEMPT_TIMEOUT_MS = 7000;

export default function FaceCapture({ signupId, onSuccess, onRestartSignup }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const activeRef = useRef(true);
  const doneRef = useRef(false);
  const attemptTimerRef = useRef(null);

  const [instruction, setInstruction] = useState(
    "Align your face inside the frame…"
  );
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [waitingRetry, setWaitingRetry] = useState(false);
  const [verified, setVerified] = useState(false);

  /* ================= CAMERA START ================= */
  async function startCamera() {
    if (!signupId) {
      setError("Signup session missing");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;


      await new Promise(resolve => (video.onloadedmetadata = resolve));
      await video.play();

      startAttempt();
    } catch (err) {
      console.error("Camera permission denied:", err);
      setError("Camera permission denied");
    }
  }

  /* ================= CAMERA STOP ================= */
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  /* ================= ATTEMPT CONTROL ================= */
  function startAttempt() {
    if (doneRef.current) return;

    setInstruction("Capturing face…");
    setError("");
    setWaitingRetry(false);

    // ⏱ 7-second attempt window
    attemptTimerRef.current = setTimeout(() => {
      handleAttemptTimeout();
    }, ATTEMPT_TIMEOUT_MS);

    captureAndSend();
  }

  function handleAttemptTimeout() {
    if (doneRef.current) return;

    setAttempts(prev => {
      const next = prev + 1;

      if (next >= MAX_ATTEMPTS) {
        doneRef.current = true;
        stopCamera();
        setError("Face verification failed. Please restart signup.");
      } else {
        setInstruction("No valid face detected");
        setWaitingRetry(true);
      }
      return next;
    });
  }

  /* ================= CAPTURE + SEND ================= */
  async function captureAndSend() {
    if (doneRef.current || !activeRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;


    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setTimeout(captureAndSend, 400);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    const image = canvas.toDataURL("image/jpeg", 0.9);
    if (!image || image.length < 100) {
      setTimeout(captureAndSend, 400);
      return;
    }

    try {
      const res = await fetch(`${API}/signup/face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signup_id: signupId, image }),
      });

      const data = await res.json();
      console.log("FACE RESPONSE:", data);

      if (data.status === "completed") {
        doneRef.current = true;
        clearTimeout(attemptTimerRef.current);
        stopCamera();
        setVerified(true);
        setInstruction("Face verified");
        setTimeout(() => onSuccess(signupId), 300);
        return;
      }

      // Live backend feedback
      setInstruction(
        data.message ||
          "Adjust your face (center, good lighting, single face)"
      );

      // keep retrying inside the SAME attempt window
      setTimeout(captureAndSend, 800);
    } catch (err) {
      console.error("Face capture error:", err);
      setError("Network error");
    }
  }

  /* ================= LIFECYCLE ================= */
  useEffect(() => {
    activeRef.current = true;
    startCamera();

    return () => {
      activeRef.current = false;
      clearTimeout(attemptTimerRef.current);
      stopCamera();
    };
  }, [signupId]);

  /* ================= UI ================= */
  const failed = doneRef.current && !verified;
  const camState = verified
    ? "success"
    : error || failed
    ? "error"
    : waitingRetry
    ? "idle"
    : "scanning";

  const statusIcon = {
    success: "check_circle",
    error: "error",
    idle: "warning",
    scanning: "center_focus_strong",
  }[camState];

  return (
    <div className="ln-face">
      <div className={`ln-cam ${camState}`}>
        <div className="ln-cam-ring" />
        <div className="ln-cam-view">
          {!doneRef.current && <video ref={videoRef} playsInline muted />}
          {doneRef.current && (
            <div className="ln-cam-overlay">
              <span className="material-symbols-rounded">
                {verified ? "verified_user" : "no_photography"}
              </span>
            </div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className={`ln-status ${camState}`} role="status">
        <span className="material-symbols-rounded">{statusIcon}</span>
        <span>{error || instruction}</span>
      </div>

      {!verified && (
        <p className="ln-attempts">
          Attempt {Math.min(attempts + 1, MAX_ATTEMPTS)} of {MAX_ATTEMPTS}
        </p>
      )}

      {waitingRetry && !doneRef.current && (
        <button type="button" className="ln-primary" onClick={startAttempt}>
          <span className="material-symbols-rounded">refresh</span>
          <span>Retry</span>
        </button>
      )}

      {failed && attempts >= MAX_ATTEMPTS && onRestartSignup && (
        <button type="button" className="ln-secondary" onClick={onRestartSignup}>
          Restart Signup
        </button>
      )}
    </div>
  );
}
