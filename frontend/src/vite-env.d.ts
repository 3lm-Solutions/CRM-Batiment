/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Websocket origin, empty in dev (Vite proxies /socket.io to the API) */
  readonly VITE_WS_URL?: string;
  /** Company of the public chatbot when the URL has no ?entreprise= (default 1) */
  readonly VITE_CHATBOT_COMPANY_ID?: string;
  /** Address of the online demo instance, linked from /demo (optional) */
  readonly VITE_DEMO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
