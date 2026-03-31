📊 Small Business Sales & Profit Analyzer

A full-stack analytics platform that helps small businesses analyze sales data, visualize trends, and predict future sales and profit using machine learning.

---

🚀 Live Demo

🔗 https://profit-analyzer-backend.onrender.com

---

📌 Features

- 📈 Track sales, expenses, and profit trends
- 📂 Upload CSV datasets or manually enter data
- 📊 Interactive dashboards with visual charts
- 🤖 AI-powered sales and profit forecasting
- 🔐 User authentication (login/register)
- 👤 Profile management with role-based access

---

🛠️ Tech Stack

Frontend

- HTML, CSS, JavaScript

Backend

- Flask (Python)

Machine Learning

- Scikit-learn
- Pandas, NumPy

Database

- MySQL

Deployment

- Render (Backend)
- FreeSQLDatabase (MySQL hosting)

---

⚙️ How It Works

1. Users upload a dataset or enter data manually
2. Data is cleaned and processed using Pandas
3. Visualizations are generated for analysis
4. ML models predict future sales and profit trends
5. Results are displayed on an interactive dashboard

---

📁 Project Structure

backend/
    app.py
    auth.py
    db.py
    visualization.py
    sales_model.pkl
    profit_model.pkl

frontend/
    index.html
    styles.css
    script.js

manual_uploads/
requirements.txt

---

🧠 Machine Learning

- Sales prediction model using regression
- Profit prediction using lag & rolling features
- Models saved as ".pkl" and loaded in backend

---

🔐 Environment Variables

Create a ".env" file:

DB_HOST=your_host
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=your_db

---

📜 License

This project is licensed under the MIT License.
