// const PROFILE_API = "http://localhost:5000/api";
const API = "/api";
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const form = document.getElementById("profileForm");
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
            const response = await fetch(PROFILE_API + "/profile", {
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
});

async function loadProfile(token) {
    try {
        const response = await fetch(PROFILE_API + "/profile", {
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

function setMessage(message, isError = false) {
    const node = document.getElementById("profileMsg");
    node.innerText = message;
    node.style.color = isError ? "#b42318" : "#1f4037";
}

function setStatus(value) {
    document.getElementById("profileStatus").innerText = value;
}

function resetPasswordInputs() {
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmPassword").value = "";
}

function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
