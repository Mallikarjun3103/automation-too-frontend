import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import "./../styles/Chatbot.css";


const API_BASE = "http://183.82.109.218:8187";
const RESOURCE_URL = `${API_BASE}/resources`;

const Chatbot = forwardRef(({ isOpen, onClose, fullPage = true, data: propData = [], requests: propRequests = {}, onRequestAccess, onDownload, currentUser: propCurrentUser, requestIdMapRef: propRequestIdMapRef }, ref) => {
    // Chat UI state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [waitingForToken, setWaitingForToken] = useState(null);
    const messagesEndRef = useRef(null);

    // Resource state managed here (falls back to props if provided)
    const [data, setData] = useState(propData || null);
    const [requests, setRequests] = useState(propRequests || {});
    const [resLoading, setResLoading] = useState(true);
    const [resError, setResError] = useState(null);
    const [error, setError] = useState(null);


    const wsRef = useRef(null);
    const localRequestIdMapRef = useRef({});
    const requestIdMapRef = propRequestIdMapRef || localRequestIdMapRef;
    const currentUser = propCurrentUser || (typeof window !== 'undefined' ? (sessionStorage.getItem('auth_username') || '') : '');
    const idMapRef = useRef(requestIdMapRef.current);

    const handleDownload = async (resourceId, item) => {
        const role = sessionStorage.getItem("role");
        const reqState = requests[resourceId] || {};

        // agent ki permission check
        if (role === "user" && !reqState.granted) return;

        try {
            let url = "";
            let body = {};

            // =========================
            //  AGENT DOWNLOAD FLOW
            // =========================
            if (role === "user") {
                const token = window.prompt(
                    "Enter download token for this resource (will not be saved):"
                );

                if (!token) {
                    setError("Download cancelled: token required");
                    return;
                }

                url = `${API_BASE}/download`;
                body = {
                    resource_id: resourceId,
                    token: token,
                };
            }

            // =========================
            // ADMIN DOWNLOAD FLOW
            // =========================
            if (role === "admin") {
                url = `${API_BASE}/admin-kansar/download`;
                body = {
                    resource_id: resourceId,
                    role: "admin",
                };
            }

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true",
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(
                    `Download failed (status ${res.status}). ${text.slice(0, 300)}`
                );
            }

            const blob = await res.blob();
            const href = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = href;
            const filename =
                (item.path || "").split("/").pop() || `resource-${resourceId}`;
            a.download = filename;

            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(href);

        } catch (err) {
            setError(err.message || "Download failed");
        }
    };

    const handleRequestAccess = async (resourceId, agentId, fileName) => {
        try {
            const url = `${API_BASE}/request-access`;
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    resource_id: resourceId,
                    requester: currentUser,
                    agent_id: agentId,
                }),
            });

            const text = await res.text();
            if (!res.ok) {
                throw new Error('Failed to request access');
            }

            let payload = {};
            try { payload = JSON.parse(text); } catch { /* ignore */ }

            const requestId = payload.request_id || null;
            if (requestId) {
                requestIdMapRef.current[requestId] = resourceId;
                localRequestIdMapRef.current[requestId] = { resourceId, fileName };
                setRequests((prev) => ({
                    ...prev,
                    [resourceId]: {
                        ...(prev[resourceId] || {}),
                        requested: true,
                        granted: false,
                        loading: false,
                        requestId,
                        status: 'pending',
                    }
                }));

                const successMsg = { role: "assistant", content: `Access request sent for "${fileName}". Waiting for approval...`, requestId };
                setMessages((prev) => [...prev, successMsg]);
                connectWebSocket();
            } else {
                const errorMsg = { role: "assistant", content: `Failed to request access for "${fileName}". Please try again.` };
                setMessages((prev) => [...prev, errorMsg]);
            }
        } catch (error) {
            console.error('Request access error:', error);
            const errorMsg = { role: "assistant", content: `Error requesting access. Please try again.` };
            setMessages((prev) => [...prev, errorMsg]);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch resources on mount
    useEffect(() => {
        const fetchResources = async () => {
            setResLoading(true);
            setResError(null);
            try {
                const role = sessionStorage.getItem("role");
                const savedUser = sessionStorage.getItem("auth_username");
                const savedPass = sessionStorage.getItem("auth_password");
                const params = new URLSearchParams({ username: savedUser || '', password: savedPass || '' }).toString();
                const res = await fetch(`${RESOURCE_URL}?${params}`, {
                    headers: {
                        "Content-Type": "application/json",
                    }
                });

                const ct = res.headers.get("content-type") || "";
                const text = await res.text();
                if (!res.ok) {
                    const snippet = (text || "").slice(0, 500);
                    throw new Error(`Failed to fetch resource (status ${res.status}). Response snippet: ${snippet}`);
                }

                let parsed = null;
                try { parsed = JSON.parse(text); } catch (err) { throw new Error('Resource returned invalid JSON'); }

                setData(parsed);

                // Init request states
                const init = {};
                if (Array.isArray(parsed)) {
                    parsed.forEach((r) => {
                        const isAdmin = role === "admin";
                        const isOwner = savedUser && r.owner && String(r.owner) === String(savedUser);
                        init[r.resource_id] = {
                            requested: false,
                            granted: isAdmin ? true : (isOwner || Boolean(r.allowed || r.access_granted || false)),
                            loading: false,
                            status: isAdmin ? 'granted' : undefined,
                        };
                    });
                }
                setRequests((prev) => ({ ...prev, ...init }));

            } catch (err) {
                setResError(err.message || 'Failed to load resources');
            } finally {
                setResLoading(false);
            }
        };

        fetchResources();
    }, []);

    // WebSocket handling moved here
    const connectWebSocket = () => {
        const savedUser = sessionStorage.getItem("auth_username");
        if (!savedUser) return;

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(
            `wss://dannielle-zonal-defiantly.ngrok-free.dev/ws/frontend/${savedUser}?token=${savedUser}`
        );

        wsRef.current = ws;

        ws.onmessage = (event) => {
            let dataMsg;
            try { dataMsg = JSON.parse(event.data); } catch { return; }

            if (dataMsg.type === 'access_decision') {
                const { request_id, status, expiry } = dataMsg;
                const resourceInfo = requestIdMapRef.current[request_id] || localRequestIdMapRef.current[request_id];
                if (!resourceInfo) return;

                const resource_id = typeof resourceInfo === 'string' ? resourceInfo : resourceInfo.resourceId || resourceInfo;

                if (status === 'approved') {
                    const expiresAt = expiry * 1000;
                    const remainingMs = expiresAt - Date.now();
                    setRequests((prev) => ({
                        ...prev,
                        [resource_id]: {
                            ...prev[resource_id],
                            requested: true,
                            granted: true,
                            status: 'granted',
                            loading: false,
                            expiresAt,
                        }
                    }));

                    setTimeout(() => {
                        setRequests((prev) => ({
                            ...prev,
                            [resource_id]: {
                                requested: false,
                                granted: false,
                                status: 'no_access',
                                loading: false,
                                expiresAt: null,
                            }
                        }));
                    }, Math.max(0, remainingMs));
                } else {
                    setRequests((prev) => ({
                        ...prev,
                        [resource_id]: {
                            ...prev[resource_id],
                            requested: false,
                            granted: false,
                            status: 'denied',
                            loading: false,
                        }
                    }));
                }
            }
        };

        ws.onclose = () => { wsRef.current = null; };
    };

    useEffect(() => {
        setMessages((prevMessages) => {
            const updated = prevMessages.map((msg) => {
                if (msg.requestId) {
                    const reqInfo = idMapRef.current[msg.requestId];
                    console.log('Checking message:', { requestId: msg.requestId, reqInfo });
                    if (reqInfo) {
                        const reqState = requests[reqInfo.resourceId];
                        console.log('Request state details:', {
                            resourceId: reqInfo.resourceId,
                            reqState,
                            granted: reqState?.granted,
                            status: reqState?.status,
                            msgContent: msg.content,
                            includes: msg.content.includes("Waiting for approval")
                        });

                        if (reqState && reqState.granted && msg.content.includes("Waiting for approval")) {
                            console.log(' UPDATING to approved:', reqInfo.fileName);
                            return {
                                ...msg,
                                content: ` Access approved for "${reqInfo.fileName}"! `
                            };
                        }
                        if (reqState && reqState.status === "denied" && msg.content.includes("Waiting for approval")) {
                            console.log('UPDATING to denied:', reqInfo.fileName);
                            return {
                                ...msg,
                                content: `Access request for "${reqInfo.fileName}" was denied.`
                            };
                        }
                    }
                }
                return msg;
            });

            console.log('Messages after update:', updated);
            return updated;
        });
    }, [requests]);

    const handleSendMessage = async (e) => {
        e.preventDefault();

        const query = input.trim();
        if (!query) return;

        if (waitingForToken) {
            const token = query;
            const { resourceId, filename, item } = waitingForToken;

            const userMessage = { role: "user", content: token };
            setMessages((prev) => [...prev, userMessage]);
            setInput("");
            setWaitingForToken(null);
            setIsLoading(true);

            try {
                // Perform download with token
                const downloadRes = await fetch(`${API_BASE}/download`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "ngrok-skip-browser-warning": "true",
                    },
                    body: JSON.stringify({
                        resource_id: item.resource_id,
                        token: token,
                    }),
                });

                if (!downloadRes.ok) {
                    const text = await downloadRes.text().catch(() => "");
                    throw new Error(
                        `Download failed (status ${downloadRes.status}). ${text.slice(0, 300)}`
                    );
                }

                const blob = await downloadRes.blob();
                const href = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = href;
                const downloadFilename =
                    (item.path || "").split("/").pop() || `${filename}`;
                a.download = downloadFilename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(href);

                const successMsg = { role: "assistant", content: ` Download started for "${filename}"!` };
                setMessages((prev) => [...prev, successMsg]);
            } catch (err) {
                console.error('Download error:', err);
                const errorMsg = { role: "assistant", content: `Error downloading "${filename}": ${err.message}` };
                setMessages((prev) => [...prev, errorMsg]);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        const userMessage = { role: "user", content: query };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE}/intent/parse`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({ question: query }),
            });

            if (!res.ok) {
                throw new Error('Failed to parse intent');
            }

            const parsed = await res.json();
            const intent = parsed.intent || 'unknown';
            const username = parsed.username;
            const filename = parsed.filename;

            let responseText = '';

            if (intent === 'search_file') {
                if (!filename) {
                    responseText = 'Please specify a filename to search.';
                } else {
                    const results = [];
                    if (Array.isArray(data)) {
                        data.forEach(item => {
                            const systemName = (item.system_name || item.name || '').toLowerCase();
                            if (systemName.includes(filename.toLowerCase())) {
                                results.push(item);
                            }
                        });
                    }
                    if (results.length === 0) {
                        responseText = `No files found matching "${filename}".`;
                    } else {
                        responseText = `Found ${results.length} file(s) matching "${filename}".`;
                    }
                }
            } else if (intent === 'list_user_files') {
                if (!username || username === 'all') {
                    const owners = new Set();
                    if (Array.isArray(data)) {
                        data.forEach(item => {
                            const owner = item.owner || 'Unknown';
                            owners.add(owner);
                        });
                    }

                    if (owners.size === 0) {
                        responseText = 'No users with files found.';
                    } else {
                        const ownerList = Array.from(owners).sort();
                        responseText = `Here are the users with files:\n\n${ownerList.map(owner => `• ${owner}`).join('\n')}\n\nWhich user's files would you like to see?`;
                    }
                } else {
                    const results = [];
                    if (Array.isArray(data)) {
                        data.forEach(item => {
                            const owner = (item.owner || '').toLowerCase();
                            const searchUsername = (username || '').toLowerCase();
                            if (owner === searchUsername) {
                                results.push(item);
                            }
                        });
                    }
                    if (results.length === 0) {
                        responseText = `No files found for user "${username}".`;
                    } else {
                        const fileNames = results.map(item => {
                            const pathName = (item.path && item.path.replace(/\n/g, '').trim().split('/').filter(Boolean).pop()) ||
                                item.system_name || item.name || 'Unnamed';
                            return { name: pathName, resourceId: item.resource_id, item: item };
                        });

                        const assistantMsg = {
                            role: "assistant",
                            content: '',
                            files: fileNames,
                            type: 'file_list'
                        };
                        setMessages((prev) => [...prev, assistantMsg]);
                        setIsLoading(false);
                        return;
                    }
                }
            } else if (intent === 'request_access') {
                if (!filename || !username) {
                    responseText = 'Please specify both filename and username.';
                } else {
                    let item = null;

                    const searchFilename = filename.trim().toLowerCase();
                    const searchUsername = username.trim().toLowerCase();

                    if (Array.isArray(data)) {
                        for (const it of data) {
                            const owner = (it.owner || '').trim().toLowerCase();

                            const actualFileName = (
                                it.path
                                    ? it.path.replace(/\n/g, '').trim().split('/').filter(Boolean).pop()
                                    : it.system_name || it.name || ''
                            )
                                .trim()
                                .toLowerCase();

                            if (
                                actualFileName === searchFilename &&
                                owner === searchUsername
                            ) {
                                item = it;
                                break;
                            }
                        }
                    }

                    if (item) {
                        await handleRequestAccess(item.resource_id, item.agent_id || item.owner, filename);
                        setIsLoading(false);
                        return;
                    } else {
                        responseText = `File "${filename}" not found for user "${username}".`;
                    }
                }
            }
            else if (intent === 'download_file') {
                if (!filename) {
                    responseText = 'Please specify a filename to download.';
                } else {
                    let item = null;
                    const searchFilename = filename.trim().toLowerCase();

                    if (Array.isArray(data)) {
                        for (const it of data) {
                            // Check system_name
                            const systemName = (it.system_name || it.name || '').toLowerCase();
                            if (systemName.includes(searchFilename) || systemName === searchFilename) {
                                item = it;
                                break;
                            }

                            // Check path filename
                            const pathName = (it.path && it.path.replace(/\n/g, '').trim().split('/').filter(Boolean).pop() || '').toLowerCase();
                            if (pathName.includes(searchFilename) || pathName === searchFilename) {
                                item = it;
                                break;
                            }
                        }
                    }

                    console.log('Download file search:', { filename: searchFilename, foundItem: item });

                    if (item) {
                        const role = sessionStorage.getItem("role");

                        // Agent download flow - requires token
                        if (role === "user") {
                            responseText = `Enter download token for "${filename}" to proceed`;
                            setWaitingForToken({ resourceId: item.resource_id, filename, item });
                        }
                        // Admin download flow
                        else if (role === "admin") {
                            window.open(`${API_BASE}/admin-kansar/stream/${item.resource_id}`, "_blank");
                            responseText = `✓ Opening download stream for "${filename}"...`;
                        } else {
                            responseText = `Download not available. Please check your permissions.`;
                        }
                    } else {
                        responseText = `File "${filename}" not found.`;
                    }
                }
            }

            if (!responseText) {
                responseText = 'I understand you said: "' + query + '". How can I help you with file access?';
            }

            const assistantMessage = { role: "assistant", content: responseText };
            setMessages((prev) => [...prev, assistantMessage]);

        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = { role: "assistant", content: "Sorry, there was an error. Please try again." };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // If fullPage modal style and closed, render nothing. If inline (fullPage=false), always render container.
    if (!fullPage && !isOpen) {
        // when rendered inline and closed, show a compact placeholder
        return (
            <div className={`chat-wrapper inline-closed`}>
                <div className="chat-closed">Chatbot (closed) — click the Chatbot button to open.</div>
            </div>
        );
    }

    if (fullPage && !isOpen) return null;

    return (
        <div className={`chat-wrapper ${fullPage ? "full-page" : "inline"}`}>
            <div className="chat-panel">
                <div className="chat-header">
                    <span>Chatbot Assistant</span>
                    <button className="chat-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="chat-messages">
                    {messages.length === 0 ? (
                        <div className="chat-empty">
                            Start a conversation by typing your message below.
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className={`chat-message ${msg.role}`}>
                                {msg.content && <pre>{msg.content}</pre>}
                                {msg.files && msg.files.length > 0 && !isLoading && (
                                    <div className="chat-file-list-wrapper">
                                        <div className="chat-file-list">
                                            {msg.files.map((file, fileIdx) => (
                                                <div key={fileIdx} className="chat-file-item">
                                                    <div className="chat-file-name">
                                                        <span className="chat-file-icon">📄</span>
                                                        <span className="chat-file-text">{file.name}</span>
                                                    </div>
                                                    <div className="chat-file-actions">
                                                        <button
                                                            className="chat-btn-small chat-btn-request"
                                                            onClick={() => handleRequestAccess(file.resourceId, file.item.agent_id || file.item.owner, file.name)}
                                                        >
                                                            Request Access
                                                        </button>
                                                        <button
                                                            className="chat-btn-small chat-btn-download"
                                                            onClick={() => handleDownload(file.resourceId, file.item)}
                                                        >
                                                            Download
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="chat-message assistant">
                            <pre>Typing...</pre>
                        </div>
                    )}
                </div>

                <form className="chat-input-row" onSubmit={handleSendMessage}>
                    <input
                        type="text"
                        placeholder="Type your message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading}>
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
});

export default Chatbot;
