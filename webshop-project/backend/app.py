from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Fake database
products = [
    {"id": 1, "name": "Schoen", "price": 50},
    {"id": 2, "name": "Shirt", "price": 30}
]

users = []
orders = []

@app.route('/products')
def get_products():
    return jsonify(products)

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    users.append(data)
    return {"message": "registered"}

@app.route('/login', methods=['POST'])
def login():
    data = request.json

    for user in users:
        if user["email"] == data["email"] and user["password"] == data["password"]:
            return {"message": "login success"}

    return {"error": "invalid login"}

@app.route('/order', methods=['POST'])
def order():
    data = request.json
    orders.append(data)
    return {"message": "order placed"}

app.run(debug=True)