export type ClientSession = {
  email: string;
  token: string;
};

export type BoletoStatusFilter = 'all' | 'paid' | 'unpaid';

export type BoletoFilterUnit = {
  id: number;
  name: string;
};

export type BoletoItem = {
  id: number;
  description: string;
  amount: number;
  due_date: string | null;
  digitable_line: string;
  is_paid: boolean;
  unit_id: number | null;
  unit_name: string;
};

export type BoletoFilters = {
  start_date: string;
  end_date: string;
  paid: BoletoStatusFilter;
  unit_id: string;
};

export type BoletoListResult = {
  items: BoletoItem[];
  filterUnits: BoletoFilterUnit[];
  filters: BoletoFilters;
  listTotalAmount: number;
};

export type VendasHojeLoja = {
  unit_id: number;
  unit_name: string;
  dinheiro: number;
  cartao: number;
  total: number;
};

export type VendasHojeResult = {
  date: string;
  period: 'today' | 'yesterday';
  items: VendasHojeLoja[];
  totals: {
    dinheiro: number;
    cartao: number;
    total: number;
  };
};

export type NotaFiscalUnit = {
  unit_id: number;
  unit_name: string;
  total_gerado: number;
  generation_active: boolean;
};

export type NotaFiscalResult = {
  date: string;
  items: NotaFiscalUnit[];
  totals: {
    total_gerado: number;
    active_count: number;
    inactive_count: number;
  };
};

export type ChatUser = {
  id: number;
  name: string;
  role: number;
  role_label: string;
  unit_id: number | null;
  unit_name: string;
  last_seen_at: string | null;
  is_online: boolean;
  unread_count: number;
  last_message_preview: string;
};

export type ChatMessage = {
  id: number;
  sender_id: number;
  recipient_id: number;
  message: string;
  image_url: string | null;
  sender_name: string;
  sent_at: string | null;
  read_at: string | null;
  sender_role: number;
  sender_role_label: string;
  is_mine: boolean;
};

export type ChatSnapshot = {
  currentUser: ChatUser | null;
  onlineUsers: ChatUser[];
  offlineUsers: ChatUser[];
  selectedUserId: number | null;
  messages: ChatMessage[];
};

export type SendChatMessagePayload = {
  sender_user_id: number;
  recipient_user_id: number;
  message: string;
  photo_base64?: string;
  photo_ext?: string;
  photo_type?: string;
};

export type ClientePedido = {
  linked_order_id: number;
  current_order_id: number;
  linked_at?: string | null;
  redirected: boolean;
  redirect_links: {
    from: number;
    to: number;
    type: string;
  }[];
  pedido: {
    id: number;
    numero: string;
    status: number;
    status_label: string;
    data_hora: string;
    cliente: string;
    destino_endereco: string;
  };
  loja: {
    id: number;
    nome: string;
    endereco: string;
    cidade: string;
    uf: string;
    cep: string;
    fone: string;
    latitude: number | null;
    longitude: number | null;
  };
  entregador: {
    id: number;
    nome: string;
    latitude: number | null;
    longitude: number | null;
  };
  tracking: {
    mode: 'store' | 'deliverer' | 'none';
    title: string;
    message: string;
    latitude: number | null;
    longitude: number | null;
  };
  contestacao: {
    can_open: boolean;
    exists: boolean;
    id: number;
    motivo: string;
    justificativa: string;
    status: number;
    status_label: string;
    foto_url: string | null;
    created_at: string;
    updated_at: string;
  };
};
