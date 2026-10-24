import { useState, useEffect } from "react";

import AuthLayout from "./AuthLayout";
import FaceFlow from "./FaceFlow";
import Dashboard from "./Dashboard";
import EmailLogin from "./EmailLogin";
import ForgotPassword from "./ForgotPassword";
import Register from "./Register";
import FaceCapture from "./FaceCapture";

const API = process.env.REACT_APP_URL;
const REMEMBER_KEY = "noat_remember_username";

const ROLES = [
  { value: "employee", label: "Employee" },
  { value: "hr", label: "HR" },
  { value: "admin", label: "Admin" },
  { value: "superadmin", label: "Super Admin" },
];

export default function Landing() {
  const [mode, setMode] = useState(() =>
    sessionStorage.getItem("session_id") &&
    localStorage.getItem("access_token")
      ? "dashboard"
      : "landing"
  );

  const [selectedRole, setSelectedRole] = useState("");
  const [registerEmail, setRegisterEmail] = useState(null);

  const [tab, setTab] = useState("email");
  const [step, setStep] = useState("login");
  const [username, setUsername] = useState(
    () => localStorage.getItem(REMEMBER_KEY) || ""
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(
    () => !!localStorage.getItem(REMEMBER_KEY)
  );
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sid = sessionStorage.getItem("session_id");
    const token = localStorage.getItem("access_token");

    if (sid && token && mode !== "dashboard") {
      setMode("dashboard");
    }
  }, [mode]);

  useEffect(() => {
    setError("");
  }, [username, password, otp, selectedRole, tab]);

  async function post(url, body) {
    const res = await fetch(`${API}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  /* ================= EMAIL LOGIN ================= */

  const login = async () => {
    if (!selectedRole) {
      setError("Please select a role before login");
      return;
    }

    if (!username || !password) {
      setError("Enter email/username and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await post(`/login/start`, {
        username_or_email: username,
        password,
        role: selectedRole,
      });

      if (!result.success) {
        setError(result.error || "Invalid credentials");
        return;
      }

      if (remember) {
        localStorage.setItem(REMEMBER_KEY, username);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      setOtpEmail(result.session.email);
      setStep("otp");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp) {
      setError("Enter OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await post(`/login/verify`, { email: otpEmail, otp });

      if (!result.success) {
        setError(result.error || "OTP verification failed");
        return;
      }

      sessionStorage.setItem("session_id", result.session_id);
      sessionStorage.setItem("auth_username", result.username);
      localStorage.setItem("access_token", result.access_token);
      localStorage.setItem("refresh_token", result.refresh_token);
      sessionStorage.setItem("role", result.role);

      setMode("dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const resetCard = () => {
    setStep("login");
    setPassword("");
    setOtp("");
    setError("");
  };

  /* ================= MAIN SWITCH ================= */

  switch (mode) {
    case "face-login":
      return (
        <FaceFlow
          goBack={() => setMode("landing")}
          selectedRole={selectedRole}
          onLoginSuccess={() => {
            setMode("dashboard");
          }}
        />
      );

    case "face-capture":
      return (
        <FaceCapture
          signupId={registerEmail}
          onSuccess={(sid) => {
            sessionStorage.setItem("session_id", sid);
            setMode("dashboard");
          }}
        />
      );

    case "forgot-password":
      return (
        <ForgotPassword
          goBack={() => setMode("landing")}
          onDone={() => setMode("landing")}
        />
      );

    case "register":
      return (
        <Register
          goBack={() => setMode("landing")}
          setMode={setMode}
          setRegisterEmail={setRegisterEmail}
        />
      );

    case "dashboard":
      return (
        <Dashboard
          goBack={() => {
            sessionStorage.clear();
            localStorage.removeItem("access_token");
            resetCard();
            setMode("landing");
          }}
        />
      );

    default:
      break;
  }

  /* ================= LANDING UI ================= */

  return (
    <AuthLayout>
      <div className="ln-card-head">
        <h2>Welcome to N.O.A.T.</h2>
        <p>Sign in to access your workspace</p>
      </div>

      <div className="ln-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "email"}
          className={`ln-tab ${tab === "email" ? "active" : ""}`}
          onClick={() => setTab("email")}
        >
          <span className="material-symbols-rounded">mail</span>
          Email Login
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "face"}
          className={`ln-tab ${tab === "face" ? "active" : ""}`}
          onClick={() => setTab("face")}
        >
          <span className="material-symbols-rounded">face</span>
          Face Login
        </button>
      </div>

      {/* Role is required by both login flows */}
      {step === "login" && (
        <div className="ln-field">
          <label htmlFor="ln-role">Login as</label>
          <div className="ln-input">
            <span className="material-symbols-rounded outline-icon ln-input-icon">
              badge
            </span>
            <select
              id="ln-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={loading}
            >
              <option value="">Select role</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && <p className="ln-error">{error}</p>}

      {tab === "email" && step === "login" && (
        <form
          className="ln-form"
          onSubmit={(e) => {
            e.preventDefault();
            login();
          }}
        >
          <div className="ln-field">
            <label htmlFor="ln-username">Username</label>
            <div className="ln-input">
              <span className="material-symbols-rounded outline-icon ln-input-icon">
                account_circle
              </span>
              <input
                id="ln-username"
                type="text"
                autoComplete="username"
                placeholder="Email or username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="ln-field">
            <label htmlFor="ln-password">Password</label>
            <div className="ln-input">
              <span className="material-symbols-rounded outline-icon ln-input-icon">
                lock
              </span>
              <input
                id="ln-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
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

          <div className="ln-row">
            <label className="ln-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              className="ln-link"
              onClick={() => setMode("forgot-password")}
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" className="ln-primary" disabled={loading}>
            <span>{loading ? "Signing in..." : "Sign In"}</span>
            {!loading && (
              <span className="material-symbols-rounded">
                arrow_forward
              </span>
            )}
          </button>
        </form>
      )}

      {tab === "email" && step === "otp" && (
        <form
          className="ln-form"
          onSubmit={(e) => {
            e.preventDefault();
            verifyOtp();
          }}
        >
          <p className="ln-note">
            OTP sent to <b>{otpEmail}</b>
          </p>
          <div className="ln-field">
            <label htmlFor="ln-otp">One-time password</label>
            <div className="ln-input">
              <span className="material-symbols-rounded outline-icon ln-input-icon">
                pin
              </span>
              <input
                id="ln-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit OTP"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          <button type="submit" className="ln-primary" disabled={loading}>
            <span>{loading ? "Verifying..." : "Verify OTP"}</span>
          </button>
          <button type="button" className="ln-link ln-back" onClick={resetCard}>
            Back to sign in
          </button>
        </form>
      )}

      {tab === "face" && (
        <div className="ln-form">
          <p className="ln-note">
            Verify your identity using your device camera.
          </p>
          <button
            type="button"
            className="ln-primary"
            onClick={() => {
              if (!selectedRole) {
                setError("Please select a role before login");
                return;
              }
              setMode("face-login");
            }}
          >
            <span className="material-symbols-rounded">face</span>
            <span>Continue with Face Login</span>
          </button>
        </div>
      )}

      <div className="ln-footer">
        <span>New to N.O.A.T.? </span>
        <button
          type="button"
          className="ln-link"
          onClick={() => setMode("register")}
        >
          Register now
        </button>
      </div>
    </AuthLayout>
  );
}
