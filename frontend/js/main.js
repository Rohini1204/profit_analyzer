// const API = "http://localhost:5000/api";
const API = "/api";

// LOGIN 

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;

        const res = await fetch(API + "/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await res.json();

        const msg = document.getElementById("loginMsg");

        if (res.status === 200) {

            msg.style.color = "green";
            msg.innerText = "Login Successful";

            // 🔐 SAVE JWT TOKEN (FIXED)
            localStorage.setItem("token", data.token);

            setTimeout(() => {
                window.location.href = "menu.html";
            }, 1000);

        } else {

            msg.style.color = "red";
            msg.innerText = data.msg || "Invalid Login";
        }
    });
}


// register

const registerForm = document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const name = document.getElementById("regName").value;
        const email = document.getElementById("regEmail").value;
        const password = document.getElementById("regPassword").value;
        const role = document.getElementById("regRole").value;
        const business = document.getElementById("regBusiness").value;

        const res = await fetch(API + "/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                email: email,
                password: password,
                role: role,
                business_name: business
            })
        });

        const data = await res.json();

        const msg = document.getElementById("regMsg");

        if (res.status === 200) {

            msg.style.color = "green";
            msg.innerText = "Registration Successful";

            setTimeout(() => {
                window.location.href = "login.html";
            }, 1000);

        } else {

            msg.style.color = "red";
            msg.innerText = data.msg || "Registration Failed";
        }
    });
}


// FILE UPLOAD (JWT PROTECTED) 

const uploadBtn = document.getElementById("uploadBtn");

if (uploadBtn) {

    uploadBtn.addEventListener("click", async () => {

        const token = localStorage.getItem("token");

        if (!token) {
            alert("Please login first.");
            window.location.href = "login.html";
            return;
        }

        const fileInput = document.getElementById("fileInput");
        const file = fileInput.files[0];

        if (!file) {
            alert("Please select a CSV file.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token
            },
            body: formData
        });

        const data = await res.json();

        displayTable(data);
    });
}


//  DISPLAY TABLE 

function displayTable(data) {

    const container = document.getElementById("tableContainer");

    if (!data || data.length === 0) {
        container.innerHTML = "<p>No data found.</p>";
        return;
    }

    let table = "<table><tr>";

    Object.keys(data[0]).forEach(key => {
        table += `<th>${key}</th>`;
    });

    table += "</tr>";

    data.forEach(row => {
        table += "<tr>";
        Object.values(row).forEach(val => {
            table += `<td>${val}</td>`;
        });
        table += "</tr>";
    });

    table += "</table>";

    container.innerHTML = table;
}


// LOGOUT 

function logout() {
    localStorage.removeItem("token");   // FIXED
    window.location.href = "login.html";
}