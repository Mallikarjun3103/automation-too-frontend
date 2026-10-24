import { useState, useEffect, useRef } from "react";
import "./../styles/dashboard.css";
import "./../styles/toolchat.css";
import { authFetch } from "./authFetch";

import noatLogo from "./../assets/noat-logo.png";

import Admin from "./Admin";
import EmailAssistant from "./EmailAssistant";
import JiraTicketGenerator from "./JiraTicket";
import OnBoard from "./OnBoard";
import EmailSignature from "./EmailSignature";
import Documents from "./Documents";
import FileSharingSystem from "./Chatbot";
import Ctc from "./Ctc";
import DashboardOverview from "./DashboardOverview";

const API = process.env.REACT_APP_URL;

export default function Dashboard({ goBack }) {
  const [active, setActive] = useState("overview");
  const [view, setView] = useState("home");
  const [sessions, setSessions] = useState([]);
  const [role] = useState(sessionStorage.getItem("role"));

  const [activeSessionId, setActiveSessionId] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false); // History sheet on small screens

  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);

  const chatbotRef = useRef(null);
  const [chatbotOpen] = useState(true);
  const currentUser = sessionStorage.getItem("auth_username");
  const token = localStorage.getItem("access_token");

  const isAdmin = role === "admin" || role === "superadmin";
  const isHr = role === "hr" || role === "superadmin";

  /* ================= TOOL DEFINITIONS ================= */
  const TOOLS = [
    { key: "Documents", label: "Documents", icon: "description", color: "#2563eb", desc: "Generate and manage HR documents", roles: ["hr"] },
    { key: "CTC", label: "CTC Calculator", icon: "calculate", color: "#059669", desc: "Work out salary and CTC breakdowns", roles: ["hr"] },
    { key: "Email", label: "Email Assistant", icon: "mail", color: "#2563eb", desc: "Draft and send emails with AI help", roles: ["employee"] },
    { key: "Jira", label: "Ticket Generator", icon: "campaign", color: "#7c3aed", desc: "Raise tickets from a short description", roles: ["employee"] },
    { key: "Policies", label: "Policy Assistant", icon: "article", color: "#059669", desc: "Ask questions about company policies", roles: ["employee"] },
    { key: "Chatbot", label: "File Sharing", icon: "folder_shared", color: "#ea580c", desc: "Share files with your colleagues", roles: ["employee"] },
    { key: "Signature", label: "Email Signature", icon: "draw", color: "#db2777", desc: "Create your official email signature", roles: ["employee"] },
    { key: "Admin", label: "Admin Panel", icon: "admin_panel_settings", color: "#7c3aed", desc: "Manage users and their roles", roles: ["admin"] },
  ];

  const TOOL_GROUPS = [
    { role: "employee", title: "Everyday Tools" },
    { role: "hr", title: "HR Tools" },
    { role: "admin", title: "Administration" },
  ];

  // Sidebar wording where it differs from the tool's own name
  const NAV_LABELS = { Admin: "Users & Roles" };

  const ROLE_ACCESS = {
    employee: ["employee"],
    hr: ["employee", "hr"],
    admin: ["employee", "admin"],
    superadmin: ["employee", "hr", "admin"],
  };

  const allowedRoles = ROLE_ACCESS[role] || [];
  const visibleTools = TOOLS.filter(tool =>
    tool.roles.some(r => allowedRoles.includes(r))
  );

  useEffect(() => {
    if (!token) {
      sessionStorage.clear();
      goBack();
    }
  }, []);

  /* ================= SESSION MANAGEMENT ================= */
  const fetchSessions = async (toolKey = active) => {
    if (!["Email", "Jira", "Policies"].includes(toolKey)) {
      setSessions([]);
      return;
    }
    const sessionId = sessionStorage.getItem("session_id");
    if (!sessionId) return;
    try {
      const res = await authFetch(`${API}/tool-sessions/recent?tool=${toolKey}`, {
        headers: {
          "X-Session-Id": sessionId,
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    }
  };

  async function createNewChat(force = true) {
    const sessionId = sessionStorage.getItem("session_id");
    if (!sessionId || !["Email", "Jira", "Policies"].includes(active)) return;

    try {
      const res = await authFetch(`${API}/tool-sessions/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sessionId,
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ tool: active, force_new: force })
      });
      const data = await res.json();
      if (data.success && data.bot_session_id) {
        setActiveSessionId(data.bot_session_id);
        await fetchSessions(active);
        setHistoryOpen(false);
      }
    } catch (e) {
      console.error("Failed to create new chat", e);
    }
  }

  async function handleRenameChat(targetId, newTitle) {
    if (!newTitle || !newTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    const sessionId = sessionStorage.getItem("session_id");
    if (!sessionId) return;

    const cleanTitle = newTitle.trim().slice(0, 80);
    setSessions(prev =>
      prev.map(s => (s.id === targetId ? { ...s, title: cleanTitle } : s))
    );
    setEditingSessionId(null);

    try {
      const res = await authFetch(`${API}/tool-sessions/rename`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sessionId,
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          bot_session_id: targetId,
          title: cleanTitle
        })
      });
      const data = await res.json();
      if (!data.success) {
        fetchSessions(active);
      }
    } catch (e) {
      console.error("Rename error", e);
      fetchSessions(active);
    }
  }

  async function executeDelete(targetIds) {
    if (!targetIds || targetIds.length === 0) return;
    const sessionId = sessionStorage.getItem("session_id");
    if (!sessionId) return;

    const updated = sessions.filter(s => !targetIds.includes(s.id));
    setSessions(updated);

    if (targetIds.includes(activeSessionId)) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else {
        createNewChat(true);
      }
    }

    try {
      await Promise.allSettled(
        targetIds.map(id =>
          authFetch(`${API}/tool-sessions/${id}`, {
            method: "DELETE",
            headers: {
              "X-Session-Id": sessionId,
              "Authorization": `Bearer ${token}`
            }
          })
        )
      );
    } catch (e) {
      console.error("Delete error", e);
      fetchSessions(active);
    }
  }

  function promptDeleteSingle(targetId, e) {
    if (e) e.stopPropagation();
    const target = sessions.find(s => s.id === targetId);
    setConfirmModal({
      title: "Delete Chat?",
      message: `Are you sure you want to delete "${target?.title || "this chat"}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        await executeDelete([targetId]);
        setConfirmModal(null);
      }
    });
  }

  function promptDeleteMultiple() {
    if (selectedSessionIds.length === 0) return;
    const count = selectedSessionIds.length;
    setConfirmModal({
      title: `Delete ${count} Chat${count > 1 ? "s" : ""}?`,
      message: `Are you sure you want to permanently delete the ${count} selected chat session${count > 1 ? "s" : ""}? This action cannot be undone.`,
      confirmLabel: `Delete ${count} Chat${count > 1 ? "s" : ""}`,
      onConfirm: async () => {
        const ids = [...selectedSessionIds];
        setSelectedSessionIds([]);
        setIsSelectMode(false);
        await executeDelete(ids);
        setConfirmModal(null);
      }
    });
  }

  function toggleSelectSession(id, e) {
    if (e) e.stopPropagation();
    setSelectedSessionIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleSelectAll() {
    if (selectedSessionIds.length === sessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(sessions.map(s => s.id));
    }
  }

  /* ================= NAVIGATION ================= */
  async function switchBot(tool) {
    setActive(tool);
    setView("tool");
    setActiveSessionId(null);
    setHistoryOpen(false);

    if (!["Email", "Jira", "Policies"].includes(tool)) return;

    const sessionId = sessionStorage.getItem("session_id");
    if (!sessionId) return;

    try {
      const res = await authFetch(`${API}/tool-sessions/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sessionId,
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ tool, force_new: false }),
      });

      const data = await res.json();

      if (data.success) {
        setActiveSessionId(data.bot_session_id);
        fetchSessions(tool);
      }
    } catch (e) {
      console.error("Failed to switch tool session", e);
    }
  }

  useEffect(() => {
    fetchSessions(active);
  }, [active]);

  useEffect(() => {
    const handleRefresh = (e) => {
      if (e.detail?.tool && e.detail.tool.toLowerCase() === active.toLowerCase()) {
        fetchSessions(active);
      }
    };
    window.addEventListener("refreshToolSessions", handleRefresh);
    return () => window.removeEventListener("refreshToolSessions", handleRefresh);
  }, [active]);

  function goToHome() {
    setActive("overview");
    setView("home");
    setActiveSessionId(null);
    setHistoryOpen(false);
  }

  /* ================= LOGOUT ================= */
  async function handleLogout() {
    const sessionId = sessionStorage.getItem("session_id");
    let duration = null;
    try {
      if (sessionId) {
        const res = await authFetch(`${API}/login/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await res.json();
        if (data.success) {
          duration = data.duration;
        }
      }
    } catch (e) {
      console.error("Logout error", e);
    }

    const event = new CustomEvent("manualLogout", {
      detail: { duration: duration }
    });
    window.dispatchEvent(event);
  }

  /* ================= HOME DATA ================= */
  const ROLE_LABELS = {
    employee: "Employee",
    hr: "HR",
    admin: "Admin",
    superadmin: "Super Admin",
  };
  const roleLabel = ROLE_LABELS[role] || role || "—";

  const initials = (currentUser || "?")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join("");

  const longDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const firstName = (currentUser || "there").split(/[\s._-]+/)[0];
  const displayFirstName =
    firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const navGroups = TOOL_GROUPS.map(group => ({
    ...group,
    tools: visibleTools.filter(tool => tool.roles.includes(group.role)),
  })).filter(group => group.tools.length);

  const SESSION_TOOLS = ["Email", "Jira", "Policies"];
  const activeTool = TOOLS.find(t => t.key === active);

  // Tools already redesigned render their own header; the rest get a
  // simple header and their original UI below it.
  const REDESIGNED = ["Email"];

  // Shown in the tool header on small screens, where History is a bottom sheet
  const historyToggle = SESSION_TOOLS.includes(active) ? (
    <button
      type="button"
      className="tc-btn ghost tc-history-toggle"
      onClick={() => setHistoryOpen(true)}
      aria-label={`Show history (${sessions.length})`}
    >
      <span className="material-symbols-rounded">history</span>
      History
      <span className="tc-history-badge">{sessions.length}</span>
    </button>
  ) : null;

  function renderToolContent() {
    switch (active) {
      case "Email":
        return (
          <EmailAssistant
            activeSessionId={activeSessionId}
            tool={activeTool}
            onNewSession={() => createNewChat(true)}
            headerActions={historyToggle}
          />
        );
      case "Jira":
        return <JiraTicketGenerator activeSessionId={activeSessionId} />;
      case "Policies":
        return <OnBoard activeSessionId={activeSessionId} />;
      case "Documents":
        return isHr ? <Documents /> : null;
      case "CTC":
        return isHr ? <Ctc /> : null;
      case "Signature":
        return <EmailSignature />;
      case "Chatbot":
        return (
          <FileSharingSystem
            ref={chatbotRef}
            isOpen={chatbotOpen}
            fullPage={false}
            currentUser={currentUser}
          />
        );
      case "Admin":
        return isAdmin ? <Admin /> : null;
      default:
        return null;
    }
  }

  /* ================= RENDER ================= */
  return (
    <div className="db-container">
      <div className="dw-page">
        {/* small screens: top bar that opens the sidebar as a drawer */}
        <header className="dw-mobilebar">
          <div className="dw-brand">
            <div className="dw-brand-logo">
              <img src={noatLogo} alt="N.O.A.T. Logo" />
            </div>
            <span className="dw-brand-name">N.O.A.T</span>
          </div>
          <button
            type="button"
            className="dw-icon-btn"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            <span className="material-symbols-rounded">menu</span>
          </button>
        </header>

        {navOpen && (
          <div className="dw-scrim" onClick={() => setNavOpen(false)} />
        )}

        {/* ---------- Sidebar: navigation to tools ---------- */}
        <nav className={`dw-side ${navOpen ? "open" : ""}`}>
          <div className="dw-brand">
            <div className="dw-brand-logo">
              <img src={noatLogo} alt="N.O.A.T. Logo" />
            </div>
            <div>
              <span className="dw-brand-name">N.O.A.T</span>
              <span className="dw-brand-tag">Niruthi Office Automation Tool</span>
            </div>
          </div>

          <div className="dw-nav-scroll">
            <p className="dw-nav-label">Overview</p>
            <button
              type="button"
              className={`dw-nav ${view === "home" ? "active" : ""}`}
              onClick={() => {
                setNavOpen(false);
                goToHome();
              }}
            >
              <span className="material-symbols-rounded">dashboard</span>
              Dashboard
            </button>

            {navGroups.map(group => (
              <div key={group.role}>
                <p className="dw-nav-label">{group.title}</p>
                {group.tools.map(tool => (
                  <button
                    type="button"
                    key={tool.key}
                    className={`dw-nav ${
                      view === "tool" && active === tool.key ? "active" : ""
                    }`}
                    style={{ "--c": tool.color }}
                    onClick={() => {
                      setNavOpen(false);
                      switchBot(tool.key);
                    }}
                  >
                    <span className="material-symbols-rounded">{tool.icon}</span>
                    {NAV_LABELS[tool.key] || tool.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="dw-side-profile">
            <div className="dw-side-user">
              <div className="dw-avatar" aria-hidden="true">{initials}</div>
              <div className="dw-user-text">
                <span className="dw-user-name">{currentUser}</span>
                <span className="dw-user-role">{roleLabel}</span>
              </div>
            </div>
            <button type="button" className="dw-logout" onClick={handleLogout}>
              <span className="material-symbols-rounded">logout</span>
              Logout
            </button>
          </div>
        </nav>

        {view === "home" ? (
          /* ---------- Main: overview of the system ---------- */
          <main className="dw-main">
            <DashboardOverview
              isAdmin={isAdmin}
              firstName={displayFirstName}
              longDate={longDate}
            />
          </main>
        ) : (
          /* ---------- Main: the selected tool ---------- */
          <main className="dw-main tool-mode">
            {!REDESIGNED.includes(active) && activeTool && (
              <header className="tc-head">
                <span className="tc-head-icon" style={{ "--c": activeTool.color }}>
                  <span className="material-symbols-rounded">{activeTool.icon}</span>
                </span>
                <div>
                  <h1>{NAV_LABELS[active] || activeTool.label}</h1>
                  <p>{activeTool.desc}</p>
                </div>
                {historyToggle && <div className="tc-head-actions">{historyToggle}</div>}
              </header>
            )}

            <div className="tc-layout">
              <div
                className={`tc-content ${
                  REDESIGNED.includes(active) ? "" : "db-content dw-legacy"
                }`}
              >
                {renderToolContent()}
              </div>

              {SESSION_TOOLS.includes(active) && historyOpen && (
                <div className="tc-sheet-scrim" onClick={() => setHistoryOpen(false)} />
              )}

              {SESSION_TOOLS.includes(active) && (
                <aside
                  className={`dw-card tc-history ${historyOpen ? "open" : ""}`}
                  aria-label="Session history"
                >
                  <div className="tc-history-head">
                    <h2>History</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="tc-history-badge">{sessions.length}</span>
                      {sessions.length > 0 && (
                        <button
                          type="button"
                          className={`tc-select-toggle ${isSelectMode ? "active" : ""}`}
                          onClick={() => {
                            setIsSelectMode(v => !v);
                            setSelectedSessionIds([]);
                          }}
                          title={isSelectMode ? "Exit multi-select" : "Select multiple chats"}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: "14px" }}>
                            {isSelectMode ? "close" : "checklist"}
                          </span>
                          {isSelectMode ? "Done" : "Select"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="tc-history-close"
                        onClick={() => setHistoryOpen(false)}
                        aria-label="Close history"
                      >
                        <span className="material-symbols-rounded">close</span>
                      </button>
                    </div>
                  </div>

                  {isSelectMode ? (
                    <div className="tc-batch-bar">
                      <label className="tc-batch-select-all">
                        <input
                          type="checkbox"
                          checked={sessions.length > 0 && selectedSessionIds.length === sessions.length}
                          onChange={handleSelectAll}
                        />
                        <span>
                          {selectedSessionIds.length === 0
                            ? "Select All"
                            : `${selectedSessionIds.length} Selected`}
                        </span>
                      </label>

                      <div className="tc-batch-actions">
                        <button
                          type="button"
                          className="tc-batch-delete-btn"
                          disabled={selectedSessionIds.length === 0}
                          onClick={promptDeleteMultiple}
                        >
                          <span className="material-symbols-rounded">delete</span>
                          Delete ({selectedSessionIds.length})
                        </button>
                        <button
                          type="button"
                          className="tc-batch-cancel-btn"
                          onClick={() => {
                            setIsSelectMode(false);
                            setSelectedSessionIds([]);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="tc-new-chat-btn"
                      onClick={() => createNewChat(true)}
                    >
                      <span className="material-symbols-rounded">add</span>
                      New Chat
                    </button>
                  )}

                  {sessions.length === 0 ? (
                    <p className="tc-history-empty">No previous sessions yet.</p>
                  ) : (
                    <ul>
                      {sessions.map(s => {
                        const isEditing = editingSessionId === s.id;
                        const isActive = activeSessionId === s.id;
                        const isSelected = selectedSessionIds.includes(s.id);

                        if (isEditing && !isSelectMode) {
                          return (
                            <li key={s.id} className="tc-history-item tc-history-editing">
                              <input
                                type="text"
                                className="tc-rename-input"
                                value={editingTitle}
                                onChange={e => setEditingTitle(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    handleRenameChat(s.id, editingTitle);
                                  } else if (e.key === "Escape") {
                                    setEditingSessionId(null);
                                  }
                                }}
                                autoFocus
                              />
                              <div className="tc-item-actions" style={{ opacity: 1 }}>
                                <button
                                  type="button"
                                  className="tc-action-btn tc-save-btn"
                                  title="Save"
                                  onClick={() => handleRenameChat(s.id, editingTitle)}
                                >
                                  <span className="material-symbols-rounded">check</span>
                                </button>
                                <button
                                  type="button"
                                  className="tc-action-btn tc-cancel-btn"
                                  title="Cancel"
                                  onClick={() => setEditingSessionId(null)}
                                >
                                  <span className="material-symbols-rounded">close</span>
                                </button>
                              </div>
                            </li>
                          );
                        }

                        return (
                          <li
                            key={s.id}
                            className={`tc-history-item ${isActive ? "active" : ""} ${isSelected ? "selected" : ""}`}
                            onClick={isSelectMode ? (e) => toggleSelectSession(s.id, e) : undefined}
                          >
                            {isSelectMode && (
                              <input
                                type="checkbox"
                                className="tc-history-check"
                                checked={isSelected}
                                onChange={(e) => toggleSelectSession(s.id, e)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}

                            <button
                              type="button"
                              className={`tc-history-btn ${isActive ? "active" : ""}`}
                              onClick={() => {
                                if (isSelectMode) {
                                  toggleSelectSession(s.id);
                                } else {
                                  setActiveSessionId(s.id);
                                  setHistoryOpen(false);
                                }
                              }}
                            >
                              <span className="material-symbols-rounded">chat_bubble</span>
                              <span className="tc-history-title">{s.title || "Untitled session"}</span>
                            </button>

                            {!isSelectMode && (
                              <div className="tc-item-actions">
                                <button
                                  type="button"
                                  className="tc-action-btn"
                                  title="Rename session"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSessionId(s.id);
                                    setEditingTitle(s.title || "");
                                  }}
                                >
                                  <span className="material-symbols-rounded">edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="tc-action-btn tc-delete-btn"
                                  title="Delete session"
                                  onClick={(e) => promptDeleteSingle(s.id, e)}
                                >
                                  <span className="material-symbols-rounded">delete</span>
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </aside>
              )}
            </div>
          </main>
        )}
      </div>

      {/* ================= CUSTOM CONFIRMATION POPUP ================= */}
      {confirmModal && (
        <div className="noat-modal-scrim" onClick={() => setConfirmModal(null)}>
          <div className="noat-modal-card" onClick={e => e.stopPropagation()}>
            <div className="noat-modal-icon-wrap">
              <span className="material-symbols-rounded">delete_forever</span>
            </div>
            <h3>{confirmModal.title}</h3>
            <p>{confirmModal.message}</p>
            <div className="noat-modal-actions">
              <button
                type="button"
                className="noat-modal-cancel"
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="noat-modal-delete"
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.confirmLabel || "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
