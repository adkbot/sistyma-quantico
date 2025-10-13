// src/adapter.js

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.ADAPTER_PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Simple logger
const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args)
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'adapter',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    service: 'Exchange Adapter',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    endpoints: [
      '/health',
      '/status',
      '/api/prices',
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

app.get('/api/balance', (req, res) => {
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
  const { symbol, side, type, amount, price } = req.body;
  
  // Mock order execution
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  res.json({
    orderId,
    symbol,
    side,
    type,
    amount,
    price,
    status: 'filled',
    executedAt: new Date().toISOString(),
    fees: amount * (price || 0) * 0.001, // 0.1% fee
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
app.use((err, req, res, next) => {
  logger.error('Adapter error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
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

module.exports = app;