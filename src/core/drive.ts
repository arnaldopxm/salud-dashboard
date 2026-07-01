// ---------------------------------------------------------------------------
// Capa de acceso a Drive — dual (Cowork / navegador).
// INVARIANTE: todo acceso a Drive pasa por driveSearch, driveDownload, driveCreate.
// Nunca llames a window.cowork ni a fetch de Drive fuera de estas funciones.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    cowork?: {
      callMcpTool: (tool: string, args: Record<string, unknown>) => Promise<McpResult>;
      askClaude?: (prompt: string, context: unknown[]) => Promise<string>;
    };
  }
}

interface McpContent {
  text: string;
}

interface McpResult {
  isError?: boolean;
  structuredContent?: unknown;
  content?: McpContent[] | string;
}

export interface DriveFile {
  id: string;
  title: string;
  modifiedTime?: string;
  viewUrl?: string;
}

export interface DriveSearchResult {
  files: DriveFile[];
}

export interface DriveDownloadResult {
  content: string; // base64
}

// ---------------------------------------------------------------------------
// Detección de entorno
// ---------------------------------------------------------------------------

export const IS_COWORK: boolean =
  typeof window !== 'undefined' &&
  typeof window.cowork?.callMcpTool === 'function';

// IDs de herramientas MCP (solo usados en Cowork)
const TOOL_SEARCH = 'mcp__c567b4dc-1137-4713-a583-962d9f2d1ad4__search_files';
const TOOL_DOWNLOAD = 'mcp__c567b4dc-1137-4713-a583-962d9f2d1ad4__download_file_content';
const TOOL_CREATE = 'mcp__c567b4dc-1137-4713-a583-962d9f2d1ad4__create_file';

// ---------------------------------------------------------------------------
// OAuth (solo navegador)
// ---------------------------------------------------------------------------

let gisToken: string | null = null;
let gisTokenClient: { requestAccessToken(opts: { prompt: string }): void } | null = null;

export function getGisToken(): string | null {
  return gisToken;
}

/** Solo para tests. No llamar en código de producción. */
export function _setTokenForTesting(token: string | null): void {
  gisToken = token;
}

function gisReady(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error google GIS loaded externally
    typeof google !== 'undefined' &&
    // @ts-expect-error google GIS loaded externally
    !!google.accounts?.oauth2
  );
}

const AUTHORIZED_KEY = 'salud-gis-authorized';

/** Devuelve true si el usuario ya autorizó la app en alguna sesión anterior. */
export function wasAuthorized(): boolean {
  try { return localStorage.getItem(AUTHORIZED_KEY) === '1'; } catch { return false; }
}

function markAuthorized(): void {
  try { localStorage.setItem(AUTHORIZED_KEY, '1'); } catch {}
}

export function clearToken(): void {
  gisToken = null;
}

export function revokeAuthorization(): void {
  const tokenToRevoke = gisToken;
  gisToken = null;
  gisTokenClient = null;
  try { localStorage.removeItem(AUTHORIZED_KEY); } catch {}
  if (tokenToRevoke && gisReady()) {
    try {
      // @ts-expect-error google GIS loaded externally
      google.accounts.oauth2.revoke(tokenToRevoke, () => {});
    } catch {}
  }
}

export function initTokenClient(
  clientId: string,
  scope: string,
  onSuccess: () => void,
  onError?: () => void,
): void {
  if (gisTokenClient || !gisReady()) return;
  // @ts-expect-error google GIS loaded externally
  gisTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope,
    callback: (resp: { access_token?: string; error?: string }) => {
      if (resp?.access_token) {
        gisToken = resp.access_token;
        markAuthorized();
        onSuccess();
      } else {
        onError?.();
      }
    },
    error_callback: () => { onError?.(); },
  });
}

/**
 * Intenta renovar el token silenciosamente (sin popup).
 * Solo funciona si el usuario ya autorizó previamente (wasAuthorized()).
 * Si Google no tiene sesión activa, el error_callback dispara onError.
 */
export function requestAccessTokenSilent(): void {
  gisTokenClient?.requestAccessToken({ prompt: '' });
}

export function requestAccessToken(): void {
  gisTokenClient?.requestAccessToken({ prompt: 'consent' });
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function unwrapMcp(result: McpResult): unknown {
  if (!result) throw new Error('La tool MCP no devolvió respuesta');
  if (result.isError) throw new Error('MCP tool returned isError=true: ' + JSON.stringify(result.content));
  if (result.structuredContent) return result.structuredContent;
  const raw = Array.isArray(result.content) ? result.content[0]!.text : result.content;
  return JSON.parse(raw as string);
}

async function driveFetch(url: string, options?: RequestInit): Promise<Response> {
  if (!gisToken) throw new Error('Sin sesión de Google. Inicia sesión.');
  const opts: RequestInit = options ?? {};
  opts.headers = { 'Authorization': 'Bearer ' + gisToken, ...(opts.headers ?? {}) };
  const r = await fetch(url, opts);
  if (r.status === 401) {
    gisToken = null;
    throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  }
  if (!r.ok) throw new Error('Drive API ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export async function driveSearch(queryDrive: string): Promise<DriveSearchResult> {
  if (IS_COWORK) {
    const res = unwrapMcp(
      await window.cowork!.callMcpTool(TOOL_SEARCH, { query: queryDrive }),
    ) as DriveSearchResult;
    return res;
  }
  const url =
    'https://www.googleapis.com/drive/v3/files?q=' +
    encodeURIComponent(queryDrive) +
    '&fields=' +
    encodeURIComponent('files(id,name,modifiedTime,webViewLink)') +
    '&pageSize=100&orderBy=modifiedTime+desc';
  const r = await driveFetch(url);
  const data = await r.json() as { files?: Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }> };
  const files: DriveFile[] = (data.files ?? []).map(f => {
    const file: DriveFile = { id: f.id, title: f.name };
    if (f.modifiedTime !== undefined) file.modifiedTime = f.modifiedTime;
    if (f.webViewLink !== undefined) file.viewUrl = f.webViewLink;
    return file;
  });
  return { files };
}

export async function driveDownload(fileId: string): Promise<DriveDownloadResult> {
  if (IS_COWORK) {
    return unwrapMcp(
      await window.cowork!.callMcpTool(TOOL_DOWNLOAD, { fileId }),
    ) as DriveDownloadResult;
  }
  const r = await driveFetch(
    'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media',
  );
  const buf = await r.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return { content: btoa(binary) };
}

export interface DriveCreateArgs {
  title: string;
  parentId?: string;
  textContent: string;
  contentMimeType?: string;
}

export async function driveCreate(args: DriveCreateArgs): Promise<unknown> {
  if (IS_COWORK) {
    return unwrapMcp(
      await window.cowork!.callMcpTool(TOOL_CREATE, {
        title: args.title,
        parentId: args.parentId,
        textContent: args.textContent,
        contentMimeType: args.contentMimeType,
        disableConversionToGoogleType: true,
      }),
    );
  }
  const mimeType = args.contentMimeType ?? 'application/json';
  const metadata = {
    name: args.title,
    parents: args.parentId ? [args.parentId] : undefined,
    mimeType,
  };
  const boundary = 'salud_boundary';
  const body =
    '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    '\r\n--' + boundary + '\r\nContent-Type: ' + mimeType + '\r\n\r\n' +
    args.textContent +
    '\r\n--' + boundary + '--';
  const r = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body,
    },
  );
  return r.json();
}

export async function iaAskClaude(prompt: string): Promise<string> {
  if (IS_COWORK && typeof window.cowork?.askClaude === 'function') {
    return window.cowork.askClaude(prompt, []);
  }
  throw new Error(
    'La sugerencia con IA solo está disponible en Cowork (escritorio). ' +
    'Aquí en el móvil usa las alternativas del pool.',
  );
}

export function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
