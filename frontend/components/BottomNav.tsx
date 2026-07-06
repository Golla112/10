'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBetSlipStore } from '../lib/betSlipStore';

const navItems = [
  { id: 0, label: 'Home', path: '/', icon: '🏠' },
  { id: 1, label: 'Prematch', path: '/prematch', icon: '📅' },
  { id: 2, label: 'Live', path: '/live', icon: '🔴', isLive: true },
  { id: 3, label: 'Coupon', path: '#', icon: '🎫', isCoupon: true },
  { id: 4, label: 'Conto', path: '/dashboard', icon: '👤' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { selections, setIsOpen } = useBetSlipStore();
  const couponCount = selections.length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d] border-t border-white/10 md:hidden">
      <div className="flex justify-around items-center h-14">
        {navItems.map((item) => {
          const isActive = item.path === '/' ? pathname === '/' : pathname?.startsWith(item.path);
          const isCoupon = item.isCoupon;
          
          const content = (
            <div
              className={`
                flex flex-col items-center justify-center py-2 px-3 relative
                ${isActive ? 'text-[#14805e]' : 'text-gray-400'}
                ${item.isLive ? 'text-red-500' : ''}
              `}
            >
              <span className="text-lg mb-0.5">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
              
              {isCoupon && couponCount > 0 && (
                <span className="absolute -top-0.5 right-1 min-w-[18px] h-[18px] px-1 
                  bg-[#ff4757] text-white text-[10px] font-bold rounded-full 
                  flex items-center justify-center border-2 border-[#0d0d0d]">
                  {couponCount > 99 ? '99+' : couponCount}
                </span>
              )}
              
              {isActive && (
                <span className="absolute -bottom-0.5 w-8 h-0.5 bg-[#14805e] rounded-full" />
              )}
              
              {item.isLive && (
                <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
          );

          if (isCoupon) {
            return (
              <button
                key={item.id}
                onClick={() => setIsOpen(true)}
                className="flex-1"
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.path}
              className="flex-1"
            >
              {content}
            </Link>
          );
        })}
      </div>
      
      {/* Safe area for iOS */}
      <div className="h-safe-area-inset-bottom bg-[#0d0d0d]" />
    </nav>
  );
}
