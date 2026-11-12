// Connexion au serveur d'evenements local (server/server.mjs), avec reconnexion automatique.
const URL_WS = 'ws://127.0.0.1:4747/ws';
const RETRY_MS = 3000;

export interface LiveHandlers {
  agent(id: string, active: boolean, label: string | null): void;
  /** prompt = true quand une nouvelle demande vient d'etre envoyee. */
  session(active: boolean, label: string, prompt: boolean): void;
  status(connected: boolean): void;
}

export function connectLive(handlers: LiveHandlers): void {
  const open = () => {
    const socket = new WebSocket(URL_WS);
    socket.addEventListener('open', () => handlers.status(true));
    socket.addEventListener('message', (e) => {
      let m: { type?: string; id?: string; active?: boolean; label?: string | null; prompt?: boolean };
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m.type === 'agent' && m.id) handlers.agent(m.id, Boolean(m.active), m.label ?? null);
      else if (m.type === 'session') handlers.session(Boolean(m.active), m.label ?? '', Boolean(m.prompt));
    });
    socket.addEventListener('close', () => {
      handlers.status(false);
      setTimeout(open, RETRY_MS);
    });
  };
  open();
}
