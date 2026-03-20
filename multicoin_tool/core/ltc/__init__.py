"""Litecoin wrappers around UTXO address derivation helpers."""

from core.btc import LTC_MAINNET, UTXOAddress, derive_utxo_address


def derive_ltc_address(private_key: bytes, path: str) -> UTXOAddress:
    return derive_utxo_address(private_key=private_key, path=path, params=LTC_MAINNET)
