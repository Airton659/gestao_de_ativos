import { http, HttpResponse } from 'msw';

/**
 * Handlers padrão para testes.
 * Cada teste pode sobrescrever com server.use(...) para cenários específicos.
 */
export const handlers = [
  // ── Autenticação ─────────────────────────────────────────────────────
  http.post('/api/v1/login/access-token/', () =>
    HttpResponse.json({ access_token: 'test-jwt-token-valido' })
  ),

  http.post('/api/v1/test-token/', () =>
    HttpResponse.json({
      id: 1,
      nome: 'Usuário Teste',
      email: 'teste@example.com',
      matricula: 'TI001',
      ativo: true,
      perfil: {
        nome: 'TI',
        permissoes: [
          { chave: 'equipamentos:ler' },
          { chave: 'movimentacoes:ler' },
          { chave: 'localizacoes:ler' },
        ],
      },
    })
  ),

  http.get('/api/v1/usuarios/me', () =>
    HttpResponse.json({
      id: 1,
      nome: 'Usuário Teste',
      email: 'teste@example.com',
      matricula: 'TI001',
    })
  ),

  // ── Dashboard ────────────────────────────────────────────────────────
  http.get('/api/v1/dashboard/stats/', () =>
    HttpResponse.json({
      total_ativos: 42,
      total_movimentacoes: 15,
      total_locais: 8,
      valor_total: 125000.5,
      recent_movements: [
        {
          id: 1,
          equipamento_id: 10,
          lote_id: 'MOV-abc123',
          has_termo: true,
          has_foto: false,
          patrimonio: 'PAT-001',
          tipo: 'Laptop',
          origem: 'Bloco A / Sala 101',
          destino: 'Bloco B / Sala 202',
          tecnico: 'João TI',
          gestor: 'Maria Responsável',
          data_iso: new Date().toISOString(),
        },
      ],
    })
  ),
];
