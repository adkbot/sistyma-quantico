// src/adapter.mjs

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.ADAPTER_PORT ? Number.parseInt(process.env.ADAPTER_PORT, 10) : 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Simple logger
const logger = {
  info: (msg, meta = {}) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, meta)
};

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'adapter',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Status endpoint
app.get('/status', (_req, res) => {
  res.json({
    service: 'Exchange Adapter',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    endpoints: [
      '/health',
      '/status',
      '/api/prices/:symbol',
      '/api/balance',
      '/api/orders'
    ]
  });
});

// Mock API endpoints for exchange integration
app.get('/api/prices/:symbol', (req, res) => {
  const { symbol } = req.params;
  
  // Mock price data
  const mockPrices = {
    BTCUSDT: {
      spot: 43250.50,
      futures: 43275.25,
      timestamp: Date.now()
    },
    ETHUSDT: {
      spot: 2650.75,
      futures: 2655.30,
      timestamp: Date.now()
    }
  };

  const prices = mockPrices[symbol] || {
    spot: 1000 + Math.random() * 100,
    futures: 1005 + Math.random() * 100,
    timestamp: Date.now()
  };

  res.json({
    symbol,
    ...prices,
    spread: prices.futures - prices.spot,
    spreadBps: ((prices.futures - prices.spot) / prices.spot) * 10000
  });
});

app.get('/api/balance', (_req, res) => {
  // Mock balance data
  res.json({
    futures: {
      USDT: 10000 + Math.random() * 5000,
      available: true
    },
    spot: {
      USDT: 5000 + Math.random() * 2000,
      BTC: 0.1 + Math.random() * 0.05,
      ETH: 2 + Math.random() * 1,
      available: true
    },
    timestamp: Date.now()
  });
});

app.post('/api/orders', (req, res) => {
  const { symbol, side, type, amount, price } = req.body ?? {};
  
  // Mock order execution
  const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  
  res.json({
    orderId,
    symbol,
    side,
    type,
    amount,
    price,
    status: 'filled',
    executedAt: new Date().toISOString(),
    fees: (Number(amount) || 0) * (Number(price) || 0) * 0.001, // 0.1% fee
    success: true
  });
});

// Funding rate endpoint
app.get('/api/funding/:symbol', (req, res) => {
  const { symbol } = req.params;
  
  res.json({
    symbol,
    fundingRate: (Math.random() - 0.5) * 0.001, // Random funding rate between -0.05% and 0.05%
    fundingTime: Date.now() + 8 * 60 * 60 * 1000, // Next funding in 8 hours
    timestamp: Date.now()
  });
});

// Borrow rate endpoint
app.get('/api/borrow/:asset', (req, res) => {
  const { asset } = req.params;
  
  res.json({
    asset,
    borrowRate: Math.random() * 0.15, // Random borrow rate between 0% and 15%
    available: true,
    timestamp: Date.now()
  });
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  logger.error('Adapter error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err?.message ?? 'unknown',
    timestamp: new Date().toISOString()
  });
});

// 404 handler (Express v5 wildcard)
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Adapter iniciado na porta ${PORT}`);
  console.log(`🚀 Exchange Adapter rodando na porta ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Status: http://localhost:${PORT}/status`);
});

export default app;