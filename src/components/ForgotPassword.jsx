import { useState, useEffect, useRef } from "react";
import AuthLayout from "./AuthLayout";

const API = process.env.REACT_APP_URL;

export default function ForgotPassword({ goBack, onDone }) {
  const [stage, setStage] = useState("email"); // email | otp | reset | done

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [resetId, setResetId] = useState(null);
  const [token, setToken] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    setError("");
  }, [email, otp, password, confirm]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function post(url, body) {
    const res = await fetch(`${API}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  /* ================= 1. SEND OTP ================= */
  async function handleSendOtp(e) {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your registered email");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await post("/forgot-password/start", { email: cleanEmail });

      if (!data.success) {
        setError(data.error || "If this email exists, an OTP will be sent");
        return;
      }

      setResetId(data.reset_id);
      setStage("otp");
      setResendCooldown(30);
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ================= 2. VERIFY OTP ================= */
  async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      setError("Please enter the 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await post("/forgot-password/verify", {
        reset_id: resetId,
        otp: cleanOtp,
      });

      if (!data.success) {
        setError(data.error || "Invalid or expired OTP");
        return;
      }

      setToken(data.token);
      setStage("reset");
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ================= 3. RESET PASSWORD ================= */
  async function handleResetPassword(e) {
    if (e) e.preventDefault();

    if (!password) {
      setError("Please enter a new password");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!confirm) {
      setError("Please confirm your new password");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await post("/forgot-password/reset", {
        reset_id: resetId,
        token,
        new_password: password,
      });

      if (!data.success) {
        setError(data.error || "Failed to reset password. Please try again.");
        return;
      }

      setStage("done");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      {/* ================= STEP 1: ENTER EMAIL ================= */}
      {stage === "email" && (
        <>
          <div className="ln-card-head">
            <h2>Forgot Password?</h2>
            <p>Enter your registered email and we'll send you a verification code</p>
          </div>

          {error && <p className="ln-error">{error}</p>}

          <form className="ln-form" onSubmit={handleSendOtp}>
            <div className="ln-field">
              <label htmlFor="fp-email">Email Address</label>
              <div className="ln-input">
                <span className="material-symbols-rounded outline-icon ln-input-icon">
                  mail
                </span>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@niruthi.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" className="ln-primary" disabled={loading}>
              <span>{loading ? "Sending OTP..." : "Send Verification Code"}</span>
              {!loading && (
                <span className="material-symbols-rounded">arrow_forward</span>
              )}
            </button>

            <button
              type="button"
              className="ln-link ln-back"
              onClick={goBack}
              disabled={loading}
            >
              <span className="material-symbols-rounded">arrow_back</span>
              Back to sign in
            </button>
          </form>
        </>
      )}

      {/* ================= STEP 2: VERIFY OTP ================= */}
      {stage === "otp" && (
        <>
          <div className="ln-card-head">
            <h2>Verify Code</h2>
            <p>
              We've sent a 6-digit verification code to <b>{email}</b>
            </p>
          </div>

          {error && <p className="ln-error">{error}</p>}

          <form className="ln-form" onSubmit={handleVerifyOtp}>
            <div className="ln-field">
              <label htmlFor="fp-otp">6-Digit Code</label>
              <div className="ln-input">
                <span className="material-symbols-rounded outline-icon ln-input-icon">
                  pin
                </span>
                <input
                  ref={otpInputRef}
                  id="fp-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div className="ln-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="ln-link"
                disabled={resendCooldown > 0 || loading}
                onClick={handleSendOtp}
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend code"}
              </button>

              <button
                type="button"
                className="ln-link"
                onClick={() => {
                  setStage("email");
                  setOtp("");
                  setError("");
                }}
              >
                Change email
              </button>
            </div>

            <button type="submit" className="ln-primary" disabled={loading}>
              <span>{loading ? "Verifying..." : "Verify & Continue"}</span>
              {!loading && (
                <span className="material-symbols-rounded">arrow_forward</span>
              )}
            </button>

            <button
              type="button"
              className="ln-link ln-back"
              onClick={goBack}
              disabled={loading}
            >
              <span className="material-symbols-rounded">arrow_back</span>
              Back to sign in
            </button>
          </form>
        </>
      )}

      {/* ================= STEP 3: NEW PASSWORD ================= */}
      {stage === "reset" && (
        <>
          <div className="ln-card-head">
            <h2>Set New Password</h2>
            <p>Create a strong new password for your account</p>
          </div>

          {error && <p className="ln-error">{error}</p>}

          <form className="ln-form" onSubmit={handleResetPassword}>
            <div className="ln-field">
              <label htmlFor="fp-new-password">New Password</label>
              <div className="ln-input">
                <span className="material-symbols-rounded outline-icon ln-input-icon">
                  lock
                </span>
                <input
                  ref={passwordInputRef}
                  id="fp-new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  className="ln-eye"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <span className="material-symbols-rounded outline-icon">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <div className="ln-field">
              <label htmlFor="fp-confirm-password">Confirm New Password</label>
              <div className="ln-input">
                <span className="material-symbols-rounded outline-icon ln-input-icon">
                  lock
                </span>
                <input
                  id="fp-confirm-password"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="ln-eye"
                  aria-label="Toggle confirm password visibility"
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  <span className="material-symbols-rounded outline-icon">
                    {showConfirm ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <button type="submit" className="ln-primary" disabled={loading}>
              <span>{loading ? "Updating password..." : "Update Password"}</span>
              {!loading && (
                <span className="material-symbols-rounded">check</span>
              )}
            </button>

            <button
              type="button"
              className="ln-link ln-back"
              onClick={goBack}
              disabled={loading}
            >
              <span className="material-symbols-rounded">arrow_back</span>
              Back to sign in
            </button>
          </form>
        </>
      )}

      {/* ================= STEP 4: SUCCESS ================= */}
      {stage === "done" && (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "#e8faf0",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: "36px" }}>
              check_circle
            </span>
          </div>

          <div className="ln-card-head" style={{ marginBottom: "24px" }}>
            <h2>Password Updated!</h2>
            <p>Your password has been reset successfully. You can now sign in with your new credentials.</p>
          </div>

          <button
            type="button"
            className="ln-primary"
            onClick={() => {
              if (onDone) onDone();
              else if (goBack) goBack();
            }}
          >
            <span>Proceed to Sign In</span>
            <span className="material-symbols-rounded">arrow_forward</span>
          </button>
        </div>
      )}
    </AuthLayout>
  );
}
