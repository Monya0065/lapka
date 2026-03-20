"""Bitcoin/Litecoin encoders and address builders."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from core.secp256k1 import private_key_to_public_key


@dataclass(frozen=True)
class UTXONetworkParams:
    name: str
    p2pkh_prefix: bytes
    p2sh_prefix: bytes
    bech32_hrp: str


BTC_MAINNET = UTXONetworkParams(
    name="btc",
    p2pkh_prefix=b"\x00",
    p2sh_prefix=b"\x05",
    bech32_hrp="bc",
)

LTC_MAINNET = UTXONetworkParams(
    name="ltc",
    p2pkh_prefix=b"\x30",
    p2sh_prefix=b"\x32",
    bech32_hrp="ltc",
)


@dataclass(frozen=True)
class UTXOAddress:
    network: str
    derivation_path: str
    address: str
    script_pubkey_hex: str
    electrum_scripthash: str


def sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def ripemd160(data: bytes) -> bytes:
    return hashlib.new("ripemd160", data).digest()


def hash160(data: bytes) -> bytes:
    return ripemd160(sha256(data))


_B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def base58_encode(data: bytes) -> str:
    value = int.from_bytes(data, "big")
    encoded = ""
    while value > 0:
        value, mod = divmod(value, 58)
        encoded = _B58_ALPHABET[mod] + encoded

    leading_zeros = len(data) - len(data.lstrip(b"\x00"))
    return "1" * leading_zeros + encoded


def base58check_encode(prefix: bytes, payload: bytes) -> str:
    raw = prefix + payload
    checksum = sha256(sha256(raw))[:4]
    return base58_encode(raw + checksum)


_BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def _bech32_polymod(values: list[int]) -> int:
    generators = [0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3]
    chk = 1
    for value in values:
        top = chk >> 25
        chk = ((chk & 0x1FFFFFF) << 5) ^ value
        for i in range(5):
            if (top >> i) & 1:
                chk ^= generators[i]
    return chk


def _bech32_hrp_expand(hrp: str) -> list[int]:
    return [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp]


def _bech32_create_checksum(hrp: str, data: list[int]) -> list[int]:
    values = _bech32_hrp_expand(hrp) + data
    polymod = _bech32_polymod(values + [0, 0, 0, 0, 0, 0]) ^ 1
    return [(polymod >> 5 * (5 - i)) & 31 for i in range(6)]


def bech32_encode(hrp: str, data: list[int]) -> str:
    combined = data + _bech32_create_checksum(hrp, data)
    return hrp + "1" + "".join(_BECH32_CHARSET[d] for d in combined)


def convertbits(data: bytes, from_bits: int, to_bits: int, pad: bool = True) -> list[int]:
    acc = 0
    bits = 0
    ret: list[int] = []
    maxv = (1 << to_bits) - 1
    max_acc = (1 << (from_bits + to_bits - 1)) - 1

    for value in data:
        if value < 0 or (value >> from_bits):
            raise ValueError("Invalid value for convertbits")
        acc = ((acc << from_bits) | value) & max_acc
        bits += from_bits
        while bits >= to_bits:
            bits -= to_bits
            ret.append((acc >> bits) & maxv)

    if pad:
        if bits:
            ret.append((acc << (to_bits - bits)) & maxv)
    elif bits >= from_bits or ((acc << (to_bits - bits)) & maxv):
        raise ValueError("Invalid padding in convertbits")

    return ret


def p2pkh_address(pubkey_compressed: bytes, params: UTXONetworkParams) -> tuple[str, bytes]:
    key_hash = hash160(pubkey_compressed)
    address = base58check_encode(params.p2pkh_prefix, key_hash)
    script_pubkey = b"\x76\xa9\x14" + key_hash + b"\x88\xac"
    return address, script_pubkey


def p2sh_p2wpkh_address(pubkey_compressed: bytes, params: UTXONetworkParams) -> tuple[str, bytes]:
    key_hash = hash160(pubkey_compressed)
    redeem_script = b"\x00\x14" + key_hash
    redeem_hash = hash160(redeem_script)
    address = base58check_encode(params.p2sh_prefix, redeem_hash)
    script_pubkey = b"\xa9\x14" + redeem_hash + b"\x87"
    return address, script_pubkey


def p2wpkh_address(pubkey_compressed: bytes, params: UTXONetworkParams) -> tuple[str, bytes]:
    key_hash = hash160(pubkey_compressed)
    witprog = convertbits(key_hash, 8, 5, pad=True)
    address = bech32_encode(params.bech32_hrp, [0] + witprog)
    script_pubkey = b"\x00\x14" + key_hash
    return address, script_pubkey


def script_to_electrum_scripthash(script_pubkey: bytes) -> str:
    return sha256(script_pubkey)[::-1].hex()


def derive_utxo_address(private_key: bytes, path: str, params: UTXONetworkParams) -> UTXOAddress:
    pubkey = private_key_to_public_key(private_key, compressed=True)

    if path.startswith("m/44'"):
        address, script = p2pkh_address(pubkey, params)
    elif path.startswith("m/49'"):
        address, script = p2sh_p2wpkh_address(pubkey, params)
    elif path.startswith("m/84'"):
        address, script = p2wpkh_address(pubkey, params)
    else:
        # Fallback to legacy format for unknown purpose.
        address, script = p2pkh_address(pubkey, params)

    return UTXOAddress(
        network=params.name,
        derivation_path=path,
        address=address,
        script_pubkey_hex=script.hex(),
        electrum_scripthash=script_to_electrum_scripthash(script),
    )
