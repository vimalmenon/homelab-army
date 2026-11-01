#!/usr/bin/env python3
"""Render the portfolio as a Telegram message body (HTML).

Runs inside the Hestia pod (piped in over `kubectl exec -i ... python -`) so it
reuses the real holdings list and yfinance client instead of duplicating them.
Hestia's own 5-minute cache applies, which is what makes this cheap to schedule.

Stdout *is* the message — the playbook sends it with parse_mode=HTML.

Layout note: an ASCII table needs ~98 characters of width, which a phone cannot
show without scrolling sideways, so it arrives clipped. This renders one short
block per holding instead, which stays inside the visible width at any number of
positions.
"""

import asyncio
import warnings
from datetime import datetime
from zoneinfo import ZoneInfo

from portfolio import get_portfolio

# yfinance's quote scraper still calls the deprecated pd.Timestamp.utcnow(), which
# prints two warnings on every run. Register the filter *after* the import: pandas
# installs its own filter for the warning subclass at import time, and the most
# recently added filter wins.
warnings.filterwarnings("ignore", message=".*Timestamp.utcnow is deprecated.*")

HKT = ZoneInfo("Asia/Hong_Kong")

# Corporate suffixes add width without adding meaning in a phone notification.
SUFFIXES = (
    " Société anonyme",
    " S.A.",
    " SA",
    " Incorporated",
    " Inc.",
    " Corporation",
    " Corp.",
    " Limited",
    " Ltd",
    " PLC",
    " NV",
    " SE",
)


def esc(text: str) -> str:
    """Escape the characters Telegram's HTML parser treats as markup."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def tidy_name(name: str, limit: int = 34) -> str:
    for suffix in SUFFIXES:
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    return name if len(name) <= limit else name[: limit - 1].rstrip() + "…"


def money(value: float, signed: bool = False) -> str:
    """Euro amount with a real minus sign (U+2212) rather than a hyphen."""
    if value < 0:
        return f"−€{abs(value):,.2f}"
    if signed:
        return f"+€{value:,.2f}"
    return f"€{value:,.2f}"


def pct(value: float) -> str:
    return f"{'−' if value < 0 else '+'}{abs(value):.2f}%"


def arrow(value: float) -> str:
    return "🔺" if value > 0 else "🔻" if value < 0 else "▪️"


def main() -> None:
    data = asyncio.run(get_portfolio()).model_dump()
    stamp = datetime.fromisoformat(data["updated_at"]).astimezone(HKT)
    holdings = data.get("holdings") or []

    if not holdings:
        print("Hestia returned 0 positions - check the HOLDINGS map in hestia/src/portfolio.py")
        raise SystemExit(1)

    state = {True: "open", False: "closed"}.get(data.get("market_open"), "unknown")
    count = f"{len(holdings)} position" + ("" if len(holdings) == 1 else "s")

    lines = [
        f"📈 <b>Portfolio</b> · {stamp:%a %-d %b %Y, %H:%M} HKT",
        f"<i>Market {state} · {count}</i>",
    ]

    for h in holdings:
        lines += [
            "",
            f"<b>{esc(h['ticker'])}</b> · {esc(tidy_name(h['name']))}",
            f"{money(h['price'])}   {arrow(h['change_pct'])} {pct(h['change_pct'])}",
            f"Value <b>{money(h['total_value'])}</b> · Day <b>{money(h['total_pnl'], signed=True)}</b>",
        ]

    lines += [
        "",
        "━━━━━━━━━━━━",
        f"<b>Total  {money(data['total_value'])}</b>",
        f"<b>Today  {money(data['total_pnl'], signed=True)}</b>",
    ]

    print("\n".join(lines))


if __name__ == "__main__":
    main()
