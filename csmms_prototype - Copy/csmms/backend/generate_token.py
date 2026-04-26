import jwt
import datetime

secret = 'your-super-secret-key-change-this'
payload = {
    'sub': '2',
    'role': 'provider',
    'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
}
token = jwt.encode(payload, secret, algorithm='HS256')
print(token)
