/* ==========================================================================
   admin.js – Secure Supabase Auth administration panel & product management
   ========================================================================== */

const CATS = ['Electronics', 'Clothing', 'Accessories', 'Home & Lifestyle'];

/**
 * Check authentication status via Supabase Auth session token.
 * Prevents client-side bypass through sessionStorage or devtools tampering.
 */
async function checkAuthAndRender() {
  const container = $('#admin-app');
  if (!container) return;

  if (!supabaseClient) {
    renderConfigNotice();
    return;
  }

  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error('[Admin Auth] Session verification error:', error);
      renderLogin(error.message);
      return;
    }

    if (session && session.user) {
      renderDashboard();
    } else {
      renderLogin();
    }
  } catch (err) {
    console.error('[Admin Auth] Unexpected check error:', err);
    renderLogin();
  }
}

/**
 * Guide displayed when Supabase credentials have not been configured yet.
 */
function renderConfigNotice() {
  const app = $('#admin-app');
  if (!app) return;
  app.innerHTML = `
    <div class="login-box" style="max-width:560px">
      <h1>Connect to Supabase</h1>
      <p class="desc" style="text-align:left;line-height:1.6;margin-block:var(--s2)">
        Project URL configured: <code>${escapeHTML(SUPABASE_URL)}</code>
      </p>
      <div class="admin-note" style="text-align:left">
        <strong>Supabase Anon API Key Required:</strong>
        <p style="margin-top:.4rem;font-size:.88rem">
          Enter your <strong>anon public API key</strong> below (or set <code>SUPABASE_ANON_KEY</code> in <code>js/supabase.js</code>).
          Found in your Supabase Dashboard &rarr; <em>Project Settings &rarr; API &rarr; Project API Keys &rarr; anon public</em>.
        </p>
      </div>
      <form class="form" id="config-form" style="text-align:left;margin-top:var(--s2)">
        <div class="field">
          <label for="cfg-anon-key">Supabase Anon Key (public)</label>
          <textarea id="cfg-anon-key" rows="3" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." required style="min-height:90px"></textarea>
        </div>
        <button class="btn btn-primary" type="submit">Save & Connect</button>
        <p class="err" id="cfg-err"></p>
      </form>
    </div>`;

  const form = $('#config-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const key = $('#cfg-anon-key').value.trim();
      if (!key || key.length < 20) {
        $('#cfg-err').textContent = 'Please enter a valid Supabase anon key.';
        return;
      }
      if (typeof setAnonKey === 'function') {
        setAnonKey(key);
      } else {
        localStorage.setItem('supabase_anon_key', key);
        location.reload();
      }
    });
  }
}

/**
 * Render Supabase Auth Sign-In Form (Hardened against XSS).
 */
function renderLogin(err = '') {
  const app = $('#admin-app');
  if (!app) return;

  app.innerHTML = `
    <div class="login-box">
      <h1>Admin sign in</h1>
      <p class="desc">Enter your Supabase administrator credentials to manage catalog records securely.</p>
      <form class="form" id="login-form" novalidate>
        <div class="field">
          <label for="admin-email">Admin Email</label>
          <input id="admin-email" type="email" autocomplete="email" required placeholder="admin@tilde.example">
        </div>
        <div class="field">
          <label for="admin-pw">Password</label>
          <input id="admin-pw" type="password" autocomplete="current-password" required placeholder="••••••••">
        </div>
        <button class="btn btn-primary" type="submit" id="btn-signin">Sign in</button>
        <p class="err" id="login-err">${escapeHTML(err)}</p>
      </form>
    </div>`;

  const form = $('#login-form');
  const btn = $('#btn-signin');
  const errEl = $('#login-err');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#admin-email').value.trim();
    const password = $('#admin-pw').value;

    if (!email || !password) {
      errEl.textContent = 'Please enter both email and password.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Verifying…';
    errEl.textContent = '';

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        errEl.textContent = error.message || 'Authentication failed.';
        btn.disabled = false;
        btn.textContent = 'Sign in';
      } else {
        toast('Signed in successfully');
        renderDashboard();
      }
    } catch (authErr) {
      errEl.textContent = authErr.message || 'An unexpected connection error occurred.';
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });
}

/**
 * Render individual catalog table row with XSS sanitization and image fallback.
 */
function productRow(p) {
  const safeId = escapeHTML(p.id);
  const safeName = escapeHTML(p.name);
  const safeCat = escapeHTML(p.cat);
  const safeImg = sanitizeUrl(productImage(p));
  const price = Number(p.price || 0);
  const oldPrice = p.old !== null && p.old !== undefined ? Number(p.old) : null;
  const statusBadge = p.is_active !== false
    ? '<span class="tag-base">Active</span>'
    : '<span class="tag-custom" style="background:#fee2e2;color:#991b1b">Inactive</span>';

  return `<tr>
    <td><img src="${safeImg}" alt="${safeName}" onerror="this.onerror=null;this.src='assets/images/placeholder.svg';"></td>
    <td><span class="prod-name">${safeName}</span><br>${statusBadge}</td>
    <td>${safeCat}</td>
    <td>${fmt(price)}${oldPrice ? ` <s>${fmt(oldPrice)}</s>` : ''}</td>
    <td class="row-actions">
      <button class="btn btn-ghost btn-sm" data-edit="${safeId}">Edit</button>
      <button class="link-danger" data-del="${safeId}" aria-label="Delete ${safeName}">${icon('trash')}</button>
    </td></tr>`;
}

/**
 * Product Add / Edit Dialog Form with complete XSS escaping and price-zero support.
 */
function dialogForm(p) {
  const isEditing = Boolean(p);
  const v = p || {
    name: '',
    cat: CATS[0],
    price: '',
    old: '',
    rating: 4.5,
    reviews: 0,
    desc: '',
    image: '',
    info: [],
    is_active: true
  };

  const safeName = escapeHTML(v.name);
  const safePrice = v.price !== '' ? escapeHTML(v.price) : '';
  const safeOld = (v.old !== null && v.old !== undefined && v.old !== '') ? escapeHTML(v.old) : '';
  const safeRating = escapeHTML(v.rating ?? 4.5);
  const safeReviews = escapeHTML(v.reviews ?? 0);
  const safeDesc = escapeHTML(v.desc || '');
  const safeInfo = Array.isArray(v.info) ? escapeHTML(v.info.join('\n')) : '';
  const safeImage = escapeHTML(v.image || '');

  return `<h2>${isEditing ? 'Edit product' : 'Add a product'}</h2>
    <form class="form" id="product-form" novalidate>
      <div class="field">
        <label for="f-name">Product name *</label>
        <input id="f-name" required value="${safeName}" placeholder="e.g. Wireless ANC Headphones">
      </div>
      <div class="two-col">
        <div class="field">
          <label for="f-cat">Category *</label>
          <select id="f-cat">
            ${CATS.map(c => `<option ${c === v.cat ? 'selected' : ''} value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="f-rating">Rating (0–5)</label>
          <input id="f-rating" type="number" min="0" max="5" step="0.1" value="${safeRating}">
        </div>
        <div class="field">
          <label for="f-price">Price (₹) *</label>
          <input id="f-price" type="number" min="0" step="any" required value="${safePrice}" placeholder="0 or greater">
        </div>
        <div class="field">
          <label for="f-old">Original price (₹, optional)</label>
          <input id="f-old" type="number" min="0" step="any" value="${safeOld}" placeholder="Leave blank if not discounted">
        </div>
      </div>
      <div class="two-col">
        <div class="field">
          <label for="f-reviews">Reviews count</label>
          <input id="f-reviews" type="number" min="0" step="1" value="${safeReviews}">
        </div>
        <div class="field" style="display:flex;align-items:center;gap:.6rem;padding-top:1.8rem">
          <input id="f-active" type="checkbox" ${v.is_active !== false ? 'checked' : ''} style="width:20px;height:20px;min-height:unset">
          <label for="f-active" style="margin:0;cursor:pointer">Product is active in store</label>
        </div>
      </div>
      <div class="field">
        <label for="f-desc">Short description</label>
        <textarea id="f-desc" rows="2" placeholder="Brief summary of the item...">${safeDesc}</textarea>
      </div>
      <div class="field">
        <label for="f-info">Product details (one feature per line, optional)</label>
        <textarea id="f-info" rows="3" placeholder="Bluetooth 5.3&#10;Fast charging&#10;Water resistant">${safeInfo}</textarea>
      </div>
      <div class="field">
        <label for="f-image">Image URL (optional — leave blank for default SVG)</label>
        <input id="f-image" type="url" placeholder="https://..." value="${safeImage}">
      </div>
      <p class="err" id="form-err"></p>
      <div class="row-actions">
        <button class="btn btn-primary" type="submit" id="btn-save-prod">Save product</button>
        <button class="btn btn-ghost" type="button" id="cancel-form">Cancel</button>
      </div>
    </form>`;
}

/**
 * Render the full Admin Dashboard.
 */
async function renderDashboard() {
  const app = $('#admin-app');
  if (!app) return;

  app.innerHTML = `
    <div class="admin-bar">
      <div>
        <h1>Product catalog</h1>
        <p class="desc" id="admin-prod-count">Loading products from Supabase…</p>
      </div>
      <div class="admin-bar-actions">
        <button class="btn btn-primary" id="add-new">Add product</button>
        <button class="btn btn-ghost" id="sign-out">Sign out</button>
      </div>
    </div>
    <p class="admin-note">
      Changes are synchronized in real-time with your live Supabase database and secured with Row Level Security (RLS).
    </p>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Actions</th></tr></thead>
        <tbody id="admin-tbody">
          <tr><td colspan="5" style="text-align:center;padding:2rem">Loading catalog…</td></tr>
        </tbody>
      </table>
    </div>
    <dialog id="product-dialog"></dialog>`;

  let list = [];
  try {
    list = await getAllProductsAdmin();
  } catch (err) {
    console.error('[Admin] Failed to load products:', err);
    toast('Error loading catalog from Supabase');
    list = window.PRODUCTS || [];
  }

  const countEl = $('#admin-prod-count');
  if (countEl) countEl.textContent = `${list.length} products live in the database.`;

  const tbody = $('#admin-tbody');
  if (tbody) {
    tbody.innerHTML = list.length
      ? list.map(productRow).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:2rem">No products found. Click "Add product" to create one.</td></tr>';
  }

  const dialog = $('#product-dialog');

  function openForm(product) {
    if (!dialog) return;
    dialog.innerHTML = dialogForm(product);
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
    bindForm(product ? String(product.id) : null);
  }

  function bindForm(editId) {
    const cancelBtn = $('#cancel-form');
    if (cancelBtn) cancelBtn.addEventListener('click', () => dialog.close());

    const prodForm = $('#product-form');
    if (!prodForm) return;

    prodForm.addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = $('#form-err');
      const submitBtn = $('#btn-save-prod');

      const name = $('#f-name').value.trim();
      const priceRaw = $('#f-price').value.trim();
      const price = parseFloat(priceRaw);

      /**
       * Price Validation Zero-Bug Fix:
       * Accepts 0 as a valid price for free or promotional items.
       * Rejects missing string, NaN, or negative prices.
       */
      if (!name || priceRaw === '' || isNaN(price) || price < 0) {
        errEl.textContent = 'A product name is required and price must be 0 or greater (0 is valid for free/promotional items).';
        return;
      }

      // Validate optional original price if provided
      const oldRaw = $('#f-old').value.trim();
      let oldPrice = null;
      if (oldRaw !== '') {
        const parsedOld = parseFloat(oldRaw);
        if (isNaN(parsedOld) || parsedOld < 0) {
          errEl.textContent = 'Original price must be 0 or greater if provided.';
          return;
        }
        oldPrice = parsedOld;
      }

      const ratingVal = parseFloat($('#f-rating').value) || 0;
      const reviewsVal = parseInt($('#f-reviews').value, 10) || 0;
      const catVal = $('#f-cat').value;
      const descVal = $('#f-desc').value.trim();
      const imageVal = $('#f-image').value.trim();
      const isActiveVal = $('#f-active').checked;
      const infoVal = $('#f-info').value
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const payload = {
        name,
        cat: catVal,
        price,
        old: oldPrice,
        rating: Math.max(0, Math.min(5, ratingVal)),
        reviews: Math.max(0, reviewsVal),
        desc: descVal,
        image: imageVal || null,
        info: infoVal,
        is_active: isActiveVal
      };

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
      errEl.textContent = '';

      try {
        if (editId) {
          await updateProduct(editId, payload);
          toast('Product updated successfully');
        } else {
          await addProduct(payload);
          toast('Product added successfully');
        }
        dialog.close();
        renderDashboard();
      } catch (saveErr) {
        console.error('[Admin] Error saving product:', saveErr);
        errEl.textContent = saveErr.message || 'Database error occurred while saving.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save product';
      }
    });
  }

  // Dashboard toolbar actions
  const addBtn = $('#add-new');
  if (addBtn) addBtn.addEventListener('click', () => openForm(null));

  const signOutBtn = $('#sign-out');
  if (signOutBtn) signOutBtn.addEventListener('click', async () => {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    toast('Signed out');
    renderLogin();
  });

  // Edit action (Standardized ID matching without unary + coercion)
  $$('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = String(btn.dataset.edit);
      const product = list.find(p => String(p.id) === targetId);
      if (product) openForm(product);
    });
  });

  // Delete action (Standardized ID matching without unary + coercion)
  $$('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = String(btn.dataset.del);
      const product = list.find(p => String(p.id) === targetId);
      if (!product) return;

      const confirmed = confirm(`Are you sure you want to permanently delete "${product.name}" from the database?`);
      if (confirmed) {
        try {
          await deleteProduct(targetId);
          toast('Product deleted successfully');
          renderDashboard();
        } catch (delErr) {
          console.error('[Admin] Delete error:', delErr);
          toast(delErr.message || 'Failed to delete product');
        }
      }
    });
  });
}

/**
 * Real-time auth session listener and page initialization.
 */
document.addEventListener('DOMContentLoaded', () => {
  checkAuthAndRender();

  // Listen to Supabase Auth state changes
  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        renderLogin();
      }
    });

    // Real-time synchronization for admin catalog updates
    subscribeToProducts(() => {
      const table = $('#admin-tbody');
      if (table) {
        console.info('[Admin Realtime] Product change detected, refreshing dashboard...');
        renderDashboard();
      }
    });
  }
});
