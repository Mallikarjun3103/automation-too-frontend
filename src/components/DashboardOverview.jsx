import { useEffect, useState } from "react";
import { authFetch } from "./authFetch";

const API = process.env.REACT_APP_URL;

/* Tools whose sessions show up in Recent Activity */
const ACTIVITY_TOOLS = [
  { tool: "Email", text: "Email Assistant session", icon: "mail", color: "#2563eb" },
  { tool: "Jira", text: "Ticket Generator session", icon: "campaign", color: "#7c3aed" },
  { tool: "Policies", text: "Policy Assistant question", icon: "article", color: "#059669" },
];

/*
 * Services the brief asks about. `url` + `isUp` = a real health check;
 * no `url` = the backend has no health endpoint for it yet.
 */
const SERVICES = [
  { name: "Email Service", icon: "mail" },
  { name: "Ticketing System", icon: "confirmation_number" },
  {
    name: "Document Service",
    icon: "description",
    url: "/autofill/files",
    isUp: (res, data) => res.ok && Array.isArray(data?.filenames),
  },
  { name: "Policy Service", icon: "policy" },
];

const ROLE_LABELS = {
  employee: "Employee",
  hr: "HR",
  admin: "Admin",
  superadmin: "Super Admin",
};

function timeAgo(value) {
  const date = value ? new Date(value) : null;
  if (!date || isNaN(date)) return "";
  const seconds = Math.round((date - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const steps = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

function NotConnected({ text }) {
  return (
    <div className="ov-nc">
      <span className="material-symbols-rounded">link_off</span>
      <div>
        <strong>Not connected yet</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

export default function DashboardOverview({ isAdmin, firstName, longDate }) {
  const [users, setUsers] = useState(null); // null = loading/unavailable
  const [docCount, setDocCount] = useState(null);
  const [activity, setActivity] = useState(null);
  const [status, setStatus] = useState({});

  /* ---------- key stats ---------- */
  useEffect(() => {
    if (isAdmin) {
      authFetch(`${API}/admin/users`)
        .then(res => (res && res.ok ? res.json() : null))
        .then(data => setUsers(data?.users || []))
        .catch(() => setUsers([]));
    }

    authFetch(`${API}/autofill/files`)
      .then(res => (res && res.ok ? res.json() : null))
      .then(data => setDocCount(data?.filenames ? data.filenames.length : -1))
      .catch(() => setDocCount(-1));
  }, [isAdmin]);

  /* ---------- recent activity (this user's tool sessions) ---------- */
  useEffect(() => {
    const sessionId = sessionStorage.getItem("session_id");
    if (!sessionId) {
      setActivity([]);
      return;
    }

    Promise.all(
      ACTIVITY_TOOLS.map(item =>
        authFetch(`${API}/tool-sessions/recent?tool=${item.tool}`, {
          headers: { "X-Session-Id": sessionId },
        })
          .then(res => (res && res.ok ? res.json() : null))
          .then(data =>
            (data?.success ? data.sessions || [] : []).map(s => ({
              ...item,
              id: `${item.tool}-${s.id}`,
              title: s.title || "Untitled session",
              time: s.updated_at || s.created_at || s.last_active || null,
            }))
          )
          .catch(() => [])
      )
    ).then(lists => {
      const merged = lists.flat();
      merged.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
      setActivity(merged.slice(0, 6));
    });
  }, []);

  /* ---------- system status (live checks) ---------- */
  useEffect(() => {
    SERVICES.filter(s => s.url).forEach(service => {
      const started = performance.now();
      fetch(`${API}${service.url}`)
        .then(async res => {
          const data = await res.json().catch(() => null);
          const ms = Math.round(performance.now() - started);
          setStatus(prev => ({
            ...prev,
            [service.name]: { up: service.isUp(res, data), ms },
          }));
        })
        .catch(() =>
          setStatus(prev => ({ ...prev, [service.name]: { up: false } }))
        );
    });
  }, []);

  /* ---------- derived ---------- */
  const roleCounts = (users || []).reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});
  const maxRoleCount = Math.max(1, ...Object.values(roleCounts));

  const stats = [
    {
      label: "Total Users",
      icon: "group",
      color: "#0060c0",
      value: !isAdmin ? "—" : users === null ? "…" : users.length,
      note: !isAdmin ? "Visible to admins" : "Registered accounts",
    },
    {
      label: "Total Documents",
      icon: "description",
      color: "#7c3aed",
      value: docCount === null ? "…" : docCount < 0 ? "—" : docCount,
      note: docCount < 0 ? "Unavailable" : "Document templates",
    },
    { label: "Open Tickets", icon: "confirmation_number", color: "#ea580c", value: "—", note: "Not connected yet", nc: true },
    { label: "Company Policies", icon: "policy", color: "#059669", value: "—", note: "Not connected yet", nc: true },
  ];

  return (
    <>
      {/* 1. Welcome */}
      <section className="dw-hero">
        <div className="dw-hero-text">
          <p className="dw-date">{longDate}</p>
          <h1>
            Welcome back,
            <br />
            <span>{firstName}</span>
          </h1>
          <p className="dw-hero-sub">
            Here's an overview of your N.O.A.T workspace: key numbers, recent
            activity and the health of the services you rely on.
          </p>
        </div>
        <div className="dw-hero-art" aria-hidden="true">
          <span className="dw-art-blob" />
          <span className="dw-art-ring" />
          <span className="dw-art-center">
            <span className="material-symbols-rounded">monitoring</span>
          </span>
          {[
            ["mail", "#2563eb"],
            ["groups", "#0084f0"],
            ["settings", "#0060c0"],
            ["cloud", "#00a8f0"],
            ["bar_chart", "#7c3aed"],
            ["description", "#059669"],
          ].map(([icon, color], i) => (
            <span key={icon} className={`dw-art-tile dw-art-tile-${i + 1}`} style={{ "--c": color }}>
              <span className="material-symbols-rounded">{icon}</span>
            </span>
          ))}
        </div>
      </section>

      {/* 2. Key statistics */}
      <section className="ov-stats">
        {stats.map(stat => (
          <div
            key={stat.label}
            className={`dw-card ov-stat ${stat.nc ? "is-nc" : ""}`}
            style={{ "--c": stat.color }}
          >
            <span className="ov-stat-icon">
              <span className="material-symbols-rounded">{stat.icon}</span>
            </span>
            <div className="ov-stat-text">
              <span className="ov-stat-label">{stat.label}</span>
              <span className="ov-stat-value">{stat.value}</span>
              <span className="ov-stat-note">
                {stat.nc && <span className="material-symbols-rounded">link_off</span>}
                {stat.note}
              </span>
            </div>
          </div>
        ))}
      </section>

      <div className="ov-grid">
        {/* 3. Recent activity */}
        <section className="dw-card ov-card">
          <header className="ov-card-head">
            <h2>Recent Activity</h2>
            <span className="ov-card-sub">Your latest tool sessions</span>
          </header>

          {activity === null ? (
            <p className="ov-muted">Loading activity…</p>
          ) : activity.length === 0 ? (
            <div className="ov-empty">
              <span className="material-symbols-rounded">history</span>
              <p>No recent activity yet. Sessions you start in Email, Ticket or Policy tools will appear here.</p>
            </div>
          ) : (
            <ul className="ov-activity">
              {activity.map(item => (
                <li key={item.id} style={{ "--c": item.color }}>
                  <span className="ov-activity-icon">
                    <span className="material-symbols-rounded">{item.icon}</span>
                  </span>
                  <div className="ov-activity-text">
                    <strong>{item.text}</strong>
                    <span>{item.title}</span>
                  </div>
                  {item.time && <time className="ov-activity-time">{timeAgo(item.time)}</time>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4. System status */}
        <section className="dw-card ov-card">
          <header className="ov-card-head">
            <h2>System Status</h2>
            <span className="ov-card-sub">Live checks</span>
          </header>

          <ul className="ov-status">
            {SERVICES.map(service => {
              const st = status[service.name];
              const state = !service.url ? "na" : !st ? "checking" : st.up ? "up" : "down";
              const label = {
                na: "Not monitored",
                checking: "Checking…",
                up: "Operational",
                down: "Unavailable",
              }[state];
              return (
                <li key={service.name}>
                  <span className="ov-status-icon">
                    <span className="material-symbols-rounded">{service.icon}</span>
                  </span>
                  <span className="ov-status-name">{service.name}</span>
                  {state === "up" && st.ms != null && (
                    <span className="ov-status-ms">{st.ms} ms</span>
                  )}
                  <span className={`ov-pill ${state}`}>
                    <span className="ov-dot" />
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 5. Usage overview */}
        <section className="dw-card ov-card">
          <header className="ov-card-head">
            <h2>Usage Overview</h2>
            <span className="ov-card-sub">Last 30 days</span>
          </header>

          <div className="ov-legend">
            <span style={{ "--c": "#7c3aed" }}>Documents</span>
            <span style={{ "--c": "#ea580c" }}>Tickets</span>
            <span style={{ "--c": "#0060c0" }}>Users activity</span>
          </div>

          <div className="ov-chart-ghost" aria-hidden="true">
            {[38, 52, 44, 63, 58, 72, 66, 80, 70, 86, 78, 92].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
            <NotConnected text="The backend has no usage history endpoint yet." />
          </div>
        </section>

        {/* 6. Quick insights */}
        <section className="dw-card ov-card">
          <header className="ov-card-head">
            <h2>Quick Insights</h2>
          </header>

          <div className="ov-insight">
            <div className="ov-insight-head">
              <span className="material-symbols-rounded">group</span>
              <strong>Team by role</strong>
            </div>
            {!isAdmin ? (
              <p className="ov-muted">Visible to admins.</p>
            ) : users === null ? (
              <p className="ov-muted">Loading…</p>
            ) : (
              <div className="ov-bars">
                {Object.entries(roleCounts).map(([r, count]) => (
                  <div key={r} className="ov-bar-row">
                    <span>{ROLE_LABELS[r] || r}</span>
                    <span className="ov-bar">
                      <span style={{ width: `${(count / maxRoleCount) * 100}%` }} />
                    </span>
                    <b>{count}</b>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ov-insight">
            <div className="ov-insight-head">
              <span className="material-symbols-rounded">description</span>
              <strong>Document activity</strong>
            </div>
            <NotConnected text="Needs document upload history." />
          </div>

          <div className="ov-insight">
            <div className="ov-insight-head">
              <span className="material-symbols-rounded">task_alt</span>
              <strong>Ticket resolution</strong>
            </div>
            <NotConnected text="Needs ticket status data." />
          </div>
        </section>
      </div>
    </>
  );
}
