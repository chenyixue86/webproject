from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Fake database
products = [
    {"id": 1, "name": "Air Force 1 '07", "price": 110, "category": "Nike Sportswear", "image": "images/image.png"},
    {"id": 2, "name": "Phantom 6", "price": 180, "category": "Nike Football", "image": "images/haaland.png"},
    {"id": 3, "name": "Air Max 90", "price": 130, "category": "Nike Sportswear", "image": "images/3efoto.png"},
    {"id": 4, "name": "Nike Dunk Low", "price": 100, "category": "Nike Sportswear", "image": "images/4efoto.png"},
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