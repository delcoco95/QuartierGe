// Recoit les evenements des hooks Claude Code (POST /event) et les pousse au navigateur (WebSocket /ws).
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createOffice } from './office.mjs';

const PORT = Number(process.env.QG_PORT ?? 4747);
const HOST = '127.0.0.1';
const MAX_BODY = 2_000_000;

const office = createOffice();
let received = 0;

// Les prompts transitent par ici : seules les pages servies depuis cette machine peuvent se connecter.
function isLocalOrigin(origin) {
  if (!origin) return true;
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname);
  } catch {
    return false;
  }
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const server = createServer((req, res) => {
  if (!isLocalOrigin(req.headers.origin)) return json(res, 403, { error: 'origine refusée' });

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true, received, clients: wss.clients.size, activeAgents: office.activeCount() });
  }

  if (req.method === 'POST' && req.url === '/event') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) req.destroy();
    });
    req.on('end', () => {
      let messages = [];
      try {
        messages = office.handle(JSON.parse(body));
        received++;
      } catch {
        return json(res, 400, { error: 'JSON invalide' });
      }
      for (const message of messages) broadcast(message);
      // Corps vide : le hook ne modifie jamais le comportement de Claude Code.
      json(res, 200, {});
    });
    return;
  }

  json(res, 404, { error: 'inconnu' });
});

const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient: ({ origin }) => isLocalOrigin(origin),
});

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of wss.clients) if (client.readyState === client.OPEN) client.send(data);
}

wss.on('connection', (socket) => {
  for (const message of office.snapshot()) socket.send(JSON.stringify(message));
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Le port ${PORT} est déjà utilisé : le serveur tourne peut-être déjà.` : error.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => console.log(`Quartier Général : serveur d'événements sur http://${HOST}:${PORT}`));
