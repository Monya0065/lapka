"""BIP32 hierarchical deterministic private key derivation."""

from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass

from core.btc import hash160
from core.secp256k1 import N, private_key_to_public_key

HARDENED_OFFSET = 0x80000000


def _hmac_sha512(key: bytes, data: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha512).digest()


def parse_path(path: str) -> list[int]:
    path = path.strip()
    if not path:
        raise ValueError("Derivation path is empty")
    if path in ("m", "M"):
        return []
    if not (path.startswith("m/") or path.startswith("M/")):
        raise ValueError("Derivation path must start with m/")

    indexes: list[int] = []
    for chunk in path[2:].split("/"):
        chunk = chunk.strip()
        if not chunk:
            raise ValueError("Empty path segment")

        hardened = chunk.endswith(("'", "h", "H"))
        value_part = chunk[:-1] if hardened else chunk
        if not value_part.isdigit():
            raise ValueError(f"Invalid path segment: {chunk}")

        value = int(value_part)
        if value < 0 or value >= HARDENED_OFFSET:
            raise ValueError(f"Path index out of range: {chunk}")
        indexes.append(value + HARDENED_OFFSET if hardened else value)
    return indexes


@dataclass(frozen=True)
class HDNode:
    private_key: bytes
    chain_code: bytes
    depth: int = 0
    parent_fingerprint: bytes = b"\x00\x00\x00\x00"
    child_index: int = 0

    @staticmethod
    def from_seed(seed: bytes) -> "HDNode":
        if len(seed) < 16:
            raise ValueError("Seed is too short")
        i = _hmac_sha512(b"Bitcoin seed", seed)
        il, ir = i[:32], i[32:]
        il_int = int.from_bytes(il, "big")
        if il_int == 0 or il_int >= N:
            raise ValueError("Invalid master private key from seed")
        return HDNode(private_key=il, chain_code=ir)

    def public_key(self, compressed: bool = True) -> bytes:
        return private_key_to_public_key(self.private_key, compressed=compressed)

    def fingerprint(self) -> bytes:
        return hash160(self.public_key(compressed=True))[:4]

    def ckd_priv(self, index: int) -> "HDNode":
        if index < 0 or index > 0xFFFFFFFF:
            raise ValueError("Child index out of range")

        if index >= HARDENED_OFFSET:
            data = b"\x00" + self.private_key + index.to_bytes(4, "big")
        else:
            data = self.public_key(compressed=True) + index.to_bytes(4, "big")

        i = _hmac_sha512(self.chain_code, data)
        il, ir = i[:32], i[32:]
        il_int = int.from_bytes(il, "big")
        if il_int >= N:
            raise ValueError("Invalid child key: IL >= curve order")

        parent_int = int.from_bytes(self.private_key, "big")
        child_int = (il_int + parent_int) % N
        if child_int == 0:
            raise ValueError("Invalid child key: zero private key")

        return HDNode(
            private_key=child_int.to_bytes(32, "big"),
            chain_code=ir,
            depth=self.depth + 1,
            parent_fingerprint=self.fingerprint(),
            child_index=index,
        )

    def derive_path(self, path: str) -> "HDNode":
        node = self
        for index in parse_path(path):
            node = node.ckd_priv(index)
        return node
