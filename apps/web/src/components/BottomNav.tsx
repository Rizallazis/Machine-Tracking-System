import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Layers, QrCode, ArrowRightLeft, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const BottomNav: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const items = [
    { to: '/', label: 'Home', icon: LayoutDashboard },
    { to: '/machines', label: 'Mesin', icon: Layers },
    { to: '/scan', label: 'Scan QR', icon: QrCode, isFab: true },
    { to: '/move', label: 'Pindah', icon: ArrowRightLeft },
    { to: '/conditions', label: 'Servis', icon: Wrench }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-1.5 z-40 flex justify-around items-center shadow-lg">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.to;

        if (item.isFab) {
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center -mt-6 group"
            >
              <div className="w-13 h-13 rounded-full bg-blue-600 border-4 border-slate-50 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 group-active:scale-95 transition-transform p-3">
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-blue-700 mt-1">Scan</span>
            </Link>
          );
        }

        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center py-1 px-3 rounded-lg transition-colors ${
              isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
};
