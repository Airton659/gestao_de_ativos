import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

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

// Wrapper que fornece o Router (AuthProvider usa useNavigate internamente)
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <AuthProvider>{children}</AuthProvider>
  </MemoryRouter>
);

describe('AuthContext — hasPermission', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGet.mockReset();
  });

  it('hasPermission_UsuarioNaoAutenticado_RetornaFalse', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    expect(result.current.hasPermission('equipamentos:ler')).toBe(false);
  });

  it('hasPermission_UsuarioAdmin_RetornaTrueParaQualquerPermissao', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    act(() => {
      result.current.login('token-fake', {
        id: 1,
        nome: 'admin',
        email: 'admin@example.com',
        perfil: { nome: 'Admin', permissoes: [] },
      });
    });

    expect(result.current.hasPermission('qualquer:permissao')).toBe(true);
    expect(result.current.hasPermission('deletar:tudo')).toBe(true);
  });

  it('hasPermission_UsuarioComPermissaoEspecifica_RetornaTrue', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    act(() => {
      result.current.login('token-fake', {
        id: 2,
        nome: 'Técnico',
        email: 'tecnico@example.com',
        perfil: {
          nome: 'TI',
          permissoes: [
            { chave: 'equipamentos:ler' },
            { chave: 'equipamentos:editar' },
          ],
        },
      });
    });

    expect(result.current.hasPermission('equipamentos:ler')).toBe(true);
    expect(result.current.hasPermission('equipamentos:editar')).toBe(true);
  });

  it('hasPermission_UsuarioSemAPermissao_RetornaFalse', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    act(() => {
      result.current.login('token-fake', {
        id: 3,
        nome: 'Estagiário',
        email: 'estagiario@example.com',
        perfil: {
          nome: 'Leitura',
          permissoes: [{ chave: 'equipamentos:ler' }],
        },
      });
    });

    expect(result.current.hasPermission('equipamentos:deletar')).toBe(false);
    expect(result.current.hasPermission('usuarios:ler')).toBe(false);
  });
});

describe('AuthContext — login / logout', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGet.mockReset();
  });

  it('login_SalvaTokenNoLocalStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    act(() => {
      result.current.login('meu-jwt-token', {
        id: 1,
        nome: 'João',
        email: 'joao@example.com',
      });
    });

    expect(localStorage.getItem('token')).toBe('meu-jwt-token');
    expect(result.current.token).toBe('meu-jwt-token');
  });

  it('login_MarcaIsAuthenticatedComoTrue', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    act(() => {
      result.current.login('qualquer-token', {
        id: 1,
        nome: 'User',
        email: 'user@example.com',
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
  });

  it('logout_RemoveTokenDoLocalStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    act(() => {
      result.current.login('token-existente', {
        id: 1,
        nome: 'User',
        email: 'user@example.com',
      });
    });

    act(() => {
      result.current.logout();
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('refreshUser_AtualizaDadosDoUsuario', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        id: 1,
        nome: 'Nome Atualizado',
        email: 'novo@example.com',
        matricula: 'TI002',
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    act(() => {
      result.current.login('token', {
        id: 1,
        nome: 'Nome Antigo',
        email: 'antigo@example.com',
      });
    });

    await act(async () => {
      await result.current.refreshUser();
    });

    await waitFor(() => {
      expect(result.current.user?.nome).toBe('Nome Atualizado');
    });
  });
});
