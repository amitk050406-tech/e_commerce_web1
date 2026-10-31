/* ==========================================================================
   products.js – Catalog data fetching, reusable product card, wishlist,
                 shop filters, product details & realtime synchronization
   ========================================================================== */

/**
 * Global product catalog cache in memory.
 * Populated asynchronously via Supabase client.
 */
window.PRODUCTS = window.PRODUCTS || [];

/**
 * Load / Refresh catalog from Supabase.
 */
async function loadCatalog() {
  try {
    const list = await getProducts();
    window.PRODUCTS = Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('[Catalog] Failed to load catalog from Supabase:', err);
    if (!window.PRODUCTS || !window.PRODUCTS.length) {
      window.PRODUCTS = typeof getFallbackProducts === 'function' ? getFallbackProducts() : [];
    }
  }
  return window.PRODUCTS;
}

/**
 * ------------------------------------------------------------------
 * Wishlist (Persisted in localStorage with String ID matching)
 * ------------------------------------------------------------------
 */
const Wish = {
  ids: (store.get('tilde_wishlist', []) || []).map(String),
  has(id) {
    const target = String(id);
    return this.ids.some(x => String(x) === target);
  },
  toggle(id) {
    const target = String(id);
    this.ids = this.has(target)
      ? this.ids.filter(x => String(x) !== target)
      : [...this.ids, target];
    store.set('tilde_wishlist', this.ids);
    return this.has(target);
  }
};

/**
 * ------------------------------------------------------------------
 * Reusable Product Card UI
 * ------------------------------------------------------------------
 */
const stars = r => Array.from({ length: 5 }, (_, i) => icon('star', i < Math.round(Number(r || 0)))).join('');
const detailUrl = p => `product-details.html?id=${encodeURIComponent(p.id)}`;

function productCard(p) {
  const price = Number(p.price || 0);
  const oldPrice = p.old !== null && p.old !== undefined ? Number(p.old) : null;
  const off = (oldPrice && oldPrice > price) ? Math.round((1 - price / oldPrice) * 100) : 0;
  
  const safeId = escapeHTML(p.id);
  const safeName = escapeHTML(p.name);
  const safeCat = escapeHTML(p.cat);
  const safeDesc = escapeHTML(p.desc);
  const safeImg = sanitizeUrl(productImage(p));
  const safeLink = detailUrl(p);
  const isWished = Wish.has(p.id);

  const infoList = (Array.isArray(p.info) ? p.info : [])
    .map(i => `<li>${escapeHTML(i)}</li>`)
    .join('');

  return `<article class="card">
    <a class="card-img" href="${safeLink}">
      <img src="${safeImg}" alt="${safeName}" width="400" height="400" loading="lazy" onerror="this.onerror=null;this.src='assets/images/placeholder.svg';">
      ${off ? `<span class="badge">−${off}%</span>` : ''}
    </a>
    <button class="wish ${isWished ? 'on' : ''}" data-wish="${safeId}" aria-pressed="${isWished}" aria-label="Save ${safeName} to wishlist">${icon('heart')}</button>
    <div class="card-body">
      <span class="cat">${safeCat}</span>
      <h3><a href="${safeLink}">${safeName}</a></h3>
      <p class="desc">${safeDesc}</p>
      <div class="rating" aria-label="Rated ${Number(p.rating || 0).toFixed(1)} out of 5">${stars(p.rating)}<small>${Number(p.rating || 0).toFixed(1)} (${Number(p.reviews || 0)})</small></div>
      <div class="price"><strong>${fmt(price)}</strong>${oldPrice ? `<s>${fmt(oldPrice)}</s>` : ''}</div>
      <button class="more" data-more aria-expanded="false">Show details</button>
      <ul class="info" hidden>${infoList}</ul>
      <div class="card-actions">
        <button class="btn btn-primary" data-add="${safeId}">Add to cart</button>
        <a class="btn btn-ghost" href="${safeLink}">View</a>
      </div>
    </div></article>`;
}

const renderGrid = (el, list) => {
  if (!el) return;
  el.innerHTML = (list || []).map(productCard).join('');
};

/**
 * ------------------------------------------------------------------
 * Event Delegation for Product Cards (Add to Cart, Wishlist, More)
 * ------------------------------------------------------------------
 */
document.addEventListener('click', e => {
  // Add to cart button
  const add = e.target.closest('[data-add]');
  if (add) {
    const targetId = String(add.dataset.add);
    const p = (window.PRODUCTS || []).find(x => String(x.id) === targetId);
    if (p) {
      const qtyInput = $('#qty');
      const qty = (add.dataset.withQty && qtyInput) ? Math.max(1, Math.min(10, parseInt(qtyInput.value, 10) || 1)) : 1;
      Cart.add(p.id, qty);
      
      const label = add.innerHTML;
      add.classList.add('added');
      add.innerHTML = icon('check') + ' Added';
      setTimeout(() => {
        add.classList.remove('added');
        add.innerHTML = label;
      }, 1400);
      toast(`${p.name} added to cart`);
    }
  }

  // Wishlist toggle button
  const wish = e.target.closest('[data-wish]');
  if (wish) {
    const targetId = String(wish.dataset.wish);
    const on = Wish.toggle(targetId);
    $$(`[data-wish]`).forEach(b => {
      if (String(b.dataset.wish) === targetId) {
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
      }
    });
    toast(on ? 'Saved to wishlist' : 'Removed from wishlist');
    if (window.refreshShop) window.refreshShop();
  }

  // Expand / collapse info drawer
  const more = e.target.closest('[data-more]');
  if (more) {
    const panel = more.nextElementSibling;
    if (panel) {
      const open = panel.hidden;
      panel.hidden = !open;
      more.setAttribute('aria-expanded', open);
      more.textContent = open ? 'Hide details' : 'Show details';
    }
  }

  // Product detail quantity stepper
  const step = e.target.closest('[data-step]');
  if (step) {
    const q = $('#qty');
    if (q) {
      const delta = parseInt(step.dataset.step, 10) || 0;
      const current = parseInt(q.value, 10) || 1;
      q.value = Math.max(1, Math.min(10, current + delta));
    }
  }
});

/**
 * ------------------------------------------------------------------
 * Home Page (Trending, Bestsellers, New Arrivals) + Realtime Sync
 * ------------------------------------------------------------------
 */
async function initHome() {
  const trendingEl = $('#trending');
  const bestsellersEl = $('#bestsellers');
  const newArrivalsEl = $('#new-arrivals');
  if (!trendingEl && !bestsellersEl && !newArrivalsEl) return;

  // Render placeholder skeletons while loading
  [trendingEl, bestsellersEl, newArrivalsEl].forEach(el => {
    if (el) el.innerHTML = '<div class="skeleton"></div>'.repeat(4);
  });

  await loadCatalog();
  renderHomeGrids();

  // Real-time synchronization
  subscribeToProducts(async () => {
    console.info('[Realtime] Auto-refreshing Home catalog grids...');
    await loadCatalog();
    renderHomeGrids();
  });
}

function renderHomeGrids() {
  const trendingEl = $('#trending');
  const bestsellersEl = $('#bestsellers');
  const newArrivalsEl = $('#new-arrivals');

  if (trendingEl) {
    renderGrid(trendingEl, (window.PRODUCTS || []).filter(p => Array.isArray(p.tags) && p.tags.includes('trending')).slice(0, 4));
  }
  if (bestsellersEl) {
    renderGrid(bestsellersEl, (window.PRODUCTS || []).filter(p => Array.isArray(p.tags) && p.tags.includes('best')).slice(0, 4));
  }
  if (newArrivalsEl) {
    renderGrid(newArrivalsEl, (window.PRODUCTS || []).filter(p => Array.isArray(p.tags) && p.tags.includes('new')).slice(0, 4));
  }
}

/**
 * ------------------------------------------------------------------
 * Shop Page: Search, Filter, Sort, Count + Realtime Sync
 * ------------------------------------------------------------------
 */
async function initShop() {
  const grid = $('#shop-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="skeleton"></div>'.repeat(8);

  await loadCatalog();

  const params = new URLSearchParams(location.search);
  const state = {
    q: params.get('q') || '',
    cat: params.get('cat') || 'All',
    sort: 'featured'
  };

  const chips = $('#chips');
  const search = $('#shop-search');
  const sort = $('#sort');
  const empty = $('#shop-empty');
  const countEl = $('#result-count');

  if (search) search.value = state.q;

  const sorters = {
    featured: () => 0,
    'price-asc': (a, b) => Number(a.price) - Number(b.price),
    'price-desc': (a, b) => Number(b.price) - Number(a.price),
    'name-asc': (a, b) => String(a.name).localeCompare(String(b.name)),
    'name-desc': (a, b) => String(b.name).localeCompare(String(a.name))
  };

  function updateCategoryChips() {
    if (!chips) return;
    const distinctCats = [...new Set((window.PRODUCTS || []).map(p => p.cat).filter(Boolean))];
    const categories = ['All', 'On sale', 'Wishlist', ...distinctCats];

    chips.innerHTML = categories.map(c => {
      const safeCategory = escapeHTML(c);
      const isSelected = c === state.cat;
      return `<button class="chip" data-cat="${safeCategory}" aria-pressed="${isSelected}">${safeCategory}</button>`;
    }).join('');
  }

  function apply() {
    const q = state.q.trim().toLowerCase();
    const list = (window.PRODUCTS || []).filter(p => {
      const text = (String(p.name) + ' ' + String(p.cat) + ' ' + String(p.desc)).toLowerCase();
      const matchText = !q || text.includes(q);
      const matchCat = state.cat === 'All'
        || (state.cat === 'On sale' ? (p.old !== null && p.old !== undefined && Number(p.old) > Number(p.price))
        : state.cat === 'Wishlist' ? Wish.has(p.id)
        : String(p.cat) === state.cat);
      return matchText && matchCat;
    }).sort(sorters[state.sort] || sorters.featured);

    renderGrid(grid, list);
    if (empty) empty.hidden = list.length > 0;
    if (countEl) countEl.textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;

    if (chips) {
      $$('.chip', chips).forEach(c => {
        c.setAttribute('aria-pressed', c.dataset.cat === state.cat);
      });
    }
  }

  window.refreshShop = () => { if (state.cat === 'Wishlist') apply(); };
  window.applyShopFilters = apply;

  updateCategoryChips();

  if (chips) {
    chips.addEventListener('click', e => {
      const c = e.target.closest('.chip');
      if (c) {
        state.cat = c.dataset.cat;
        apply();
      }
    });
  }

  if (search) {
    search.addEventListener('input', () => {
      state.q = search.value;
      apply();
    });
  }

  if (sort) {
    sort.addEventListener('change', () => {
      state.sort = sort.value;
      apply();
    });
  }

  const clearBtn = $('#clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      Object.assign(state, { q: '', cat: 'All', sort: 'featured' });
      if (search) search.value = '';
      if (sort) sort.value = 'featured';
      apply();
    });
  }

  apply();

  // Real-time synchronization
  subscribeToProducts(async () => {
    console.info('[Realtime] Auto-refreshing Shop catalog...');
    await loadCatalog();
    updateCategoryChips();
    apply();
  });
}

/**
 * ------------------------------------------------------------------
 * Product Details Page
 * ------------------------------------------------------------------
 */
async function initDetail() {
  const box = $('#detail');
  if (!box) return;

  const targetId = new URLSearchParams(location.search).get('id');
  if (!targetId) {
    box.innerHTML = '<div class="empty"><h2>Product not found</h2><p>No product ID provided.</p><a class="btn btn-primary" href="products.html">Back to shop</a></div>';
    const relWrap = $('#related-wrap');
    if (relWrap) relWrap.hidden = true;
    return;
  }

  // Fetch single product record asynchronously
  let p = await getProductById(targetId);

  // If not found in direct fetch, try catalog fallback
  if (!p) {
    await loadCatalog();
    p = (window.PRODUCTS || []).find(x => String(x.id) === String(targetId));
  }

  if (!p) {
    box.innerHTML = '<div class="empty"><h2>Product not found</h2><p>This product link is no longer available.</p><a class="btn btn-primary" href="products.html">Back to shop</a></div>';
    const relWrap = $('#related-wrap');
    if (relWrap) relWrap.hidden = true;
    return;
  }

  document.title = `${escapeHTML(p.name)} – Tilde`;
  const crumb = $('#crumb');
  if (crumb) crumb.textContent = p.name;

  const price = Number(p.price || 0);
  const oldPrice = p.old !== null && p.old !== undefined ? Number(p.old) : null;
  const off = (oldPrice && oldPrice > price) ? Math.round((1 - price / oldPrice) * 100) : 0;
  
  const safeId = escapeHTML(p.id);
  const safeName = escapeHTML(p.name);
  const safeCat = escapeHTML(p.cat);
  const safeDesc = escapeHTML(p.desc);
  const safeImg = sanitizeUrl(productImage(p));
  const isWished = Wish.has(p.id);
  const infoList = (Array.isArray(p.info) ? p.info : [])
    .map(i => `<li>${escapeHTML(i)}</li>`)
    .join('');

  // Standardized SKU display without arithmetic coercion
  const skuCode = String(p.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || '1001';

  box.innerHTML = `<div class="detail-img">
      <img src="${safeImg}" alt="${safeName}" width="600" height="600" onerror="this.onerror=null;this.src='assets/images/placeholder.svg';">
    </div>
    <div>
      <span class="cat">${safeCat}</span>
      <h1>${safeName}</h1>
      <div class="rating" aria-label="Rated ${Number(p.rating || 0).toFixed(1)} out of 5">${stars(p.rating)}<small>${Number(p.rating || 0).toFixed(1)} (${Number(p.reviews || 0)} reviews)</small></div>
      <div class="price"><strong>${fmt(price)}</strong>${oldPrice ? `<s>${fmt(oldPrice)}</s><span class="badge" style="position:static">−${off}%</span>` : ''}</div>
      <p class="desc">${safeDesc}</p>
      <div class="buy">
        <div class="qty">
          <button data-step="-1" aria-label="Decrease quantity">−</button>
          <input id="qty" type="number" min="1" max="10" value="1" aria-label="Quantity">
          <button data-step="1" aria-label="Increase quantity">+</button>
        </div>
        <button class="btn btn-primary" data-add="${safeId}" data-with-qty="1">Add to cart</button>
        <button class="btn btn-ghost wish-inline ${isWished ? 'on' : ''}" data-wish="${safeId}" aria-pressed="${isWished}">${icon('heart')} Wishlist</button>
      </div>
      <dl class="facts">
        <dt>Category</dt><dd>${safeCat}</dd>
        <dt>SKU</dt><dd>TL-${skuCode}</dd>
        <dt>Availability</dt><dd>${p.is_active ? 'In stock' : 'Out of stock'}</dd>
        <dt>Delivery</dt><dd>Free above ₹999</dd>
      </dl>
      <button class="more" data-more aria-expanded="false">Show product information</button>
      <ul class="info" hidden>${infoList}</ul>
    </div>`;

  // Render related products from the same category
  await loadCatalog();
  const relatedGrid = $('#related');
  if (relatedGrid) {
    const relatedList = (window.PRODUCTS || [])
      .filter(x => String(x.cat) === String(p.cat) && String(x.id) !== String(p.id))
      .slice(0, 4);
    renderGrid(relatedGrid, relatedList);
  }
}

/**
 * ------------------------------------------------------------------
 * Page Lifecycle Initialization
 * ------------------------------------------------------------------
 */
document.addEventListener('DOMContentLoaded', () => {
  initHome();
  initShop();
  initDetail();
});
