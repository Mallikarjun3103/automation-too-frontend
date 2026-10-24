import { useEffect, useState } from "react";
import Landing from "./components/Landing";

function App() {
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isManualLogout, setIsManualLogout] = useState(false);
  const [duration, setDuration] = useState("");

  useEffect(() => {
    const handleExpire = (e) => {
      setSessionExpired(true);
      if (e.detail && e.detail.duration) {
        setDuration(e.detail.duration);
      }
    };

    const handleManualLogout = (e) => {
      setIsManualLogout(true);
      if (e.detail && e.detail.duration) {
        setDuration(e.detail.duration);
      }
    };

    window.addEventListener("sessionExpired", handleExpire);
    window.addEventListener("manualLogout", handleManualLogout);

    return () => {
      window.removeEventListener("sessionExpired", handleExpire);
      window.removeEventListener("manualLogout", handleManualLogout);
    };
  }, []);

  // 🟠 Manual logout screen
  if (isManualLogout) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={{ "color": "black" }}>Logout Successful</h2>
          <p style={{"color":"black"}}>your logged in time is {duration}</p>
          <button
            style={styles.button}
            onClick={() => {
              sessionStorage.clear();
              localStorage.removeItem("access_token");
              setIsManualLogout(false);
              window.location.reload();
            }}
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  // 🔴 Session expired screen
  if (sessionExpired) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={{ "color": "black" }}>⚠ Session Expired</h2>
          <p style={{ "color": "black" }}>Your session has expired. Please login again.</p>
          {duration && (
            <p style={{ fontWeight: "bold", color: "#666" }}>
              Total login time: {duration}
            </p>
          )}

          <button
            style={styles.button}
            onClick={() => {
              setSessionExpired(false);
              window.location.reload(); // reloads app -> Landing page
            }}
          >
            Login Again
          </button>
        </div>
      </div>
    );
  }

  // 🟢 Normal app
  return <Landing />;
}

const styles = {
  container: {
    height: "100dvh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "16px",
    boxSizing: "border-box",
    background: "#f4f4f4",
    overflowY: "auto",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    boxSizing: "border-box",
    background: "#fff",
    padding: "clamp(24px, 6vw, 40px)",
    borderRadius: "12px",
    textAlign: "center",
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
  },
  button: {
    marginTop: "20px",
    padding: "10px 22px",
    fontSize: "16px",
    cursor: "pointer",
  },
};

export default App;
