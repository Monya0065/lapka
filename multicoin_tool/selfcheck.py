"""Deterministic vector checks for quick reproducibility validation."""

from core.bip32 import HDNode
from core.bip39 import mnemonic_to_seed, validate_mnemonic
from core.btc import BTC_MAINNET, derive_utxo_address
from core.eth import keccak256, private_key_to_evm_address
from core.ltc import derive_ltc_address

MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
EXPECTED_SEED_HEX = (
    "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc1"
    "9a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4"
)


def main() -> int:
    assert validate_mnemonic(MNEMONIC)
    seed = mnemonic_to_seed(MNEMONIC)
    assert seed.hex() == EXPECTED_SEED_HEX

    root = HDNode.from_seed(seed)

    eth_node = root.derive_path("m/44'/60'/0'/0/0")
    assert private_key_to_evm_address(eth_node.private_key) == "0x9858EfFD232B4033E47d90003D41EC34EcaEda94"

    btc44 = derive_utxo_address(root.derive_path("m/44'/0'/0'/0/0").private_key, "m/44'/0'/0'/0/0", BTC_MAINNET)
    btc49 = derive_utxo_address(root.derive_path("m/49'/0'/0'/0/0").private_key, "m/49'/0'/0'/0/0", BTC_MAINNET)
    btc84 = derive_utxo_address(root.derive_path("m/84'/0'/0'/0/0").private_key, "m/84'/0'/0'/0/0", BTC_MAINNET)
    ltc44 = derive_ltc_address(root.derive_path("m/44'/2'/0'/0/0").private_key, "m/44'/2'/0'/0/0")

    assert btc44.address == "1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA"
    assert btc49.address == "37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf"
    assert btc84.address == "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"
    assert ltc44.address == "LUWPbpM43E2p7ZSh8cyTBEkvpHmr3cB8Ez"

    assert keccak256(b"").hex() == "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"

    print("Self-check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
