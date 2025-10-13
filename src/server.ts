// src/server.ts

import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { Request, Response } from 'express';
import { botRunner, loadConfig, writeConfig } from './bot';
import { getSettings, updateSettings, saveApiKeys, clearApiKeys } from './state/settingsStore';
import { getMaskedState, upsertUserKeys } from './lib/keyStore.js';
import { getFuturesBalance, getMarketPrices, getSpotBalance, getSpotPortfolioValueUSDT, getFuturesTotalUSDT, getSpotBalancesRaw } from './api/exchange';
import { botState, type BotSnapshot } from './state/botState';
import { logger } from './logger';
import type { StartBotOptions, BotConfig } from './bot';

const app = express();

// Permitir múltiplas origens em desenvolvimento (8083 e 8084) e via env
const DEFAULT_ORIGINS = ['http://localhost:8083', 'http://localhost:8084'];
const ENV_ORIGINS = (process.env.CORS_ORIGIN_LIST || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = ENV_ORIGINS.length ? ENV_ORIGINS : DEFAULT_ORIGINS;

// Em desenvolvimento, permitir qualquer origem para evitar bloqueios (será ajustado em produção via env)
const corsOptions = {
  origin: true,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

const DEFAULT_USER_ID = 'default';

app.get('/api/status', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.get('/api/keys/state', (_req, res) => {
  const state = getMaskedState(DEFAULT_USER_ID);
  res.json(state);
});

app.post('/api/keys', (req, res) => {
  const { apiKey, apiSecret, mode, testnet } = req.body ?? {};

  if (!apiKey || !apiSecret) {
    res.status(400).json({ ok: false, error: 'API key e secret sao obrigatorios.' });
    return;
  }

  const normalizedMode = (() => {
    if (mode === 'future') return 'futures';
    if (mode === 'futures') return 'futures';
    return mode === 'spot' ? 'spot' : 'futures';
  })();

  upsertUserKeys(DEFAULT_USER_ID, { apiKey, apiSecret, mode: normalizedMode, testnet: Boolean(testnet) });
  res.json({ ok: true, state: getMaskedState(DEFAULT_USER_ID) });
});

function sendSnapshot(res: Response): void {
  const snapshot = botState.getSnapshot();
  res.json({ snapshot });
}

app.get('/api/state', (req, res) => {
  sendSnapshot(res);
});

app.get('/api/config', (_req, res) => {
  const config = loadConfig();
  res.json({ config });
});

app.put('/api/config', (req, res) => {
  try {
    const body = req.body as Partial<BotConfig> | undefined;
    if (!body) {
      res.status(400).json({ error: 'Configura��o inv�lida.' });
      return;
    }

    const current = loadConfig();

  const updated: BotConfig = {
    tradingPair: typeof body.tradingPair === 'string' ? body.tradingPair : current.tradingPair,
      minProfitPercentage: typeof body.minProfitPercentage === 'number' ? body.minProfitPercentage : current.minProfitPercentage,
      exchangeFeePercentage: typeof body.exchangeFeePercentage === 'number' ? body.exchangeFeePercentage : current.exchangeFeePercentage,
      checkIntervalSeconds: typeof body.checkIntervalSeconds === 'number' ? Math.max(1, Math.floor(body.checkIntervalSeconds)) : current.checkIntervalSeconds,
      placeOrders: typeof body.placeOrders === 'boolean' ? body.placeOrders : current.placeOrders,
      allowReverse: typeof body.allowReverse === 'boolean' ? body.allowReverse : current.allowReverse,
      spotMarginEnabled: typeof body.spotMarginEnabled === 'boolean' ? body.spotMarginEnabled : current.spotMarginEnabled,
      feesBps: {
        spotTaker: typeof body.feesBps?.spotTaker === 'number' ? body.feesBps.spotTaker : current.feesBps.spotTaker,
        futuresTaker: typeof body.feesBps?.futuresTaker === 'number' ? body.feesBps.futuresTaker : current.feesBps.futuresTaker
      },
      slippageBpsPerLeg: typeof body.slippageBpsPerLeg === 'number' ? body.slippageBpsPerLeg : current.slippageBpsPerLeg,
      minSpreadBpsLongCarry: typeof body.minSpreadBpsLongCarry === 'number' ? body.minSpreadBpsLongCarry : current.minSpreadBpsLongCarry,
      minSpreadBpsReverse: typeof body.minSpreadBpsReverse === 'number' ? body.minSpreadBpsReverse : current.minSpreadBpsReverse,
      considerFunding: typeof body.considerFunding === 'boolean' ? body.considerFunding : current.considerFunding,
      fundingHorizonHours: typeof body.fundingHorizonHours === 'number' ? Math.max(0, body.fundingHorizonHours) : current.fundingHorizonHours,
      maxBorrowAprPct: typeof body.maxBorrowAprPct === 'number' ? body.maxBorrowAprPct : current.maxBorrowAprPct,
      enableTriangular: typeof body.enableTriangular === 'boolean' ? body.enableTriangular : current.enableTriangular,
      triMinQuoteVolumeUSDT: typeof body.triMinQuoteVolumeUSDT === 'number' ? body.triMinQuoteVolumeUSDT : current.triMinQuoteVolumeUSDT,
      triMinProfitBps: typeof body.triMinProfitBps === 'number' ? body.triMinProfitBps : current.triMinProfitBps,
    spotFuturesMinProfitBps: typeof body.spotFuturesMinProfitBps === 'number' ? body.spotFuturesMinProfitBps : current.spotFuturesMinProfitBps
    ,
    multiPairScanEnabled: typeof body.multiPairScanEnabled === 'boolean' ? body.multiPairScanEnabled : current.multiPairScanEnabled,
    spotFuturesMinQuoteVolumeUSDT: typeof body.spotFuturesMinQuoteVolumeUSDT === 'number' ? body.spotFuturesMinQuoteVolumeUSDT : current.spotFuturesMinQuoteVolumeUSDT,
    spotFuturesMaxSymbols: typeof body.spotFuturesMaxSymbols === 'number' ? Math.max(1, Math.floor(body.spotFuturesMaxSymbols)) : current.spotFuturesMaxSymbols,
    triBudgetUseDynamic: typeof body.triBudgetUseDynamic === 'boolean' ? body.triBudgetUseDynamic : current.triBudgetUseDynamic,
    triBudgetFixedUSDT: typeof body.triBudgetFixedUSDT === 'number' ? body.triBudgetFixedUSDT : current.triBudgetFixedUSDT
  };

    writeConfig(updated);

    if (!botRunner.isRunning()) {
      botState.initialize(updated.tradingPair, updated.checkIntervalSeconds * 1000);
    }

    res.json({ config: updated });
  } catch (error) {
    logger.error('Falha ao atualizar config.json.', { error });
    res.status(500).json({ error: 'Erro ao salvar configura��o.' });
  }
});

app.post('/api/bot/start', (req, res) => {
  try {
    const options = (req.body ?? {}) as StartBotOptions;

    void botRunner.start(options).catch((error) => {
      logger.error('Falha ao iniciar o bot via API (async).', { error });
    });

    sendSnapshot(res);
  } catch (error) {
    logger.error('Falha ao iniciar o bot via API.', { error });
    res.status(500).json({ error: 'N�o foi poss�vel iniciar o bot.' });
  }
});

app.post('/api/bot/stop', async (_req, res) => {
  try {
    await botRunner.stop();
    sendSnapshot(res);
  } catch (error) {
    logger.error('Falha ao parar o bot via API.', { error });
    res.status(500).json({ error: 'N�o foi poss�vel parar o bot.' });
  }
});

app.post('/api/bot/reload-config', async (_req, res) => {
  try {
    const config = await botRunner.reloadConfig();
    res.json({ config });
  } catch (error) {
    logger.error('Falha ao recarregar configura��o.', { error });
    res.status(500).json({ error: 'N�o foi poss�vel recarregar configura��o.' });
  }
});

app.post('/api/sync', async (_req, res) => {
  try {
    const config = botRunner.getConfig();
    const [spot, futures, prices] = await Promise.all([
      getSpotPortfolioValueUSDT(),
      getFuturesTotalUSDT(),
      getMarketPrices(config.tradingPair),
    ]);

    botState.updateBalances(spot, futures, prices.spot);
    botState.setLastCycle();

    sendSnapshot(res);
  } catch (error) {
    logger.error('Falha ao sincronizar dados manualmente.', { error });
    res.status(500).json({ error: 'N�o foi poss�vel sincronizar os dados.' });
  }
});

// Endpoint de diagnóstico: retorna saldos spot brutos diretamente da Binance
app.get('/api/balances/spot/raw', async (_req, res) => {
  try {
    const raw = await getSpotBalancesRaw();
    res.json({ balances: raw });
  } catch (error) {
    logger.error('Falha ao obter saldos spot brutos.', { error });
    res.status(500).json({ error: 'Não foi possível obter saldos spot brutos.' });
  }
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Log detalhado de conexões SSE
  const clientIp = (req.ip || req.socket.remoteAddress || 'unknown');
  logger.info('SSE conectado', { clientIp, at: new Date().toISOString() });

  const send = (snapshot: BotSnapshot) => {
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  };

  send(botState.getSnapshot());

  const unsubscribe = botState.onChange((snapshot) => {
    send(snapshot);
  });

  req.on('close', () => {
    unsubscribe();
    logger.info('SSE desconectado', { clientIp, at: new Date().toISOString() });
    res.end();
  });
});

const port = Number.parseInt(process.env.PORT ?? '3001', 10);

app.get('/api/system/status', async (_req, res) => {
  const settings = getSettings();
  const config = botRunner.getConfig();

  const status = {
    binanceConnection: 'disconnected' as 'connected' | 'disconnected' | 'error',
    regionalStatus: 'full' as 'full' | 'partial' | 'restricted',
    websocketStatus: 'connected' as 'connected' | 'disconnected',
    apiKeys: settings.apiKeys.configured ? 'configured' as const : 'missing' as const,
    region: 'Global',
    restrictions: [] as string[],
    connectivity: false,
  };

  try {
    const prices = await getMarketPrices(config.tradingPair);
    status.connectivity = prices.spot > 0;
    if (prices.spot <= 0) {
      status.regionalStatus = 'partial';
    }
  } catch (error) {
    logger.warn('Falha ao consultar pre�os para verifica��o de conectividade.', { error });
    status.regionalStatus = 'partial';
  }

  if (settings.apiKeys.configured) {
    try {
      const balance = await getFuturesBalance();
      status.binanceConnection = balance >= 0 ? 'connected' : 'error';
    } catch (error) {
      logger.warn('Falha ao validar credenciais da corretora.', { error });
      status.binanceConnection = 'error';
      status.apiKeys = 'invalid';
    }
  }

  res.json({ status });
});

app.get('/api/settings', (_req, res) => {
  res.json({ settings: getSettings() });
});

app.put('/api/settings', (req, res) => {
  try {
    const { tradingParams, aiSettings, riskSettings } = req.body ?? {};
    const updated = updateSettings({ tradingParams, aiSettings, riskSettings });
    res.json({ settings: updated });
  } catch (error) {
    logger.error('Falha ao atualizar configura��es.', { error });
    res.status(500).json({ error: 'N�o foi poss�vel atualizar as configura��es.' });
  }
});

app.post('/api/settings/api-keys', (req, res) => {
  const { action, apiKey, apiSecret, testnet, mode } = req.body ?? {};

  try {
    if (action === 'save') {
      if (!apiKey || !apiSecret) {
        res.status(400).json({ error: 'Informe API Key e Secret Key.' });
        return;
      }

      const normalizedMode = typeof mode === 'string' ? mode : 'futures';

      const settings = saveApiKeys({
        apiKey,
        apiSecret,
        testnet: Boolean(testnet),
        mode: normalizedMode === 'spot' ? 'spot' : 'futures',
      });

      res.json({ settings });
      return;
    }

    if (action === 'delete') {
      const settings = clearApiKeys();
      res.json({ settings });
      return;
    }

    if (action === 'get') {
      res.json({ settings: getSettings() });
      return;
    }

    res.status(400).json({ error: 'A��o inv�lida.' });
  } catch (error) {
    logger.error('Falha ao processar API keys.', { error });
    res.status(500).json({ error: 'N�o foi poss�vel processar as chaves de API.' });
  }
});

const server = app.listen(port, () => {
  logger.info(`Servidor HTTP iniciado na porta ${port}.`);

  if (process.env.AUTO_START_BOT !== 'false') {
    botRunner.start().catch((error) => {
      logger.error('Falha ao iniciar o bot automaticamente.', { error });
    });
  }
});

process.on('SIGINT', async () => {
  logger.info('Encerrando servidor...');
  await botRunner.stop();
  server.close(() => {
    logger.info('Servidor finalizado.');
    process.exit(0);
  });
});



















