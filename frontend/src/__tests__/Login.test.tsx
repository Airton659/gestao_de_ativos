import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from '@/pages/Login';

// Mock do módulo de API — substitui axios.create() por funções controladas
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

// Import após o mock para obter a referência mockada
import { api } from '@/lib/api';
const mockPost = api.post as jest.Mock;

// Mock do hook useAuth
const mockLogin = jest.fn();
let mockIsAuthenticated = false;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: mockIsAuthenticated,
    isLoading: false,
  }),
}));

function renderLogin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Login — Renderização inicial', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
    mockLogin.mockReset();
    mockPost.mockReset();
  });

  it('renderiza_CampoDeUsuarioESenha', () => {
    renderLogin();

    expect(screen.getByPlaceholderText(/usuário/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/senha/i)).toBeInTheDocument();
  });

  it('renderiza_BotaoDeAcessar', () => {
    renderLogin();

    expect(screen.getByRole('button', { name: /acessar sistema/i })).toBeInTheDocument();
  });

  it('naoExibeErro_NaRenderizacaoInicial', () => {
    renderLogin();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Login — Validação de campos', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
    mockLogin.mockReset();
    mockPost.mockReset();
  });

  it('handleSubmit_CamposVazios_ExibeMensagemDePreenchimento', async () => {
    renderLogin();

    await userEvent.click(screen.getByRole('button', { name: /acessar sistema/i }));

    expect(await screen.findByText(/preencha usuário e senha/i)).toBeInTheDocument();
  });

  it('handleSubmit_ApenasUsuarioPreenchido_ExibeErro', async () => {
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/usuário/i), 'TI001');
    await userEvent.click(screen.getByRole('button', { name: /acessar sistema/i }));

    expect(await screen.findByText(/preencha usuário e senha/i)).toBeInTheDocument();
  });

  it('handleSubmit_ApenassenhaPreenchida_ExibeErro', async () => {
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/senha/i), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /acessar sistema/i }));

    expect(await screen.findByText(/preencha usuário e senha/i)).toBeInTheDocument();
  });
});

describe('Login — Credenciais inválidas', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
    mockLogin.mockReset();
    mockPost.mockReset();
  });

  it('handleSubmit_CredenciaisInvalidas_ExibeMensagemDeErroDoServidor', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { detail: 'Usuário ou senha incorreta' }, status: 400 },
    });

    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/usuário/i), 'usuario_invalido');
    await userEvent.type(screen.getByPlaceholderText(/senha/i), 'senha_errada');
    await userEvent.click(screen.getByRole('button', { name: /acessar sistema/i }));

    await waitFor(() => {
      expect(screen.getByText(/usuário ou senha incorreta/i)).toBeInTheDocument();
    });
  });

  it('handleSubmit_ErroDeRede_ExibeMensagemGenerica', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network Error'));

    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/usuário/i), 'TI001');
    await userEvent.type(screen.getByPlaceholderText(/senha/i), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /acessar sistema/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/erro ao fazer login/i)
      ).toBeInTheDocument();
    });
  });
});

describe('Login — Credenciais válidas', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
    mockLogin.mockReset();
    mockPost.mockReset();
  });

  it('handleSubmit_CredenciaisValidas_ChamaLoginComToken', async () => {
    // Primeira chamada: POST /login/access-token/ → retorna token
    mockPost
      .mockResolvedValueOnce({ data: { access_token: 'test-jwt-token-valido' } })
      // Segunda chamada: POST /test-token/ → retorna dados do usuário
      .mockResolvedValueOnce({ data: { id: 1, nome: 'Técnico TI', email: 'ti@example.com' } });

    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/usuário/i), 'TI001');
    await userEvent.type(screen.getByPlaceholderText(/senha/i), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /acessar sistema/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        'test-jwt-token-valido',
        expect.objectContaining({ id: 1 })
      );
    });
  });
});
