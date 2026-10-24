import { useState, useEffect, useRef } from "react";
import AuthLayout from "./AuthLayout";
import FaceCapture from "./FaceCapture";

const API = process.env.REACT_APP_URL;

export default function Register({ goBack, setMode }) {

  /* ================= STATES ================= */
  const [step, setStep] = useState("form");
  const [signupId, setSignupId] = useState(null);

  const [form, setForm] = useState({
    username: "",
    email: "",
    mobile: "",
    password: "",
  });

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  /* ================= REFS ================= */
  const usernameRef = useRef();
  const emailRef = useRef();
  const mobileRef = useRef();
  const passwordRef = useRef();
  const otpRef = useRef();

  /* ================= VALIDATION ================= */
  const passwordRules = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(form.password),
  };

  const isPasswordValid = Object.values(passwordRules).every(Boolean);
  const isValidEmail = /^[a-zA-Z0-9._%+-]+@niruthi\.com$/.test(form.email);
  const isValidMobile = /^[0-9]{10}$/.test(form.mobile);

  /* ================= EFFECTS ================= */
  useEffect(() => {
    if (isPasswordValid) setShowPasswordRules(false);
  }, [isPasswordValid]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  /* ================= ENTER KEY FLOW ================= */
  const moveNext = (e, next) => {
    if (e.key === "Enter") {
      e.preventDefault();
      next.current.focus();
    }
  };

  /* ================= REGISTER ================= */
  async function submitRegister() {

    if (!isValidEmail) return setError("Email must end with @niruthi.com");
    if (!isValidMobile) return setError("Mobile must be 10 digits");
    if (!isPasswordValid) {
      setShowPasswordRules(true);
      return setError("Password does not meet requirements");
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/signup/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Registration failed");
        return;
      }

      setSignupId(data.signup_id);
      setResendCooldown(30);
      setStep("otp");

    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  /* ================= OTP VERIFY ================= */
  async function verifyOtp() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/signup/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signup_id: signupId,
          otp: otp.trim(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Invalid OTP");
        return;
      }

      setStep("face");

    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  /* ================= OTP RESEND ================= */
  async function resendOtp() {
    if (resendCooldown > 0) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/signup/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signup_id: signupId }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Unable to resend OTP");
        return;
      }

      setResendCooldown(30);

    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  /* ================= UI ================= */
  return (
    <AuthLayout>
      <div className="ln-card-head">
        <h2>Create your account</h2>
        <p>Register to get started with N.O.A.T.</p>
      </div>

      {/* Same tabs as login; here they are the two signup stages */}
      <div className="ln-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={step !== "face"}
          className={`ln-tab ${step !== "face" ? "active" : "done"}`}
          disabled={step === "face"}
        >
          <span className="material-symbols-rounded">
            {step === "face" ? "check_circle" : "mail"}
          </span>
          Email Register
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={step === "face"}
          className={`ln-tab ${step === "face" ? "active" : ""}`}
          disabled={step !== "face"}
          title={step !== "face" ? "Verify your email first" : undefined}
        >
          <span className="material-symbols-rounded">
            {step === "face" ? "face" : "lock"}
          </span>
          Face Register
        </button>
      </div>

      {step === "form" && (
        <>

          <form
            className="ln-form"
            onSubmit={e => {
              e.preventDefault();
              submitRegister();
            }}
          >
            <Field id="reg-username" label="Username" icon="account_circle">
              <input
                id="reg-username"
                ref={usernameRef}
                autoComplete="username"
                placeholder="Choose a username"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                onKeyDown={e => moveNext(e, emailRef)}
                disabled={loading}
              />
            </Field>

            <Field
              id="reg-email"
              label="Email"
              icon="mail"
              hint={
                !isValidEmail && form.email
                  ? "Use your company email (@niruthi.com)"
                  : ""
              }
            >
              <input
                id="reg-email"
                ref={emailRef}
                type="email"
                autoComplete="email"
                placeholder="name@niruthi.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                onKeyDown={e => moveNext(e, mobileRef)}
                disabled={loading}
              />
            </Field>

            <Field
              id="reg-mobile"
              label="Mobile"
              icon="call"
              hint={
                !isValidMobile && form.mobile
                  ? "Enter 10 digit mobile number"
                  : ""
              }
            >
              <input
                id="reg-mobile"
                ref={mobileRef}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10 digit mobile number"
                value={form.mobile}
                onChange={e => setForm({ ...form, mobile: e.target.value })}
                onKeyDown={e => moveNext(e, passwordRef)}
                disabled={loading}
              />
            </Field>

            <Field id="reg-password" label="Password" icon="lock">
              <input
                id="reg-password"
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                onFocus={() => setShowPasswordRules(true)}
                disabled={loading}
              />
              <button
                type="button"
                className="ln-eye"
                aria-label="Toggle password visibility"
                onClick={() => setShowPassword(v => !v)}
              >
                <span className="material-symbols-rounded outline-icon">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </Field>

            {showPasswordRules && (
              <div className="ln-rules">
                <Rule ok={passwordRules.length} text="Minimum 8 characters" />
                <Rule ok={passwordRules.upper} text="Uppercase letter" />
                <Rule ok={passwordRules.lower} text="Lowercase letter" />
                <Rule ok={passwordRules.number} text="Number" />
                <Rule ok={passwordRules.special} text="Special symbol" />
              </div>
            )}

            {error && <p className="ln-error">{error}</p>}

            <button type="submit" className="ln-primary" disabled={loading}>
              <span>{loading ? "Sending OTP..." : "Continue"}</span>
              {!loading && (
                <span className="material-symbols-rounded">arrow_forward</span>
              )}
            </button>
          </form>
        </>
      )}

      {step === "otp" && (
        <>
          <p className="ln-note ln-step-note">
            OTP sent to <b>{form.email}</b>
          </p>

          <form
            className="ln-form"
            onSubmit={e => {
              e.preventDefault();
              verifyOtp();
            }}
          >
            <Field id="reg-otp" label="One-time password" icon="pin">
              <input
                id="reg-otp"
                ref={otpRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit OTP"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </Field>

            {/* Countdown Bar */}
            <div className="ln-countdown">
              <div
                className="ln-countdown-fill"
                style={{ width: `${(resendCooldown / 30) * 100}%` }}
              />
            </div>

            {error && <p className="ln-error">{error}</p>}

            <button type="submit" className="ln-primary" disabled={loading}>
              <span>{loading ? "Verifying..." : "Verify OTP"}</span>
            </button>

            <button
              type="button"
              className="ln-secondary"
              disabled={resendCooldown > 0 || loading}
              onClick={resendOtp}
            >
              {resendCooldown > 0
                ? `Resend OTP in ${resendCooldown}s`
                : "Resend OTP"}
            </button>
          </form>
        </>
      )}

      {step === "face" && signupId && (
        <>
          <p className="ln-note ln-step-note">
            Email verified. Look at the camera and follow the instructions
            to finish registering.
          </p>

          <FaceCapture
            signupId={signupId}
            onSuccess={() => setMode("landing")}
            onRestartSignup={() => {
              setSignupId(null);
              setOtp("");
              setError("");
              setStep("form");
            }}
          />
        </>
      )}

      {step !== "face" && goBack && (
        <div className="ln-footer">
          <span>Already have an account? </span>
          <button type="button" className="ln-link" onClick={goBack}>
            Sign in
          </button>
        </div>
      )}
    </AuthLayout>
  );
}

/* ================= FIELD ================= */
function Field({ id, label, icon, hint, children }) {
  return (
    <div className="ln-field">
      <label htmlFor={id}>{label}</label>
      <div className="ln-input">
        <span className="material-symbols-rounded outline-icon ln-input-icon">
          {icon}
        </span>
        {children}
      </div>
      {hint && <p className="ln-hint">{hint}</p>}
    </div>
  );
}

/* ================= RULE ================= */
function Rule({ ok, text }) {
  return (
    <div className={`ln-rule ${ok ? "ok" : "bad"}`}>
      <span className="material-symbols-rounded">
        {ok ? "check_circle" : "cancel"}
      </span>
      {text}
    </div>
  );
}
