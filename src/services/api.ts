import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import type {
  BoletoFilterUnit,
  BoletoFilters,
  BoletoItem,
  BoletoListResult,
  ChatMessage,
  ChatSnapshot,
  ChatUser,
  ClientSession,
  ClientePedido,
  NotaFiscalResult,
  NotaFiscalUnit,
  RemanejarFuncionarioResponse,
  RemanejarFuncionarioUnit,
  RemanejarFuncionariosResult,
  RemanejarFuncionarioUser,
  SendChatMessagePayload,
  VendasHojeLoja,
  VendasHojeResult,
} from '../types';

const DEFAULT_API_ORIGIN = 'https://apec-roberto.azurewebsites.net';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '');
}

function guessApiBaseUrl(): string | null {
  try {
    const runtimeUrl = Linking.createURL('/');
    const parsed = new URL(runtimeUrl);
    let hostname = parsed.hostname;

    if (!hostname) {
      return null;
    }

    if (hostname === 'localhost' && Platform.OS === 'android') {
      hostname = '10.0.2.2';
    }

    return `http://${hostname}/apec-roberto/endpoints`;
  } catch {
    return null;
  }
}

const API_BASE_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || guessApiBaseUrl() || `${DEFAULT_API_ORIGIN}/endpoints`
);
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return DEFAULT_API_ORIGIN;
  }
})();
const CHAT_SNAPSHOT_URL = `${API_BASE_URL}/cliente-login.php`;
const CHAT_SEND_URL = `${API_BASE_URL}/cliente-contestacao-criar.php`;

type JsonObject = Record<string, unknown>;

const defaultBoletoFilters: BoletoFilters = {
  start_date: '',
  end_date: '',
  paid: 'unpaid',
  unit_id: 'all',
};

function normalizePedidoLookupNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  let normalized = trimmed.replace(/\s+/g, ' ');
  normalized = normalized.replace(/^(?:nu|num|n|no|numero)\s+pedido\s*[:#-]*\s*/i, '');
  normalized = normalized.replace(/^pedido\s*[:#-]*\s*/i, '');
  normalized = normalized.replace(/^#\s*/, '');
  normalized = normalized.trim().replace(/^[#:\-\s]+|[#:\-\s]+$/g, '');

  if (/^\d[\d\s]*$/.test(normalized)) {
    return normalized.replace(/\s+/g, '');
  }

  return normalized;
}

async function parseResponse(response: Response) {
  const data = (await response.json().catch(() => null)) as JsonObject | null;
  if (!response.ok || !data?.ok) {
    const message =
      (typeof data?.error === 'string' && data.error) ||
      (typeof data?.message === 'string' && data.message) ||
      (response.status ? `Falha ao processar a solicitacao. HTTP ${response.status}.` : 'Falha ao processar a solicitacao.');
    throw new Error(message);
  }
  return data;
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\./g, '').replace(',', '.').trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeBoletoItem(item: unknown): BoletoItem {
  const source = item && typeof item === 'object' ? (item as JsonObject) : {};
  const unitSource =
    source.unit && typeof source.unit === 'object' ? (source.unit as JsonObject) : ({} as JsonObject);

  return {
    id: Number(source.id ?? 0),
    description: String(source.description ?? ''),
    amount: parseNumber(source.amount),
    due_date: source.due_date ? String(source.due_date) : null,
    digitable_line: String(source.digitable_line ?? ''),
    is_paid: Boolean(source.is_paid),
    unit_id:
      source.unit_id === null || source.unit_id === undefined ? null : Number(source.unit_id),
    unit_name: String(unitSource.tb2_nome ?? unitSource.name ?? source.unit_name ?? ''),
  };
}

function normalizeFilterUnit(item: unknown): BoletoFilterUnit | null {
  const source = item && typeof item === 'object' ? (item as JsonObject) : {};
  const id = Number(source.id ?? 0);
  const name = String(source.name ?? source.tb2_nome ?? '').trim();

  if (!id || !name) {
    return null;
  }

  return { id, name };
}

function normalizeBoletoItems(data: JsonObject): BoletoItem[] {
  const directItems = Array.isArray(data.items) ? data.items : null;
  if (directItems) {
    return directItems.map(normalizeBoletoItem);
  }

  const boletos = data.boletos;
  if (Array.isArray(boletos)) {
    return boletos.map(normalizeBoletoItem);
  }

  if (boletos && typeof boletos === 'object') {
    const boletosObject = boletos as JsonObject;
    if (Array.isArray(boletosObject.data)) {
      return boletosObject.data.map(normalizeBoletoItem);
    }
  }

  return [];
}

function normalizeBoletoFilterUnits(data: JsonObject): BoletoFilterUnit[] {
  const rawUnits = Array.isArray(data.filter_units)
    ? data.filter_units
    : Array.isArray(data.units)
      ? data.units
      : [];

  return rawUnits.map(normalizeFilterUnit).filter((item): item is BoletoFilterUnit => item !== null);
}

function normalizeBoletoFilters(input: unknown, fallback: BoletoFilters): BoletoFilters {
  const source = input && typeof input === 'object' ? (input as JsonObject) : {};
  const paid = source.paid;

  return {
    start_date: String(source.start_date ?? fallback.start_date ?? defaultBoletoFilters.start_date),
    end_date: String(source.end_date ?? fallback.end_date ?? defaultBoletoFilters.end_date),
    paid: paid === 'all' || paid === 'paid' || paid === 'unpaid' ? paid : fallback.paid,
    unit_id: String(source.unit_id ?? fallback.unit_id ?? defaultBoletoFilters.unit_id),
  };
}

function normalizeVendasHojeLoja(item: unknown): VendasHojeLoja {
  const source = item && typeof item === 'object' ? (item as JsonObject) : {};
  const dinheiro = parseNumber(source.dinheiro);
  const cartao = parseNumber(source.cartao);

  return {
    unit_id: Number(source.unit_id ?? 0),
    unit_name: String(source.unit_name ?? source.name ?? ''),
    dinheiro,
    cartao,
    total: parseNumber(source.total ?? dinheiro + cartao),
  };
}

function normalizeNotaFiscalUnit(item: unknown): NotaFiscalUnit {
  const source = item && typeof item === 'object' ? (item as JsonObject) : {};

  return {
    unit_id: Number(source.unit_id ?? 0),
    unit_name: String(source.unit_name ?? source.name ?? ''),
    total_gerado: parseNumber(source.total_gerado),
    generation_active: Boolean(source.generation_active),
  };
}

function normalizeRemanejarFuncionarioUser(item: unknown): RemanejarFuncionarioUser | null {
  const source = item && typeof item === 'object' ? (item as JsonObject) : {};
  const id = Number(source.id ?? 0);
  const name = String(source.name ?? '').trim();

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    unit_id: source.unit_id === null || source.unit_id === undefined ? null : Number(source.unit_id),
    unit_name: String(source.unit_name ?? '').trim(),
  };
}

function normalizeRemanejarFuncionarioUnit(item: unknown): RemanejarFuncionarioUnit | null {
  const source = item && typeof item === 'object' ? (item as JsonObject) : {};
  const id = Number(source.id ?? 0);
  const name = String(source.name ?? '').trim();

  if (!id || !name) {
    return null;
  }

  return { id, name };
}

function extractChatImageUrl(message: string): string | null {
  const match = message.match(/\[image:([\s\S]*?)\]/i);
  const rawUrl = match?.[1]?.replace(/\s+/g, '').trim() ?? '';

  if (!rawUrl) {
    return null;
  }

  return rawUrl.startsWith('/') ? `${API_ORIGIN}${rawUrl}` : rawUrl;
}

function cleanChatMessage(message: string): string {
  return message.replace(/\s*\[image:[\s\S]*?\]\s*/gi, '').trim();
}

function normalizeChatUser(item: unknown): ChatUser {
  const source = item && typeof item === 'object' ? (item as JsonObject) : {};

  return {
    id: Number(source.id ?? 0),
    name: String(source.name ?? ''),
    role: Number(source.role ?? 0),
    role_label: String(source.role_label ?? '---'),
    unit_id: source.unit_id === null || source.unit_id === undefined ? null : Number(source.unit_id),
    unit_name: String(source.unit_name ?? 'Sem loja ativa'),
    last_seen_at: source.last_seen_at ? String(source.last_seen_at) : null,
    is_online: Boolean(source.is_online),
    unread_count: Number(source.unread_count ?? 0),
    last_message_preview: String(source.last_message_preview ?? ''),
  };
}

function normalizeChatMessage(item: unknown): ChatMessage {
  const source = item && typeof item === 'object' ? (item as JsonObject) : {};
  const rawMessage = String(source.message ?? '');

  return {
    id: Number(source.id ?? 0),
    sender_id: Number(source.sender_id ?? 0),
    recipient_id: Number(source.recipient_id ?? 0),
    message: cleanChatMessage(rawMessage),
    image_url: extractChatImageUrl(rawMessage),
    sender_name: String(source.sender_name ?? ''),
    sent_at: source.sent_at ? String(source.sent_at) : null,
    read_at: source.read_at ? String(source.read_at) : null,
    sender_role: Number(source.sender_role ?? 0),
    sender_role_label: String(source.sender_role_label ?? '---'),
    is_mine: Boolean(source.is_mine),
  };
}

function normalizeChatSnapshot(data: JsonObject): ChatSnapshot {
  return {
    currentUser: data.currentUser ? normalizeChatUser(data.currentUser) : null,
    onlineUsers: Array.isArray(data.onlineUsers) ? data.onlineUsers.map(normalizeChatUser) : [],
    offlineUsers: Array.isArray(data.offlineUsers) ? data.offlineUsers.map(normalizeChatUser) : [],
    selectedUserId:
      data.selectedUserId === null || data.selectedUserId === undefined ? null : Number(data.selectedUserId),
    messages: Array.isArray(data.messages) ? data.messages.map(normalizeChatMessage) : [],
  };
}

export async function loginWithEmail(email: string): Promise<ClientSession> {
  const response = await fetch(`${API_BASE_URL}/cliente-login.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  const data = await parseResponse(response);
  return {
    email,
    token: String(data.token ?? ''),
  };
}

function getAuthHeaders(session: ClientSession) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${session.token}`,
  };
}

export async function fetchHistorico(session: ClientSession): Promise<ClientePedido[]> {
  const response = await fetch(`${API_BASE_URL}/cliente-historico.php`, {
    headers: getAuthHeaders(session),
  });
  const data = await parseResponse(response);
  return Array.isArray(data.items) ? (data.items as ClientePedido[]) : [];
}

export async function buscarPedido(
  session: ClientSession,
  tb12Id: number,
  tb12PedidoNum: string
): Promise<ClientePedido> {
  const normalizedPedidoNum = normalizePedidoLookupNumber(tb12PedidoNum);

  const response = await fetch(`${API_BASE_URL}/cliente-pedido-buscar.php`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tb12_id: tb12Id,
      tb12_pedido_num: normalizedPedidoNum || tb12PedidoNum.trim(),
    }),
  });
  const data = await parseResponse(response);
  return data.pedido as ClientePedido;
}

export async function fetchPedidoDetalhe(
  session: ClientSession,
  linkedOrderId: number
): Promise<ClientePedido> {
  const url = new URL(`${API_BASE_URL}/cliente-pedido-detalhe.php`);
  url.searchParams.set('tb12_id', String(linkedOrderId));

  const response = await fetch(url.toString(), {
    headers: getAuthHeaders(session),
  });
  const data = await parseResponse(response);
  return data.pedido as ClientePedido;
}

type ContestacaoPayload = {
  tb12_id: number;
  motivo: string;
  justificativa: string;
  photo_base64: string;
  photo_ext: string;
  photo_type: string;
};

export async function criarContestacao(
  session: ClientSession,
  payload: ContestacaoPayload
): Promise<ClientePedido> {
  const response = await fetch(`${API_BASE_URL}/cliente-contestacao-criar.php`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseResponse(response);
  return data.pedido as ClientePedido;
}

export async function fetchBoletos(filters: BoletoFilters): Promise<BoletoListResult> {
  const url = new URL(`${API_BASE_URL}/mobile/boletos/`);

  if (filters.start_date) {
    url.searchParams.set('start_date', filters.start_date);
  }

  if (filters.end_date) {
    url.searchParams.set('end_date', filters.end_date);
  }

  if (filters.paid) {
    url.searchParams.set('paid', filters.paid);
  }

  if (filters.unit_id && filters.unit_id !== 'all') {
    url.searchParams.set('unit_id', filters.unit_id);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await parseResponse(response);

  return {
    items: normalizeBoletoItems(data),
    filterUnits: normalizeBoletoFilterUnits(data),
    filters: normalizeBoletoFilters(data.filters, filters),
    listTotalAmount: parseNumber(data.list_total_amount ?? data.total_amount ?? 0),
  };
}

export async function setBoletoPaidStatus(id: number, isPaid: boolean): Promise<BoletoItem> {
  const response = await fetch(`${API_BASE_URL}/mobile/boletos/`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id,
      is_paid: isPaid,
    }),
  });

  const data = await parseResponse(response);
  return normalizeBoletoItem(data.item);
}

export async function fetchVendasHoje(period: 'today' | 'yesterday' = 'today'): Promise<VendasHojeResult> {
  const url = new URL(`${API_BASE_URL}/mobile/vendas-hoje/`);
  url.searchParams.set('period', period);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await parseResponse(response);
  const items = Array.isArray(data.items) ? data.items.map(normalizeVendasHojeLoja) : [];
  const totalsSource =
    data.totals && typeof data.totals === 'object' ? (data.totals as JsonObject) : {};
  const dinheiro = parseNumber(totalsSource.dinheiro);
  const cartao = parseNumber(totalsSource.cartao);

  return {
    date: String(data.date ?? ''),
    period: data.period === 'yesterday' ? 'yesterday' : 'today',
    items,
    totals: {
      dinheiro,
      cartao,
      total: parseNumber(totalsSource.total ?? dinheiro + cartao),
    },
  };
}

export async function fetchNotaFiscalUnits(): Promise<NotaFiscalResult> {
  const response = await fetch(`${API_BASE_URL}/mobile/nota-fiscal/`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await parseResponse(response);
  const items = Array.isArray(data.items) ? data.items.map(normalizeNotaFiscalUnit) : [];
  const totalsSource =
    data.totals && typeof data.totals === 'object' ? (data.totals as JsonObject) : {};

  return {
    date: String(data.date ?? ''),
    items,
    totals: {
      total_gerado: parseNumber(totalsSource.total_gerado),
      active_count: Number(totalsSource.active_count ?? 0),
      inactive_count: Number(totalsSource.inactive_count ?? 0),
    },
  };
}

export async function setNotaFiscalGeneration(
  unitId: number,
  generationActive: boolean
): Promise<NotaFiscalUnit> {
  const response = await fetch(`${API_BASE_URL}/mobile/nota-fiscal/`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      unit_id: unitId,
      generation_active: generationActive,
    }),
  });

  const data = await parseResponse(response);
  return normalizeNotaFiscalUnit(data.unit);
}

export async function fetchRemanejarFuncionarios(): Promise<RemanejarFuncionariosResult> {
  const response = await fetch(`${API_BASE_URL}/mobile/remanejar-funcionarios/`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await parseResponse(response);

  return {
    users: Array.isArray(data.users)
      ? data.users.map(normalizeRemanejarFuncionarioUser).filter((item): item is RemanejarFuncionarioUser => item !== null)
      : [],
    units: Array.isArray(data.units)
      ? data.units.map(normalizeRemanejarFuncionarioUnit).filter((item): item is RemanejarFuncionarioUnit => item !== null)
      : [],
  };
}

export async function remanejarFuncionario(
  userId: number,
  unitId: number
): Promise<RemanejarFuncionarioResponse> {
  const response = await fetch(`${API_BASE_URL}/mobile/remanejar-funcionarios/`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      unit_id: unitId,
    }),
  });

  const data = await parseResponse(response);
  const user = normalizeRemanejarFuncionarioUser(data.user);

  if (!user) {
    throw new Error('Resposta invalida ao remanejar funcionario.');
  }

  return {
    user,
    message: String(data.message ?? 'Funcionario remanejado com sucesso.'),
  };
}

export async function fetchChatSnapshot(
  viewerUserId: number,
  selectedUserId?: number | null
): Promise<ChatSnapshot> {
  const fetchSnapshot = async () => {
    const response = await fetch(CHAT_SNAPSHOT_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'snapshot',
        viewer_id: viewerUserId,
        selected_id: selectedUserId ?? null,
      }),
    });

    const data = await parseResponse(response);
    return normalizeChatSnapshot(data);
  };

  try {
    return await fetchSnapshot();
  } catch (error) {
    const fallbackUrl = new URL(`${API_BASE_URL}/mobile/chat/`);
    const response = await fetch(fallbackUrl.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await parseResponse(response);
    return normalizeChatSnapshot(data);
  }
}

export async function sendChatMessage(payload: SendChatMessagePayload): Promise<ChatSnapshot> {
  const response = await fetch(CHAT_SEND_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseResponse(response);
  return normalizeChatSnapshot(data);
}
