"""Minimal secp256k1 implementation for key derivation and address generation."""

from __future__ import annotations

from dataclasses import dataclass

P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
A = 0
B = 7
GX = 55066263022277343669578718895168534326250603453777594175500187360389116729240
GY = 32670510020758816978083085130507043184471273380659243275938904335757337482424


@dataclass(frozen=True)
class Point:
    x: int
    y: int


G = Point(GX, GY)


def _mod_inv(value: int, modulus: int) -> int:
    if value % modulus == 0:
        raise ZeroDivisionError("Inverse does not exist")
    return pow(value, -1, modulus)


def _point_add(p1: Point | None, p2: Point | None) -> Point | None:
    if p1 is None:
        return p2
    if p2 is None:
        return p1

    if p1.x == p2.x and (p1.y != p2.y or p1.y == 0):
        return None

    if p1.x == p2.x:
        slope = (3 * p1.x * p1.x + A) * _mod_inv(2 * p1.y % P, P)
    else:
        slope = (p2.y - p1.y) * _mod_inv((p2.x - p1.x) % P, P)

    slope %= P
    x3 = (slope * slope - p1.x - p2.x) % P
    y3 = (slope * (p1.x - x3) - p1.y) % P
    return Point(x3, y3)


def scalar_mult(scalar: int, point: Point | None = G) -> Point | None:
    if scalar % N == 0 or point is None:
        return None

    scalar %= N
    result: Point | None = None
    addend: Point | None = point

    while scalar:
        if scalar & 1:
            result = _point_add(result, addend)
        addend = _point_add(addend, addend)
        scalar >>= 1

    return result


def is_valid_private_key(private_key: bytes) -> bool:
    if len(private_key) != 32:
        return False
    value = int.from_bytes(private_key, "big")
    return 1 <= value < N


def private_key_to_public_point(private_key: bytes) -> Point:
    if not is_valid_private_key(private_key):
        raise ValueError("Invalid secp256k1 private key")
    point = scalar_mult(int.from_bytes(private_key, "big"), G)
    if point is None:
        raise ValueError("Point at infinity")
    return point


def compress_public_key(point: Point) -> bytes:
    prefix = 0x02 if point.y % 2 == 0 else 0x03
    return bytes([prefix]) + point.x.to_bytes(32, "big")


def uncompressed_public_key(point: Point) -> bytes:
    return b"\x04" + point.x.to_bytes(32, "big") + point.y.to_bytes(32, "big")


def private_key_to_public_key(private_key: bytes, compressed: bool = True) -> bytes:
    point = private_key_to_public_point(private_key)
    return compress_public_key(point) if compressed else uncompressed_public_key(point)
