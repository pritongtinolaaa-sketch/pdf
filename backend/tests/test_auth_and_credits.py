import os
import tempfile

import pytest

import server as app_server


@pytest.fixture
def client():
    with tempfile.TemporaryDirectory() as tmp:
        db_path = os.path.join(tmp, 'test_users.db')
        app_server.DB_PATH = db_path
        app_server.init_db()
        app_server.app.config['TESTING'] = True
        with app_server.app.test_client() as c:
            yield c


def test_register_starts_with_30_credits(client):
    res = client.post(
        '/api/auth/register',
        json={
            'email': 'u1@example.com',
            'username': 'userone',
            'password': 'secret123',
        },
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body['user']['credits'] == 30


def test_login_requires_verification_for_non_admin(client):
    client.post(
        '/api/auth/register',
        json={
            'email': 'u2@example.com',
            'username': 'usertwo',
            'password': 'secret123',
        },
    )
    res = client.post('/api/auth/login', json={'email': 'u2@example.com', 'password': 'secret123'})
    assert res.status_code == 403


def test_estimate_endpoint_requires_auth(client):
    res = client.post('/api/tools/estimate', json={'tool_id': 'merge', 'file_count': 2, 'total_mb': 1.2})
    assert res.status_code == 401
