from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, get_jwt_identity, jwt_required
import os
import pickle
import re
import psycopg2
from werkzeug.security import check_password_hash, generate_password_hash
import numpy as np
import pandas as pd

from auth import login_user, register_user
from db import get_db, get_dict_cursor
from visualization import generate_dashboard


app = Flask(__name__)

CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "super-secret-key")
app.config["JWT_TOKEN_LOCATION"] = ["headers"]
app.config["JWT_HEADER_NAME"] = "Authorization"
app.config["JWT_HEADER_TYPE"] = "Bearer"

jwt = JWTManager(app)


def init_db():
    db = get_db()
    cur = db.cursor()

    try:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS businesses (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        db.commit()
    finally:
        cur.close()
        db.close()


init_db()

BASE_DIR = os.path.dirname(__file__)
FRONTEND_PATH = os.path.join(BASE_DIR, "..", "frontend")
SALES_MODEL_PATH = os.path.join(BASE_DIR, "sales_model.pkl")
PROFIT_MODEL_PATH = os.path.join(BASE_DIR, "profit_model.pkl")
MANUAL_DATA_DIR = os.path.join(BASE_DIR, "..", "manual_uploads")
os.makedirs(MANUAL_DATA_DIR, exist_ok=True)


def load_model(model_path):
    if not os.path.exists(model_path):
        return None
    with open(model_path, "rb") as model_file:
        return pickle.load(model_file)


def model_features(model):
    if model is None:
        return []
    return list(getattr(model, "feature_names_in_", []))


sales_model = load_model(SALES_MODEL_PATH)
profit_model = load_model(PROFIT_MODEL_PATH)


def parse_forecast_csv(file_obj):
    raw_df = pd.read_csv(file_obj)
    df = raw_df.copy()
    df.columns = [str(col).strip().lower() for col in df.columns]

    if "date" not in df.columns:
        raise ValueError("CSV must include a Date/date column.")

    if "sales" not in df.columns:
        if "revenue" in df.columns:
            df["sales"] = df["revenue"]
        elif {"quantity", "selling_price"}.issubset(df.columns):
            df["sales"] = pd.to_numeric(df["quantity"], errors="coerce") * pd.to_numeric(
                df["selling_price"], errors="coerce"
            )
        else:
            raise ValueError(
                "Sales not found. Provide Sales/Revenue or Quantity + Selling_Price."
            )

    if "expenses" not in df.columns:
        if "expense" in df.columns:
            df["expenses"] = df["expense"]
        elif "cogs" in df.columns:
            df["expenses"] = df["cogs"]
        elif {"quantity", "cost_price"}.issubset(df.columns):
            df["expenses"] = pd.to_numeric(df["quantity"], errors="coerce") * pd.to_numeric(
                df["cost_price"], errors="coerce"
            )

    df["date"] = pd.to_datetime(df["date"], errors="coerce", dayfirst=True)
    df["sales"] = pd.to_numeric(df["sales"], errors="coerce")
    if "expenses" in df.columns:
        df["expenses"] = pd.to_numeric(df["expenses"], errors="coerce")

    df = df.dropna(subset=["date", "sales"]).sort_values("date").reset_index(drop=True)
    if df.empty:
        raise ValueError("No valid rows after parsing date and sales values.")

    df["day_number"] = np.arange(len(df))
    df["month"] = df["date"].dt.month
    df["day_of_week"] = df["date"].dt.dayofweek
    df["year"] = df["date"].dt.year
    df["day"] = df["date"].dt.day

    return raw_df, df


def build_future_frame(last_date, base_day_number, horizon_days):
    future_dates = pd.date_range(
        start=last_date + pd.Timedelta(days=1), periods=horizon_days, freq="D"
    )
    return pd.DataFrame(
        {
            "date": future_dates,
            "day_number": np.arange(base_day_number + 1, base_day_number + horizon_days + 1),
            "month": future_dates.month,
            "day_of_week": future_dates.dayofweek,
            "year": future_dates.year,
            "day": future_dates.day,
        }
    )


def pick_columns(df, required_features):
    missing = [feature for feature in required_features if feature not in df.columns]
    if missing:
        raise ValueError(f"Missing required model features: {', '.join(missing)}")
    return df[required_features]


def safe_csv_filename(filename):
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", (filename or "").strip())
    safe_name = safe_name.strip("._")
    if not safe_name:
        raise ValueError("Filename is required.")
    if not safe_name.lower().endswith(".csv"):
        safe_name += ".csv"
    return safe_name


def fetch_user_profile(user_id):
    db = get_db()
    cur = get_dict_cursor(db)
    cur.execute(
        """
        SELECT
            u.id,
            u.name,
            u.email,
            u.role,
            b.name AS business_name
        FROM users u
        LEFT JOIN businesses b ON b.user_id = u.id
        WHERE u.id = %s
        LIMIT 1
        """,
        (user_id,),
    )
    row = cur.fetchone()
    cur.close()
    db.close()
    return row


@app.route("/")
def home():
    return send_from_directory(FRONTEND_PATH, "index.html")


@app.route("/<path:filename>")
def serve_files(filename):
    return send_from_directory(FRONTEND_PATH, filename)


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(force=True)
    register_user(
        data["name"],
        data["email"],
        data["password"],
        data["role"],
        data.get("business_name"),
    )
    return jsonify({"msg": "Registered Successfully"})


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    user = login_user(data["email"], data["password"])
    if not user:
        return jsonify({"msg": "Invalid Login"}), 401
    token = create_access_token(identity=str(user["id"]))
    return jsonify({"token": token})


@app.route("/api/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = int(get_jwt_identity())
    profile = fetch_user_profile(user_id)
    if not profile:
        return jsonify({"error": "User not found"}), 404
    return jsonify(
        {
            "id": profile["id"],
            "name": profile["name"],
            "email": profile["email"],
            "role": profile["role"],
            "business_name": profile.get("business_name") or "",
            "password_mask": "**********",
        }
    )


@app.route("/api/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    payload = request.get_json(force=True)

    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip()
    role = str(payload.get("role", "")).strip().lower()
    business_name = str(payload.get("business_name", "")).strip()
    current_password = str(payload.get("current_password", ""))
    new_password = str(payload.get("new_password", ""))

    if not name or not email or not role:
        return jsonify({"error": "name, email and role are required"}), 400

    allowed_roles = {"user", "business"}
    if role not in allowed_roles:
        return jsonify({"error": "Invalid role. Allowed roles are: user, business."}), 400

    db = get_db()
    cur = get_dict_cursor(db)

    try:
        cur.execute("SELECT password FROM users WHERE id=%s LIMIT 1", (user_id,))
        existing_user = cur.fetchone()
        if not existing_user:
            return jsonify({"error": "User not found"}), 404

        update_fields = [("name", name), ("email", email), ("role", role)]
        if new_password:
            if not current_password:
                return jsonify({"error": "Current password is required to set a new password."}), 400
            if len(new_password) < 6:
                return jsonify({"error": "New password must be at least 6 characters long."}), 400
            if not check_password_hash(existing_user["password"], current_password):
                return jsonify({"error": "Current password is incorrect."}), 400
            update_fields.append(("password", generate_password_hash(new_password)))

        set_clause = ", ".join(f"{column}=%s" for column, _ in update_fields)
        update_values = [value for _, value in update_fields]
        cur.execute(
            f"UPDATE users SET {set_clause} WHERE id=%s",
            (*update_values, user_id),
        )

        cur.execute("SELECT id FROM businesses WHERE user_id=%s LIMIT 1", (user_id,))
        existing_business = cur.fetchone()

        if business_name:
            if existing_business:
                cur.execute(
                    "UPDATE businesses SET name=%s WHERE user_id=%s",
                    (business_name, user_id),
                )
            else:
                cur.execute(
                    "INSERT INTO businesses(user_id, name) VALUES(%s, %s)",
                    (user_id, business_name),
                )

        db.commit()
    except psycopg2.IntegrityError:
        db.rollback()
        return jsonify({"error": "Email already exists. Use a different email."}), 409
    except psycopg2.Error as exc:
        db.rollback()
        return jsonify({"error": f"Database error: {str(exc).strip()}"}), 500
    finally:
        cur.close()
        db.close()

    updated_profile = fetch_user_profile(user_id)
    return jsonify(
        {
            "msg": "Profile updated successfully",
            "profile": {
                "id": updated_profile["id"],
                "name": updated_profile["name"],
                "email": updated_profile["email"],
                "role": updated_profile["role"],
                "business_name": updated_profile.get("business_name") or "",
                "password_mask": "**********",
            },
        }
    )


@app.route("/api/analyze-file", methods=["POST"])
@jwt_required()
def analyze_uploaded_file():
    if "file" not in request.files:
        return {"error": "No file uploaded"}, 400
    file = request.files["file"]
    return generate_dashboard(file)


@app.route("/api/manual-data/save-analyze", methods=["POST"])
@jwt_required()
def save_and_analyze_manual_data():
    payload = request.get_json(force=True)
    filename = payload.get("filename")
    rows = payload.get("rows", [])

    if not isinstance(rows, list) or len(rows) == 0:
        return jsonify({"error": "At least one row is required."}), 400

    try:
        safe_name = safe_csv_filename(filename)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    manual_df = pd.DataFrame(rows).copy()
    manual_df.columns = [str(col).strip().lower() for col in manual_df.columns]

    # Standard manual-entry columns for analysis compatibility.
    expected_cols = ["date", "sales", "expenses", "category"]
    for col in expected_cols:
        if col not in manual_df.columns:
            manual_df[col] = ""
    manual_df = manual_df[expected_cols]

    manual_df = manual_df.replace("", np.nan)
    manual_df = manual_df.dropna(how="all")
    if manual_df.empty:
        return jsonify({"error": "Manual data is empty."}), 400

    if manual_df["date"].isna().all() or manual_df["sales"].isna().all():
        return jsonify({"error": "Each dataset needs at least date and sales values."}), 400

    output_path = os.path.join(MANUAL_DATA_DIR, safe_name)
    manual_df.to_csv(output_path, index=False)

    result = generate_dashboard(output_path)
    if "error" in result:
        return jsonify(result), 400

    result["saved_file"] = safe_name
    return jsonify(result)


@app.route("/api/forecast", methods=["POST"])
@jwt_required()
def forecast_sales():
    if sales_model is None:
        return jsonify({"error": "Sales model not loaded from backend/sales_model.pkl"}), 500

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    try:
        horizon_days = 180
        _, df = parse_forecast_csv(request.files["file"])

        future_frame = build_future_frame(
            last_date=df["date"].iloc[-1],
            base_day_number=int(df["day_number"].iloc[-1]),
            horizon_days=horizon_days,
        )

        sales_features = model_features(sales_model) or ["day_number", "month"]
        sales_pred = sales_model.predict(pick_columns(future_frame, sales_features))

        profit_pred = []
        profit_features = model_features(profit_model)
        if profit_model is not None and "expenses" in df.columns:
            df["profit"] = df["sales"] - df["expenses"]
            df["lag_1"] = df["profit"].shift(1)
            df["rolling_7"] = df["profit"].rolling(7).mean()
            df = df.dropna(subset=["profit", "lag_1", "rolling_7"]).copy()

            if not df.empty:
                rolling_window = df["profit"].tail(7).tolist()
                last_profit = float(df["profit"].iloc[-1])
                expected_profit_features = profit_features or [
                    "day_number",
                    "month",
                    "day_of_week",
                    "lag_1",
                    "rolling_7",
                ]

                for _, row in future_frame.iterrows():
                    point = row.to_dict()
                    point["lag_1"] = last_profit
                    point["rolling_7"] = float(np.mean(rolling_window))
                    input_df = pd.DataFrame([point])
                    predicted = float(
                        profit_model.predict(pick_columns(input_df, expected_profit_features))[0]
                    )
                    profit_pred.append(predicted)
                    rolling_window = (rolling_window + [predicted])[-7:]
                    last_profit = predicted

        category_breakdown = {}
        if "category" in df.columns:
            category_breakdown = df.groupby("category")["sales"].sum().to_dict()

        return jsonify(
            {
                "future_days_180": future_frame["day_number"].tolist(),
                "future_dates_180": future_frame["date"].dt.strftime("%Y-%m-%d").tolist(),
                "sales_6_months": [float(value) for value in sales_pred],
                "profit_6_months": [float(value) for value in profit_pred],
                "category_breakdown": category_breakdown,
                "models_loaded": {
                    "sales_model": True,
                    "profit_model": profit_model is not None,
                    "sales_features": sales_features,
                    "profit_features": profit_features,
                },
            }
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Forecast failed: {str(exc)}"}), 500


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )
