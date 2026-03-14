import matplotlib

matplotlib.use("Agg")

import base64
from io import BytesIO

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns


def _parse_date(series):
    parsed = pd.to_datetime(series, errors="coerce", dayfirst=True)
    missing_mask = parsed.isna()
    if missing_mask.any():
        retry = pd.to_datetime(series[missing_mask], errors="coerce", dayfirst=False)
        parsed.loc[missing_mask] = retry
    return parsed


def _normalize_input(file):
    raw = pd.read_csv(file)
    df = raw.copy()
    df.columns = [str(col).strip().lower() for col in df.columns]

    if "date" not in df.columns:
        raise ValueError("CSV must contain a date column.")

    df["Date"] = _parse_date(df["date"])

    # Format A: Date,Product,Quantity,Selling_Price,Cost_Price
    if {"quantity", "selling_price", "cost_price"}.issubset(df.columns):
        df["Quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
        df["Selling_Price"] = pd.to_numeric(df["selling_price"], errors="coerce")
        df["Cost_Price"] = pd.to_numeric(df["cost_price"], errors="coerce")
        df["Revenue"] = df["Quantity"] * df["Selling_Price"]
        df["COGS"] = df["Quantity"] * df["Cost_Price"]
        if "product" in df.columns:
            df["Product"] = df["product"].astype(str)
        elif "category" in df.columns:
            df["Product"] = df["category"].astype(str)
        else:
            df["Product"] = "Unknown"

    # Format B: date,sales,expenses,(category optional)
    elif {"sales", "expenses"}.issubset(df.columns):
        df["Revenue"] = pd.to_numeric(df["sales"], errors="coerce")
        df["COGS"] = pd.to_numeric(df["expenses"], errors="coerce")
        if "product" in df.columns:
            df["Product"] = df["product"].astype(str)
        elif "category" in df.columns:
            df["Product"] = df["category"].astype(str)
        else:
            df["Product"] = "Uncategorized"

    # Format C: date,sales with no expense
    elif "sales" in df.columns:
        df["Revenue"] = pd.to_numeric(df["sales"], errors="coerce")
        df["COGS"] = 0.0
        if "product" in df.columns:
            df["Product"] = df["product"].astype(str)
        elif "category" in df.columns:
            df["Product"] = df["category"].astype(str)
        else:
            df["Product"] = "Uncategorized"
    else:
        raise ValueError(
            "Unsupported CSV format. Use either Date/Product/Quantity/Selling_Price/Cost_Price "
            "or date/sales/expenses/(category)."
        )

    normalized = df[["Date", "Product", "Revenue", "COGS"]].copy()
    normalized = normalized.dropna(subset=["Date", "Revenue", "COGS"])
    normalized["Revenue"] = pd.to_numeric(normalized["Revenue"], errors="coerce")
    normalized["COGS"] = pd.to_numeric(normalized["COGS"], errors="coerce")
    normalized = normalized.dropna(subset=["Revenue", "COGS"]).sort_values("Date")

    if normalized.empty:
        raise ValueError("No valid records found after cleaning the CSV.")

    # If dataset has no product/category labels, create useful groups instead of a single "All Sales" bucket.
    if normalized["Product"].nunique() == 1 and normalized["Product"].iloc[0] == "Uncategorized":
        q1 = normalized["Revenue"].quantile(0.33)
        q2 = normalized["Revenue"].quantile(0.66)

        def bucket(revenue):
            if revenue <= q1:
                return "Low Revenue Orders"
            if revenue <= q2:
                return "Medium Revenue Orders"
            return "High Revenue Orders"

        normalized["Product"] = normalized["Revenue"].apply(bucket)

    return normalized


def _figure_to_base64(fig):
    buffer = BytesIO()
    fig.savefig(buffer, format="png", bbox_inches="tight")
    buffer.seek(0)
    image = base64.b64encode(buffer.getvalue()).decode()
    plt.close(fig)
    return image


def generate_dashboard(file):
    try:
        df = _normalize_input(file)
    except ValueError as exc:
        return {"error": str(exc)}

    df["Profit"] = df["Revenue"] - df["COGS"]
    df["Month"] = df["Date"].dt.to_period("M")

    total_revenue = df["Revenue"].sum()
    total_cogs = df["COGS"].sum()
    total_profit = df["Profit"].sum()
    profit_margin = (total_profit / total_revenue) * 100 if total_revenue else 0.0
    avg_order_value = df["Revenue"].mean()

    mean_revenue = df["Revenue"].mean()
    median_revenue = df["Revenue"].median()
    std_revenue = df["Revenue"].std()
    max_day = df.loc[df["Revenue"].idxmax()]["Date"].strftime("%d-%m-%y")
    min_day = df.loc[df["Revenue"].idxmin()]["Date"].strftime("%d-%m-%y")

    monthly = df.groupby("Month")[["Revenue", "Profit"]].sum()
    fig, ax = plt.subplots(figsize=(8, 5))
    monthly.plot(marker="o", ax=ax)
    ax.set_xlabel("Month")
    ax.set_ylabel("Amount")
    ax.tick_params(axis="x", rotation=45)
    fig.tight_layout()
    monthly_plot = _figure_to_base64(fig)

    contribution = df.groupby("Product")["Revenue"].sum()
    contribution_percent = (contribution / total_revenue) * 100 if total_revenue else contribution
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.pie(contribution_percent, labels=contribution_percent.index, autopct="%1.1f%%")
    ax.set_title("Revenue Contribution %")
    fig.tight_layout()
    pie_plot = _figure_to_base64(fig)

    top3_revenue = contribution.sort_values(ascending=False).head(3).to_dict()
    top3_profit = (
        df.groupby("Product")["Profit"].sum().sort_values(ascending=False).head(3).to_dict()
    )
    bottom3_profit = df.groupby("Product")["Profit"].sum().sort_values().head(3).to_dict()

    corr = df[["Revenue", "Profit", "COGS"]].corr()
    fig, ax = plt.subplots(figsize=(5, 4))
    sns.heatmap(corr, annot=True, cmap="coolwarm", ax=ax)
    fig.tight_layout()
    corr_plot = _figure_to_base64(fig)

    best_product = contribution.idxmax()
    insight = (
        f"{best_product} contributes highest revenue. "
        f"Profit margin overall is {round(profit_margin, 2)}%."
    )

    return {
        "total_revenue": float(total_revenue),
        "total_cogs": float(total_cogs),
        "total_profit": float(total_profit),
        "profit_margin": round(float(profit_margin), 2),
        "avg_order_value": round(float(avg_order_value), 2),
        "mean_revenue": round(float(mean_revenue), 2),
        "median_revenue": round(float(median_revenue), 2),
        "std_revenue": round(float(std_revenue), 2),
        "max_day": max_day,
        "min_day": min_day,
        "monthly_plot": monthly_plot,
        "pie_plot": pie_plot,
        "corr_plot": corr_plot,
        "top3_revenue": top3_revenue,
        "top3_profit": top3_profit,
        "bottom3_profit": bottom3_profit,
        "insight": insight,
    }
