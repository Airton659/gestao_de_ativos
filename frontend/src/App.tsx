import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Ativos } from '@/pages/Ativos';
import { Movimentacoes } from '@/pages/Movimentacoes';
import { Historico } from '@/pages/Historico';
import { Fornecedores } from '@/pages/Fornecedores';
import { Localizacoes } from '@/pages/Localizacoes';
import { Usuarios } from '@/pages/Usuarios';
import { Acessos } from '@/pages/Acessos';
import { Perfil } from '@/pages/Perfil';
import { Relatorios } from '@/pages/Relatorios';
// import { Auditoria } from '@/pages/Auditoria';
import { Categorias } from '@/pages/Categorias';

export const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ativos" element={<Ativos />} />
          <Route path="/movimentacoes" element={<Movimentacoes />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/fornecedores" element={<Fornecedores />} />
          <Route path="/localizacoes" element={<Localizacoes />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/acessos" element={<Acessos />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/relatorios" element={<Relatorios />} />
          {/* <Route path="/auditoria" element={<Auditoria />} /> */}
          <Route path="/categorias" element={<Categorias />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
