// src/server.ts

import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { Request, Response } from 'express';
import { botRunner, loadConfig, writeConfig } from './bot';
import { getSettings, updateSettings, saveApiKeys, clearApiKeys } from './state/settingsStore';
import { getFuturesBalance, getMarketPrices } from './api/exchange';
import { botState, type BotSnapshot } from './state/botState';
import { logger } from './logger';
import type { StartBotOptions, BotConfig } from './bot';

const app = express();
app.use(cors());
app.use(express.json());

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
      res.status(400).json({ error: 'Configuração inválida.' });
      return;
    }

    const current = loadConfig();

    const updated: BotConfig = {
      tradingPair: body.tradingPair ?? current.tradingPair,
      minProfitPercentage: typeof body.minProfitPercentage === 'number' ? body.minProfitPercentage : current.minProfitPercentage,
      exchangeFeePercentage: typeof body.exchangeFeePercentage === 'number' ? body.exchangeFeePercentage : current.exchangeFeePercentage,
      checkIntervalSeconds: typeof body.checkIntervalSeconds === 'number' ? Math.max(1, Math.floor(body.checkIntervalSeconds)) : current.checkIntervalSeconds,
    };

    writeConfig(updated);

    if (!botRunner.isRunning()) {
      botState.initialize(updated.tradingPair, updated.checkIntervalSeconds * 1000);
    }

    res.json({ config: updated });
  } catch (error) {
    logger.error('Falha ao atualizar config.json.', { error });
    res.status(500).json({ error: 'Erro ao salvar configuração.' });
  }
});

app.post('/api/bot/start', (req, res) => {
  try {
    const options = (req.body ?? {}) as StartBotOptions;

    botRunner
      .start(options)
      .then(() => {
        sendSnapshot(res);
      })
      .catch((error) => {
        logger.error('Falha ao iniciar o bot via API.', { error });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Não foi possível iniciar o bot.' });
        }
      });
  } catch (error) {
    logger.error('Falha ao iniciar o bot via API.', { error });
    res.status(500).json({ error: 'Não foi possível iniciar o bot.' });
  }
});

app.post('/api/bot/stop', async (_req, res) => {
  try {
    await botRunner.stop();
    sendSnapshot(res);
  } catch (error) {
    logger.error('Falha ao parar o bot via API.', { error });
    res.status(500).json({ error: 'Não foi possível parar o bot.' });
  }
});

app.post('/api/bot/reload-config', async (_req, res) => {
  try {
    const config = await botRunner.reloadConfig();
    res.json({ config });
  } catch (error) {
    logger.error('Falha ao recarregar configuração.', { error });
    res.status(500).json({ error: 'Não foi possível recarregar configuração.' });
  }
});

app.post('/api/sync', async (_req, res) => {
  try {
    const config = botRunner.getConfig();
    const [capital, prices] = await Promise.all([
      getFuturesBalance(),
      getMarketPrices(config.tradingPair),
    ]);

    botState.updateBalanceFromFutures(capital, prices.spot);
    botState.setLastCycle();

    sendSnapshot(res);
  } catch (error) {
    logger.error('Falha ao sincronizar dados manualmente.', { error });
    res.status(500).json({ error: 'Não foi possível sincronizar os dados.' });
  }
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (snapshot: BotSnapshot) => {
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  };

  send(botState.getSnapshot());

  const unsubscribe = botState.onChange((snapshot) => {
    send(snapshot);
  });

  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

const port = Number.parseInt(process.env.PORT ?? '4000', 10);

app.get('/api/system/status', async (_req, res) => {
  const settings = getSettings();
  const config = botRunner.getConfig();

  const status = {
    binanceConnection: 'disconnected' as 'connected' | 'disconnected' | 'error',
    regionalStatus: 'full' as 'full' | 'partial' | 'restricted',
    websocketStatus: 'connected' as 'connected' | 'disconnected',
    apiKeys: settings.apiKeys.configured ? 'configured' as const : 'missing' as const,
    region: 'Desconhecido',
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
    logger.warn('Falha ao consultar preços para verificação de conectividade.', { error });
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
    logger.error('Falha ao atualizar configurações.', { error });
    res.status(500).json({ error: 'Não foi possível atualizar as configurações.' });
  }
});

app.post('/api/settings/api-keys', (req, res) => {
  const { action, apiKey, apiSecret, testnet } = req.body ?? {};

  try {
    if (action === 'save') {
      if (!apiKey || !apiSecret) {
        res.status(400).json({ error: 'Informe API Key e Secret Key.' });
        return;
      }

      const settings = saveApiKeys({
        apiKey,
        apiSecret,
        testnet: Boolean(testnet),
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

    res.status(400).json({ error: 'Ação inválida.' });
  } catch (error) {
    logger.error('Falha ao processar API keys.', { error });
    res.status(500).json({ error: 'Não foi possível processar as chaves de API.' });
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






