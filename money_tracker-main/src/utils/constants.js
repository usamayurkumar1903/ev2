export const CATEGORIES = [
  { id: 'food',          label: 'Food',        color: '#FF9F0A', bg: 'rgba(255,159,10,0.15)' },
  { id: 'transport',     label: 'Travel',      color: '#5AC8FA', bg: 'rgba(90,200,250,0.15)' },
  { id: 'bills',         label: 'Bills',       color: '#FF453A', bg: 'rgba(255,69,58,0.15)'  },
  { id: 'shopping',      label: 'Shopping',    color: '#BF5AF2', bg: 'rgba(191,90,242,0.15)' },
  { id: 'health',        label: 'Health',      color: '#30D158', bg: 'rgba(48,209,88,0.15)'  },
  { id: 'entertainment', label: 'Fun',         color: '#FF375F', bg: 'rgba(255,55,95,0.15)'  },
  { id: 'education',     label: 'Education',   color: '#5E5CE6', bg: 'rgba(94,92,230,0.15)'  },
  { id: 'salary',        label: 'Salary',      color: '#30D158', bg: 'rgba(48,209,88,0.15)'  },
  { id: 'freelance',     label: 'Freelance',   color: '#0A84FF', bg: 'rgba(10,132,255,0.15)' },
  { id: 'investment',    label: 'Invest',      color: '#5E5CE6', bg: 'rgba(94,92,230,0.15)'  },
  { id: 'rent',          label: 'Rent',        color: '#FF6B00', bg: 'rgba(255,107,0,0.15)'  },
  { id: 'other',         label: 'Other',       color: '#636366', bg: 'rgba(99,99,102,0.15)'  },
];

export const EXPENSE_CATS = ['food','transport','bills','shopping','health','entertainment','education','rent','other'];
export const INCOME_CATS  = ['salary','freelance','investment','other'];

export const BOOK_COLORS = [
  '#0A84FF','#30D158','#FF9F0A','#FF453A',
  '#BF5AF2','#5AC8FA','#FF375F','#5E5CE6',
  '#FF6B00','#636366',
];

// Extended currencies list
export const CURRENCIES = [
  { symbol: '₹', name: 'Indian Rupee',        code: 'INR' },
  { symbol: '$', name: 'US Dollar',            code: 'USD' },
  { symbol: '€', name: 'Euro',                 code: 'EUR' },
  { symbol: '£', name: 'British Pound',        code: 'GBP' },
  { symbol: '¥', name: 'Japanese Yen',         code: 'JPY' },
  { symbol: '¥', name: 'Chinese Yuan',         code: 'CNY' },
  { symbol: 'A$',name: 'Australian Dollar',    code: 'AUD' },
  { symbol: 'C$',name: 'Canadian Dollar',      code: 'CAD' },
  { symbol: 'Fr',name: 'Swiss Franc',          code: 'CHF' },
  { symbol: 'kr',name: 'Swedish Krona',        code: 'SEK' },
  { symbol: 'kr',name: 'Norwegian Krone',      code: 'NOK' },
  { symbol: 'kr',name: 'Danish Krone',         code: 'DKK' },
  { symbol: '₩', name: 'South Korean Won',     code: 'KRW' },
  { symbol: 'S$',name: 'Singapore Dollar',     code: 'SGD' },
  { symbol: 'د.إ',name:'UAE Dirham',           code: 'AED' },
  { symbol: '﷼', name: 'Saudi Riyal',          code: 'SAR' },
  { symbol: '₺', name: 'Turkish Lira',         code: 'TRY' },
  { symbol: 'R',  name: 'South African Rand',  code: 'ZAR' },
  { symbol: 'R$', name: 'Brazilian Real',       code: 'BRL' },
  { symbol: '$',  name: 'Mexican Peso',         code: 'MXN' },
  { symbol: 'Rp', name: 'Indonesian Rupiah',    code: 'IDR' },
  { symbol: '₱',  name: 'Philippine Peso',      code: 'PHP' },
  { symbol: '฿',  name: 'Thai Baht',            code: 'THB' },
  { symbol: '₫',  name: 'Vietnamese Dong',      code: 'VND' },
  { symbol: 'RM', name: 'Malaysian Ringgit',    code: 'MYR' },
];

export function getCat(id) {
  return CATEGORIES.find(function(c) { return c.id === id; }) || CATEGORIES[CATEGORIES.length - 1];
}

export function fmt(amount, currency) {
  if (!currency) currency = '₹';
  var n = Math.abs(amount);
  if (n >= 100000) return currency + (n / 100000).toFixed(1) + 'L';
  if (n >= 10000)  return currency + (n / 1000).toFixed(0) + 'K';
  if (n >= 1000)   return currency + (n / 1000).toFixed(1) + 'K';
  return currency + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function fmtFull(amount, currency) {
  if (!currency) currency = '₹';
  return currency + Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(dateStr) {
  var d = new Date(dateStr);
  var t = new Date();
  var y = new Date(t); y.setDate(y.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
    year: d.getFullYear() !== t.getFullYear() ? 'numeric' : undefined,
  });
}

export function monthKey(dateStr) {
  var d = new Date(dateStr);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function fmtMonth(key) {
  var parts = key.split('-');
  return new Date(+parts[0], +parts[1] - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function groupByDate(txs) {
  var map = {};
  for (var i = 0; i < txs.length; i++) {
    var t = txs[i];
    if (!map[t.date]) map[t.date] = [];
    map[t.date].push(t);
  }
  return Object.entries(map).sort(function(a, b) { return new Date(b[0]) - new Date(a[0]); });
}

export function catBreakdown(txs) {
  var map = {};
  for (var i = 0; i < txs.length; i++) {
    var t = txs[i];
    if (t.type === 'expense') {
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
  }
  return Object.entries(map)
    .map(function(e) { return Object.assign({}, getCat(e[0]), { total: e[1] }); })
    .sort(function(a, b) { return b.total - a.total; });
}
