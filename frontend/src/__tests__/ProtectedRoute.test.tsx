import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

// Mock do contexto de autenticação para controlar o estado por teste
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Helper que renderiza as rotas com o ProtectedRoute
function renderWithRoutes(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Conteúdo Protegido</div>} />
          <Route path="/ativos" element={<div>Página de Ativos</div>} />
        </Route>
        <Route path="/login" element={<div>Página de Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute — Redirecionamento', () => {
  it('naoAutenticado_RedirecionaParaLogin', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      token: null,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      hasPermission: jest.fn(),
    });

    renderWithRoutes('/dashboard');

    expect(screen.getByText('Página de Login')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo Protegido')).not.toBeInTheDocument();
  });

  it('autenticado_RenderizaConteudoProtegido', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 1, nome: 'Usuário', email: 'user@test.com' },
      token: 'token-valido',
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      hasPermission: jest.fn(),
    });

    renderWithRoutes('/dashboard');

    expect(screen.getByText('Conteúdo Protegido')).toBeInTheDocument();
    expect(screen.queryByText('Página de Login')).not.toBeInTheDocument();
  });

  it('carregando_ExibeMensagemDeCarregamento', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true, // ainda carregando token do localStorage
      user: null,
      token: null,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      hasPermission: jest.fn(),
    });

    renderWithRoutes('/dashboard');

    // Enquanto isLoading=true, mostra spinner/texto de carregamento
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo Protegido')).not.toBeInTheDocument();
    expect(screen.queryByText('Página de Login')).not.toBeInTheDocument();
  });

  it('autenticado_RenderizaQualquerRotaProtegida', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 1, nome: 'Admin', email: 'admin@test.com' },
      token: 'token',
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      hasPermission: jest.fn(),
    });

    renderWithRoutes('/ativos');

    expect(screen.getByText('Página de Ativos')).toBeInTheDocument();
  });
});
