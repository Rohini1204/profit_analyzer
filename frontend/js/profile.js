const API = "/api";

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const form = document.getElementById("profileForm");
    const managerUnlockBtn = document.getElementById("managerUnlockBtn");
    const managerUsersBody = document.getElementById("managerUsersBody");

    loadProfile(token);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage("");
        setStatus("Saving...");

        const payload = {
            name: document.getElementById("profileName").value.trim(),
            email: document.getElementById("profileEmail").value.trim(),
            role: document.getElementById("profileRole").value.toLowerCase(),
            business_name: document.getElementById("profileBusiness").value.trim(),
        };
        const currentPassword = document.getElementById("currentPassword").value;
        const newPassword = document.getElementById("newPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (currentPassword || newPassword || confirmPassword) {
            if (!currentPassword || !newPassword || !confirmPassword) {
                setStatus("Update failed");
                setMessage("Fill current, new, and confirm password fields to change password.", true);
                return;
            }

            if (newPassword !== confirmPassword) {
                setStatus("Update failed");
                setMessage("New password and confirm password do not match.", true);
                return;
            }

            payload.current_password = currentPassword;
            payload.new_password = newPassword;
        }

        try {
            const response = await fetch(API + "/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + token,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!response.ok) {
                setStatus("Update failed");
                setMessage(data.error || "Unable to update profile.", true);
                return;
            }

            fillProfile(data.profile);
            resetPasswordInputs();
            setStatus("Saved");
            setMessage(data.msg || "Profile updated successfully.");
        } catch (error) {
            setStatus("Error");
            setMessage("Network/API error while updating profile.", true);
        }
    });

    managerUnlockBtn.addEventListener("click", async () => {
        const password = document.getElementById("managerPassword").value;
        setManagerMessage("");
        setManagerStatus("Checking...");

        try {
            const response = await fetch(API + "/manager-login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "same-origin",
                body: JSON.stringify({ password }),
            });

            const data = await response.json();
            if (!response.ok || !data.access) {
                hideManagerDashboard();
                setManagerStatus("Locked");
                setManagerMessage("Invalid manager password.", true);
                return;
            }

            setManagerStatus("Unlocked");
            setManagerMessage("Manager dashboard unlocked.");
            await loadManagerUsers();
        } catch (error) {
            hideManagerDashboard();
            setManagerStatus("Error");
            setManagerMessage("Network/API error while unlocking manager dashboard.", true);
        }
    });

    managerUsersBody.addEventListener("click", async (event) => {
        const historyButton = event.target.closest(".manager-history-toggle");
        if (historyButton) {
            const userId = Number(historyButton.dataset.userId);
            await toggleUserSessionHistory(userId);
            return;
        }

        const toggleButton = event.target.closest(".manager-reset-toggle");
        if (toggleButton) {
            const userId = toggleButton.dataset.userId;
            const resetPanel = document.getElementById(`resetPanel-${userId}`);
            if (resetPanel) {
                resetPanel.style.display = resetPanel.style.display === "none" ? "block" : "none";
            }
            return;
        }

        const saveButton = event.target.closest(".manager-reset-save");
        if (saveButton) {
            const userId = Number(saveButton.dataset.userId);
            const input = document.getElementById(`resetPasswordInput-${userId}`);
            const newPassword = input ? input.value.trim() : "";

            if (!newPassword) {
                setManagerMessage(`Enter a new password for user ${userId}.`, true);
                return;
            }

            await resetUserPassword(userId, newPassword);
        }
    });
});

async function loadProfile(token) {
    try {
        const response = await fetch(API + "/profile", {
            method: "GET",
            headers: { Authorization: "Bearer " + token },
        });

        const data = await response.json();
        if (!response.ok) {
            setStatus("Load failed");
            setMessage(data.error || "Unable to load profile.", true);
            return;
        }

        fillProfile(data);
        setStatus("Loaded");
        setMessage("");
    } catch (error) {
        setStatus("Error");
        setMessage("Network/API error while loading profile.", true);
    }
}

function fillProfile(profile) {
    document.getElementById("userIdText").innerText = profile.id || "--";
    document.getElementById("currentEmailText").innerText = profile.email || "--";
    document.getElementById("passwordText").innerText = profile.password_mask || "**********";

    document.getElementById("profileName").value = profile.name || "";
    document.getElementById("profileEmail").value = profile.email || "";
    const roleValue = (profile.role || "business").toLowerCase();
    document.getElementById("profileRole").value =
        roleValue === "user" || roleValue === "business" ? roleValue : "business";
    document.getElementById("profileBusiness").value = profile.business_name || "";
}

async function loadManagerUsers() {
    const dashboard = document.getElementById("managerDashboard");
    const tbody = document.getElementById("managerUsersBody");
    dashboard.style.display = "block";
    tbody.innerHTML = '<tr><td colspan="7">Loading users...</td></tr>';

    try {
        const response = await fetch(API + "/manager/users", {
            method: "GET",
            credentials: "same-origin",
        });
        const data = await response.json();

        if (!response.ok) {
            hideManagerDashboard();
            setManagerStatus("Locked");
            setManagerMessage(data.error || "Unable to load manager users.", true);
            return;
        }

        renderManagerUsers(data);
    } catch (error) {
        hideManagerDashboard();
        setManagerStatus("Error");
        setManagerMessage("Network/API error while loading manager users.", true);
    }
}

function renderManagerUsers(users) {
    const tbody = document.getElementById("managerUsersBody");

    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="7">No users found.</td></tr>';
        return;
    }

    tbody.innerHTML = users
        .map(
            (user) => `
                <tr>
                    <td style="padding: 10px 8px; border-top: 1px solid #dfe9e3;">${user.id}</td>
                    <td style="padding: 10px 8px; border-top: 1px solid #dfe9e3;">${escapeHtml(user.name || "")}</td>
                    <td style="padding: 10px 8px; border-top: 1px solid #dfe9e3;">${escapeHtml(user.email || "")}</td>
                    <td style="padding: 10px 8px; border-top: 1px solid #dfe9e3;">${escapeHtml(user.role || "")}</td>
                    <td style="padding: 10px 8px; border-top: 1px solid #dfe9e3;">${Number(user.time_spent_minutes || 0)}</td>
                    <td style="padding: 10px 8px; border-top: 1px solid #dfe9e3;">
                        <button type="button" class="btn manager-reset-toggle" data-user-id="${user.id}">Reset Password</button>
                        <div id="resetPanel-${user.id}" style="display: none; margin-top: 10px;">
                            <input
                                id="resetPasswordInput-${user.id}"
                                type="password"
                                placeholder="New password"
                                style="width: 100%; padding: 8px 10px; border: 1px solid #cbd9d1; border-radius: 8px; margin-bottom: 8px;"
                            >
                            <button type="button" class="btn manager-reset-save" data-user-id="${user.id}">Save</button>
                        </div>
                    </td>
                    <td style="padding: 10px 8px; border-top: 1px solid #dfe9e3;">
                        <button type="button" class="btn manager-history-toggle" data-user-id="${user.id}">Login Time</button>
                    </td>
                </tr>
                <tr id="historyRow-${user.id}" style="display: none;">
                    <td colspan="7" style="padding: 12px 8px; border-top: 1px solid #dfe9e3; background: #f7faf8;">
                        <div id="historyPanel-${user.id}">No history loaded.</div>
                    </td>
                </tr>
            `
        )
        .join("");
}

async function toggleUserSessionHistory(userId) {
    const historyRow = document.getElementById(`historyRow-${userId}`);
    const historyPanel = document.getElementById(`historyPanel-${userId}`);

    if (!historyRow || !historyPanel) {
        return;
    }

    if (historyRow.style.display === "table-row" && historyPanel.dataset.loaded === "true") {
        historyRow.style.display = "none";
        return;
    }

    historyRow.style.display = "table-row";
    historyPanel.innerHTML = "Loading login history...";

    try {
        const response = await fetch(API + `/manager/user-sessions/${userId}`, {
            method: "GET",
            credentials: "same-origin",
        });
        const data = await response.json();

        if (!response.ok) {
            historyPanel.innerHTML = escapeHtml(data.error || "Unable to load login history.");
            return;
        }

        historyPanel.dataset.loaded = "true";
        historyPanel.innerHTML = buildSessionHistoryTable(data);
    } catch (error) {
        historyPanel.innerHTML = "Network/API error while loading login history.";
    }
}

function buildSessionHistoryTable(sessions) {
    if (!sessions.length) {
        return "No login history found for this user.";
    }

    const rows = sessions
        .map(
            (entry) => `
                <tr>
                    <td style="padding: 8px; border-top: 1px solid #dfe9e3;">${escapeHtml(entry.login_time || "--")}</td>
                    <td style="padding: 8px; border-top: 1px solid #dfe9e3;">${escapeHtml(entry.logout_time || "--")}</td>
                    <td style="padding: 8px; border-top: 1px solid #dfe9e3;">${Number(entry.time_spent_minutes || 0)}</td>
                </tr>
            `
        )
        .join("");

    return `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th align="left">Login Time</th>
                    <th align="left">Logout Time</th>
                    <th align="left">Time Spent (minutes)</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

async function resetUserPassword(userId, newPassword) {
    setManagerMessage("");

    try {
        const response = await fetch(API + "/manager/reset-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "same-origin",
            body: JSON.stringify({
                user_id: userId,
                new_password: newPassword,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            setManagerMessage(data.error || "Unable to reset password.", true);
            return;
        }

        setManagerMessage(data.msg || "Password reset successfully.");
        await loadManagerUsers();
    } catch (error) {
        setManagerMessage("Network/API error while resetting password.", true);
    }
}

function setMessage(message, isError = false) {
    const node = document.getElementById("profileMsg");
    node.innerText = message;
    node.style.color = isError ? "#b42318" : "#1f4037";
}

function setStatus(value) {
    document.getElementById("profileStatus").innerText = value;
}

function setManagerMessage(message, isError = false) {
    const node = document.getElementById("managerMsg");
    node.innerText = message;
    node.style.color = isError ? "#b42318" : "#1f4037";
}

function setManagerStatus(value) {
    document.getElementById("managerStatus").innerText = value;
}

function resetPasswordInputs() {
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmPassword").value = "";
}

function hideManagerDashboard() {
    document.getElementById("managerDashboard").style.display = "none";
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

async function logout() {
    const token = localStorage.getItem("token");

    if (token) {
        try {
            await fetch(API + "/logout", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token,
                },
            });
        } catch (error) {
            // Ignore logout API failures and clear the local token anyway.
        }
    }

    localStorage.removeItem("token");
    window.location.href = "login.html";
}
