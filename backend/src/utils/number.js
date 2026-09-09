export function n(v){ return Number(v?.toString?.() ?? v ?? 0); }
export function money(v){ return Math.round((n(v)+Number.EPSILON)*100)/100; }
export function dec(v){ return money(v); }
