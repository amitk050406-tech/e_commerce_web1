/* ==========================================================================
   cart.js – Cart state, live Supabase synchronization, totals calculation,
             drawer management, cart view & simulated checkout
   ========================================================================== */

const FREE_SHIPPING_AT = 999;
const SHIPPING_FEE = 99;
const MAX_QTY = 10;

const Cart = {
  // Persisted cart items: [{ id: string, qty: number }]
  items: (store.get('tilde_cart', []) || []).map(i => ({
    id: String(i.id),
    qty: Math.max(1, Math.min(MAX_QTY, parseInt(i.qty, 10) || 1))
  })),

  save() {
    store.set('tilde_cart', this.items);
    this.render();
  },

  find(id) {
    const target = String(id);
    return this.items.find(i => String(i.id) === target);
  },

  add(id, qty = 1) {
    const target = String(id);
    const line = this.find(target);
    const delta = Math.max(1, Math.min(MAX_QTY, parseInt(qty, 10) || 1));

    if (line) {
      line.qty = Math.min(MAX_QTY, line.qty + delta);
    } else {
      this.items.push({ id: target, qty: delta });
    }

    this.save();
    $$('.cart-count').forEach(c => {
      c.classList.remove('bump');
      void c.offsetWidth;
      c.classList.add('bump');
    });
  },

  setQty(id, qty) {
    const target = String(id);
    const parsedQty = parseInt(qty, 10);
    if (isNaN(parsedQty) || parsedQty < 1) {
      return this.remove(target);
    }
    const line = this.find(target);
    if (line) {
      line.qty = Math.min(MAX_QTY, parsedQty);
      this.save();
    }
  },

  remove(id) {
    const target = String(id);
    this.items = this.items.filter(i => String(i.id) !== target);
    this.save();
  },

  clear() {
    this.items = [];
    this.save();
  },

  /**
   * Resolve cart line items matching against live catalog products.
   * Standardizes ID lookups using string comparison (String(p.id) === String(i.id)).
   */
  lines() {
    const catalog = window.PRODUCTS || [];
    return this.items
      .map(i => ({
        ...i,
        p: catalog.find(p => String(p.id) === String(i.id))
      }))
      .filter(l => Boolean(l.p));
  },

  count() {
    return this.lines().reduce((n, l) => n + l.qty, 0);
  },

  subtotal() {
    return this.lines().reduce((s, l) => s + (l.qty * Number(l.p.price || 0)), 0);
  },

  shipping() {
    const s = this.subtotal();
    return (s === 0 || s >= FREE_SHIPPING_AT) ? 0 : SHIPPING_FEE;
  },

  total() {
    return this.subtotal() + this.shipping();
  },

  /**
   * Dynamically validate cart against live Supabase product records.
   * Handles deleted, out-of-stock, or modified products gracefully.
   */
  async sync() {
    try {
      let liveProducts = [];
      if (typeof getProducts === 'function') {
        liveProducts = await getProducts();
      }
      if (!liveProducts || !liveProducts.length) {
        liveProducts = window.PRODUCTS || [];
      } else {
        window.PRODUCTS = liveProducts;
      }

      // If catalog is not yet loaded or server returned empty list, do not wipe cart
      if (!liveProducts || !liveProducts.length) {
        return;
      }

      let removedCount = 0;
      const validItems = [];

      for (const item of this.items) {
        const liveProduct = liveProducts.find(p => String(p.id) === String(item.id));
        if (!liveProduct || liveProduct.is_active === false) {
          removedCount++;
        } else {
          validItems.push({
            id: String(item.id),
            qty: Math.max(1, Math.min(MAX_QTY, parseInt(item.qty, 10) || 1))
          });
        }
      }

      if (removedCount > 0) {
        this.items = validItems;
        store.set('tilde_cart', this.items);
        toast(`${removedCount} item${removedCount > 1 ? 's' : ''} no longer available in store and removed from cart`);
      }
    } catch (err) {
      console.warn('[Cart] Live synchronization warning:', err);
    }
    this.render();
  },

  /**
   * Render cart counters, slide drawer, and cart page summary.
   */
  render() {
    $$('.cart-count').forEach(c => {
      c.textContent = this.count();
    });

    const lines = this.lines();
    const listHtml = lines.length ? `<ul class="cart-list">${lines.map(cartRow).join('')}</ul>` : '';
    const emptyHtml = `<div class="empty">
      <h2>Your cart is empty</h2>
      <p>Add something you like and it will show up here.</p>
      <a class="btn btn-primary" href="products.html">Continue shopping</a>
    </div>`;

    // Drawer container
    const drawer = $('#drawer-body');
    const drawerFoot = $('#drawer-foot');
    if (drawer) {
      drawer.innerHTML = lines.length ? listHtml : emptyHtml;
      if (drawerFoot) {
        drawerFoot.innerHTML = lines.length ? `
          <div class="summary-line" style="display:flex;justify-content:space-between;font-weight:600">
            <span>Subtotal</span>
            <strong>${fmt(this.subtotal())}</strong>
          </div>
          <a class="btn btn-ghost" href="cart.html">View cart</a>
          <button class="btn btn-primary" data-checkout>Checkout</button>` : '';
      }
    }

    // Full Cart Page container
    const page = $('#cart-page');
    if (page) {
      page.innerHTML = lines.length ? `
        ${listHtml}
        <aside class="summary">
          <h2>Order summary</h2>
          <div><span>Subtotal</span><span>${fmt(this.subtotal())}</span></div>
          <div><span>Delivery</span><span>${this.shipping() ? fmt(this.shipping()) : 'Free'}</span></div>
          <div class="total"><span>Total</span><span>${fmt(this.total())}</span></div>
          <small>Free delivery on orders over ${fmt(FREE_SHIPPING_AT)}. Demo checkout: no payment is taken.</small>
          <button class="btn btn-primary" data-checkout>Checkout</button>
          <a class="btn btn-ghost" href="products.html">Continue shopping</a>
        </aside>` : emptyHtml;
    }
  }
};

/**
 * Renders individual cart row with XSS sanitization and image fallback onerror.
 */
const cartRow = l => {
  const safeId = escapeHTML(l.id);
  const safeName = escapeHTML(l.p.name);
  const safeImg = sanitizeUrl(productImage(l.p));
  const safeLink = `product-details.html?id=${encodeURIComponent(l.id)}`;
  const lineTotal = fmt(Number(l.p.price || 0) * l.qty);

  return `<li class="cart-row">
    <img src="${safeImg}" alt="${safeName}" width="72" height="72" onerror="this.onerror=null;this.src='assets/images/placeholder.svg';">
    <div>
      <a href="${safeLink}">${safeName}</a>
      <small>${fmt(l.p.price)} each</small>
      <div class="qty">
        <button data-cart-step="-1" data-id="${safeId}" aria-label="Decrease quantity of ${safeName}">−</button>
        <span aria-live="polite">${l.qty}</span>
        <button data-cart-step="1" data-id="${safeId}" aria-label="Increase quantity of ${safeName}">+</button>
      </div>
    </div>
    <div class="row-end">
      <strong>${lineTotal}</strong>
      <button class="link-danger" data-remove="${safeId}" aria-label="Remove ${safeName}">${icon('trash')}</button>
    </div>
  </li>`;
};

/**
 * Slide-out cart drawer controls
 */
function setDrawer(open) {
  const drawerEl = $('#drawer');
  const overlayEl = $('#overlay');
  if (drawerEl) {
    drawerEl.classList.toggle('open', open);
    drawerEl.setAttribute('aria-hidden', !open);
  }
  if (overlayEl) overlayEl.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
}

/**
 * Global Cart Event Listeners (Event Delegation)
 */
document.addEventListener('click', e => {
  if (e.target.closest('[data-open-cart]')) setDrawer(true);
  if (e.target.closest('[data-close-cart]') || (e.target.id === 'overlay')) setDrawer(false);

  // Cart quantity step
  const step = e.target.closest('[data-cart-step]');
  if (step) {
    const targetId = String(step.dataset.id);
    const delta = parseInt(step.dataset.cartStep, 10) || 0;
    const current = Cart.find(targetId);
    if (current) {
      Cart.setQty(targetId, current.qty + delta);
    }
  }

  // Cart line item deletion
  const rm = e.target.closest('[data-remove]');
  if (rm) {
    const targetId = String(rm.dataset.remove);
    Cart.remove(targetId);
    toast('Removed from cart');
  }

  // Demo checkout action
  if (e.target.closest('[data-checkout]') && Cart.count() > 0) {
    const orderNo = $('#order-no');
    if (orderNo) {
      orderNo.textContent = 'TL-' + Math.floor(100000 + Math.random() * 900000);
    }
    Cart.clear();
    setDrawer(false);
    const dialog = $('#order-dialog');
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') setDrawer(false);
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  Cart.render();
  Cart.sync();

  // Listen to realtime changes for automatic cart recalculation
  if (typeof subscribeToProducts === 'function') {
    subscribeToProducts(() => {
      Cart.sync();
    });
  }
});

window.Cart = Cart;
