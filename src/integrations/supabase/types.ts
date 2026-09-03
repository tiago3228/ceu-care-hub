export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aparelhos_ultrassom: {
        Row: {
          aetitle: string | null
          aparelho: string
          ativo: boolean
          data_cadastro: string | null
          gravacao: string | null
          id: number
          ip: string | null
          observacoes: string | null
          porta: string | null
          sala: string
          voltagem: string | null
          worklist: string | null
        }
        Insert: {
          aetitle?: string | null
          aparelho: string
          ativo?: boolean
          data_cadastro?: string | null
          gravacao?: string | null
          id?: number
          ip?: string | null
          observacoes?: string | null
          porta?: string | null
          sala: string
          voltagem?: string | null
          worklist?: string | null
        }
        Update: {
          aetitle?: string | null
          aparelho?: string
          ativo?: boolean
          data_cadastro?: string | null
          gravacao?: string | null
          id?: number
          ip?: string | null
          observacoes?: string | null
          porta?: string | null
          sala?: string
          voltagem?: string | null
          worklist?: string | null
        }
        Relationships: []
      }
      atendimento_materiais: {
        Row: {
          atendimento_id: number
          created_at: string
          id: number
          item_id: number
          lote_id: number | null
          quantidade: number
        }
        Insert: {
          atendimento_id: number
          created_at?: string
          id?: number
          item_id: number
          lote_id?: number | null
          quantidade: number
        }
        Update: {
          atendimento_id?: number
          created_at?: string
          id?: number
          item_id?: number
          lote_id?: number | null
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_materiais_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos_enfermagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_materiais_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_materiais_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos_enfermagem: {
        Row: {
          colaboradora_id: number | null
          created_at: string
          created_by: string | null
          data: string
          hora: string | null
          id: number
          medico_id: number | null
          observacoes: string | null
          paciente_id: number | null
          paciente_nome_livre: string | null
          procedimento: string
          procedimento_id: number | null
          sala_id: number | null
        }
        Insert: {
          colaboradora_id?: number | null
          created_at?: string
          created_by?: string | null
          data?: string
          hora?: string | null
          id?: number
          medico_id?: number | null
          observacoes?: string | null
          paciente_id?: number | null
          paciente_nome_livre?: string | null
          procedimento: string
          procedimento_id?: number | null
          sala_id?: number | null
        }
        Update: {
          colaboradora_id?: number | null
          created_at?: string
          created_by?: string | null
          data?: string
          hora?: string | null
          id?: number
          medico_id?: number | null
          observacoes?: string | null
          paciente_id?: number | null
          paciente_nome_livre?: string | null
          procedimento?: string
          procedimento_id?: number | null
          sala_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_enfermagem_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_enfermagem_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_enfermagem_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_enfermagem_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos_enfermagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_enfermagem_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: number
          observacoes: string | null
          operacao: string
          registro_id: string | null
          tabela: string
          user_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: number
          observacoes?: string | null
          operacao: string
          registro_id?: string | null
          tabela: string
          user_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: number
          observacoes?: string | null
          operacao?: string
          registro_id?: string | null
          tabela?: string
          user_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      ausencias: {
        Row: {
          anexo_atestado: string | null
          colaboradora_id: number | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          id: number
          medico_id: number | null
          observacoes: string | null
          tipo: string | null
        }
        Insert: {
          anexo_atestado?: string | null
          colaboradora_id?: number | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: number
          medico_id?: number | null
          observacoes?: string | null
          tipo?: string | null
        }
        Update: {
          anexo_atestado?: string | null
          colaboradora_id?: number | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: number
          medico_id?: number | null
          observacoes?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ausencias_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ausencias_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      banco_horas: {
        Row: {
          colaboradora_id: number | null
          created_at: string
          data: string | null
          id: number
          minutos: number
          observacoes: string | null
          tipo: string | null
        }
        Insert: {
          colaboradora_id?: number | null
          created_at?: string
          data?: string | null
          id?: number
          minutos?: number
          observacoes?: string | null
          tipo?: string | null
        }
        Update: {
          colaboradora_id?: number | null
          created_at?: string
          data?: string | null
          id?: number
          minutos?: number
          observacoes?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banco_horas_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradora_medicos_padrao: {
        Row: {
          colaboradora_id: number
          id: number
          medico_id: number
        }
        Insert: {
          colaboradora_id: number
          id?: number
          medico_id: number
        }
        Update: {
          colaboradora_id?: number
          id?: number
          medico_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "colaboradora_medicos_padrao_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradora_medicos_padrao_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradoras: {
        Row: {
          atende_todos_medicos: boolean
          banco_horas: number
          cargo: string | null
          coordenadora: string | null
          desativada: boolean
          entrada: string | null
          especialidades: string | null
          estagiaria: string | null
          funcoes: string | null
          id: number
          jornada: string | null
          medico_padrao_id: number | null
          nome: string
          observacoes: string | null
          saida: string | null
          secretaria: string | null
          status: string | null
          supervisora: string | null
          tipo_colaboradora: string | null
          treinamentos: string | null
        }
        Insert: {
          atende_todos_medicos?: boolean
          banco_horas?: number
          cargo?: string | null
          coordenadora?: string | null
          desativada?: boolean
          entrada?: string | null
          especialidades?: string | null
          estagiaria?: string | null
          funcoes?: string | null
          id?: number
          jornada?: string | null
          medico_padrao_id?: number | null
          nome: string
          observacoes?: string | null
          saida?: string | null
          secretaria?: string | null
          status?: string | null
          supervisora?: string | null
          tipo_colaboradora?: string | null
          treinamentos?: string | null
        }
        Update: {
          atende_todos_medicos?: boolean
          banco_horas?: number
          cargo?: string | null
          coordenadora?: string | null
          desativada?: boolean
          entrada?: string | null
          especialidades?: string | null
          estagiaria?: string | null
          funcoes?: string | null
          id?: number
          jornada?: string | null
          medico_padrao_id?: number | null
          nome?: string
          observacoes?: string | null
          saida?: string | null
          secretaria?: string | null
          status?: string | null
          supervisora?: string | null
          tipo_colaboradora?: string | null
          treinamentos?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradoras_medico_padrao_id_fkey"
            columns: ["medico_padrao_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_sistema: {
        Row: {
          chave: string
          valor: string | null
        }
        Insert: {
          chave: string
          valor?: string | null
        }
        Update: {
          chave?: string
          valor?: string | null
        }
        Relationships: []
      }
      conflitos_detectados: {
        Row: {
          data_deteccao: string
          descricao: string | null
          escala_id: number | null
          id: number
          resolvido: boolean
          tipo_conflito: string | null
        }
        Insert: {
          data_deteccao?: string
          descricao?: string | null
          escala_id?: number | null
          id?: number
          resolvido?: boolean
          tipo_conflito?: string | null
        }
        Update: {
          data_deteccao?: string
          descricao?: string | null
          escala_id?: number | null
          id?: number
          resolvido?: boolean
          tipo_conflito?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conflitos_detectados_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      enf_detalhe_coleta: {
        Row: {
          atendimento_id: number
          horario_coleta: string | null
          material_coletado: string | null
          tipo_exame: string | null
        }
        Insert: {
          atendimento_id: number
          horario_coleta?: string | null
          material_coletado?: string | null
          tipo_exame?: string | null
        }
        Update: {
          atendimento_id?: number
          horario_coleta?: string | null
          material_coletado?: string | null
          tipo_exame?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enf_detalhe_coleta_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: true
            referencedRelation: "atendimentos_enfermagem"
            referencedColumns: ["id"]
          },
        ]
      }
      enf_detalhe_sinais_vitais: {
        Row: {
          atendimento_id: number
          frequencia_cardiaca: string | null
          glicemia: string | null
          peso: string | null
          pressao_arterial: string | null
          saturacao: string | null
          temperatura: string | null
        }
        Insert: {
          atendimento_id: number
          frequencia_cardiaca?: string | null
          glicemia?: string | null
          peso?: string | null
          pressao_arterial?: string | null
          saturacao?: string | null
          temperatura?: string | null
        }
        Update: {
          atendimento_id?: number
          frequencia_cardiaca?: string | null
          glicemia?: string | null
          peso?: string | null
          pressao_arterial?: string | null
          saturacao?: string | null
          temperatura?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enf_detalhe_sinais_vitais_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: true
            referencedRelation: "atendimentos_enfermagem"
            referencedColumns: ["id"]
          },
        ]
      }
      enf_detalhe_vacina: {
        Row: {
          atendimento_id: number
          dose: string | null
          local_aplicacao: string | null
          lote: string | null
          vacina: string | null
          validade: string | null
          via_administracao: string | null
        }
        Insert: {
          atendimento_id: number
          dose?: string | null
          local_aplicacao?: string | null
          lote?: string | null
          vacina?: string | null
          validade?: string | null
          via_administracao?: string | null
        }
        Update: {
          atendimento_id?: number
          dose?: string | null
          local_aplicacao?: string | null
          lote?: string | null
          vacina?: string | null
          validade?: string | null
          via_administracao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enf_detalhe_vacina_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: true
            referencedRelation: "atendimentos_enfermagem"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_base: {
        Row: {
          dia_semana: string
          horario_fim: string | null
          horario_inicio: string | null
          id: number
          medico_id: number | null
          observacoes: string | null
          periodo: string
          sala_id: number | null
        }
        Insert: {
          dia_semana: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: number
          medico_id?: number | null
          observacoes?: string | null
          periodo: string
          sala_id?: number | null
        }
        Update: {
          dia_semana?: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: number
          medico_id?: number | null
          observacoes?: string | null
          periodo?: string
          sala_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "escala_base_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_base_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_base_colaboradoras: {
        Row: {
          colaboradora_id: number
          escala_base_id: number
        }
        Insert: {
          colaboradora_id: number
          escala_base_id: number
        }
        Update: {
          colaboradora_id?: number
          escala_base_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "escala_base_colaboradoras_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_base_colaboradoras_escala_base_id_fkey"
            columns: ["escala_base_id"]
            isOneToOne: false
            referencedRelation: "escala_base"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_colaboradoras: {
        Row: {
          alerta_ignorado: string | null
          colaboradora_id: number
          escala_id: number
        }
        Insert: {
          alerta_ignorado?: string | null
          colaboradora_id: number
          escala_id: number
        }
        Update: {
          alerta_ignorado?: string | null
          colaboradora_id?: number
          escala_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "escala_colaboradoras_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_colaboradoras_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          horario_fim: string | null
          horario_inicio: string | null
          id: number
          medico_id: number | null
          motivo_alerta: string | null
          observacoes: string | null
          periodo: string | null
          sala_id: number | null
          status_compatibilidade: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: number
          medico_id?: number | null
          motivo_alerta?: string | null
          observacoes?: string | null
          periodo?: string | null
          sala_id?: number | null
          status_compatibilidade?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: number
          medico_id?: number | null
          motivo_alerta?: string | null
          observacoes?: string | null
          periodo?: string | null
          sala_id?: number | null
          status_compatibilidade?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalas_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      especialidades: {
        Row: {
          descricao: string | null
          id: number
          sigla: string
        }
        Insert: {
          descricao?: string | null
          id?: number
          sigla: string
        }
        Update: {
          descricao?: string | null
          id?: number
          sigla?: string
        }
        Relationships: []
      }
      itens: {
        Row: {
          anvisa: string | null
          ativo: boolean
          be: boolean
          codigo: string | null
          controla_validade: boolean
          cs: boolean
          custo: number | null
          el: boolean
          grupo: string | null
          id: number
          nome: string
          preco: number | null
          referencia: string | null
          tipo: string
          unidade: string | null
        }
        Insert: {
          anvisa?: string | null
          ativo?: boolean
          be?: boolean
          codigo?: string | null
          controla_validade?: boolean
          cs?: boolean
          custo?: number | null
          el?: boolean
          grupo?: string | null
          id?: number
          nome: string
          preco?: number | null
          referencia?: string | null
          tipo: string
          unidade?: string | null
        }
        Update: {
          anvisa?: string | null
          ativo?: boolean
          be?: boolean
          codigo?: string | null
          controla_validade?: boolean
          cs?: boolean
          custo?: number | null
          el?: boolean
          grupo?: string | null
          id?: number
          nome?: string
          preco?: number | null
          referencia?: string | null
          tipo?: string
          unidade?: string | null
        }
        Relationships: []
      }
      lotes: {
        Row: {
          data_entrada: string
          id: number
          item_id: number
          localizacao: string | null
          lote: string | null
          quantidade: number
          validade: string | null
        }
        Insert: {
          data_entrada?: string
          id?: number
          item_id: number
          localizacao?: string | null
          lote?: string | null
          quantidade?: number
          validade?: string | null
        }
        Update: {
          data_entrada?: string
          id?: number
          item_id?: number
          localizacao?: string | null
          lote?: string | null
          quantidade?: number
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
        ]
      }
      medico_salas: {
        Row: {
          id: number
          medico_id: number
          sala_id: number
        }
        Insert: {
          id?: number
          medico_id: number
          sala_id: number
        }
        Update: {
          id?: number
          medico_id?: number
          sala_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "medico_salas_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medico_salas_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      medico_secretarias_favoritas: {
        Row: {
          colaboradora_id: number
          id: number
          medico_id: number
          ordem: number
        }
        Insert: {
          colaboradora_id: number
          id?: number
          medico_id: number
          ordem?: number
        }
        Update: {
          colaboradora_id?: number
          id?: number
          medico_id?: number
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "medico_secretarias_favoritas_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medico_secretarias_favoritas_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      medicos: {
        Row: {
          apelido: string | null
          ativo: boolean
          colaboradora_padrao_id: number | null
          crm: string | null
          especialidade_principal: string | null
          especialidades: string | null
          id: number
          necessita_experiente: boolean
          nome: string
          observacoes: string | null
          procedimentos: string | null
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          colaboradora_padrao_id?: number | null
          crm?: string | null
          especialidade_principal?: string | null
          especialidades?: string | null
          id?: number
          necessita_experiente?: boolean
          nome: string
          observacoes?: string | null
          procedimentos?: string | null
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          colaboradora_padrao_id?: number | null
          crm?: string | null
          especialidade_principal?: string | null
          especialidades?: string | null
          id?: number
          necessita_experiente?: boolean
          nome?: string
          observacoes?: string | null
          procedimentos?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicos_colab_padrao_fk"
            columns: ["colaboradora_padrao_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          atendimento_id: number | null
          created_at: string
          data: string
          hora: string | null
          id: number
          item_id: number
          lote_id: number | null
          observacoes: string | null
          quantidade: number
          responsavel_id: number | null
          solicitacao_item_id: number | null
          tipo: string
          user_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          atendimento_id?: number | null
          created_at?: string
          data?: string
          hora?: string | null
          id?: number
          item_id: number
          lote_id?: number | null
          observacoes?: string | null
          quantidade: number
          responsavel_id?: number | null
          solicitacao_item_id?: number | null
          tipo: string
          user_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          atendimento_id?: number | null
          created_at?: string
          data?: string
          hora?: string | null
          id?: number
          item_id?: number
          lote_id?: number | null
          observacoes?: string | null
          quantidade?: number
          responsavel_id?: number | null
          solicitacao_item_id?: number | null
          tipo?: string
          user_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
        ]
      }
      notas: {
        Row: {
          conteudo: string | null
          created_at: string
          created_by: string | null
          data_alerta: string | null
          data_criacao: string
          hora_alerta: string | null
          hora_criacao: string | null
          id: number
          lido: boolean
          status: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          data_alerta?: string | null
          data_criacao?: string
          hora_alerta?: string | null
          hora_criacao?: string | null
          id?: number
          lido?: boolean
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          data_alerta?: string | null
          data_criacao?: string
          hora_alerta?: string | null
          hora_criacao?: string | null
          id?: number
          lido?: boolean
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          arquivado: boolean
          created_at: string
          data_nascimento: string | null
          id: number
          nome: string
          observacoes: string | null
          prontuario: string | null
        }
        Insert: {
          arquivado?: boolean
          created_at?: string
          data_nascimento?: string | null
          id?: number
          nome: string
          observacoes?: string | null
          prontuario?: string | null
        }
        Update: {
          arquivado?: boolean
          created_at?: string
          data_nascimento?: string | null
          id?: number
          nome?: string
          observacoes?: string | null
          prontuario?: string | null
        }
        Relationships: []
      }
      procedimento_materiais: {
        Row: {
          id: number
          item_id: number
          procedimento_id: number
          quantidade: number
        }
        Insert: {
          id?: number
          item_id: number
          procedimento_id: number
          quantidade?: number
        }
        Update: {
          id?: number
          item_id?: number
          procedimento_id?: number
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "procedimento_materiais_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedimento_materiais_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos_enfermagem"
            referencedColumns: ["id"]
          },
        ]
      }
      procedimentos_enfermagem: {
        Row: {
          ativo: boolean
          id: number
          nome: string
        }
        Insert: {
          ativo?: boolean
          id?: number
          nome: string
        }
        Update: {
          ativo?: boolean
          id?: number
          nome?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          legacy_usuario_id: number | null
          login: string | null
          nome: string
          setor: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id: string
          legacy_usuario_id?: number | null
          login?: string | null
          nome?: string
          setor?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          legacy_usuario_id?: number | null
          login?: string | null
          nome?: string
          setor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sala_colaboradoras: {
        Row: {
          colaboradora_id: number
          id: number
          sala_id: number
        }
        Insert: {
          colaboradora_id: number
          id?: number
          sala_id: number
        }
        Update: {
          colaboradora_id?: number
          id?: number
          sala_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sala_colaboradoras_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sala_colaboradoras_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      salas: {
        Row: {
          aparelho_id: number | null
          ativa: boolean
          especialidade_principal: string | null
          horario_fim: string | null
          horario_inicio: string | null
          id: number
          nome: string
          observacoes: string | null
          recursos: string | null
          unidade: string | null
        }
        Insert: {
          aparelho_id?: number | null
          ativa?: boolean
          especialidade_principal?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: number
          nome: string
          observacoes?: string | null
          recursos?: string | null
          unidade?: string | null
        }
        Update: {
          aparelho_id?: number | null
          ativa?: boolean
          especialidade_principal?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: number
          nome?: string
          observacoes?: string | null
          recursos?: string | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salas_aparelho_id_fkey"
            columns: ["aparelho_id"]
            isOneToOne: false
            referencedRelation: "aparelhos_ultrassom"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacao_itens: {
        Row: {
          data_atendimento: string | null
          id: number
          item_id: number
          lote_id: number | null
          observacoes: string | null
          quantidade_atendida: number
          quantidade_solicitada: number
          responsavel_atendimento_id: number | null
          solicitacao_id: number
        }
        Insert: {
          data_atendimento?: string | null
          id?: number
          item_id: number
          lote_id?: number | null
          observacoes?: string | null
          quantidade_atendida?: number
          quantidade_solicitada: number
          responsavel_atendimento_id?: number | null
          solicitacao_id: number
        }
        Update: {
          data_atendimento?: string | null
          id?: number
          item_id?: number
          lote_id?: number | null
          observacoes?: string | null
          quantidade_atendida?: number
          quantidade_solicitada?: number
          responsavel_atendimento_id?: number | null
          solicitacao_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_itens_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_itens_responsavel_atendimento_id_fkey"
            columns: ["responsavel_atendimento_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          id: number
          observacoes: string | null
          setor: string | null
          solicitante_id: number | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string
          id?: number
          observacoes?: string | null
          setor?: string | null
          solicitante_id?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          id?: number
          observacoes?: string | null
          setor?: string | null
          solicitante_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
        ]
      }
      sondas_desinfeccao: {
        Row: {
          assinatura: string | null
          created_at: string
          created_by: string | null
          data: string
          horario_inicio: string | null
          horario_termino: string | null
          id: number
          numero_sonda: string
          observacao: string | null
          protocolo: string | null
        }
        Insert: {
          assinatura?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          horario_inicio?: string | null
          horario_termino?: string | null
          id?: number
          numero_sonda: string
          observacao?: string | null
          protocolo?: string | null
        }
        Update: {
          assinatura?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          horario_inicio?: string | null
          horario_termino?: string | null
          id?: number
          numero_sonda?: string
          observacao?: string | null
          protocolo?: string | null
        }
        Relationships: []
      }
      sondas_teste_fita: {
        Row: {
          created_at: string
          created_by: string | null
          data_teste: string
          id: number
          lote: string | null
          observacao: string | null
          produto: string | null
          responsavel: string | null
          validade: string | null
          validade_produto_cuba: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_teste?: string
          id?: number
          lote?: string | null
          observacao?: string | null
          produto?: string | null
          responsavel?: string | null
          validade?: string | null
          validade_produto_cuba?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_teste?: string
          id?: number
          lote?: string | null
          observacao?: string | null
          produto?: string | null
          responsavel?: string | null
          validade?: string | null
          validade_produto_cuba?: string | null
        }
        Relationships: []
      }
      sondas_troca_cuba: {
        Row: {
          created_at: string
          created_by: string | null
          data_troca: string
          id: number
          lote: string | null
          produto: string | null
          proxima_troca: string | null
          responsavel: string | null
          validade_rioscope: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_troca?: string
          id?: number
          lote?: string | null
          produto?: string | null
          proxima_troca?: string | null
          responsavel?: string | null
          validade_rioscope?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_troca?: string
          id?: number
          lote?: string | null
          produto?: string | null
          proxima_troca?: string | null
          responsavel?: string | null
          validade_rioscope?: string | null
        }
        Relationships: []
      }
      sugestoes: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          nome: string | null
          setor: string | null
          sugestao: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          nome?: string | null
          setor?: string | null
          sugestao: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          nome?: string | null
          setor?: string | null
          sugestao?: string
          updated_at?: string
        }
        Relationships: []
      }
      treinamentos: {
        Row: {
          colaboradora_id: number | null
          data_fim: string | null
          data_inicio: string | null
          especialidade: string | null
          id: number
          instrutora: string | null
          observacoes: string | null
          status: string | null
        }
        Insert: {
          colaboradora_id?: number | null
          data_fim?: string | null
          data_inicio?: string | null
          especialidade?: string | null
          id?: number
          instrutora?: string | null
          observacoes?: string | null
          status?: string | null
        }
        Update: {
          colaboradora_id?: number | null
          data_fim?: string | null
          data_inicio?: string | null
          especialidade?: string | null
          id?: number
          instrutora?: string | null
          observacoes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuario_permissoes: {
        Row: {
          id: string
          modulo: string
          user_id: string
        }
        Insert: {
          id?: string
          modulo: string
          user_id: string
        }
        Update: {
          id?: string
          modulo?: string
          user_id?: string
        }
        Relationships: []
      }
      versiculos: {
        Row: {
          id: number
          referencia: string | null
          texto: string
        }
        Insert: {
          id?: number
          referencia?: string | null
          texto: string
        }
        Update: {
          id?: number
          referencia?: string | null
          texto?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_ativo: { Args: { _user_id: string }; Returns: boolean }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      pode_editar: {
        Args: { _modulo: string; _user_id: string }
        Returns: boolean
      }
      tem_modulo: {
        Args: { _modulo: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin_master"
        | "administrador"
        | "coordenacao"
        | "enfermagem"
        | "secretaria"
        | "visualizacao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin_master",
        "administrador",
        "coordenacao",
        "enfermagem",
        "secretaria",
        "visualizacao",
      ],
    },
  },
} as const
