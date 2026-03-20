"""BNB Smart Chain uses Ethereum-compatible addresses and RPC."""

from core.eth import EvmAddress, derive_evm_address


def derive_bnb_address(private_key: bytes, path: str) -> EvmAddress:
    return derive_evm_address(private_key=private_key, path=path, network="bnb")
