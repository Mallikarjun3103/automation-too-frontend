import { useState, useEffect, useRef } from "react";
import "./../styles/emaillogin.css";

const API = process.env.REACT_APP_URL;

export default function EmailLogin({
  goBack,
  onSuccess,
  selectedRole,
  initialStep = "login",
}) {
  const [step, setStep] = useState(initialStep);

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [resetId, setResetId] = useState(null);
  const [resetToken, setResetToken] = useState(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const otpRef = useRef(null);
  const forgotEmailRef = useRef(null);
  const newPassRef = useRef(null);
  const confirmPassRef = useRef(null);

  /* ================= UX HELPERS ================= */

  useEffect(() => {
    setError("");
  }, [usernameOrEmail, password, otp, newPassword, confirmPassword]);

  async function post(url, body) {
    const res = await fetch(`${API}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  /* ================= LOGIN ================= */

  const login = async () => {
    if (!selectedRole) {
      setError("Please select a role before login");
      return;
    }

    if (!usernameOrEmail || !password) {
      setError("Enter email/username and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await post(`/login/start`, {
        username_or_email: usernameOrEmail,
        password,
        role: selectedRole,
      });

      if (!result.success) {
        setError(result.error || "Invalid credentials");
        return;
      }

      setEmail(result.session.email);
      setStep("login_otp");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginOtp = async () => {
    if (!otp) {
      setError("Enter OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await post(`/login/verify`, { email, otp });

      if (!result.success) {
        setError(result.error || "OTP verification failed");
        return;
      }

      sessionStorage.setItem("session_id", result.session_id);
      sessionStorage.setItem("auth_username", result.username);
      localStorage.setItem("access_token", result.access_token);
      localStorage.setItem("refresh_token", result.refresh_token);
      sessionStorage.setItem("role", result.role);

      // 🔁 Notify parent
      onSuccess(
        result.access_token,
        result.refresh_token,
        result.session_id,
        result.username,
        result.role
      );

    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  /* ================= FORGOT PASSWORD ================= */

  const startForgot = async () => {
    if (!email) {
      setError("Enter registered email");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await post(`/forgot-password/start`, { email });

      if (!result.success) {
        setError("If this email exists, an OTP will be sent");
        return;
      }

      setResetId(result.reset_id);
      setStep("forgot_otp");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const verifyForgotOtp = async () => {
    if (!otp) {
      setError("Enter OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await post(`/forgot-password/verify`, {
        reset_id: resetId,
        otp,
      });

      if (!result.success) {
        setError("Invalid or expired OTP");
        return;
      }

      setResetToken(result.token);
      setStep("forgot_reset");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError("Enter password");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await post(`/forgot-password/reset`, {
        reset_id: resetId,
        token: resetToken,
        new_password: newPassword,
      });

      if (!result.success) {
        setError("Failed to reset password");
        return;
      }

      setStep("login");
      setOtp("");
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setResetId(null);
      setResetToken(null);
      setError("Password reset successful. Please login.");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };
  
  /* ================= UI ================= */

  return (
    <div className="emailLoginWrapper">

      {error && <p className="errorText">{error}</p>}

      {step === "login" && (
        <>
          <h2>Email Login</h2>

          <input
            ref={usernameRef}
            className="inputBox"
            placeholder="Email or Username"
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                passwordRef.current?.focus();
              }
            }}
            disabled={loading}
          />

          <input
            ref={passwordRef}
            className="inputBox"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                login();
              }
            }}
            disabled={loading}
          />

          <button
            className="nextBtn"
            onClick={login}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <p
            className="linkText"
            onClick={() => {
              setStep("forgot_email");
              setEmail("");
              setError("");
            }}
          >
            Forgot password?
          </p>
        </>
      )}

      {step === "login_otp" && (
        <>
          <h2>Enter OTP</h2>
          <p>OTP sent to <b>{email}</b></p>

          <input
            ref={otpRef}
            className="inputBox"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                verifyLoginOtp();
              }
            }}
            maxLength={6}
            disabled={loading}
          />

          <button
            className="nextBtn"
            onClick={verifyLoginOtp}
            disabled={loading}
          >
            Verify OTP
          </button>
        </>
      )}

      {step === "forgot_email" && (
        <>
          <h2>Forgot Password</h2>

          <input
            ref={forgotEmailRef}
            className="inputBox"
            placeholder="Registered Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                startForgot();
              }
            }}
            disabled={loading}
          />

          <button
            className="nextBtn"
            onClick={startForgot}
            disabled={loading}
          >
            Send OTP
          </button>
        </>
      )}

      {step === "forgot_otp" && (
        <>
          <h2>Verify OTP</h2>

          <input
            ref={otpRef}
            className="inputBox"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                verifyForgotOtp();
              }
            }}
            maxLength={6}
            disabled={loading}
          />

          <button
            className="nextBtn"
            onClick={verifyForgotOtp}
            disabled={loading}
          >
            Verify OTP
          </button>
        </>
      )}

      {step === "forgot_reset" && (
        <>
          <h2>Reset Password</h2>

          <input
            ref={newPassRef}
            className="inputBox"
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmPassRef.current?.focus();
              }
            }}
            disabled={loading}
          />

          <input
            ref={confirmPassRef}
            className="inputBox"
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                resetPassword();
              }
            }}
            disabled={loading}
          />

          <button
            className="nextBtn"
            onClick={resetPassword}
            disabled={loading}
          >
            Reset Password
          </button>
        </>
      )}

      {goBack && (
        <p className="linkText" onClick={goBack}>
          Back to sign in
        </p>
      )}
    </div>
  );
}
