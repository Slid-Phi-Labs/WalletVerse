#!/usr/bin/env python3
"""Admin unlock for ComputePay — L33tSaaS owner gate.

Refuses closed: there is no default admin code. Unless ADMIN_CODE is set in
the environment, every code is rejected and the gate reports unconfigured.
"""
from __future__ import annotations
import hashlib, hmac, os
from typing import Any, Dict, Optional

ADMIN_CODE = os.environ.get("ADMIN_CODE") or ""


def is_admin_configured() -> bool:
    return bool(ADMIN_CODE)


def verify_admin_code(code: Optional[str]) -> bool:
    if not is_admin_configured():
        return False
    if not code or not isinstance(code, str):
        return False
    expected = hashlib.sha256(ADMIN_CODE.encode("utf-8")).digest()
    got = hashlib.sha256(code.encode("utf-8")).digest()
    return hmac.compare_digest(got, expected)


def grant_admin_payload(user_id: Optional[str] = None) -> Dict[str, Any]:
    return {
        "role": "admin",
        "plan": "admin",
        "billing_bypass": True,
        "free_admin": True,
        "user_id": user_id,
        "source": "admin_code",
    }
