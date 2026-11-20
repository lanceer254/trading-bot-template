# Zyntrix signal gate

This fork adds a fail-closed signal gate to the DBot purchase boundary. DBot remains the only component that can submit a trade. Zyntrix is a market-analysis signal source only.

## Runtime flow

1. Open the DBot builder and choose **Open Zyntrix Analysis**. The button opens the Zyntrix GitHub Pages app as a popup so the two windows can establish an origin-checked `postMessage` channel.
2. Select the same Deriv market in DBot and Zyntrix. Keep Zyntrix on the 60-tick analysis window.
3. Press RUN in DBot. The bot reaches its normal Blockly purchase block and waits there; RUN itself does not submit a trade.
4. The purchase boundary accepts only a fresh, one-use `PASS` for the same market, `OVER1`, `DIGITOVER`, prediction `1`, a 60-tick sample, and all four thresholds (OVER 0 >=95%, OVER 1 >=85%, OVER 2 >=75%, OVER 3 >=65%).
5. Every later purchase, including a `trade_again` cycle, waits for another fresh PASS. WAIT, stale messages, duplicate IDs, wrong origins/windows, market mismatch, missing popup, or invalid metrics cannot authorize a purchase.
6. STOP cancels a pending signal wait.

Signals expire after 3 seconds. A PASS that arrives before DBot is actively waiting is discarded and cannot be replayed.

## Deploy order

The DBot changes are in this fork's `zyntrix-signal-bridge` branch. The Zyntrix signal publisher is in `lanceer254/mirror` branch `zyntrix-dbot-foundation`. Merge/deploy the Zyntrix change to GitHub Pages before expecting the popup to send bridge messages. Deploy this DBot fork separately to a supported static host.

The Deriv white-label template also requires its own Deriv OAuth client ID and redirect URI for the deployed domain. Configure that through the host's environment settings; never commit account tokens or secrets.

## Verification

Run:

```bash
npm test -- --runInBand
npm run build
```

The unit tests cover PASS payload validation. A complete integration test still requires a deployed DBot app, the deployed Zyntrix page, a browser popup session, and a Deriv demo account. Test with demo funds first. Do not use live funds until the end-to-end behavior has been independently verified.
