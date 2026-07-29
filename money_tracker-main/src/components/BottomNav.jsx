import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, BookOpen, Settings } from 'lucide-react';

var ITEMS = [
  { to: '/',             end: true, label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/transactions',             label: 'History',   Icon: ArrowLeftRight  },
  { to: '/books',                    label: 'Books',     Icon: BookOpen        },
  { to: '/settings',                 label: 'Settings',  Icon: Settings        },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(function(item) {
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={function(p) { return 'bottom-nav-item' + (p.isActive ? ' active' : ''); }}
          >
            <item.Icon size={22} strokeWidth={1.8} />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
