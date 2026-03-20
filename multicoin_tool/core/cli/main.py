"""CLI entrypoint for multicoin wallet operations."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from core.balance import BNB_PATHS, BTC_PATHS, ETH_PATHS, LTC_PATHS, scan_seed
from core.bip32 import HDNode
from core.bip39 import entropy_to_mnemonic, generate_entropy, mnemonic_to_seed, validate_mnemonic
from core.btc import BTC_MAINNET, derive_utxo_address
from core.eth import derive_evm_address
from core.ltc import derive_ltc_address
from core.rpc import BitcoinCoreClient, ElectrumClient, EvmJsonRpcClient, PublicUtxoApiClient
from core.storage import save_records


def _setup_logging(log_file: str | None, verbose: bool) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stderr)]
    if log_file:
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))

    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=handlers,
    )


def _seed_from_args(mnemonic: str, passphrase: str) -> bytes:
    if not validate_mnemonic(mnemonic):
        raise ValueError("Provided mnemonic is invalid")
    return mnemonic_to_seed(mnemonic, passphrase)


def _build_utxo_client(network: str, provider: str, args: argparse.Namespace):
    if provider == "none":
        return None

    if network == "btc":
        if provider == "core":
            return BitcoinCoreClient(
                url=args.btc_core_url,
                username=args.btc_core_user,
                password=args.btc_core_password,
                timeout=args.timeout,
            )
        if provider == "electrum":
            return ElectrumClient(
                host=args.btc_electrum_host,
                port=args.btc_electrum_port,
                use_ssl=args.btc_electrum_ssl,
                timeout=args.timeout,
            )
        return PublicUtxoApiClient("btc", base_url=args.btc_public_api_url, timeout=args.timeout)

    if provider == "core":
        return BitcoinCoreClient(
            url=args.ltc_core_url,
            username=args.ltc_core_user,
            password=args.ltc_core_password,
            timeout=args.timeout,
        )
    if provider == "electrum":
        return ElectrumClient(
            host=args.ltc_electrum_host,
            port=args.ltc_electrum_port,
            use_ssl=args.ltc_electrum_ssl,
            timeout=args.timeout,
        )
    return PublicUtxoApiClient("ltc", base_url=args.ltc_public_api_url, timeout=args.timeout)


def _cmd_generate(args: argparse.Namespace) -> int:
    entropy = generate_entropy(args.strength)
    mnemonic = entropy_to_mnemonic(entropy)
    seed = mnemonic_to_seed(mnemonic, args.passphrase)

    payload = {
        "entropy_hex": entropy.hex(),
        "mnemonic": mnemonic,
        "seed_hex": seed.hex(),
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


def _cmd_validate(args: argparse.Namespace) -> int:
    is_valid = validate_mnemonic(args.mnemonic)
    print(json.dumps({"valid": is_valid}, ensure_ascii=False))
    return 0 if is_valid else 1


def _resolve_paths(template_or_path: str, count: int) -> list[str]:
    if "{index}" in template_or_path:
        return [template_or_path.format(index=i) for i in range(count)]
    if count != 1:
        raise ValueError("Custom path without {index} supports only --count 1")
    return [template_or_path]


def _cmd_derive(args: argparse.Namespace) -> int:
    seed = _seed_from_args(args.mnemonic, args.passphrase)
    root = HDNode.from_seed(seed)
    paths = _resolve_paths(args.path, args.count)

    rows = []
    for path in paths:
        node = root.derive_path(path)
        if args.network == "btc":
            addr = derive_utxo_address(node.private_key, path, BTC_MAINNET)
            rows.append({"path": path, "address": addr.address, "script_pubkey": addr.script_pubkey_hex})
        elif args.network == "ltc":
            addr = derive_ltc_address(node.private_key, path)
            rows.append({"path": path, "address": addr.address, "script_pubkey": addr.script_pubkey_hex})
        elif args.network in {"eth", "bnb"}:
            addr = derive_evm_address(node.private_key, path, network=args.network)
            rows.append({"path": path, "address": addr.address})
        else:
            raise ValueError(f"Unsupported network: {args.network}")

    print(json.dumps(rows, indent=2, ensure_ascii=False))
    return 0


def _cmd_scan(args: argparse.Namespace) -> int:
    seed = _seed_from_args(args.mnemonic, args.passphrase)

    btc_client = _build_utxo_client("btc", args.btc_provider, args)
    ltc_client = _build_utxo_client("ltc", args.ltc_provider, args)
    eth_client = EvmJsonRpcClient(args.eth_rpc_url, timeout=args.timeout) if args.eth_rpc_url else None
    bnb_client = EvmJsonRpcClient(args.bnb_rpc_url, timeout=args.timeout) if args.bnb_rpc_url else None

    result = scan_seed(
        seed=seed,
        address_count=args.count,
        btc_client=btc_client,
        btc_mode=args.btc_provider,
        ltc_client=ltc_client,
        ltc_mode=args.ltc_provider,
        eth_client=eth_client,
        bnb_client=bnb_client,
        include_seed=args.include_seed,
        btc_paths=args.btc_paths,
        ltc_paths=args.ltc_paths,
        eth_paths=args.eth_paths,
        bnb_paths=args.bnb_paths,
    )

    rows = [
        {
            "network": item.network,
            "path": item.derivation_path,
            "address": item.address,
            "balance": item.balance_display,
            "unit": item.unit,
        }
        for item in result.checked
    ]
    print(json.dumps(rows, indent=2, ensure_ascii=False))

    if result.non_zero_records:
        save_records(result.non_zero_records, output_file=args.output_file, output_format=args.output_format)
        print(
            json.dumps(
                {
                    "saved": len(result.non_zero_records),
                    "output_file": str(Path(args.output_file).resolve()),
                    "output_format": args.output_format,
                },
                ensure_ascii=False,
            )
        )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Real multicoin wallet derivation and balance checker")
    parser.add_argument("--log-file", default="multicoin_tool.log", help="Path to log file for RPC responses")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    parser.add_argument("--timeout", type=float, default=15.0, help="Network timeout in seconds")

    subparsers = parser.add_subparsers(dest="command", required=True)

    cmd_generate = subparsers.add_parser("generate", help="Generate entropy, mnemonic and seed")
    cmd_generate.add_argument("--strength", type=int, choices=[128, 256], default=128)
    cmd_generate.add_argument("--passphrase", default="")
    cmd_generate.set_defaults(func=_cmd_generate)

    cmd_validate = subparsers.add_parser("validate", help="Validate BIP39 mnemonic")
    cmd_validate.add_argument("--mnemonic", required=True)
    cmd_validate.set_defaults(func=_cmd_validate)

    cmd_derive = subparsers.add_parser("derive", help="Derive addresses from mnemonic/path")
    cmd_derive.add_argument("--mnemonic", required=True)
    cmd_derive.add_argument("--passphrase", default="")
    cmd_derive.add_argument("--network", choices=["btc", "ltc", "eth", "bnb"], required=True)
    cmd_derive.add_argument("--path", required=True, help="Derivation path or template with {index}")
    cmd_derive.add_argument("--count", type=int, default=1)
    cmd_derive.set_defaults(func=_cmd_derive)

    cmd_scan = subparsers.add_parser("scan", help="Run mnemonic -> addresses -> RPC -> balance flow")
    cmd_scan.add_argument("--mnemonic", required=True)
    cmd_scan.add_argument("--passphrase", default="")
    cmd_scan.add_argument("--count", type=int, default=3)
    cmd_scan.add_argument("--include-seed", action="store_true")
    cmd_scan.add_argument("--output-file", default="non_zero_balances.json")
    cmd_scan.add_argument("--output-format", choices=["json", "csv"], default="json")

    cmd_scan.add_argument("--btc-provider", choices=["public", "core", "electrum", "none"], default="public")
    cmd_scan.add_argument("--btc-core-url", default="http://127.0.0.1:8332")
    cmd_scan.add_argument("--btc-core-user", default=None)
    cmd_scan.add_argument("--btc-core-password", default=None)
    cmd_scan.add_argument("--btc-electrum-host", default="127.0.0.1")
    cmd_scan.add_argument("--btc-electrum-port", type=int, default=50001)
    cmd_scan.add_argument("--btc-electrum-ssl", action="store_true")
    cmd_scan.add_argument("--btc-public-api-url", default=None)

    cmd_scan.add_argument("--ltc-provider", choices=["public", "core", "electrum", "none"], default="public")
    cmd_scan.add_argument("--ltc-core-url", default="http://127.0.0.1:9332")
    cmd_scan.add_argument("--ltc-core-user", default=None)
    cmd_scan.add_argument("--ltc-core-password", default=None)
    cmd_scan.add_argument("--ltc-electrum-host", default="127.0.0.1")
    cmd_scan.add_argument("--ltc-electrum-port", type=int, default=50001)
    cmd_scan.add_argument("--ltc-electrum-ssl", action="store_true")
    cmd_scan.add_argument("--ltc-public-api-url", default=None)

    cmd_scan.add_argument("--eth-rpc-url", default=None, help="JSON-RPC endpoint for Ethereum")
    cmd_scan.add_argument("--bnb-rpc-url", default=None, help="JSON-RPC endpoint for BNB Smart Chain")

    cmd_scan.add_argument("--btc-paths", nargs="*", default=BTC_PATHS)
    cmd_scan.add_argument("--ltc-paths", nargs="*", default=LTC_PATHS)
    cmd_scan.add_argument("--eth-paths", nargs="*", default=ETH_PATHS)
    cmd_scan.add_argument("--bnb-paths", nargs="*", default=BNB_PATHS)
    cmd_scan.set_defaults(func=_cmd_scan)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    _setup_logging(args.log_file, args.verbose)
    try:
        return args.func(args)
    except Exception as exc:  # pragma: no cover - CLI guard
        logging.getLogger("multicoin.cli").exception("Execution failed: %s", exc)
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
