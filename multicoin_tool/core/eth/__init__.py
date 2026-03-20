"""Ethereum/BSC key and address helpers, including Keccak-256 and EIP-55."""

from __future__ import annotations

from dataclasses import dataclass

from core.secp256k1 import private_key_to_public_key

MASK64 = (1 << 64) - 1


_ROTC = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14],
]

_RC = [
    0x0000000000000001,
    0x0000000000008082,
    0x800000000000808A,
    0x8000000080008000,
    0x000000000000808B,
    0x0000000080000001,
    0x8000000080008081,
    0x8000000000008009,
    0x000000000000008A,
    0x0000000000000088,
    0x0000000080008009,
    0x000000008000000A,
    0x000000008000808B,
    0x800000000000008B,
    0x8000000000008089,
    0x8000000000008003,
    0x8000000000008002,
    0x8000000000000080,
    0x000000000000800A,
    0x800000008000000A,
    0x8000000080008081,
    0x8000000000008080,
    0x0000000080000001,
    0x8000000080008008,
]


@dataclass(frozen=True)
class EvmAddress:
    network: str
    derivation_path: str
    address: str


def _rol64(value: int, shift: int) -> int:
    shift %= 64
    return ((value << shift) | (value >> (64 - shift))) & MASK64


def _keccak_f(state: list[int]) -> None:
    for rc in _RC:
        c = [
            state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20]
            for x in range(5)
        ]
        d = [(c[(x - 1) % 5] ^ _rol64(c[(x + 1) % 5], 1)) & MASK64 for x in range(5)]

        for x in range(5):
            for y in range(5):
                state[x + 5 * y] = (state[x + 5 * y] ^ d[x]) & MASK64

        b = [0] * 25
        for x in range(5):
            for y in range(5):
                new_x = y
                new_y = (2 * x + 3 * y) % 5
                b[new_x + 5 * new_y] = _rol64(state[x + 5 * y], _ROTC[x][y])

        for y in range(5):
            row = [b[x + 5 * y] for x in range(5)]
            for x in range(5):
                state[x + 5 * y] = (row[x] ^ ((~row[(x + 1) % 5]) & row[(x + 2) % 5])) & MASK64

        state[0] = (state[0] ^ rc) & MASK64


def keccak256(data: bytes) -> bytes:
    rate_bytes = 136
    state = [0] * 25

    padded = bytearray(data)
    padded.append(0x01)
    while (len(padded) % rate_bytes) != rate_bytes - 1:
        padded.append(0x00)
    padded.append(0x80)

    for block_start in range(0, len(padded), rate_bytes):
        block = padded[block_start : block_start + rate_bytes]
        for i in range(rate_bytes // 8):
            lane = int.from_bytes(block[i * 8 : (i + 1) * 8], "little")
            state[i] = (state[i] ^ lane) & MASK64
        _keccak_f(state)

    out = bytearray()
    while len(out) < 32:
        for i in range(rate_bytes // 8):
            out.extend(state[i].to_bytes(8, "little"))
            if len(out) >= 32:
                break
        if len(out) < 32:
            _keccak_f(state)

    return bytes(out[:32])


def to_eip55_checksum(address_hex_no_prefix: str) -> str:
    lower = address_hex_no_prefix.lower()
    digest = keccak256(lower.encode("ascii")).hex()
    checksummed = ""
    for i, char in enumerate(lower):
        if char in "0123456789":
            checksummed += char
        else:
            checksummed += char.upper() if int(digest[i], 16) >= 8 else char
    return "0x" + checksummed


def private_key_to_evm_address(private_key: bytes) -> str:
    pub_uncompressed = private_key_to_public_key(private_key, compressed=False)
    pub_raw = pub_uncompressed[1:]
    address = keccak256(pub_raw)[-20:].hex()
    return to_eip55_checksum(address)


def derive_evm_address(private_key: bytes, path: str, network: str) -> EvmAddress:
    return EvmAddress(
        network=network,
        derivation_path=path,
        address=private_key_to_evm_address(private_key),
    )
