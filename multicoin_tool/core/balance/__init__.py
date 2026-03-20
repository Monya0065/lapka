"""End-to-end wallet derivation and balance discovery pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from core.bip32 import HDNode
from core.btc import BTC_MAINNET, UTXOAddress, derive_utxo_address
from core.eth import EvmAddress, derive_evm_address
from core.ltc import derive_ltc_address
from core.rpc import EvmJsonRpcClient, UTXOBalance
from core.storage import BalanceRecord, make_record

BTC_PATHS = [
    "m/44'/0'/0'/0/{index}",
    "m/49'/0'/0'/0/{index}",
    "m/84'/0'/0'/0/{index}",
]
LTC_PATHS = ["m/44'/2'/0'/0/{index}"]
ETH_PATHS = ["m/44'/60'/0'/0/{index}"]
BNB_PATHS = ["m/44'/60'/0'/0/{index}"]


@dataclass(frozen=True)
class AddressBalance:
    network: str
    derivation_path: str
    address: str
    balance_atomic: int
    balance_display: str
    unit: str


@dataclass
class ScanResult:
    checked: list[AddressBalance]
    non_zero_records: list[BalanceRecord]


def _format_amount(value: int, decimals: int) -> str:
    quant = Decimal(value) / (Decimal(10) ** decimals)
    text = format(quant, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def _expand_paths(templates: list[str], count: int) -> list[str]:
    paths: list[str] = []
    for index in range(count):
        for template in templates:
            paths.append(template.format(index=index))
    return paths


def _query_utxo_balance(mode: str, client: Any, address: UTXOAddress) -> UTXOBalance:
    if mode == "electrum":
        utxo = client.get_utxos(address.electrum_scripthash)
        if utxo.satoshis > 0:
            return utxo
        return client.get_balance(address.electrum_scripthash)

    utxo = client.get_utxos(address.address)
    if utxo.satoshis > 0:
        return utxo
    return client.get_balance(address.address)


def scan_seed(
    seed: bytes,
    address_count: int,
    btc_client: Any | None = None,
    btc_mode: str = "public",
    ltc_client: Any | None = None,
    ltc_mode: str = "public",
    eth_client: EvmJsonRpcClient | None = None,
    bnb_client: EvmJsonRpcClient | None = None,
    include_seed: bool = False,
    btc_paths: list[str] | None = None,
    ltc_paths: list[str] | None = None,
    eth_paths: list[str] | None = None,
    bnb_paths: list[str] | None = None,
) -> ScanResult:
    root = HDNode.from_seed(seed)

    checked: list[AddressBalance] = []
    saved: list[BalanceRecord] = []
    seed_hex = seed.hex() if include_seed else None

    for path in _expand_paths(btc_paths or BTC_PATHS, address_count):
        node = root.derive_path(path)
        addr = derive_utxo_address(private_key=node.private_key, path=path, params=BTC_MAINNET)
        satoshis = 0
        if btc_client is not None:
            satoshis = _query_utxo_balance(btc_mode, btc_client, addr).satoshis
        balance_display = _format_amount(satoshis, 8)
        checked.append(
            AddressBalance(
                network="btc",
                derivation_path=path,
                address=addr.address,
                balance_atomic=satoshis,
                balance_display=balance_display,
                unit="BTC",
            )
        )
        if satoshis > 0:
            saved.append(make_record("btc", path, addr.address, balance_display, seed_hex))

    for path in _expand_paths(ltc_paths or LTC_PATHS, address_count):
        node = root.derive_path(path)
        addr = derive_ltc_address(private_key=node.private_key, path=path)
        satoshis = 0
        if ltc_client is not None:
            satoshis = _query_utxo_balance(ltc_mode, ltc_client, addr).satoshis
        balance_display = _format_amount(satoshis, 8)
        checked.append(
            AddressBalance(
                network="ltc",
                derivation_path=path,
                address=addr.address,
                balance_atomic=satoshis,
                balance_display=balance_display,
                unit="LTC",
            )
        )
        if satoshis > 0:
            saved.append(make_record("ltc", path, addr.address, balance_display, seed_hex))

    for path in _expand_paths(eth_paths or ETH_PATHS, address_count):
        node = root.derive_path(path)
        addr: EvmAddress = derive_evm_address(node.private_key, path, network="eth")
        wei = eth_client.get_balance_wei(addr.address) if eth_client is not None else 0
        balance_display = _format_amount(wei, 18)
        checked.append(
            AddressBalance(
                network="eth",
                derivation_path=path,
                address=addr.address,
                balance_atomic=wei,
                balance_display=balance_display,
                unit="ETH",
            )
        )
        if wei > 0:
            saved.append(make_record("eth", path, addr.address, balance_display, seed_hex))

    for path in _expand_paths(bnb_paths or BNB_PATHS, address_count):
        node = root.derive_path(path)
        addr: EvmAddress = derive_evm_address(node.private_key, path, network="bnb")
        wei = bnb_client.get_balance_wei(addr.address) if bnb_client is not None else 0
        balance_display = _format_amount(wei, 18)
        checked.append(
            AddressBalance(
                network="bnb",
                derivation_path=path,
                address=addr.address,
                balance_atomic=wei,
                balance_display=balance_display,
                unit="BNB",
            )
        )
        if wei > 0:
            saved.append(make_record("bnb", path, addr.address, balance_display, seed_hex))

    return ScanResult(checked=checked, non_zero_records=saved)
