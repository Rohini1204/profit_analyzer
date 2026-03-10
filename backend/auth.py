from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db

# Register User
def register_user(name, email, password, role, business_name=None):

    db = get_db()
    cur = db.cursor()

    hashed = generate_password_hash(password)

    # Inserting the user
    cur.execute("""
        INSERT INTO users(name,email,password,role)
        VALUES(%s,%s,%s,%s)
    """, (name, email, hashed, role))

    user_id = cur.lastrowid

    # creating business name
    if role == "business" and business_name:

        cur.execute("""
            INSERT INTO businesses(user_id,name)
            VALUES(%s,%s)
        """, (user_id, business_name))

    db.commit()


# user login
def login_user(email, password):

    db = get_db()
    cur = db.cursor(dictionary=True)

    cur.execute("""
        SELECT * FROM users WHERE email=%s
    """, (email,))

    user = cur.fetchone()

    if user and check_password_hash(user["password"], password):
        return user

    return None
