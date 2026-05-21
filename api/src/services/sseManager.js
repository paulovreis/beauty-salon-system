// In-memory SSE client registry. Each entry: { res, userId }
const clients = new Set();

function addClient(res, userId) {
  const client = { res, userId };
  clients.add(client);
  return client;
}

function removeClient(client) {
  clients.delete(client);
}

/**
 * Broadcast an SSE event to all connected clients.
 * @param {string} event - Event name (e.g. 'payment:confirmed')
 * @param {object} data  - JSON-serializable payload
 */
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export default { addClient, removeClient, broadcast };
