import {
  Utensils, Car, FileText, ShoppingBag, Heart,
  Clapperboard, BookOpen, Banknote, Laptop, TrendingUp,
  Home, MoreHorizontal,
} from 'lucide-react';
import { getCat } from '../utils/constants';

const ICONS = {
  food:          Utensils,
  transport:     Car,
  bills:         FileText,
  shopping:      ShoppingBag,
  health:        Heart,
  entertainment: Clapperboard,
  education:     BookOpen,
  salary:        Banknote,
  freelance:     Laptop,
  investment:    TrendingUp,
  rent:          Home,
  other:         MoreHorizontal,
};

export default function CategoryIcon({ catId, size }) {
  if (!size) size = 16;
  const cat = getCat(catId);
  const Icon = ICONS[catId] || MoreHorizontal;
  return (
    <div
      className="tx-icon"
      style={{ background: cat.bg, width: size + 24, height: size + 24, borderRadius: 10 }}
    >
      <Icon size={size} style={{ color: cat.color }} strokeWidth={1.8} />
    </div>
  );
}

export { ICONS };
