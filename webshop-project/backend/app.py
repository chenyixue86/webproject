from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import requests as http_requests

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization"])

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///anitrack.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'dev-secret-change-in-production'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    username = db.Column(db.String(80), nullable=False)
    password = db.Column(db.String(200), nullable=False)
    favorites = db.relationship('Favorite', backref='user', lazy=True, cascade='all, delete-orphan')


class Favorite(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    anime_id = db.Column(db.Integer, nullable=False)
    anime_title = db.Column(db.String(300), nullable=False)
    anime_image = db.Column(db.String(500), nullable=True)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)


with app.app_context():
    db.create_all()


@app.route('/register', methods=['POST'])
def register():
    data = request.json or {}
    email = data.get('email', '').strip()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not email or not username or not password:
        return jsonify({'error': 'All fields are required'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already in use'}), 409

    hashed = bcrypt.generate_password_hash(password).decode('utf-8')
    user = User(email=email, username=username, password=hashed)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'username': user.username}), 201


@app.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    user = User.query.filter_by(email=data.get('email', '').strip()).first()

    if not user or not bcrypt.check_password_hash(user.password, data.get('password', '')):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'username': user.username})


@app.route('/favorites', methods=['GET'])
@jwt_required()
def get_favorites():
    user_id = int(get_jwt_identity())
    favs = Favorite.query.filter_by(user_id=user_id).order_by(Favorite.added_at.desc()).all()
    return jsonify([{
        'anime_id': f.anime_id,
        'anime_title': f.anime_title,
        'anime_image': f.anime_image,
        'added_at': f.added_at.isoformat()
    } for f in favs])


@app.route('/favorites', methods=['POST'])
@jwt_required()
def add_favorite():
    user_id = int(get_jwt_identity())
    data = request.json or {}

    if not data.get('anime_id'):
        return jsonify({'error': 'anime_id required'}), 400

    if Favorite.query.filter_by(user_id=user_id, anime_id=data['anime_id']).first():
        return jsonify({'error': 'Already in favorites'}), 409

    fav = Favorite(
        user_id=user_id,
        anime_id=data['anime_id'],
        anime_title=data.get('anime_title', 'Unknown'),
        anime_image=data.get('anime_image', '')
    )
    db.session.add(fav)
    db.session.commit()
    return jsonify({'message': 'Added'}), 201


@app.route('/favorites/<int:anime_id>', methods=['DELETE'])
@jwt_required()
def remove_favorite(anime_id):
    user_id = int(get_jwt_identity())
    fav = Favorite.query.filter_by(user_id=user_id, anime_id=anime_id).first()
    if not fav:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(fav)
    db.session.commit()
    return jsonify({'message': 'Removed'})


@app.route('/api/anime', methods=['POST'])
def anime_proxy():
    try:
        res = http_requests.post(
            'https://graphql.anilist.co',
            json=request.get_json(),
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        return jsonify(res.json()), res.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
