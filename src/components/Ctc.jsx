import { useState } from "react";
import "./../styles/emailassistant.css";
import { authFetch } from "./authFetch";

const API = process.env.REACT_APP_URL;

export default function Ctc() {
    const [ctc, setCtc] = useState("");
    const [vc, setVc] = useState("");
    const [ctcData, setCtcData] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const token = localStorage.getItem("access_token");

    // Table structure mirroring the screenshot exactly
    const tableStructure = [
        // CTC Summary section (no explicit header row — just "Components / Amount" th)
        { type: "row",    label: "Fixed CTC",                              key: "afc"  },
        { type: "row",    label: "Variable Pay (Performance Bonus)",       key: "avc"  },
        { type: "bold",   label: "Total CTC Annually",                     key: "actc" },
        { type: "spacer" },

        // Monthly Salary Structure
        { type: "header", label: "MONTHLY SALARY STRUCTURE" },
        { type: "row",    label: "Basic Salary",                           key: "mbp"  },
        { type: "row",    label: "House Rent Allowance",                   key: "mhra" },
        { type: "row",    label: "Leave Travel Allowance",                 key: "mlta" },
        { type: "row",    label: "Special Allowance",                      key: "msa"  },
        { type: "bold",   label: "Monthly CTC",                            key: "mctc" },
        { type: "spacer" },

        // Employer Contributions
        { type: "row",    label: "Employer Provident Fund",                key: "mpf"  },
        { type: "row",    label: "Employer ESIC",                          key: "mesi" },
        { type: "row",    label: "Gratuity Provision",                     key: "mgr"  },
        { type: "bold",   label: "Employer Contributions (Part of CTC)",   key: "merc" },
        { type: "spacer" },

        // Gross Salary
        { type: "bold",   label: "Gross Salary",                           key: "mg"   },
        { type: "spacer" },

        // Employee Contributions
        { type: "row",    label: "Employee Provident Fund",                key: "mpf"  },
        { type: "row",    label: "Employee ESIC",                          key: "me_esi" },
        { type: "row",    label: "Professional Tax",                       key: "mpt"  },
        { type: "bold",   label: "Employee Contributions & Deductions",    key: "mecd" },
        { type: "spacer" },

        // Take Home
        { type: "bold",   label: "Take Home Salary",                       key: "mth"  },
        { type: "spacer" },

        // Other Benefits
        { type: "section-header", label: "Other Benefits" },
        { type: "row",    label: "Health Insurance",                       key: "obhi" },
        { type: "row",    label: "Accident Insurance",                     key: "obai" },
    ];

    const calculateCTC = async () => {
        if (!ctc) {
            setError("Please enter CTC amount");
            return;
        }

        setError("");
        setLoading(true);

        try {
            const response = await authFetch(`${API}/ctc/calculate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ctc: Number(ctc),
                    vc: Number(vc) || 0,
                    session_id: sessionStorage.getItem("session_id"),
                }),
            });

            const data = await response.json();
            setCtcData(data.data);
        } catch (err) {
            setError("Failed to calculate CTC");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            calculateCTC();
        }
    };

    const formatAmount = (val) => {
        if (val === undefined || val === null || val === "") return "—";
        const num = Number(val);
        if (isNaN(num)) return val;
        return num.toLocaleString("en-IN");
    };

    const renderTableRows = () => {
        return tableStructure.map((item, idx) => {
            if (item.type === "spacer") {
                return (
                    <tr key={`spacer-${idx}`} style={{ height: "10px", background: "#fff" }}>
                        <td colSpan={2} style={{ border: "none", padding: 0 }} />
                    </tr>
                );
            }

            if (item.type === "header") {
                return (
                    <tr key={`header-${idx}`} style={{ background: "#1a3c5e" }}>
                        <td style={{
                            padding: "8px 12px",
                            fontWeight: "700",
                            fontSize: "13px",
                            color: "#fff",
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                        }}>
                            {item.label}
                        </td>
                        <td style={{
                            padding: "8px 12px",
                            fontWeight: "700",
                            fontSize: "13px",
                            color: "#fff",
                            textAlign: "right",
                        }}>
                            Amount
                        </td>
                    </tr>
                );
            }

            if (item.type === "section-header") {
                return (
                    <tr key={`section-${idx}`} style={{ background: "#f0f0f0" }}>
                        <td style={{
                            padding: "8px 12px",
                            fontWeight: "700",
                            fontSize: "13px",
                            color: "#222",
                            borderTop: "2px solid #ccc",
                        }}>
                            {item.label}
                        </td>
                        <td style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            borderTop: "2px solid #ccc",
                        }} />
                    </tr>
                );
            }

            if (item.type === "bold") {
                return (
                    <tr key={`bold-${idx}`} style={{ background: "#eaf0f6" }}>
                        <td style={{
                            padding: "8px 12px",
                            fontWeight: "700",
                            fontSize: "13px",
                            color: "#1a3c5e",
                            borderTop: "1px solid #c5d5e8",
                            borderBottom: "1px solid #c5d5e8",
                        }}>
                            {item.label}
                        </td>
                        <td style={{
                            padding: "8px 12px",
                            fontWeight: "700",
                            fontSize: "13px",
                            color: "#1a3c5e",
                            textAlign: "right",
                            borderTop: "1px solid #c5d5e8",
                            borderBottom: "1px solid #c5d5e8",
                        }}>
                            {ctcData ? formatAmount(ctcData[item.key]) : item.key}
                        </td>
                    </tr>
                );
            }

            // type === "row"
            return (
                <tr key={`row-${idx}`} style={{ background: "#fff" }}>
                    <td style={{
                        padding: "7px 12px 7px 24px",
                        fontSize: "13px",
                        color: "#444",
                        borderBottom: "1px solid #eee",
                    }}>
                        {item.label}
                    </td>
                    <td style={{
                        padding: "7px 12px",
                        fontSize: "13px",
                        color: "#444",
                        textAlign: "right",
                        borderBottom: "1px solid #eee",
                    }}>
                        {ctcData ? formatAmount(ctcData[item.key]) : item.key}
                    </td>
                </tr>
            );
        });
    };

    return (
        <div className="chatWrapper">
            <div className="chatHeader">
                <h2>CTC Calculator</h2>
            </div>

            <div className="chatBox">
                {/* TOP SECTION: Results or Placeholder */}
                <div className="ctcContent">
                    {/* Always show the table — with keys as placeholder when no data */}
                    <table style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontFamily: "'Segoe UI', sans-serif",
                        fontSize: "13px",
                        border: "1px solid #c5d5e8",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    }}>
                        <thead>
                            <tr style={{ background: "#1a3c5e" }}>
                                <th style={{
                                    padding: "10px 12px",
                                    textAlign: "left",
                                    color: "#fff",
                                    fontWeight: "700",
                                    fontSize: "13px",
                                    letterSpacing: "0.3px",
                                    width: "65%",
                                }}>
                                    Components
                                </th>
                                <th style={{
                                    padding: "10px 12px",
                                    textAlign: "right",
                                    color: "#fff",
                                    fontWeight: "700",
                                    fontSize: "13px",
                                }}>
                                    Amount (₹)
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {renderTableRows()}
                        </tbody>
                    </table>

                    {!ctcData && (
                        <p style={{
                            textAlign: "center",
                            marginTop: "14px",
                            color: "#888",
                            fontSize: "13px",
                        }}>
                            Enter CTC below and click <strong>Calculate</strong> to see your breakdown.
                        </p>
                    )}
                </div>

                {/* BOTTOM SECTION: Input Bar */}
                <div className="ctcInputArea">
                    <div className="ctcInputGroup">
                        <div className="ctcInputWrapper">
                            <input
                                type="text"
                                placeholder="Annual CTC (e.g. 1200000)"
                                value={ctc}
                                onChange={(e) => setCtc(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="ctcInputField"
                            />
                        </div>

                        <div className="ctcInputWrapper">
                            <input
                                type="number"
                                placeholder="Variable Pay (Optional)"
                                value={vc}
                                onChange={(e) => setVc(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="ctcInputField"
                            />
                        </div>

                        <button
                            onClick={calculateCTC}
                            disabled={loading}
                            className="ctcCalculateBtn"
                        >
                            {loading ? "..." : "Calculate"}
                        </button>
                    </div>

                    {error && (
                        <div className="ctcError">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}