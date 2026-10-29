import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Layers,
  LayoutDashboard,
  QrCode,
  ArrowRightLeft,
  Wrench,
  History,
  Database,
  ShieldAlert,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, UserRoleLabel } from '@machine-tracking/shared';

export const Navbar: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/machines', label: 'Daftar Mesin', icon: Layers },
    { to: '/scan', label: 'Scan QR', icon: QrCode },
    { to: '/move', label: 'Pindah Mesin', icon: ArrowRightLeft },
    { to: '/conditions', label: 'Kondisi & Servis', icon: Wrench },
    { to: '/history', label: 'Riwayat', icon: History }
  ];

  if (hasRole(UserRole.ADMIN, UserRole.IE)) {
    navLinks.push({ to: '/master', label: 'Master Data', icon: Database });
    navLinks.push({ to: '/audit', label: 'Audit Log', icon: ShieldAlert });
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
                <span className="text-lg tracking-wider">M</span>
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 tracking-tight block leading-tight">
                  PT ESGI <span className="text-blue-600 font-semibold">Tracking</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium block uppercase tracking-wider">
                  Machine System v1.0
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex space-x-1 items-center">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800 flex items-center justify-end gap-1">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                {user.User_Name}
              </span>
              <span className="text-[11px] text-blue-600 font-medium">
                {UserRoleLabel[user.Role_ID] || user.Role_ID}
              </span>
            </div>

            <button
              onClick={logout}
              title="Keluar"
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
