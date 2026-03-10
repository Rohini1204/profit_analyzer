const API = "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const tableBody = document.getElementById("manualTableBody");
    const addRowBtn = document.getElementById("addRowBtn");
    const saveAnalyzeBtn = document.getElementById("saveAnalyzeBtn");

    for (let i = 0; i < 5; i += 1) {
        addRow();
    }

    addRowBtn.addEventListener("click", addRow);
    saveAnalyzeBtn.addEventListener("click", () => saveAndAnalyze(token));

    function addRow() {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><input type="date" class="date"></td>
            <td><input type="number" class="sales" placeholder="0"></td>
            <td><input type="number" class="expenses" placeholder="0"></td>
            <td><input type="text" class="category" placeholder="Category"></td>
            <td><button type="button" class="delete-btn">Delete</button></td>
        `;
        row.querySelector(".delete-btn").addEventListener("click", () => row.remove());
        tableBody.appendChild(row);
    }
});

async function saveAndAnalyze(token) {
    const filename = document.getElementById("fileNameInput").value.trim();
    if (!filename) {
        setMessage("Filename is required.", true);
        return;
    }

    const rows = [];
    document.querySelectorAll("#manualTableBody tr").forEach((tr) => {
        const date = tr.querySelector(".date").value;
        const sales = tr.querySelector(".sales").value;
        const expenses = tr.querySelector(".expenses").value;
        const category = tr.querySelector(".category").value;

        if (date || sales || expenses || category) {
            rows.push({ date, sales, expenses, category });
        }
    });

    if (rows.length === 0) {
        setMessage("Please add at least one data row.", true);
        return;
    }

    setMessage("Saving CSV and analyzing data...");

    try {
        const response = await fetch(API + "/manual-data/save-analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
            },
            body: JSON.stringify({ filename, rows }),
        });

        const data = await response.json();
        if (!response.ok) {
            setMessage(data.error || "Unable to save/analyze data.", true);
            return;
        }

        setMessage(`Saved as ${data.saved_file} and analysis generated.`);
        updateDashboard(data);
    } catch (error) {
        setMessage("Network/API error while saving data.", true);
    }
}

function updateDashboard(data) {
    setText("rev", "Rs " + data.total_revenue.toLocaleString());
    setText("profit", "Rs " + data.total_profit.toLocaleString());
    setText("margin", data.profit_margin + " %");
    setText("avg", "Rs " + data.avg_order_value);
    setText("mean", data.mean_revenue);
    setText("median", data.median_revenue);
    setText("std", data.std_revenue);
    setText("maxday", data.max_day);
    setText("minday", data.min_day);

    setHtml("monthlyChart", `<img src="data:image/png;base64,${data.monthly_plot}" width="700"/>`);
    setHtml("pieChart", `<img src="data:image/png;base64,${data.pie_plot}" width="500"/>`);
    setHtml("corrChart", `<img src="data:image/png;base64,${data.corr_plot}" width="500"/>`);
    setText("topRevenue", formatRanking(data.top3_revenue, "Rs"));
    setText("topProfit", formatRanking(data.top3_profit, "Rs"));
    setText("bottomProfit", formatRanking(data.bottom3_profit, "Rs"));
    setText("insight", data.insight || "No insight generated.");
}

function formatRanking(items, prefix) {
    if (!items || Object.keys(items).length === 0) {
        return "No data available.";
    }
    const lines = [];
    let i = 1;
    for (const [name, value] of Object.entries(items)) {
        lines.push(`${i}. ${name}: ${prefix} ${Math.round(value).toLocaleString()}`);
        i += 1;
    }
    return lines.join("\n");
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.innerText = value;
    }
}

function setHtml(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.innerHTML = value;
    }
}

function setMessage(message, isError = false) {
    const element = document.getElementById("manualMsg");
    element.innerText = message;
    element.style.color = isError ? "#b42318" : "#1f4037";
}

function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
