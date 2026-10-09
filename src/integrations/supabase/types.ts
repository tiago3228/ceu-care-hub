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
      agenda_marcacao: {
        Row: {
          convenio: string | null
          created_at: string
          created_by: string
          data_contato: string | null
          data_prevista: string | null
          exame: string | null
          id: number
          lembrete: string | null
          lembrete_em: string | null
          medico: string | null
          nome_paciente: string | null
          observacao: string | null
          observacoes_internas: string | null
          retorno_em: string | null
          status: string
          telefone: string | null
          unidade: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          convenio?: string | null
          created_at?: string
          created_by?: string
          data_contato?: string | null
          data_prevista?: string | null
          exame?: string | null
          id?: number
          lembrete?: string | null
          lembrete_em?: string | null
          medico?: string | null
          nome_paciente?: string | null
          observacao?: string | null
          observacoes_internas?: string | null
          retorno_em?: string | null
          status?: string
          telefone?: string | null
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          convenio?: string | null
          created_at?: string
          created_by?: string
          data_contato?: string | null
          data_prevista?: string | null
          exame?: string | null
          id?: number
          lembrete?: string | null
          lembrete_em?: string | null
          medico?: string | null
          nome_paciente?: string | null
          observacao?: string | null
          observacoes_internas?: string | null
          retorno_em?: string | null
          status?: string
          telefone?: string | null
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
      atalhos_dashboard_usuario: {
        Row: {
          ativo: boolean
          chave: string
          created_at: string
          destino: string
          icone: string
          id: number
          ordem: number
          rotulo: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          created_at?: string
          destino: string
          icone?: string
          id?: number
          ordem?: number
          rotulo: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          created_at?: string
          destino?: string
          icone?: string
          id?: number
          ordem?: number
          rotulo?: string
          updated_at?: string
          usuario_id?: string
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
      auditoria_autenticacao: {
        Row: {
          acao: string
          criado_em: string
          dados: Json | null
          email: string | null
          id: number
          user_id: string | null
          username: string | null
        }
        Insert: {
          acao: string
          criado_em?: string
          dados?: Json | null
          email?: string | null
          id?: number
          user_id?: string | null
          username?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string
          dados?: Json | null
          email?: string | null
          id?: number
          user_id?: string | null
          username?: string | null
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
      chat_admin_mensagens: {
        Row: {
          criado_em: string
          destinatario_id: string
          id: number
          lida_em: string | null
          mensagem: string | null
          remetente_id: string
        }
        Insert: {
          criado_em?: string
          destinatario_id: string
          id?: number
          lida_em?: string | null
          mensagem?: string | null
          remetente_id: string
        }
        Update: {
          criado_em?: string
          destinatario_id?: string
          id?: number
          lida_em?: string | null
          mensagem?: string | null
          remetente_id?: string
        }
        Relationships: []
      }
      chat_salas_mensagens: {
        Row: {
          anexo_nome: string | null
          anexo_path: string | null
          anexo_tamanho: number | null
          anexo_tipo: string | null
          canal: string
          criado_em: string
          destinatario_id: string
          id: number
          lida_em: string | null
          mensagem: string | null
          remetente_id: string
        }
        Insert: {
          anexo_nome?: string | null
          anexo_path?: string | null
          anexo_tamanho?: number | null
          anexo_tipo?: string | null
          canal?: string
          criado_em?: string
          destinatario_id: string
          id?: number
          lida_em?: string | null
          mensagem?: string | null
          remetente_id: string
        }
        Update: {
          anexo_nome?: string | null
          anexo_path?: string | null
          anexo_tamanho?: number | null
          anexo_tipo?: string | null
          canal?: string
          criado_em?: string
          destinatario_id?: string
          id?: number
          lida_em?: string | null
          mensagem?: string | null
          remetente_id?: string
        }
        Relationships: []
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
          almoco_ativo: boolean
          almoco_fim: string | null
          almoco_inicio: string | null
          apelido: string | null
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
          setor: string
          status: string | null
          supervisora: string | null
          tipo_colaboradora: string | null
          treinamentos: string | null
        }
        Insert: {
          almoco_ativo?: boolean
          almoco_fim?: string | null
          almoco_inicio?: string | null
          apelido?: string | null
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
          setor?: string
          status?: string | null
          supervisora?: string | null
          tipo_colaboradora?: string | null
          treinamentos?: string | null
        }
        Update: {
          almoco_ativo?: boolean
          almoco_fim?: string | null
          almoco_inicio?: string | null
          apelido?: string | null
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
          setor?: string
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
      configuracoes_acesso: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          valor?: Json
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          valor?: Json
        }
        Relationships: []
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
      controle_ip: {
        Row: {
          ae_title: string | null
          andar: string | null
          anydesk: string | null
          atualizado_em: string
          atualizado_por: string | null
          categoria: string
          criado_em: string
          criado_por: string | null
          erro_monitoramento: string | null
          fabricante: string | null
          historico_status: Json
          id: number
          ip: unknown
          local: string | null
          mac_address: string | null
          metodo_monitoramento: string
          modelo: string | null
          nome: string
          observacoes: string | null
          patrimonio: string | null
          patrimonio_cpu: string | null
          patrimonio_monitor: string | null
          porta: string | null
          rede_wifi: string | null
          senha_wifi: string | null
          setor: string | null
          sistema_operacional: string | null
          status_online: string
          tempo_resposta_ms: number | null
          ultima_verificacao: string | null
          unidade: string
          usuario_responsavel: string | null
          worklist: string | null
        }
        Insert: {
          ae_title?: string | null
          andar?: string | null
          anydesk?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          categoria: string
          criado_em?: string
          criado_por?: string | null
          erro_monitoramento?: string | null
          fabricante?: string | null
          historico_status?: Json
          id?: number
          ip?: unknown
          local?: string | null
          mac_address?: string | null
          metodo_monitoramento?: string
          modelo?: string | null
          nome: string
          observacoes?: string | null
          patrimonio?: string | null
          patrimonio_cpu?: string | null
          patrimonio_monitor?: string | null
          porta?: string | null
          rede_wifi?: string | null
          senha_wifi?: string | null
          setor?: string | null
          sistema_operacional?: string | null
          status_online?: string
          tempo_resposta_ms?: number | null
          ultima_verificacao?: string | null
          unidade: string
          usuario_responsavel?: string | null
          worklist?: string | null
        }
        Update: {
          ae_title?: string | null
          andar?: string | null
          anydesk?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          categoria?: string
          criado_em?: string
          criado_por?: string | null
          erro_monitoramento?: string | null
          fabricante?: string | null
          historico_status?: Json
          id?: number
          ip?: unknown
          local?: string | null
          mac_address?: string | null
          metodo_monitoramento?: string
          modelo?: string | null
          nome?: string
          observacoes?: string | null
          patrimonio?: string | null
          patrimonio_cpu?: string | null
          patrimonio_monitor?: string | null
          porta?: string | null
          rede_wifi?: string | null
          senha_wifi?: string | null
          setor?: string | null
          sistema_operacional?: string | null
          status_online?: string
          tempo_resposta_ms?: number | null
          ultima_verificacao?: string | null
          unidade?: string
          usuario_responsavel?: string | null
          worklist?: string | null
        }
        Relationships: []
      }
      controle_ip_historico_status: {
        Row: {
          controle_ip_id: number
          erro: string | null
          id: number
          metodo_monitoramento: string
          status_online: string
          tempo_resposta_ms: number | null
          verificado_em: string
          verificado_por: string | null
        }
        Insert: {
          controle_ip_id: number
          erro?: string | null
          id?: number
          metodo_monitoramento?: string
          status_online: string
          tempo_resposta_ms?: number | null
          verificado_em?: string
          verificado_por?: string | null
        }
        Update: {
          controle_ip_id?: number
          erro?: string | null
          id?: number
          metodo_monitoramento?: string
          status_online?: string
          tempo_resposta_ms?: number | null
          verificado_em?: string
          verificado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controle_ip_historico_status_controle_ip_id_fkey"
            columns: ["controle_ip_id"]
            isOneToOne: false
            referencedRelation: "controle_ip"
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
      equipamentos_us: {
        Row: {
          aetitle: string | null
          alerta_manutencao: boolean
          ano_fabricacao: number | null
          atualizado_em: string
          atualizado_por: string | null
          contato_tecnico: string | null
          contrato_vigente: boolean
          criado_em: string
          criado_por: string
          dias_alerta_manutencao: number
          dns: string | null
          empresa_responsavel: string | null
          fabricante: string | null
          gateway: string | null
          grava: boolean
          id: number
          ip: string | null
          localizacao: string
          mac: string | null
          mascara: string | null
          modelo: string
          nome: string
          numero_anvisa: string | null
          observacoes: string | null
          observacoes_dicom: string | null
          patrimonio: string
          porta: string | null
          porta_dicom: string | null
          proxima_manutencao: string | null
          senha_cadastrada: boolean
          senha_cifrada: string | null
          serial: string
          servidor_dicom: string | null
          status: string
          storage_scp: string | null
          storage_scu: string | null
          telefone_tecnico: string | null
          ultima_manutencao: string | null
          usuario: string | null
          versao_software: string | null
          voltagem: number | null
          worklist: string | null
        }
        Insert: {
          aetitle?: string | null
          alerta_manutencao?: boolean
          ano_fabricacao?: number | null
          atualizado_em?: string
          atualizado_por?: string | null
          contato_tecnico?: string | null
          contrato_vigente?: boolean
          criado_em?: string
          criado_por?: string
          dias_alerta_manutencao?: number
          dns?: string | null
          empresa_responsavel?: string | null
          fabricante?: string | null
          gateway?: string | null
          grava?: boolean
          id?: number
          ip?: string | null
          localizacao: string
          mac?: string | null
          mascara?: string | null
          modelo: string
          nome: string
          numero_anvisa?: string | null
          observacoes?: string | null
          observacoes_dicom?: string | null
          patrimonio: string
          porta?: string | null
          porta_dicom?: string | null
          proxima_manutencao?: string | null
          senha_cadastrada?: boolean
          senha_cifrada?: string | null
          serial: string
          servidor_dicom?: string | null
          status?: string
          storage_scp?: string | null
          storage_scu?: string | null
          telefone_tecnico?: string | null
          ultima_manutencao?: string | null
          usuario?: string | null
          versao_software?: string | null
          voltagem?: number | null
          worklist?: string | null
        }
        Update: {
          aetitle?: string | null
          alerta_manutencao?: boolean
          ano_fabricacao?: number | null
          atualizado_em?: string
          atualizado_por?: string | null
          contato_tecnico?: string | null
          contrato_vigente?: boolean
          criado_em?: string
          criado_por?: string
          dias_alerta_manutencao?: number
          dns?: string | null
          empresa_responsavel?: string | null
          fabricante?: string | null
          gateway?: string | null
          grava?: boolean
          id?: number
          ip?: string | null
          localizacao?: string
          mac?: string | null
          mascara?: string | null
          modelo?: string
          nome?: string
          numero_anvisa?: string | null
          observacoes?: string | null
          observacoes_dicom?: string | null
          patrimonio?: string
          porta?: string | null
          porta_dicom?: string | null
          proxima_manutencao?: string | null
          senha_cadastrada?: boolean
          senha_cifrada?: string | null
          serial?: string
          servidor_dicom?: string | null
          status?: string
          storage_scp?: string | null
          storage_scu?: string | null
          telefone_tecnico?: string | null
          ultima_manutencao?: string | null
          usuario?: string | null
          versao_software?: string | null
          voltagem?: number | null
          worklist?: string | null
        }
        Relationships: []
      }
      equipamentos_us_documentos: {
        Row: {
          caminho_storage: string
          criado_em: string
          criado_por: string | null
          equipamento_id: number
          id: number
          nome_arquivo: string
          tamanho: number | null
          tipo: string | null
        }
        Insert: {
          caminho_storage: string
          criado_em?: string
          criado_por?: string | null
          equipamento_id: number
          id?: number
          nome_arquivo: string
          tamanho?: number | null
          tipo?: string | null
        }
        Update: {
          caminho_storage?: string
          criado_em?: string
          criado_por?: string | null
          equipamento_id?: number
          id?: number
          nome_arquivo?: string
          tamanho?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_us_documentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos_us"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos_us_historico: {
        Row: {
          campo: string | null
          criado_em: string
          criado_por: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          equipamento_id: number
          id: number
          operacao: string
        }
        Insert: {
          campo?: string | null
          criado_em?: string
          criado_por?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          equipamento_id: number
          id?: number
          operacao: string
        }
        Update: {
          campo?: string | null
          criado_em?: string
          criado_por?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          equipamento_id?: number
          id?: number
          operacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_us_historico_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos_us"
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
      escala_enfermagem_colaboradoras: {
        Row: {
          colaboradora_id: number
          escala_id: number
        }
        Insert: {
          colaboradora_id: number
          escala_id: number
        }
        Update: {
          colaboradora_id?: number
          escala_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "escala_enfermagem_colaboradoras_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_enfermagem_colaboradoras_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas_enfermagem"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_enfermagem_medicos: {
        Row: {
          escala_id: number
          medico_id: number
        }
        Insert: {
          escala_id: number
          medico_id: number
        }
        Update: {
          escala_id?: number
          medico_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "escala_enfermagem_medicos_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas_enfermagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_enfermagem_medicos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_enfermagem_procedimentos: {
        Row: {
          escala_id: number
          procedimento_id: number
        }
        Insert: {
          escala_id: number
          procedimento_id: number
        }
        Update: {
          escala_id?: number
          procedimento_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "escala_enfermagem_procedimentos_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas_enfermagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_enfermagem_procedimentos_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos_enfermagem"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_enfermagem_salas: {
        Row: {
          escala_id: number
          sala_id: number
        }
        Insert: {
          escala_id: number
          sala_id: number
        }
        Update: {
          escala_id?: number
          sala_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "escala_enfermagem_salas_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas_enfermagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_enfermagem_salas_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
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
      escalas_enfermagem: {
        Row: {
          colaboradora_id: number
          created_at: string
          created_by: string | null
          data: string
          horario_fim: string | null
          horario_inicio: string | null
          id: number
          observacoes: string | null
          periodo: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          colaboradora_id: number
          created_at?: string
          created_by?: string | null
          data: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: number
          observacoes?: string | null
          periodo?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          colaboradora_id?: number
          created_at?: string
          created_by?: string | null
          data?: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: number
          observacoes?: string | null
          periodo?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalas_enfermagem_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "colaboradoras"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas_importadas_enfermagem: {
        Row: {
          atualizado_em: string
          conteudo: Json
          criado_em: string
          fim: string | null
          id: number
          inicio: string | null
          nome_arquivo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          conteudo?: Json
          criado_em?: string
          fim?: string | null
          id?: number
          inicio?: string | null
          nome_arquivo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          conteudo?: Json
          criado_em?: string
          fim?: string | null
          id?: number
          inicio?: string | null
          nome_arquivo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      escalas_marcacao: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          id: number
          observacoes: string | null
          periodo: string | null
          responsaveis: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          id?: number
          observacoes?: string | null
          periodo?: string | null
          responsaveis?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          id?: number
          observacoes?: string | null
          periodo?: string | null
          responsaveis?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      estoque_pendencias: {
        Row: {
          criado_em: string
          id: number
          item_id: number
          lote_id: number
          resolvido_em: string | null
          resolvido_por: string | null
          status: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          id?: number
          item_id: number
          lote_id: number
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          tipo?: string
        }
        Update: {
          criado_em?: string
          id?: number
          item_id?: number
          lote_id?: number
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_pendencias_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_pendencias_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: true
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedor_documentos: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          fornecedor_id: number
          id: number
          nome: string
          numero: string | null
          observacoes: string | null
          validade: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          fornecedor_id: number
          id?: number
          nome: string
          numero?: string | null
          observacoes?: string | null
          validade?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          fornecedor_id?: number
          id?: number
          nome?: string
          numero?: string | null
          observacoes?: string | null
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedor_documentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cnpj: string | null
          criado_em: string
          criado_por: string | null
          email: string | null
          id: number
          nome: string
          observacoes: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          id?: number
          nome: string
          observacoes?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          id?: number
          nome?: string
          observacoes?: string | null
          telefone?: string | null
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
      lembretes: {
        Row: {
          adiado_ate: string | null
          atualizado_em: string
          atualizado_por: string | null
          categoria: string
          concluido_em: string | null
          criado_em: string
          criado_por: string
          data_lembrete: string
          descricao: string | null
          hora_lembrete: string | null
          id: number
          observacoes: string | null
          popup_ativo: boolean
          prioridade: string
          recorrencia: string
          recorrencia_dias: number | null
          som_ativo: boolean
          status: string
          titulo: string
          user_id: string
          vinculo_id: number | null
          vinculo_tipo: string | null
        }
        Insert: {
          adiado_ate?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          categoria?: string
          concluido_em?: string | null
          criado_em?: string
          criado_por?: string
          data_lembrete: string
          descricao?: string | null
          hora_lembrete?: string | null
          id?: number
          observacoes?: string | null
          popup_ativo?: boolean
          prioridade?: string
          recorrencia?: string
          recorrencia_dias?: number | null
          som_ativo?: boolean
          status?: string
          titulo: string
          user_id: string
          vinculo_id?: number | null
          vinculo_tipo?: string | null
        }
        Update: {
          adiado_ate?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          categoria?: string
          concluido_em?: string | null
          criado_em?: string
          criado_por?: string
          data_lembrete?: string
          descricao?: string | null
          hora_lembrete?: string | null
          id?: number
          observacoes?: string | null
          popup_ativo?: boolean
          prioridade?: string
          recorrencia?: string
          recorrencia_dias?: number | null
          som_ativo?: boolean
          status?: string
          titulo?: string
          user_id?: string
          vinculo_id?: number | null
          vinculo_tipo?: string | null
        }
        Relationships: []
      }
      lixeira_registros: {
        Row: {
          dados: Json
          dono_user_id: string | null
          excluido_em: string
          excluido_por: string | null
          expira_em: string
          id: string
          registro_id: string
          restaurado_em: string | null
          tabela: string
        }
        Insert: {
          dados: Json
          dono_user_id?: string | null
          excluido_em?: string
          excluido_por?: string | null
          expira_em?: string
          id?: string
          registro_id: string
          restaurado_em?: string | null
          tabela: string
        }
        Update: {
          dados?: Json
          dono_user_id?: string | null
          excluido_em?: string
          excluido_por?: string | null
          expira_em?: string
          id?: string
          registro_id?: string
          restaurado_em?: string | null
          tabela?: string
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
          atende_todas_colaboradoras: boolean
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
          setor: string
        }
        Insert: {
          apelido?: string | null
          atende_todas_colaboradoras?: boolean
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
          setor?: string
        }
        Update: {
          apelido?: string | null
          atende_todas_colaboradoras?: boolean
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
          setor?: string
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
      menu_itens: {
        Row: {
          ativo: boolean
          chave: string
          created_at: string
          destino: string
          grupo: string
          grupo_ordem: number
          icone: string
          id: number
          modulo: string | null
          ordem: number
          rotulo: string
          somente_admin: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          created_at?: string
          destino: string
          grupo?: string
          grupo_ordem?: number
          icone?: string
          id?: number
          modulo?: string | null
          ordem?: number
          rotulo: string
          somente_admin?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          created_at?: string
          destino?: string
          grupo?: string
          grupo_ordem?: number
          icone?: string
          id?: number
          modulo?: string | null
          ordem?: number
          rotulo?: string
          somente_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      menu_ordens_usuario: {
        Row: {
          chave: string
          created_at: string
          ordem: number
          tipo: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          chave: string
          created_at?: string
          ordem: number
          tipo: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          chave?: string
          created_at?: string
          ordem?: number
          tipo?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
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
          cor: string
          created_at: string
          created_by: string | null
          data_alerta: string | null
          data_criacao: string
          fixada: boolean
          fonte: string
          hora_alerta: string | null
          hora_criacao: string | null
          id: number
          italico: boolean
          lido: boolean
          negrito: boolean
          status: string
          sublinhado: boolean
          tamanho_fonte: string
          titulo: string | null
          updated_at: string
          urgente: boolean
        }
        Insert: {
          conteudo?: string | null
          cor?: string
          created_at?: string
          created_by?: string | null
          data_alerta?: string | null
          data_criacao?: string
          fixada?: boolean
          fonte?: string
          hora_alerta?: string | null
          hora_criacao?: string | null
          id?: number
          italico?: boolean
          lido?: boolean
          negrito?: boolean
          status?: string
          sublinhado?: boolean
          tamanho_fonte?: string
          titulo?: string | null
          updated_at?: string
          urgente?: boolean
        }
        Update: {
          conteudo?: string | null
          cor?: string
          created_at?: string
          created_by?: string | null
          data_alerta?: string | null
          data_criacao?: string
          fixada?: boolean
          fonte?: string
          hora_alerta?: string | null
          hora_criacao?: string | null
          id?: number
          italico?: boolean
          lido?: boolean
          negrito?: boolean
          status?: string
          sublinhado?: boolean
          tamanho_fonte?: string
          titulo?: string | null
          updated_at?: string
          urgente?: boolean
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
          criado_por: string | null
          data_cadastro: string
          id: string
          legacy_usuario_id: number | null
          login: string | null
          nome: string
          preferencias_lembretes: Json
          setor: string | null
          setor_id: number | null
          ultimo_login: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          data_cadastro?: string
          id: string
          legacy_usuario_id?: number | null
          login?: string | null
          nome?: string
          preferencias_lembretes?: Json
          setor?: string | null
          setor_id?: number | null
          ultimo_login?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          data_cadastro?: string
          id?: string
          legacy_usuario_id?: number | null
          login?: string | null
          nome?: string
          preferencias_lembretes?: Json
          setor?: string | null
          setor_id?: number | null
          ultimo_login?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      ramais: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          id: number
          localizacao: string | null
          numero: string | null
          observacoes: string | null
          responsavel: string | null
          setor: string | null
          situacao: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          localizacao?: string | null
          numero?: string | null
          observacoes?: string | null
          responsavel?: string | null
          setor?: string | null
          situacao?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          localizacao?: string | null
          numero?: string | null
          observacoes?: string | null
          responsavel?: string | null
          setor?: string | null
          situacao?: string
          updated_at?: string
          updated_by?: string | null
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
          setor: string
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
          setor?: string
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
          setor?: string
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
      senhas: {
        Row: {
          atualizado_por: string | null
          categoria: string | null
          created_at: string
          criado_por: string | null
          id: number
          login: string
          nome: string
          observacoes: string | null
          owner_user_id: string | null
          senha_cifrada: string
          updated_at: string
          url: string | null
        }
        Insert: {
          atualizado_por?: string | null
          categoria?: string | null
          created_at?: string
          criado_por?: string | null
          id?: number
          login: string
          nome: string
          observacoes?: string | null
          owner_user_id?: string | null
          senha_cifrada: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          atualizado_por?: string | null
          categoria?: string | null
          created_at?: string
          criado_por?: string | null
          id?: number
          login?: string
          nome?: string
          observacoes?: string | null
          owner_user_id?: string | null
          senha_cifrada?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      setores: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          id: number
          nome: string
          papel_padrao: Database["public"]["Enums"]["app_role"]
          permissoes_padrao: string[]
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: number
          nome: string
          papel_padrao?: Database["public"]["Enums"]["app_role"]
          permissoes_padrao?: string[]
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: number
          nome?: string
          papel_padrao?: Database["public"]["Enums"]["app_role"]
          permissoes_padrao?: string[]
        }
        Relationships: []
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
      sondas: {
        Row: {
          ano_fabricacao: number | null
          atualizado_em: string
          atualizado_por: string | null
          contato_tecnico: string | null
          criado_em: string
          criado_por: string
          data_aquisicao: string | null
          empresa_responsavel: string | null
          fabricante: string | null
          frequencia: string | null
          garantia: string | null
          id: number
          localizacao: string
          modelo: string
          nome: string
          numero_anvisa: string | null
          observacoes: string | null
          observacoes_manutencao: string | null
          patrimonio: string | null
          proxima_manutencao: string | null
          sala: string | null
          serial: string
          setor: string | null
          status: string
          telefone_tecnico: string | null
          tipo: string
          ultima_manutencao: string | null
        }
        Insert: {
          ano_fabricacao?: number | null
          atualizado_em?: string
          atualizado_por?: string | null
          contato_tecnico?: string | null
          criado_em?: string
          criado_por?: string
          data_aquisicao?: string | null
          empresa_responsavel?: string | null
          fabricante?: string | null
          frequencia?: string | null
          garantia?: string | null
          id?: number
          localizacao: string
          modelo: string
          nome: string
          numero_anvisa?: string | null
          observacoes?: string | null
          observacoes_manutencao?: string | null
          patrimonio?: string | null
          proxima_manutencao?: string | null
          sala?: string | null
          serial: string
          setor?: string | null
          status?: string
          telefone_tecnico?: string | null
          tipo: string
          ultima_manutencao?: string | null
        }
        Update: {
          ano_fabricacao?: number | null
          atualizado_em?: string
          atualizado_por?: string | null
          contato_tecnico?: string | null
          criado_em?: string
          criado_por?: string
          data_aquisicao?: string | null
          empresa_responsavel?: string | null
          fabricante?: string | null
          frequencia?: string | null
          garantia?: string | null
          id?: number
          localizacao?: string
          modelo?: string
          nome?: string
          numero_anvisa?: string | null
          observacoes?: string | null
          observacoes_manutencao?: string | null
          patrimonio?: string | null
          proxima_manutencao?: string | null
          sala?: string | null
          serial?: string
          setor?: string | null
          status?: string
          telefone_tecnico?: string | null
          tipo?: string
          ultima_manutencao?: string | null
        }
        Relationships: []
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
      sondas_documentos: {
        Row: {
          caminho_storage: string
          criado_em: string
          criado_por: string | null
          id: number
          nome_arquivo: string
          sonda_id: number
          tamanho: number | null
          tipo: string | null
        }
        Insert: {
          caminho_storage: string
          criado_em?: string
          criado_por?: string | null
          id?: number
          nome_arquivo: string
          sonda_id: number
          tamanho?: number | null
          tipo?: string | null
        }
        Update: {
          caminho_storage?: string
          criado_em?: string
          criado_por?: string | null
          id?: number
          nome_arquivo?: string
          sonda_id?: number
          tamanho?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sondas_documentos_sonda_id_fkey"
            columns: ["sonda_id"]
            isOneToOne: false
            referencedRelation: "sondas"
            referencedColumns: ["id"]
          },
        ]
      }
      sondas_equipamentos: {
        Row: {
          criado_em: string
          criado_por: string | null
          equipamento_id: number
          id: number
          sonda_id: number
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          equipamento_id: number
          id?: number
          sonda_id: number
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          equipamento_id?: number
          id?: number
          sonda_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sondas_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos_us"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sondas_equipamentos_sonda_id_fkey"
            columns: ["sonda_id"]
            isOneToOne: false
            referencedRelation: "sondas"
            referencedColumns: ["id"]
          },
        ]
      }
      sondas_ocorrencias: {
        Row: {
          anexo_nome: string | null
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string
          id: number
          sonda_id: number
          tipo: string
        }
        Insert: {
          anexo_nome?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao: string
          id?: number
          sonda_id: number
          tipo: string
        }
        Update: {
          anexo_nome?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string
          id?: number
          sonda_id?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sondas_ocorrencias_sonda_id_fkey"
            columns: ["sonda_id"]
            isOneToOne: false
            referencedRelation: "sondas"
            referencedColumns: ["id"]
          },
        ]
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
      usuario_presenca: {
        Row: {
          ultimo_acesso: string
          user_id: string
        }
        Insert: {
          ultimo_acesso?: string
          user_id: string
        }
        Update: {
          ultimo_acesso?: string
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
      chat_coordenadora_entre_setores: {
        Args: { _user_id: string }
        Returns: boolean
      }
      chat_coordenadoras_sao_partes: {
        Args: { _destinatario: string; _remetente: string }
        Returns: boolean
      }
      chat_enfermagem_eh_coordenadora: {
        Args: { _user_id: string }
        Returns: boolean
      }
      chat_marcacao_eh_supervisora: {
        Args: { _user_id: string }
        Returns: boolean
      }
      chat_salas_eh_coordenadora: {
        Args: { _user_id: string }
        Returns: boolean
      }
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
      is_username_available: { Args: { p_username: string }; Returns: boolean }
      limpar_lixeira_expirada: { Args: never; Returns: number }
      listar_pendencias_validade: {
        Args: never
        Returns: {
          id: number
          item_id: number
          item_nome: string
          lote: string
          lote_id: number
          quantidade: number
          status: string
          validade: string
        }[]
      }
      marcar_usuario_online: { Args: never; Returns: undefined }
      obter_administradores_master: {
        Args: never
        Returns: {
          ativo: boolean
          id: string
          nome: string
          setor: string
        }[]
      }
      obter_chat_coordenadoras: {
        Args: never
        Returns: {
          ativo: boolean
          email: string
          id: string
          nome: string
          setor: string
        }[]
      }
      obter_chat_enfermagem_coordenadora: {
        Args: never
        Returns: {
          ativo: boolean
          id: string
          nome: string
          setor: string
        }[]
      }
      obter_chat_marcacao_supervisora: {
        Args: never
        Returns: {
          ativo: boolean
          id: string
          nome: string
          setor: string
        }[]
      }
      obter_chat_salas_coordenadora: {
        Args: never
        Returns: {
          ativo: boolean
          id: string
          nome: string
          setor: string
        }[]
      }
      pode_chat_enfermagem: { Args: { _user_id: string }; Returns: boolean }
      pode_chat_marcacao: { Args: { _user_id: string }; Returns: boolean }
      pode_chat_salas: { Args: { _user_id: string }; Returns: boolean }
      pode_editar: {
        Args: { _modulo: string; _user_id: string }
        Returns: boolean
      }
      pode_editar_ramais: { Args: never; Returns: boolean }
      resolver_pendencia_validade: {
        Args: { p_id: number }
        Returns: undefined
      }
      restaurar_lixeira: { Args: { p_id: string }; Returns: undefined }
      sincronizar_medicos_da_sala_enfermagem: {
        Args: { p_medico_ids: number[]; p_sala_id: number }
        Returns: undefined
      }
      sincronizar_pendencias_validade: { Args: never; Returns: undefined }
      sincronizar_salas_do_medico_enfermagem: {
        Args: { p_medico_id: number; p_sala_ids: number[] }
        Returns: undefined
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
        | "recepcao"
        | "marcacao"
        | "comercial"
        | "qualidade"
        | "rh"
        | "manutencao"
        | "medicos"
        | "diretoria"
        | "sondas"
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
        "recepcao",
        "marcacao",
        "comercial",
        "qualidade",
        "rh",
        "manutencao",
        "medicos",
        "diretoria",
        "sondas",
      ],
    },
  },
} as const
