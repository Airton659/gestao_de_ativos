import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTabletMode } from '@/contexts/TabletModeContext';
import {
  Menu, LayoutDashboard, Package, MoveHorizontal, History,
  Truck, MapPin, Users, ShieldCheck, LogOut, Tablet, Settings, ChevronDown, RefreshCw, Printer,
  LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AppLayout = ({ title = 'Dashboard' }: { title?: string }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, logout, refreshUser, hasPermission } = useAuth();
  const { tabletMode, toggleTabletMode } = useTabletMode();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMovimentacoes = location.pathname.startsWith('/movimentacoes');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', route: '/', permission: null },
    { icon: Package, label: 'Ativos', route: '/ativos', permission: 'equipamentos:ler' },
    { icon: MoveHorizontal, label: 'Movimentar', route: '/movimentacoes', permission: 'movimentacoes:ler' },
    { icon: History, label: 'Histórico', route: '/historico', permission: 'movimentacoes:ler' },
    { icon: Truck, label: 'Fornecedores', route: '/fornecedores', permission: 'fornecedores:ler' },
    { icon: MapPin, label: 'Localizações', route: '/localizacoes', permission: 'localizacoes:ler' },
    { icon: Users, label: 'Usuários', route: '/usuarios', permission: 'usuarios:ler' },
    { icon: ShieldCheck, label: 'Acessos', route: '/acessos', permission: 'perfis:ler' },
    { icon: LayoutGrid, label: 'Categorias', route: '/categorias', permission: 'categorias:ler' },
    { icon: Printer, label: 'Relatórios', route: '/relatorios', permission: 'relatorios:gerar' },
    // { icon: ClipboardList, label: 'Auditoria', route: '/auditoria', permission: 'auditoria:ler' },
  ];

  const userName = user?.nome || 'Usuário';
  const userProfile = user?.perfil?.nome || 'PERFIL';
  const initials = userName.substring(0, 2).toUpperCase();

  const getTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'DASHBOARD';
    if (path.startsWith('/ativos')) return 'ATIVOS E EQUIPAMENTOS';
    if (path.startsWith('/movimentacoes')) return 'MOVIMENTAÇÃO DE ATIVOS';
    if (path.startsWith('/historico')) return 'HISTÓRICO E MOVIMENTAÇÕES';
    if (path.startsWith('/fornecedores')) return 'FORNECEDORES';
    if (path.startsWith('/localizacoes')) return 'LOCALIZAÇÕES';
    if (path.startsWith('/usuarios')) return 'USUÁRIOS';
    if (path.startsWith('/acessos')) return 'PERFIS DE ACESSO';
    if (path.startsWith('/perfil')) return 'MEU PERFIL';
    if (path.startsWith('/relatorios')) return 'CENTRAL DE IMPRESSÃO';
    if (path.startsWith('/auditoria')) return 'LOG DE AUDITORIA';
    if (path.startsWith('/categorias')) return 'CATEGORIAS DE EQUIPAMENTO';
    return title.toUpperCase();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC]">
      <aside 
        className={cn(
          "flex flex-col bg-[#0000A0] shadow-[4px_0_20px_rgba(0,0,0,0.1)] transition-all duration-300 z-20 no-scrollbar",
          isSidebarOpen ? "w-[260px]" : "w-[80px]",
          isMobile && !isSidebarOpen && "hidden"
        )}
      >
        <div className="flex select-none items-center justify-between p-6">
          {isSidebarOpen ? (
            <div className="flex h-16 w-44 items-center justify-center overflow-hidden rounded-2xl bg-white p-3 shadow-sm">
              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
            </div>
          ) : (
             <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white font-black text-xs">
                F
             </div>
          )}
          <button 
            onClick={toggleSidebar}
            className="rounded-full p-2 text-white/80 hover:bg-white/10"
          >
            <Menu size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 no-scrollbar">
          <ul className="flex flex-col gap-1">
            {navItems.filter((item: any) => !item.permission || hasPermission(item.permission)).map((item: any, idx) => {
              if (item.divider) {
                return <div key={idx} className="my-4 h-px bg-white/10" />;
              }

              const isActive = item.route && (location.pathname === item.route || (item.route !== '/' && location.pathname.startsWith(item.route)));
              const Icon = item.icon;

              return (
                <li key={idx}>
                  <button
                    onClick={() => {
                      if (item.route) {
                        navigate(item.route);
                        if (isMobile) setIsSidebarOpen(false);
                      }
                    }}
                    className={cn(
                      "group flex h-14 w-full items-center px-6 transition-colors",
                      isActive ? "bg-white/10" : "hover:bg-white/5"
                    )}
                  >
                    {Icon && <Icon size={isActive ? 24 : 22} className={isActive ? "text-white" : "text-white/40 group-hover:text-white/70"} />}
                    
                    {isSidebarOpen && (
                      <span 
                        className={cn(
                          "ml-5 text-[11px] font-black tracking-[1.5px]",
                          isActive ? "text-white" : "text-white/60 group-hover:text-white/80"
                        )}
                      >
                        {item.label?.toUpperCase()}
                      </span>
                    )}

                    {isActive && (
                      <div className="ml-auto h-10 w-1 rounded-sm bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-6">
          <button 
            onClick={logout}
            className="flex w-full items-center text-white/60 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            {isSidebarOpen && <span className="ml-3 text-sm font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 z-10 bg-black/50" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            {isMobile && !isSidebarOpen && (
              <button onClick={toggleSidebar} className="shrink-0 text-slate-500">
                <Menu size={24} />
              </button>
            )}
            <h1 className="truncate text-xs font-black tracking-[2px] text-slate-400">
              {getTitle()}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {isMovimentacoes && (
              <button
                onClick={toggleTabletMode}
                title={tabletMode ? 'Desativar modo tablet' : 'Ativar modo tablet'}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black tracking-widest transition-all",
                  tabletMode
                    ? "bg-[#0000A0] text-white shadow-lg shadow-[#0000A0]/20"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                )}
              >
                <Tablet size={16} />
                {!isMobile && <span>TABLET</span>}
              </button>
            )}
            
            <button
              onClick={async () => {
                setIsRefreshing(true);
                await refreshUser();
                setTimeout(() => setIsRefreshing(false), 600);
              }}
              title="Recarregar Permissões"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all",
                isRefreshing && "bg-blue-50 text-[#0000A0]"
              )}
            >
              <RefreshCw size={18} className={cn(isRefreshing && "animate-spin")} />
            </button>

            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(v => !v)}
                className="flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-slate-100"
              >
                {!isMobile && (
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-black text-[#1E3A8A]">{userName}</span>
                    <span className="text-[10px] font-bold text-slate-400">{userProfile.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-white bg-blue-50 text-sm font-black text-[#1E3A8A] shadow-sm">
                  {initials}
                </div>
                <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isUserMenuOpen && "rotate-180")} />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl shadow-slate-200/60 z-50">
                  <div className="px-3 py-2 mb-1">
                    <p className="text-xs font-black text-[#1E3A8A]">{userName}</p>
                    <p className="text-[10px] font-bold text-slate-400">{userProfile.toUpperCase()}</p>
                  </div>
                  <div className="h-px bg-slate-100 mb-1" />
                  <button
                    onClick={() => { setIsUserMenuOpen(false); navigate('/perfil'); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Settings size={16} className="text-slate-400" />
                    Configurações
                  </button>
                  <button
                    onClick={() => { setIsUserMenuOpen(false); logout(); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
