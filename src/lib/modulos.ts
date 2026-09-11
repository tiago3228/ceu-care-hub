export type ModuloChave =
  | "escalas"
  | "escalas_visualizar"
  | "escalas_editar"
  | "colaboradoras"
  | "medicos"
  | "salas"
  | "ausencias"
  | "banco_horas"
  | "notas"
  | "agenda_marcacao"
  | "agenda_marcacao_adicionar"
  | "agenda_marcacao_editar"
  | "agenda_marcacao_excluir"
  | "agenda_marcacao_relatorios"
  | "lembretes"
  | "lembretes_adicionar"
  | "lembretes_editar"
  | "lembretes_excluir"
  | "lembretes_visualizar_todos"
  | "equipamentos_us"
  | "equipamentos_us_adicionar"
  | "equipamentos_us_editar"
  | "equipamentos_us_excluir"
  | "equipamentos_us_visualizar_senhas"
  | "equipamentos_us_visualizar_todos"
  | "equipamentos_us_relatorios"
  | "equipamentos_us_manutencao"
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
  | "senhas_revelar"
  | "controle_ip"
  | "controle_ip_adicionar"
  | "controle_ip_editar"
  | "controle_ip_excluir"
  | "controle_ip_wifi_senha_visualizar";

/**
 * Mesmas chaves de permissão do sistema desktop (services/modulos_sistema.py),
 * para que as permissões já cadastradas continuem válidas.
 */
export const MODULOS: { chave: ModuloChave; rotulo: string; grupo: string }[] = [
  { chave: "escalas", rotulo: "Escala Semanal", grupo: "Operação" },
  { chave: "escalas_visualizar", rotulo: "Visualizar Escala", grupo: "Operação" },
  { chave: "escalas_editar", rotulo: "Editar Escala", grupo: "Operação" },
  { chave: "colaboradoras", rotulo: "Colaboradoras", grupo: "Pessoas" },
  { chave: "medicos", rotulo: "Médicos", grupo: "Pessoas" },
  { chave: "salas", rotulo: "Salas de Exame", grupo: "Operação" },
  { chave: "ausencias", rotulo: "Ausências / Férias", grupo: "Pessoas" },
  { chave: "banco_horas", rotulo: "Banco de Horas", grupo: "Pessoas" },
  { chave: "notas", rotulo: "Bloco de Notas", grupo: "Apoio" },
  { chave: "agenda_marcacao", rotulo: "Minha Agenda", grupo: "Marcação" },
  {
    chave: "agenda_marcacao_adicionar",
    rotulo: "Adicionar registros da agenda",
    grupo: "Marcação",
  },
  { chave: "agenda_marcacao_editar", rotulo: "Editar registros da agenda", grupo: "Marcação" },
  { chave: "agenda_marcacao_excluir", rotulo: "Excluir registros da agenda", grupo: "Marcação" },
  { chave: "agenda_marcacao_relatorios", rotulo: "Relatórios da agenda", grupo: "Marcação" },
  { chave: "lembretes", rotulo: "Lembretes", grupo: "Apoio" },
  { chave: "lembretes_adicionar", rotulo: "Adicionar lembretes", grupo: "Apoio" },
  { chave: "lembretes_editar", rotulo: "Editar lembretes", grupo: "Apoio" },
  { chave: "lembretes_excluir", rotulo: "Excluir lembretes", grupo: "Apoio" },
  { chave: "lembretes_visualizar_todos", rotulo: "Visualizar todos os lembretes", grupo: "Apoio" },
  { chave: "equipamentos_us", rotulo: "Visualizar Equipamentos US", grupo: "Operação" },
  { chave: "equipamentos_us_adicionar", rotulo: "Adicionar Equipamentos US", grupo: "Operação" },
  { chave: "equipamentos_us_editar", rotulo: "Editar Equipamentos US", grupo: "Operação" },
  { chave: "equipamentos_us_excluir", rotulo: "Excluir Equipamentos US", grupo: "Operação" },
  {
    chave: "equipamentos_us_visualizar_senhas",
    rotulo: "Visualizar senhas de equipamentos",
    grupo: "Operação",
  },
  {
    chave: "equipamentos_us_visualizar_todos",
    rotulo: "Visualizar todos os equipamentos",
    grupo: "Operação",
  },
  { chave: "equipamentos_us_relatorios", rotulo: "Relatórios de equipamentos", grupo: "Operação" },
  {
    chave: "equipamentos_us_manutencao",
    rotulo: "Gerenciar manutenção de equipamentos",
    grupo: "Operação",
  },
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
  { chave: "controle_ip", rotulo: "Visualizar Controle de IP", grupo: "Rede" },
  { chave: "controle_ip_adicionar", rotulo: "Adicionar Controle de IP", grupo: "Rede" },
  { chave: "controle_ip_editar", rotulo: "Editar Controle de IP", grupo: "Rede" },
  { chave: "controle_ip_excluir", rotulo: "Excluir Controle de IP", grupo: "Rede" },
  { chave: "controle_ip_wifi_senha_visualizar", rotulo: "Visualizar senhas Wi-Fi", grupo: "Rede" },
];

export const PERFIS = [
  { valor: "admin_master", rotulo: "Administrador Master" },
  { valor: "administrador", rotulo: "Administrador" },
  { valor: "coordenacao", rotulo: "Coordenação" },
  { valor: "enfermagem", rotulo: "Enfermagem" },
  { valor: "secretaria", rotulo: "Secretaria" },
  { valor: "recepcao", rotulo: "Recepção" },
  { valor: "marcacao", rotulo: "Marcação" },
  { valor: "comercial", rotulo: "Comercial" },
  { valor: "qualidade", rotulo: "Qualidade" },
  { valor: "rh", rotulo: "RH" },
  { valor: "manutencao", rotulo: "Manutenção" },
  { valor: "medicos", rotulo: "Médicos" },
  { valor: "diretoria", rotulo: "Diretoria" },
  { valor: "visualizacao", rotulo: "Visualização" },
] as const;

export type PerfilValor = (typeof PERFIS)[number]["valor"];

export const VERSAO_SISTEMA = "1.0.0";
