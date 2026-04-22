import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '@/pages/Dashboard';

// Mock do módulo de API
jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { headers: { common: {} } },
  },
}));

import { api } from '@/lib/api';
const mockGet = api.get as jest.Mock;

// Resposta padrão do dashboard usada pela maioria dos testes
const defaultStats = {
  total_ativos: 42,
  total_movimentacoes: 15,
  total_locais: 8,
  valor_total: 120000,
  recent_movements: [
    {
      id: 1,
      patrimonio: 'PAT-001',
      equipamento: 'Notebook Dell',
      tipo: 'Entrada',
      data: '2024-01-15',
      responsavel: 'TI001',
    },
  ],
};

// Permite controlar permissões por teste
const mockHasPermission = jest.fn(() => true);

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: mockHasPermission,
    user: { id: 1, nome: 'Técnico TI', email: 'ti@example.com' },
  }),
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Dashboard — Renderização com dados', () => {
  beforeEach(() => {
    mockHasPermission.mockReturnValue(true);
    mockGet.mockResolvedValue({ data: defaultStats });
  });

  afterEach(() => {
    mockGet.mockReset();
  });

  it('renderiza_ComDadosDoServidor_ExibeValorTotalDeAtivos', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  it('renderiza_ComDadosDoServidor_ExibeCardDeMovimentacoes', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  it('renderiza_ComDadosDoServidor_ExibeMovimentacaoRecenteNaTabela', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('PAT-001')).toBeInTheDocument();
    });
  });

  it('renderiza_EstadoDeCarregamento_ExibeSkeletons', () => {
    // A query fica pendente → loading skeleton aparece
    mockGet.mockReturnValueOnce(new Promise(() => {})); // nunca resolve

    renderDashboard();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('Dashboard — Dados vazios', () => {
  beforeEach(() => {
    mockHasPermission.mockReturnValue(true);
  });

  afterEach(() => {
    mockGet.mockReset();
  });

  it('renderiza_ComDadosZerados_NaoLancaExcecao', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        total_ativos: 0,
        total_movimentacoes: 0,
        total_locais: 0,
        valor_total: 0,
        recent_movements: [],
      },
    });

    expect(() => renderDashboard()).not.toThrow();
  });

  it('renderiza_SemMovimentacoesRecentes_ExibeMensagemVazia', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        total_ativos: 10,
        total_movimentacoes: 0,
        total_locais: 3,
        valor_total: 50000,
        recent_movements: [],
      },
    });

    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText(/nenhuma movimentação recente/i)
      ).toBeInTheDocument();
    });
  });
});

describe('Dashboard — RBAC (sem permissão)', () => {
  afterEach(() => {
    mockGet.mockReset();
  });

  it('renderiza_SemNenhumaPermissao_ExibeMensagemDeAcessoNegado', () => {
    mockHasPermission.mockReturnValue(false);

    renderDashboard();

    expect(
      screen.getByText(/bem-vindo ao sistema de gestão de ativos/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/não tem permissão/i)
    ).toBeInTheDocument();
  });

  it('renderiza_SemPermissaoDeEquipamentos_OcultaCardDeAtivos', async () => {
    mockGet.mockResolvedValue({ data: defaultStats });

    // Permite movimentações mas não equipamentos
    mockHasPermission.mockImplementation((perm: unknown) =>
      perm === 'movimentacoes:ler' || perm === 'localizacoes:ler'
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByText('TOTAL ATIVOS')).not.toBeInTheDocument();
    });
  });
});
