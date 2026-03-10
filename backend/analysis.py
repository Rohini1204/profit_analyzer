import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import base64
from io import BytesIO


def analyze_csv(file):

    df = pd.read_csv(file)

    # Cleaning
    df["Date"] = pd.to_datetime(df["Date"])
    df["Revenue"] = pd.to_numeric(df["Revenue"])
    df["Expense"] = pd.to_numeric(df["Expense"])

    # Feature engineering
    df["Profit"] = df["Revenue"] - df["Expense"]
    df["Month"] = df["Date"].dt.strftime("%Y-%m")

    # KPIs
    total_revenue = df["Revenue"].sum()
    total_expense = df["Expense"].sum()
    total_profit = df["Profit"].sum()
    profit_margin = (total_profit / total_revenue) * 100

    # Monthly Revenue Plot
    monthly = df.groupby("Month")["Revenue"].sum()

    plt.figure(figsize=(6,4))
    sns.lineplot(x=monthly.index, y=monthly.values)
    plt.title("Monthly Revenue")
    plt.xticks(rotation=45)
    plt.tight_layout()

    buffer = BytesIO()
    plt.savefig(buffer, format="png")
    buffer.seek(0)
    monthly_img = base64.b64encode(buffer.getvalue()).decode()
    plt.close()

    # Category Revenue Plot
    category = df.groupby("Category")["Revenue"].sum()

    plt.figure(figsize=(6,4))
    sns.barplot(x=category.index, y=category.values)
    plt.title("Category Revenue")
    plt.tight_layout()

    buffer2 = BytesIO()
    plt.savefig(buffer2, format="png")
    buffer2.seek(0)
    category_img = base64.b64encode(buffer2.getvalue()).decode()
    plt.close()

    return {
        "total_revenue": float(total_revenue),
        "total_expense": float(total_expense),
        "total_profit": float(total_profit),
        "profit_margin": round(float(profit_margin), 2),
        "monthly_plot": monthly_img,
        "category_plot": category_img
    }
