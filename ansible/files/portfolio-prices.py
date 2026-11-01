#!/usr/bin/env python3
"""Print a portfolio price summary.

This runs *inside* the Hestia pod (piped in over `kubectl exec -i ... python -`)
so it reuses the real holdings list and yfinance client instead of duplicating
them in the playbook. Hestia's own 5-minute cache applies, which is what makes
this cheap to call on a schedule.
"""

import asyncio
import warnings

# yfinance's quote scraper still calls the deprecated pd.Timestamp.utcnow(),
# which prints two warnings on every run. They are harmless and would otherwise
# land in the middle of the daily task log.
warnings.filterwarnings("ignore", message=".*Timestamp.utcnow is deprecated.*")

from portfolio import get_portfolio


def _market(state) -> str:
    if state is True:
        return "OPEN"
    if state is False:
        return "CLOSED"
    return "unknown"


def main() -> None:
    resp = asyncio.run(get_portfolio())
    data = resp.model_dump()

    holdings = data.get("holdings") or []

    print(f"Portfolio prices — fetched {data['updated_at']}")
    print(f"Market: {_market(data.get('market_open'))}   Positions: {len(holdings)}")
    print()
    print(
        f"{'Ticker':<10} {'Company':<30} {'Shares':>8} "
        f"{'Price':>11} {'Chg %':>8} {'Value':>14} {'Day P&L':>13}"
    )
    print("-" * 98)

    for h in holdings:
        print(
            f"{h['ticker']:<10} {h['name'][:29]:<30} {h['shares']:>8,.0f} "
            f"{h['price']:>10,.2f}€ {h['change_pct']:>+7.2f}% "
            f"{h['total_value']:>13,.2f}€ {h['total_pnl']:>+12,.2f}€"
        )

    print("-" * 98)
    print(
        f"{'TOTAL':<10} {'':<30} {'':>8} {'':>11} {'':>8} "
        f"{data['total_value']:>13,.2f}€ {data['total_pnl']:>+12,.2f}€"
    )


if __name__ == "__main__":
    main()
