import { useEffect, useState } from "react";
import "./../styles/admin.css";
import "./../styles/emailassistant.css";
import { authFetch } from "./authFetch";

const API = process.env.REACT_APP_URL;

const ROLES = ["employee", "hr", "admin", "superadmin"];

export default function Admin({ goBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("access_token");
  const currentUser = sessionStorage.getItem("username");

  /* ================= FETCH USERS ================= */

  useEffect(() => {
    if (!token) {
      setError("Session expired. Please login again.");
      setLoading(false);
      return;
    }

    async function fetchUsers() {
      try {
        setError("");
        setLoading(true);

        const res = await authFetch(`${API}/admin/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401 || res.status === 403) {
          setError("Admin access denied");
          return;
        }

        const data = await res.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [token]);

  /* ================= UPDATE ROLE ================= */

  async function updateRole(username, role) {
    try {
      const res = await authFetch(`${API}/admin/update-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, role }),
      });

      if (!res.ok) {
        alert("Failed to update role");
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.username === username ? { ...u, role } : u
        )
      );
    } catch {
      alert("Network error while updating role");
    }
  }

  /* ================= DELETE USER ================= */

  async function deleteUser(username) {
    if (!window.confirm(`This will permanently delete "${username}". Continue?`)) {
      return;
    }

    try {
      const res = await authFetch(`${API}/admin/delete-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username }),
      });

      if (!res.ok) {
        alert("Failed to delete user");
        return;
      }

      setUsers((prev) =>
        prev.filter((u) => u.username !== username)
      );
    } catch {
      alert("Network error while deleting user");
    }
  }

  /* ================= UI ================= */

  return (
    <div className="chatWrapper">
      <div className="chatHeader">
        <h2>Admin Panel</h2>
      </div>

      {loading && <p>Loading users...</p>}
      {error && <p className="errorText">{error}</p>}

      {!loading && !error && users.length === 0 && (
        <p>No users found</p>
      )}

      {!loading && !error && users.length > 0 && (
        <table className="adminTable">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.username}>
                <td>{u.username}</td>

                {/* ROLE DROPDOWN */}
                <td>
                  <select
                    value={u.role}
                    disabled={u.username === currentUser}
                    onChange={(e) =>
                      updateRole(u.username, e.target.value)
                    }
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </td>

                {/* ACTIONS */}
                <td className="actionsCell">
                  <button
                    className="danger"
                    disabled={u.username === currentUser}
                    onClick={() => deleteUser(u.username)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
