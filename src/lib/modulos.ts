export type ModuloChave =
  | "escalas"
  | "colaboradoras"
  | "medicos"
  | "salas"
  | "ausencias"
  | "banco_horas"
  | "notas"
  | "aparelhos"
  | "configuracoes"
  | "materiais"
  | "itens"
  | "estoque"
  | "solicitacoes"
  | "enfermagem"
  | "sondas"
  | "relatorios"
  | "ramais"
  | "senhas"
  | "senhas_adicionar"
  | "senhas_editar"
  | "senhas_excluir"
  | "senhas_revelar";

/**
 * Mesmas chaves de permissão do sistema desktop (services/modulos_sistema.py),
 * para que as permissões já cadastradas continuem válidas.
 */
export const MODULOS: { chave: ModuloChave; rotulo: string; grupo: string }[] = [
  { chave: "escalas", rotulo: "Escala Semanal", grupo: "Operação" },
  { chave: "colaboradoras", rotulo: "Colaboradoras", grupo: "Pessoas" },
  { chave: "medicos", rotulo: "Médicos", grupo: "Pessoas" },
  { chave: "salas", rotulo: "Salas de Exame", grupo: "Operação" },
  { chave: "ausencias", rotulo: "Ausências / Férias", grupo: "Pessoas" },
  { chave: "banco_horas", rotulo: "Banco de Horas", grupo: "Pessoas" },
  { chave: "notas", rotulo: "Bloco de Notas", grupo: "Apoio" },
  { chave: "aparelhos", rotulo: "Aparelhos de Ultrassom", grupo: "Operação" },
  { chave: "itens", rotulo: "Itens (Materiais/Medicamentos)", grupo: "Suprimentos" },
  { chave: "materiais", rotulo: "Materiais", grupo: "Suprimentos" },
  { chave: "estoque", rotulo: "Estoque / Lotes", grupo: "Suprimentos" },
  { chave: "solicitacoes", rotulo: "Solicitações", grupo: "Suprimentos" },
  { chave: "enfermagem", rotulo: "Enfermagem", grupo: "Enfermagem" },
  { chave: "sondas", rotulo: "Sondas", grupo: "Enfermagem" },
  { chave: "relatorios", rotulo: "Relatórios", grupo: "Apoio" },
  { chave: "ramais", rotulo: "Ramais (telefonia)", grupo: "Apoio" },
  { chave: "senhas", rotulo: "Visualizar senhas", grupo: "Apoio" },
  { chave: "senhas_adicionar", rotulo: "Adicionar senhas", grupo: "Apoio" },
  { chave: "senhas_editar", rotulo: "Editar senhas", grupo: "Apoio" },
  { chave: "senhas_excluir", rotulo: "Excluir senhas", grupo: "Apoio" },
  { chave: "senhas_revelar", rotulo: "Revelar / copiar senhas", grupo: "Apoio" },
  { chave: "configuracoes", rotulo: "Configurações", grupo: "Sistema" },
];

export const PERFIS = [
  { valor: "admin_master", rotulo: "Administrador Master" },
  { valor: "administrador", rotulo: "Administrador" },
  { valor: "coordenacao", rotulo: "Coordenação" },
  { valor: "enfermagem", rotulo: "Enfermagem" },
  { valor: "secretaria", rotulo: "Secretaria" },
  { valor: "visualizacao", rotulo: "Visualização" },
] as const;

export type PerfilValor = (typeof PERFIS)[number]["valor"];

export const VERSAO_SISTEMA = "1.0.0";
