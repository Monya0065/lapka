# Multicoin Wallet Tool (BTC/LTC/ETH/BNB)

Реализация спецификации: `BIP39 + BIP32 + secp256k1 + адреса + RPC + баланс + storage`.

## Структура

```
multicoin_tool/
 ├── main.py
 └── core/
     ├── bip39
     ├── bip32
     ├── secp256k1
     ├── btc
     ├── ltc
     ├── eth
     ├── bnb
     ├── rpc
     ├── balance
     ├── storage
     └── cli
```

## Что реализовано

- BIP39
- Генерация энтропии 128/256 бит
- Checksum
- Официальный wordlist (2048 слов): `core/bip39/english.txt`
- Валидация mnemonic
- `PBKDF2-HMAC-SHA512` -> seed 512 бит

- BIP32
- Master private key и chain code
- Hardened/non-hardened derivation
- Произвольные derivation paths (`m/...`)

- Поддерживаемые пути по умолчанию
- BTC: `m/44'/0'/0'/0/x`, `m/49'/0'/0'/0/x`, `m/84'/0'/0'/0/x`
- LTC: `m/44'/2'/0'/0/x`
- ETH: `m/44'/60'/0'/0/x`
- BNB (BSC): `m/44'/60'/0'/0/x`

- Криптография
- secp256k1 (чистая Python-реализация)
- SHA256 / RIPEMD160 / hash160
- Base58Check / Bech32
- Keccak-256 + EIP-55

- RPC
- BTC/LTC: Bitcoin Core/Litecoin Core RPC, Electrum protocol, Public API
- ETH/BNB: JSON-RPC `eth_getBalance`
- HTTP/JSON parsing, network error handling, логирование ответов

- Storage
- Сохранение только ненулевых балансов
- Поля: `seed_hex (optional), derivation_path, address, balance, timestamp, network`
- Форматы: JSON или CSV

## Быстрый старт

Из корня репозитория:

```bash
python3 multicoin_tool/main.py generate --strength 128
```

Проверка воспроизводимости на тест-векторах:

```bash
cd multicoin_tool
python3 selfcheck.py
```

Проверка mnemonic:

```bash
python3 multicoin_tool/main.py validate --mnemonic "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
```

Деривация адресов (пример BTC):

```bash
python3 multicoin_tool/main.py derive \
  --mnemonic "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about" \
  --network btc \
  --path "m/84'/0'/0'/0/{index}" \
  --count 3
```

Сканирование с публичным API для BTC/LTC и собственным RPC для ETH/BNB:

```bash
python3 multicoin_tool/main.py scan \
  --mnemonic "..." \
  --count 5 \
  --btc-provider public \
  --ltc-provider public \
  --eth-rpc-url "https://mainnet.infura.io/v3/<KEY>" \
  --bnb-rpc-url "https://bsc-dataseed.binance.org/" \
  --output-format json \
  --output-file non_zero_balances.json
```

Сканирование через Bitcoin Core/Litecoin Core:

```bash
python3 multicoin_tool/main.py scan \
  --mnemonic "..." \
  --btc-provider core \
  --btc-core-url "http://127.0.0.1:8332" \
  --btc-core-user "rpcuser" \
  --btc-core-password "rpcpass" \
  --ltc-provider core \
  --ltc-core-url "http://127.0.0.1:9332" \
  --ltc-core-user "rpcuser" \
  --ltc-core-password "rpcpass"
```

Сканирование через Electrum:

```bash
python3 multicoin_tool/main.py scan \
  --mnemonic "..." \
  --btc-provider electrum \
  --btc-electrum-host "127.0.0.1" \
  --btc-electrum-port 50001 \
  --ltc-provider electrum \
  --ltc-electrum-host "127.0.0.1" \
  --ltc-electrum-port 50001
```

## Логи

По умолчанию ответы RPC пишутся в `multicoin_tool.log`. Можно изменить:

```bash
python3 multicoin_tool/main.py --log-file rpc.log --verbose scan --mnemonic "..."
```

## Проверяемость

- Один и тот же mnemonic/passphrase всегда дает одинаковые адреса.
- Адреса можно проверить в публичных блокчейн-эксплорерах.
- Нет зависимости от закрытого сервера: поддержаны собственные ноды и открытые endpoint'ы.
