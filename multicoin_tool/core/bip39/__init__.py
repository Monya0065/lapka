"""BIP39 entropy, mnemonic and seed utilities."""

from __future__ import annotations

import hashlib
import secrets
import unicodedata
from functools import lru_cache
from pathlib import Path

WORDLIST_FILE = Path(__file__).with_name("english.txt")
OFFICIAL_WORDLIST_SHA256 = "68b451276b0ab3338f181828d833d50aebf394f6d6a301617391fdcf0c628e36"


def _normalize(text: str) -> str:
    return unicodedata.normalize("NFKD", text)


@lru_cache(maxsize=1)
def load_wordlist() -> list[str]:
    raw = WORDLIST_FILE.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != OFFICIAL_WORDLIST_SHA256:
        raise ValueError("BIP39 wordlist checksum mismatch; expected official english.txt")
    words = raw.decode("utf-8").split()
    if len(words) != 2048:
        raise ValueError("BIP39 wordlist must contain exactly 2048 words")
    return words


def generate_entropy(strength: int = 128) -> bytes:
    if strength not in (128, 256):
        raise ValueError("Entropy strength must be 128 or 256 bits")
    return secrets.token_bytes(strength // 8)


def entropy_to_mnemonic(entropy: bytes) -> str:
    entropy_bits = len(entropy) * 8
    if entropy_bits not in (128, 160, 192, 224, 256):
        raise ValueError("Entropy length must be 128/160/192/224/256 bits")

    checksum_len = entropy_bits // 32
    checksum = hashlib.sha256(entropy).digest()

    entropy_bin = bin(int.from_bytes(entropy, "big"))[2:].zfill(entropy_bits)
    checksum_bin = bin(int.from_bytes(checksum, "big"))[2:].zfill(256)[:checksum_len]
    bits = entropy_bin + checksum_bin

    words = load_wordlist()
    mnemonic_words = []
    for i in range(0, len(bits), 11):
        index = int(bits[i : i + 11], 2)
        mnemonic_words.append(words[index])
    return " ".join(mnemonic_words)


def mnemonic_to_entropy(mnemonic: str) -> bytes:
    mnemonic = _normalize(" ".join(mnemonic.strip().split()))
    words = mnemonic.split(" ")
    if len(words) not in (12, 15, 18, 21, 24):
        raise ValueError("Mnemonic must contain 12/15/18/21/24 words")

    wordlist = load_wordlist()
    index_map = {word: i for i, word in enumerate(wordlist)}

    bits = ""
    try:
        for word in words:
            bits += format(index_map[word], "011b")
    except KeyError as exc:
        raise ValueError(f"Mnemonic contains non-BIP39 word: {exc.args[0]}") from exc

    total_bits = len(bits)
    checksum_len = total_bits // 33
    entropy_len = total_bits - checksum_len

    entropy_bits = bits[:entropy_len]
    checksum_bits = bits[entropy_len:]
    entropy = int(entropy_bits, 2).to_bytes(entropy_len // 8, "big")

    expected_checksum = hashlib.sha256(entropy).digest()
    expected_bits = bin(int.from_bytes(expected_checksum, "big"))[2:].zfill(256)[:checksum_len]
    if checksum_bits != expected_bits:
        raise ValueError("Mnemonic checksum is invalid")

    return entropy


def validate_mnemonic(mnemonic: str) -> bool:
    try:
        mnemonic_to_entropy(mnemonic)
        return True
    except ValueError:
        return False


def mnemonic_to_seed(mnemonic: str, passphrase: str = "") -> bytes:
    if not validate_mnemonic(mnemonic):
        raise ValueError("Invalid BIP39 mnemonic")
    mnemonic_norm = _normalize(" ".join(mnemonic.strip().split()))
    salt = "mnemonic" + _normalize(passphrase)
    return hashlib.pbkdf2_hmac(
        "sha512",
        mnemonic_norm.encode("utf-8"),
        salt.encode("utf-8"),
        2048,
        dklen=64,
    )
