"""RPC clients for BTC/LTC (UTXO) and EVM networks (ETH/BNB)."""

from __future__ import annotations

import base64
import json
import logging
import socket
import ssl
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

LOGGER = logging.getLogger("multicoin.rpc")


class RpcError(RuntimeError):
    """Raised when a JSON-RPC endpoint returns an error."""


class NetworkError(RuntimeError):
    """Raised when endpoint is unavailable or returns malformed response."""


@dataclass(frozen=True)
class UTXOBalance:
    satoshis: int
    utxos: list[dict[str, Any]]


class HttpJsonRpcClient:
    def __init__(
        self,
        url: str,
        timeout: float = 15.0,
        username: str | None = None,
        password: str | None = None,
    ) -> None:
        self.url = url
        self.timeout = timeout
        self.username = username
        self.password = password

    def call(self, method: str, params: list[Any] | None = None, request_id: int = 1) -> Any:
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params or [],
        }
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}

        if self.username is not None and self.password is not None:
            token = base64.b64encode(f"{self.username}:{self.password}".encode("utf-8")).decode("ascii")
            headers["Authorization"] = f"Basic {token}"

        request = urllib.request.Request(self.url, data=body, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
                LOGGER.debug("JSON-RPC response (%s): %s", method, raw)
        except urllib.error.URLError as exc:
            raise NetworkError(f"Network error while calling {method}: {exc}") from exc

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise NetworkError(f"Malformed JSON response for {method}: {raw[:500]}") from exc

        if parsed.get("error"):
            raise RpcError(f"RPC error for {method}: {parsed['error']}")
        return parsed.get("result")


class BitcoinCoreClient:
    def __init__(self, url: str, username: str | None = None, password: str | None = None, timeout: float = 15.0) -> None:
        self.client = HttpJsonRpcClient(url=url, timeout=timeout, username=username, password=password)

    def get_utxos(self, address: str) -> UTXOBalance:
        # Prefer scanutxo because it does not require importing addresses into wallet.
        try:
            result = self.client.call("scantxoutset", ["start", [f"addr({address})"]])
            unspents = result.get("unspents", []) if isinstance(result, dict) else []
            satoshis = 0
            utxos: list[dict[str, Any]] = []
            for item in unspents:
                amount = Decimal(str(item.get("amount", "0")))
                value_sats = int(amount * Decimal(100_000_000))
                satoshis += value_sats
                utxos.append(
                    {
                        "txid": item.get("txid"),
                        "vout": item.get("vout"),
                        "value_sats": value_sats,
                        "height": item.get("height"),
                    }
                )
            return UTXOBalance(satoshis=satoshis, utxos=utxos)
        except RpcError:
            pass

        # Fallback for older nodes with address imported into wallet.
        result = self.client.call("listunspent", [0, 9999999, [address]])
        satoshis = 0
        utxos = []
        for item in result:
            amount = Decimal(str(item.get("amount", "0")))
            value_sats = int(amount * Decimal(100_000_000))
            satoshis += value_sats
            utxos.append(
                {
                    "txid": item.get("txid"),
                    "vout": item.get("vout"),
                    "value_sats": value_sats,
                    "confirmations": item.get("confirmations"),
                }
            )
        return UTXOBalance(satoshis=satoshis, utxos=utxos)


class ElectrumClient:
    def __init__(self, host: str, port: int = 50001, use_ssl: bool = False, timeout: float = 10.0) -> None:
        self.host = host
        self.port = port
        self.use_ssl = use_ssl
        self.timeout = timeout

    def _send(self, method: str, params: list[Any]) -> Any:
        payload = json.dumps({"id": 1, "method": method, "params": params}).encode("utf-8") + b"\n"

        try:
            sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
            if self.use_ssl:
                context = ssl.create_default_context()
                sock = context.wrap_socket(sock, server_hostname=self.host)
            with sock:
                sock.sendall(payload)
                chunks = []
                while True:
                    piece = sock.recv(4096)
                    if not piece:
                        break
                    chunks.append(piece)
                    if b"\n" in piece:
                        break
        except OSError as exc:
            raise NetworkError(f"Electrum connection error: {exc}") from exc

        raw = b"".join(chunks).decode("utf-8", errors="replace").strip()
        LOGGER.debug("Electrum response (%s): %s", method, raw)

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise NetworkError(f"Malformed Electrum JSON response: {raw[:500]}") from exc

        if parsed.get("error"):
            raise RpcError(f"Electrum RPC error for {method}: {parsed['error']}")
        return parsed.get("result")

    def get_utxos(self, script_hash: str) -> UTXOBalance:
        result = self._send("blockchain.scripthash.listunspent", [script_hash])
        satoshis = 0
        utxos = []
        for item in result or []:
            value = int(item.get("value", 0))
            satoshis += value
            utxos.append(
                {
                    "tx_hash": item.get("tx_hash"),
                    "tx_pos": item.get("tx_pos"),
                    "height": item.get("height"),
                    "value_sats": value,
                }
            )
        return UTXOBalance(satoshis=satoshis, utxos=utxos)

    def get_balance(self, script_hash: str) -> UTXOBalance:
        result = self._send("blockchain.scripthash.get_balance", [script_hash])
        confirmed = int(result.get("confirmed", 0))
        unconfirmed = int(result.get("unconfirmed", 0))
        return UTXOBalance(
            satoshis=confirmed + unconfirmed,
            utxos=[],
        )


class PublicUtxoApiClient:
    """Public APIs: Blockstream for BTC and BlockCypher for LTC."""

    def __init__(self, network: str, base_url: str | None = None, timeout: float = 15.0) -> None:
        if network not in {"btc", "ltc"}:
            raise ValueError("PublicUtxoApiClient network must be 'btc' or 'ltc'")
        self.network = network
        self.timeout = timeout
        if base_url:
            self.base_url = base_url.rstrip("/")
        elif network == "btc":
            self.base_url = "https://blockstream.info/api"
        else:
            self.base_url = "https://api.blockcypher.com/v1/ltc/main"

    def _get_json(self, url: str) -> Any:
        request = urllib.request.Request(url, headers={"Accept": "application/json"}, method="GET")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
                LOGGER.debug("HTTP response (%s): %s", url, raw)
        except urllib.error.URLError as exc:
            raise NetworkError(f"Network error while requesting {url}: {exc}") from exc

        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise NetworkError(f"Malformed JSON response from {url}: {raw[:500]}") from exc

    def get_utxos(self, address: str) -> UTXOBalance:
        if self.network == "btc":
            url = f"{self.base_url}/address/{urllib.parse.quote(address)}/utxo"
            data = self._get_json(url)
            satoshis = 0
            utxos = []
            for item in data:
                value = int(item.get("value", 0))
                satoshis += value
                utxos.append(
                    {
                        "txid": item.get("txid"),
                        "vout": item.get("vout"),
                        "value_sats": value,
                        "status": item.get("status", {}),
                    }
                )
            return UTXOBalance(satoshis=satoshis, utxos=utxos)

        url = f"{self.base_url}/addrs/{urllib.parse.quote(address)}?unspentOnly=true&includeScript=true"
        data = self._get_json(url)
        satoshis = 0
        utxos = []
        for key in ("txrefs", "unconfirmed_txrefs"):
            for item in data.get(key, []) or []:
                value = int(item.get("value", 0))
                satoshis += value
                utxos.append(
                    {
                        "tx_hash": item.get("tx_hash"),
                        "tx_output_n": item.get("tx_output_n"),
                        "value_sats": value,
                        "confirmations": item.get("confirmations"),
                    }
                )
        return UTXOBalance(satoshis=satoshis, utxos=utxos)

    def get_balance(self, address: str) -> UTXOBalance:
        if self.network == "btc":
            url = f"{self.base_url}/address/{urllib.parse.quote(address)}"
            data = self._get_json(url)
            chain = data.get("chain_stats", {})
            mempool = data.get("mempool_stats", {})
            funded = int(chain.get("funded_txo_sum", 0)) + int(mempool.get("funded_txo_sum", 0))
            spent = int(chain.get("spent_txo_sum", 0)) + int(mempool.get("spent_txo_sum", 0))
            return UTXOBalance(satoshis=funded - spent, utxos=[])

        url = f"{self.base_url}/addrs/{urllib.parse.quote(address)}/balance"
        data = self._get_json(url)
        final_balance = int(data.get("final_balance", 0))
        return UTXOBalance(satoshis=final_balance, utxos=[])


class EvmJsonRpcClient:
    def __init__(self, url: str, timeout: float = 15.0) -> None:
        self.client = HttpJsonRpcClient(url=url, timeout=timeout)

    def get_balance_wei(self, address: str) -> int:
        result = self.client.call("eth_getBalance", [address, "latest"])
        if not isinstance(result, str):
            raise RpcError(f"eth_getBalance returned non-hex value: {result!r}")
        return int(result, 16)
