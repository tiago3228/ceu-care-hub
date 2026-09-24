import {
  BarChart3,
  BellRing,
  Boxes,
  CalendarDays,
  CalendarHeart,
  CalendarOff,
  ClipboardList,
  DoorOpen,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  MonitorCog,
  Network,
  Package,
  Phone,
  Settings,
  Stethoscope,
  StickyNote,
  Trash2,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react";

export const MENU_ICONS = {
  LayoutDashboard,
  Phone,
  CalendarDays,
  DoorOpen,
  Users,
  Stethoscope,
  CalendarOff,
  Boxes,
  Package,
  ClipboardList,
  HeartPulse,
  Waves,
  StickyNote,
  BellRing,
  MonitorCog,
  CalendarHeart,
  BarChart3,
  KeyRound,
  Network,
  Trash2,
  Settings,
} as const satisfies Record<string, LucideIcon>;

export type MenuIconName = keyof typeof MENU_ICONS;

export interface MenuItemDefinition {
  chave: string;
  grupo: string;
  grupoOrdem: number;
  rotulo: string;
  destino: string;
  icone: MenuIconName;
  ordem: number;
  modulo?: string | null;
  somenteAdmin?: boolean;
}

export interface MenuItemRecord extends MenuItemDefinition {
  id: number;
  ativo: boolean;
}

export const MENU_ICON_OPTIONS: { value: MenuIconName; label: string }[] = [
  { value: "LayoutDashboard", label: "Painel" },
  { value: "Phone", label: "Telefone" },
  { value: "CalendarDays", label: "Calendário" },
  { value: "DoorOpen", label: "Sala" },
  { value: "Users", label: "Pessoas" },
  { value: "Stethoscope", label: "Médico" },
  { value: "CalendarOff", label: "Calendário com ausência" },
  { value: "Boxes", label: "Caixas / materiais" },
  { value: "Package", label: "Pacote / estoque" },
  { value: "ClipboardList", label: "Lista" },
  { value: "HeartPulse", label: "Atendimento" },
  { value: "Waves", label: "Sondas" },
  { value: "StickyNote", label: "Nota" },
  { value: "BellRing", label: "Lembrete" },
  { value: "MonitorCog", label: "Equipamento" },
  { value: "CalendarHeart", label: "Agenda" },
  { value: "BarChart3", label: "Relatórios" },
  { value: "KeyRound", label: "Senhas" },
  { value: "Network", label: "Rede" },
  { value: "Trash2", label: "Lixeira" },
  { value: "Settings", label: "Configurações" },
];

export const MENU_PADRAO: MenuItemDefinition[] = [
  {
    chave: "painel",
    grupo: "Visão geral",
    grupoOrdem: 10,
    rotulo: "Painel",
    destino: "/dashboard",
    icone: "LayoutDashboard",
    ordem: 10,
  },
  {
    chave: "ramais",
    grupo: "Visão geral",
    grupoOrdem: 10,
    rotulo: "Ramais",
    destino: "/ramais",
    icone: "Phone",
    ordem: 20,
  },
  {
    chave: "escala",
    grupo: "Salas",
    grupoOrdem: 20,
    rotulo: "Escala semanal",
    destino: "/escala",
    icone: "CalendarDays",
    modulo: "escalas",
    ordem: 10,
  },
  {
    chave: "salas",
    grupo: "Salas",
    grupoOrdem: 20,
    rotulo: "Salas de exame",
    destino: "/salas",
    icone: "DoorOpen",
    modulo: "salas",
    ordem: 20,
  },
  {
    chave: "colaboradoras",
    grupo: "Salas",
    grupoOrdem: 20,
    rotulo: "Colaboradoras",
    destino: "/colaboradoras",
    icone: "Users",
    modulo: "colaboradoras",
    ordem: 30,
  },
  {
    chave: "medicos",
    grupo: "Salas",
    grupoOrdem: 20,
    rotulo: "Médicos",
    destino: "/medicos",
    icone: "Stethoscope",
    modulo: "medicos",
    ordem: 40,
  },
  {
    chave: "ausencias",
    grupo: "Salas",
    grupoOrdem: 20,
    rotulo: "Ausências",
    destino: "/dashboard",
    icone: "CalendarOff",
    modulo: "ausencias",
    ordem: 50,
  },
  {
    chave: "itens",
    grupo: "Suprimentos",
    grupoOrdem: 30,
    rotulo: "Itens e materiais",
    destino: "/itens",
    icone: "Boxes",
    modulo: "itens",
    ordem: 10,
  },
  {
    chave: "estoque",
    grupo: "Suprimentos",
    grupoOrdem: 30,
    rotulo: "Estoque",
    destino: "/estoque",
    icone: "Package",
    modulo: "estoque",
    ordem: 20,
  },
  {
    chave: "fornecedores",
    grupo: "Suprimentos",
    grupoOrdem: 30,
    rotulo: "Fornecedores",
    destino: "/fornecedores",
    icone: "ClipboardList",
    modulo: "fornecedores",
    ordem: 30,
  },
  {
    chave: "solicitacoes",
    grupo: "Suprimentos",
    grupoOrdem: 30,
    rotulo: "Solicitações",
    destino: "/solicitacoes",
    icone: "ClipboardList",
    modulo: "solicitacoes",
    ordem: 40,
  },
  {
    chave: "enfermagem",
    grupo: "Enfermagem",
    grupoOrdem: 40,
    rotulo: "Atendimentos",
    destino: "/enfermagem",
    icone: "HeartPulse",
    modulo: "enfermagem",
    ordem: 10,
  },
  {
    chave: "escala-enfermagem",
    grupo: "Enfermagem",
    grupoOrdem: 40,
    rotulo: "Escala semanal",
    destino: "/escala-enfermagem",
    icone: "CalendarDays",
    modulo: "escala_enfermagem_visualizar",
    ordem: 20,
  },
  {
    chave: "salas-enfermagem",
    grupo: "Enfermagem",
    grupoOrdem: 40,
    rotulo: "Salas de exames",
    destino: "/salas-enfermagem",
    icone: "DoorOpen",
    modulo: "enfermagem",
    ordem: 30,
  },
  {
    chave: "colaboradoras-enfermagem",
    grupo: "Enfermagem",
    grupoOrdem: 40,
    rotulo: "Colaboradoras",
    destino: "/colaboradoras-enfermagem",
    icone: "Users",
    modulo: "enfermagem",
    ordem: 40,
  },
  {
    chave: "medicos-enfermagem",
    grupo: "Enfermagem",
    grupoOrdem: 40,
    rotulo: "Médicos",
    destino: "/medicos-enfermagem",
    icone: "Stethoscope",
    modulo: "enfermagem",
    ordem: 50,
  },
  {
    chave: "pacientes",
    grupo: "Enfermagem",
    grupoOrdem: 40,
    rotulo: "Pacientes",
    destino: "/pacientes",
    icone: "Users",
    modulo: "enfermagem",
    ordem: 60,
  },
  {
    chave: "sondas",
    grupo: "Enfermagem",
    grupoOrdem: 40,
    rotulo: "Sondas",
    destino: "/sondas",
    icone: "Waves",
    modulo: "sondas",
    ordem: 70,
  },
  {
    chave: "notas",
    grupo: "Apoio",
    grupoOrdem: 50,
    rotulo: "Notas",
    destino: "/notas",
    icone: "StickyNote",
    modulo: "notas",
    ordem: 10,
  },
  {
    chave: "lembretes",
    grupo: "Apoio",
    grupoOrdem: 50,
    rotulo: "Lembretes",
    destino: "/lembretes",
    icone: "BellRing",
    modulo: "lembretes",
    ordem: 20,
  },
  {
    chave: "equipamentos-us",
    grupo: "Apoio",
    grupoOrdem: 50,
    rotulo: "Aparelhos de US / Equipamentos",
    destino: "/equipamentos-us",
    icone: "MonitorCog",
    modulo: "equipamentos_us",
    ordem: 30,
  },
  {
    chave: "agenda-marcacao",
    grupo: "Apoio",
    grupoOrdem: 50,
    rotulo: "Minha Agenda",
    destino: "/agenda-marcacao",
    icone: "CalendarHeart",
    modulo: "agenda_marcacao",
    ordem: 40,
  },
  {
    chave: "relatorios",
    grupo: "Apoio",
    grupoOrdem: 50,
    rotulo: "Relatórios",
    destino: "/relatorios",
    icone: "BarChart3",
    modulo: "relatorios",
    ordem: 50,
  },
  {
    chave: "senhas",
    grupo: "Apoio",
    grupoOrdem: 50,
    rotulo: "Senhas",
    destino: "/senhas",
    icone: "KeyRound",
    modulo: "senhas",
    ordem: 60,
  },
  {
    chave: "controle-ip",
    grupo: "Rede",
    grupoOrdem: 60,
    rotulo: "Controle de IP",
    destino: "/controle-ip",
    icone: "Network",
    modulo: "controle_ip",
    ordem: 10,
  },
  {
    chave: "lixeira",
    grupo: "Sistema",
    grupoOrdem: 70,
    rotulo: "Lixeira",
    destino: "/lixeira",
    icone: "Trash2",
    modulo: "lixeira",
    ordem: 10,
  },
];

export function normalizarIconeMenu(value: string | null | undefined): MenuIconName {
  return value && value in MENU_ICONS ? (value as MenuIconName) : "LayoutDashboard";
}

export function agruparMenu(itens: MenuItemDefinition[]) {
  const grupos = new Map<
    string,
    { grupo: string; grupoOrdem: number; itens: MenuItemDefinition[] }
  >();
  for (const item of itens) {
    const atual = grupos.get(item.grupo) ?? {
      grupo: item.grupo,
      grupoOrdem: item.grupoOrdem,
      itens: [],
    };
    atual.itens.push(item);
    grupos.set(item.grupo, atual);
  }
  return [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      itens: [...grupo.itens].sort((a, b) => a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo)),
    }))
    .sort((a, b) => a.grupoOrdem - b.grupoOrdem || a.grupo.localeCompare(b.grupo));
}
