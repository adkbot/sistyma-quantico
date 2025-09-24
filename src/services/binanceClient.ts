import ccxt from 'ccxt';
import { getUserKeys } from '../lib/keyStore.js';

export function makeBinance() {
  const user = getUserKeys('default');
  if (!user) return null;

  const isFutures = user.mode === 'futures' || user.mode === 'future';

  const exchange = new ccxt.binance({
    apiKey: user.apiKey,
    secret: user.apiSecret,
    enableRateLimit: true,
    options: { defaultType: isFutures ? 'future' : 'spot' },
  });

  if (user.testnet) {
    exchange.setSandboxMode(true);
  }

  return exchange;
}
