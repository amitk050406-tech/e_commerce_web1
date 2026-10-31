/* main.js – shared helpers and site-wide UI: icons, toast, mobile nav, search suggestions, back-to-top */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN');

// localStorage wrapper – never crashes if storage is blocked
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } }
};

// Lucide-style icon paths (inline so the site works offline)
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/>',
  heart: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 22l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', check: '<path d="M20 6 9 17l-5-5"/>', up: '<path d="m18 15-6-6-6 6"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  truck: '<path d="M1 3h14v13H1zM15 8h4l4 4v4h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12A9 9 0 0 1 18.5 5.7L21 8M21 3v5h-5M3 21v-5h5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'
};
function icon(name, filled = false) {
  return `<svg class="ic" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// Toast notification (Hardened against XSS)
function toast(message) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast';
  
  const iconSpan = document.createElement('span');
  iconSpan.innerHTML = icon('check');
  el.appendChild(iconSpan.firstElementChild || iconSpan);

  const textSpan = document.createElement('span');
  textSpan.textContent = String(message || '');
  el.appendChild(textSpan);

  box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

document.addEventListener('DOMContentLoaded', () => {
  $$('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon, 'fill' in el.dataset); });
  const year = $('#year'); if (year) year.textContent = new Date().getFullYear();

  // Mobile hamburger menu (absent on pages with no site header, e.g. admin.html)
  const header = $('.site-header'), toggle = $('#nav-toggle');
  if (header && toggle) toggle.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', open);
  });

  // Back-to-top button
  const top = $('#to-top');
  if (top) {
    window.addEventListener('scroll', () => top.classList.toggle('show', window.scrollY > 500), { passive: true });
    top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // Search suggestions (Hardened with safe DOM manipulation)
  const input = $('#site-search'), list = $('#suggest');
  if (!input || !list) return;
  input.value = new URLSearchParams(location.search).get('q') || '';
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const catalog = window.PRODUCTS || [];
    const hits = q ? catalog.filter(p => (String(p.name) + ' ' + String(p.cat)).toLowerCase().includes(q)).slice(0, 5) : [];
    
    list.innerHTML = '';
    hits.forEach(p => {
      const a = document.createElement('a');
      a.href = `product-details.html?id=${encodeURIComponent(p.id)}`;
      
      const span = document.createElement('span');
      span.textContent = p.name;
      
      const small = document.createElement('small');
      small.textContent = p.cat;
      
      a.appendChild(span);
      a.appendChild(small);
      list.appendChild(a);
    });
    list.hidden = !hits.length;
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) list.hidden = true; });
  input.addEventListener('keydown', e => { if (e.key === 'Escape') list.hidden = true; });
});
