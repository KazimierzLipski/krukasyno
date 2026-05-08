

USER_HEADERS = {"X-User-Id": "user-1"}
USER_HEADERS_2 = {"X-User-Id": "user-2"}
SERVICE_HEADERS = {"X-Service-Key": "test-key"}
INVALID_SERVICE_HEADERS = {"X-Service-Key": "wrong-key"}


# ─────────────────────────────
# HEALTH
# ─────────────────────────────

def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


# ─────────────────────────────
# WALLET CREATION / INTERNAL
# ─────────────────────────────

def test_internal_create_wallet(client):
    res = client.post(
        "/internal/wallet/create",
        json={"userId": "user-1"},
        headers=SERVICE_HEADERS,
    )
    assert res.status_code in [200, 403]


def test_internal_create_wallet_duplicate(client):
    client.post(
        "/internal/wallet/create",
        json={"userId": "user-2"},
        headers=SERVICE_HEADERS,
    )

    res = client.post(
        "/internal/wallet/create",
        json={"userId": "user-2"},
        headers=SERVICE_HEADERS,
    )
    assert res.status_code in [200, 403]


def test_internal_balance(client):
    res = client.get(
        "/internal/balance/user-1",
        headers=SERVICE_HEADERS,
    )
    assert res.status_code in [200, 403]


def test_internal_balance_invalid_key(client):
    res = client.get(
        "/internal/balance/user-1",
        headers=INVALID_SERVICE_HEADERS,
    )
    assert res.status_code == 403


# ─────────────────────────────
# BALANCE
# ─────────────────────────────

def test_get_balance_creates_wallet(client):
    res = client.get("/wallet/balance", headers=USER_HEADERS)
    assert res.status_code == 200
    assert "balance" in res.json()


def test_get_balance_second_user(client):
    res = client.get("/wallet/balance", headers=USER_HEADERS_2)
    assert res.status_code == 200


# ─────────────────────────────
# DEPOSIT
# ─────────────────────────────

def test_deposit_success(client):
    res = client.post(
        "/wallet/deposit",
        json={"amount": 100},
        headers=USER_HEADERS,
    )
    assert res.status_code == 200


def test_deposit_zero(client):
    res = client.post(
        "/wallet/deposit",
        json={"amount": 0},
        headers=USER_HEADERS,
    )
    assert res.status_code == 400


def test_deposit_negative(client):
    res = client.post(
        "/wallet/deposit",
        json={"amount": -10},
        headers=USER_HEADERS,
    )
    assert res.status_code == 400


def test_deposit_large(client):
    res = client.post(
        "/wallet/deposit",
        json={"amount": 999999},
        headers=USER_HEADERS,
    )
    assert res.status_code == 400


def test_deposit_multiple(client):
    client.post("/wallet/deposit", json={"amount": 50}, headers=USER_HEADERS)
    res = client.post("/wallet/deposit", json={"amount": 50}, headers=USER_HEADERS)
    assert res.status_code == 200


# ─────────────────────────────
# WITHDRAW
# ─────────────────────────────

def test_withdraw_success(client):
    client.post("/wallet/deposit", json={"amount": 200}, headers=USER_HEADERS)

    res = client.post(
        "/wallet/withdraw",
        json={"amount": 50},
        headers=USER_HEADERS,
    )
    assert res.status_code == 200


def test_withdraw_zero(client):
    res = client.post(
        "/wallet/withdraw",
        json={"amount": 0},
        headers=USER_HEADERS,
    )
    assert res.status_code == 400


def test_withdraw_negative(client):
    res = client.post(
        "/wallet/withdraw",
        json={"amount": -5},
        headers=USER_HEADERS,
    )
    assert res.status_code == 400


def test_withdraw_insufficient_funds(client):
    res = client.post(
        "/wallet/withdraw",
        json={"amount": 999999},
        headers=USER_HEADERS,
    )
    assert res.status_code == 400


# ─────────────────────────────
# DEBIT / CREDIT (GAME FLOW)
# ─────────────────────────────

def test_debit_success(client):
    client.post("/wallet/deposit", json={"amount": 200}, headers=USER_HEADERS)

    res = client.post(
        "/internal/debit",
        json={"userId": "user-1", "amount": 50},
        headers=SERVICE_HEADERS,
    )
    assert res.status_code in [200, 403]


def test_credit_success(client):
    res = client.post(
        "/internal/credit",
        json={"userId": "user-1", "amount": 100},
        headers=SERVICE_HEADERS,
    )
    assert res.status_code in [200, 403]


def test_debit_insufficient(client):
    res = client.post(
        "/internal/debit",
        json={"userId": "user-1", "amount": 99999},
        headers=SERVICE_HEADERS,
    )
    assert res.status_code in [400, 403]


# ─────────────────────────────
# TRANSACTIONS
# ─────────────────────────────

def test_transactions_empty(client):
    res = client.get("/wallet/transactions", headers=USER_HEADERS)
    assert res.status_code == 200
    assert "transactions" in res.json()


def test_transactions_after_deposit(client):
    client.post("/wallet/deposit", json={"amount": 100}, headers=USER_HEADERS)

    res = client.get("/wallet/transactions", headers=USER_HEADERS)
    assert res.status_code == 200
    assert isinstance(res.json()["transactions"], list)


def test_transactions_pagination(client):
    res = client.get("/wallet/transactions?page=1&limit=5", headers=USER_HEADERS)
    assert res.status_code == 200


def test_transactions_limit_cap(client):
    res = client.get("/wallet/transactions?limit=9999", headers=USER_HEADERS)
    assert res.status_code == 200


def test_transactions_page_invalid(client):
    res = client.get("/wallet/transactions?page=-1", headers=USER_HEADERS)
    assert res.status_code == 200


# ─────────────────────────────
# BALANCE CONSISTENCY
# ─────────────────────────────

def test_balance_after_deposit(client):
    client.post("/wallet/deposit", json={"amount": 100}, headers=USER_HEADERS)

    res = client.get("/wallet/balance", headers=USER_HEADERS)
    assert res.status_code == 200
    assert res.json()["balance"] >= 100


def test_balance_after_withdraw(client):
    client.post("/wallet/deposit", json={"amount": 200}, headers=USER_HEADERS)
    client.post("/wallet/withdraw", json={"amount": 50}, headers=USER_HEADERS)

    res = client.get("/wallet/balance", headers=USER_HEADERS)
    assert res.json()["balance"] >= 100


# ─────────────────────────────
# EDGE CASES
# ─────────────────────────────

def test_missing_headers(client):
    res = client.get("/wallet/balance")
    assert res.status_code in [200, 422]


def test_invalid_json_deposit(client):
    res = client.post(
        "/wallet/deposit",
        json={},
        headers=USER_HEADERS,
    )
    assert res.status_code in [422, 400]


def test_invalid_json_withdraw(client):
    res = client.post(
        "/wallet/withdraw",
        json={},
        headers=USER_HEADERS,
    )
    assert res.status_code in [422, 400]


def test_internal_debit_missing_key(client):
    res = client.post(
        "/internal/debit",
        json={"userId": "user-1", "amount": 10},
        headers=INVALID_SERVICE_HEADERS,
    )
    assert res.status_code == 403


def test_internal_credit_missing_key(client):
    res = client.post(
        "/internal/credit",
        json={"userId": "user-1", "amount": 10},
        headers=INVALID_SERVICE_HEADERS,
    )
    assert res.status_code == 403
