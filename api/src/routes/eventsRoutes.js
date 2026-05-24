import express from 'express';
import jwt from 'jsonwebtoken';
import sseManager from '../services/sseManager.js';

const router = express.Router();

// SSE clients can't set custom headers, so we accept the token via query param
function authenticateQuery(req, res, next) {
  const token = req.query.token || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).end();
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(401).end();
    req.user = user;
    next();
  });
}

router.get('/', authenticateQuery, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Initial heartbeat so the browser knows the connection is alive
  res.write(': connected\n\n');

  const client = sseManager.addClient(res, req.user?.id);

  // Keep-alive ping every 25 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseManager.removeClient(client);
  });
});

export default router;
