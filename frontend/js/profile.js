const API = "http://localhost:5000/api";

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

function setMessage(message, isError = false) {
    const node = document.getElementById("profileMsg");
    node.innerText = message;
    node.style.color = isError ? "#b42318" : "#1f4037";
}

function setStatus(value) {
    document.getElementById("profileStatus").innerText = value;
}

function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
