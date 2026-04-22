import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * Servidor MSW para Node/jsdom (ambiente Jest).
 * Intercepta chamadas Axios/fetch durante os testes.
 * Configurado no jest.setup.ts com listen/resetHandlers/close.
 */
export const server = setupServer(...handlers);
