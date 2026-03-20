from __future__ import annotations

from dataclasses import dataclass

from app.tbank_client import ShareInfo, TBankClient

BLUECHIP_TICKERS = {
    "SBER",
    "SBERP",
    "GAZP",
    "LKOH",
    "ROSN",
    "NVTK",
    "GMKN",
    "MGNT",
    "TATN",
    "YDEX",
    "YNDX",
    "VTBR",
    "ALRS",
    "MOEX",
    "POLY",
    "CHMF",
    "NLMK",
}


@dataclass(slots=True)
class Instrument:
    figi: str
    ticker: str
    lot: int
    profile: str


def _is_moex(share: ShareInfo) -> bool:
    exchange = share.exchange.upper()
    cls = share.class_code.upper()
    return "MOEX" in exchange or cls.startswith("TQ")


def _is_normal_trading(share: ShareInfo) -> bool:
    status = share.trading_status.upper()
    return "NORMAL_TRADING" in status or "SECURITY_TRADING_STATUS_NORMAL_TRADING" in status


def _profile(share: ShareInfo) -> str:
    t = share.ticker.upper()
    if t in BLUECHIP_TICKERS:
        return "BLUECHIP"
    if share.lot <= 100:
        return "STANDARD"
    return "THIN"


def build_universe(client: TBankClient, logger) -> list[Instrument]:
    shares = client.list_shares()
    selected: list[Instrument] = []
    for share in shares:
        if share.currency != "RUB":
            continue
        if not _is_moex(share):
            continue
        if not share.api_trade_available_flag:
            continue
        if not share.buy_available_flag or not share.sell_available_flag:
            continue
        if not _is_normal_trading(share):
            continue
        selected.append(
            Instrument(
                figi=share.figi,
                ticker=share.ticker,
                lot=share.lot,
                profile=_profile(share),
            )
        )

    logger.info(
        "universe built",
        extra={
            "event": "universe",
            "loaded": len(shares),
            "selected": len(selected),
            "bluechip": sum(1 for x in selected if x.profile == "BLUECHIP"),
            "standard": sum(1 for x in selected if x.profile == "STANDARD"),
            "thin": sum(1 for x in selected if x.profile == "THIN"),
        },
    )
    return selected
