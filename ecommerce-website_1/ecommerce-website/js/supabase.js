/* ==========================================================================
   js/supabase.js – Unified Supabase Client Module & Product Data Service
   ========================================================================== */

/**
 * ------------------------------------------------------------------
 * 1. SUPABASE CONFIGURATION
 * ------------------------------------------------------------------
 * Connected Project: https://hmktzkrsfmtbmprysavt.supabase.co
 */
const SUPABASE_URL = 'https://hmktzkrsfmtbmprysavt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhta3R6a3JzZm10Ym1wcnlzYXZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MDkzOTMsImV4cCI6MjEwODk4NTM5M30.rBOeC2osOcMcNLkva-Fw8KxUddEYIoOWl3VtSuk8kJg';

function getAnonKey() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('supabase_anon_key');
    if (stored && stored.trim() && !stored.includes('YOUR_SUPABASE_ANON_KEY') && stored.startsWith('eyJ')) {
      return stored.trim();
    }
  }
  return SUPABASE_ANON_KEY;
}

function setAnonKey(key) {
  if (typeof window !== 'undefined' && key) {
    localStorage.setItem('supabase_anon_key', key.trim());
    location.reload();
  }
}

/**
 * Verify whether Supabase credentials have been configured.
 */
function isSupabaseConfigured() {
  const url = SUPABASE_URL;
  const key = getAnonKey();
  return Boolean(
    typeof url === 'string' &&
    typeof key === 'string' &&
    url.startsWith('https://') &&
    !url.includes('YOUR_PROJECT_ID') &&
    !key.includes('YOUR_SUPABASE_ANON_KEY') &&
    key.length > 10
  );
}

/**
 * Initialize unified Supabase client.
 */
let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase && isSupabaseConfigured()) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, getAnonKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch (err) {
    console.error('[Supabase] Initialization error:', err);
  }
}

/**
 * ------------------------------------------------------------------
 * 2. SANITIZATION & SECURITY HELPERS (XSS Prevention)
 * ------------------------------------------------------------------
 */

/**
 * Escapes HTML characters in untrusted user strings to prevent XSS.
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes URLs to prevent javascript: and data: pseudo-protocol attacks.
 */
function sanitizeUrl(url, fallback = 'assets/images/placeholder.svg') {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) {
    return fallback;
  }
  return escapeHTML(trimmed);
}

/**
 * Resolves a resilient image path for a product record.
 */
function productImage(p) {
  if (!p) return 'assets/images/placeholder.svg';
  if (p.image && typeof p.image === 'string' && p.image.trim()) {
    return p.image.trim();
  }
  if (p.img && typeof p.img === 'string' && p.img.trim()) {
    return `assets/images/${p.img}.svg`;
  }
  if (p.id && !isNaN(Number(p.id)) && Number(p.id) >= 1 && Number(p.id) <= 16) {
    return `assets/images/p${p.id}.svg`;
  }
  return 'assets/images/placeholder.svg';
}

/**
 * ------------------------------------------------------------------
 * 3. FALLBACK / OFFLINE PRODUCTS (Used when Supabase is unconfigured)
 * ------------------------------------------------------------------
 */
const BASE_CATALOG = [
  { id: '1', name: 'Aero ANC Headphones', cat: 'Electronics', price: 7999, old: 10999, rating: 4.6, reviews: 312, tags: ['best'], desc: 'Wireless over-ear headphones with 40-hour battery.', info: ['Active noise cancelling', 'Bluetooth 5.3', 'USB-C fast charge'], image: 'assets/images/p1.svg', is_active: true },
  { id: '2', name: 'Pulse Smartwatch', cat: 'Electronics', price: 4499, old: 5999, rating: 4.3, reviews: 188, tags: ['trending'], desc: 'Heart-rate, sleep and step tracking on a bright display.', info: ['1.8" AMOLED screen', '7-day battery', 'Water resistant (5 ATM)'], image: 'assets/images/p2.svg', is_active: true },
  { id: '3', name: 'Cube Mini Speaker', cat: 'Electronics', price: 2299, old: null, rating: 4.4, reviews: 97, tags: ['new'], desc: 'Pocket-size Bluetooth speaker with surprisingly full sound.', info: ['12-hour playtime', 'IP67 splash proof', 'Built-in mic'], image: 'assets/images/p3.svg', is_active: true },
  { id: '4', name: 'Tactile Keyboard', cat: 'Electronics', price: 5499, old: 6499, rating: 4.7, reviews: 241, tags: ['best'], desc: 'Compact mechanical keyboard with hot-swappable switches.', info: ['75% layout', 'Wired + Bluetooth', 'Per-key backlight'], image: 'assets/images/p4.svg', is_active: true },
  { id: '5', name: 'Linen Weekend Shirt', cat: 'Clothing', price: 1799, old: null, rating: 4.5, reviews: 156, tags: ['trending'], desc: 'Breathable pure linen shirt with a relaxed fit.', info: ['100% linen', 'Machine washable', 'Sizes S–XXL'], image: 'assets/images/p5.svg', is_active: true },
  { id: '6', name: 'Everyday Hoodie', cat: 'Clothing', price: 2199, old: 2799, rating: 4.6, reviews: 402, tags: ['best'], desc: 'Heavyweight cotton fleece hoodie that keeps its shape.', info: ['380 GSM cotton', 'Kangaroo pocket', 'Pre-shrunk'], image: 'assets/images/p6.svg', is_active: true },
  { id: '7', name: 'Indigo Denim Jacket', cat: 'Clothing', price: 3299, old: null, rating: 4.4, reviews: 73, tags: ['new'], desc: 'Classic trucker jacket in washed indigo denim.', info: ['Stretch denim', 'Button front', 'Two chest pockets'], image: 'assets/images/p7.svg', is_active: true },
  { id: '8', name: 'Merino Beanie', cat: 'Clothing', price: 899, old: 1199, rating: 4.2, reviews: 64, tags: [], desc: 'Soft ribbed beanie that stays warm without itch.', info: ['100% merino wool', 'One size', 'Hand wash'], image: 'assets/images/p8.svg', is_active: true },
  { id: '9', name: 'Atlas Daypack', cat: 'Accessories', price: 3799, old: 4599, rating: 4.8, reviews: 520, tags: ['best'], desc: 'Weatherproof 20L backpack with a padded laptop sleeve.', info: ['Fits 15" laptop', 'Water-resistant fabric', 'Hidden back pocket'], image: 'assets/images/p9.svg', is_active: true },
  { id: '10', name: 'Solis Sunglasses', cat: 'Accessories', price: 1499, old: null, rating: 4.3, reviews: 118, tags: ['trending'], desc: 'Lightweight frames with UV400 polarised lenses.', info: ['Polarised lenses', 'UV400 protection', 'Hard case included'], image: 'assets/images/p10.svg', is_active: true },
  { id: '11', name: 'Slim Leather Wallet', cat: 'Accessories', price: 1299, old: 1699, rating: 4.5, reviews: 209, tags: ['best'], desc: 'Full-grain leather wallet with six card slots.', info: ['RFID blocking', 'Full-grain leather', 'Holds 6 cards + notes'], image: 'assets/images/p11.svg', is_active: true },
  { id: '12', name: 'Canvas Field Cap', cat: 'Accessories', price: 699, old: null, rating: 4.1, reviews: 52, tags: ['new'], desc: 'Six-panel cotton canvas cap with adjustable strap.', info: ['Washed cotton canvas', 'Adjustable strap', 'Unisex'], image: 'assets/images/p12.svg', is_active: true },
  { id: '13', name: 'Stoneware Mug Set', cat: 'Home & Lifestyle', price: 1199, old: 1599, rating: 4.7, reviews: 330, tags: ['best'], desc: 'Set of two hand-glazed mugs, 300 ml each.', info: ['Dishwasher safe', 'Microwave safe', 'Set of 2'], image: 'assets/images/p13.svg', is_active: true },
  { id: '14', name: 'Arc Table Lamp', cat: 'Home & Lifestyle', price: 2599, old: null, rating: 4.4, reviews: 88, tags: ['trending'], desc: 'Warm-light desk lamp with a touch dimmer.', info: ['3 brightness levels', 'LED bulb included', 'USB powered'], image: 'assets/images/p14.svg', is_active: true },
  { id: '15', name: 'Cedar Soy Candle', cat: 'Home & Lifestyle', price: 599, old: null, rating: 4.6, reviews: 143, tags: ['new'], desc: 'Hand-poured soy candle with a woody, calm scent.', info: ['45-hour burn time', '100% soy wax', 'Cotton wick'], image: 'assets/images/p15.svg', is_active: true },
  { id: '16', name: 'Terra Planter', cat: 'Home & Lifestyle', price: 799, old: 999, rating: 4.3, reviews: 61, tags: [], desc: 'Terracotta planter with drainage hole and saucer.', info: ['18 cm diameter', 'Drainage hole', 'Includes saucer'], image: 'assets/images/p16.svg', is_active: true }
];

function getFallbackProducts() {
  return JSON.parse(JSON.stringify(BASE_CATALOG));
}

/**
 * ------------------------------------------------------------------
 * 4. ASYNCHRONOUS DATABASE OPERATIONS (Parameterized Queries)
 * ------------------------------------------------------------------
 */

/**
 * Fetch active products ordered by ID ascending.
 * Public method used across catalog storefront.
 */
async function getProducts() {
  if (!supabaseClient) {
    console.warn('[Supabase] Client unconfigured; serving fallback catalog.');
    return getFallbackProducts().filter(p => p.is_active !== false);
  }

  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (error) {
      console.error('[Supabase] getProducts query failed:', error);
      return getFallbackProducts().filter(p => p.is_active !== false);
    }
    return (data || []).map(normalizeProduct);
  } catch (err) {
    console.error('[Supabase] getProducts unexpected error:', err);
    return getFallbackProducts().filter(p => p.is_active !== false);
  }
}

/**
 * Fetch all products (including inactive) for Admin management.
 */
async function getAllProductsAdmin() {
  if (!supabaseClient) {
    console.warn('[Supabase] Client unconfigured; serving fallback catalog for admin.');
    return getFallbackProducts();
  }

  const { data, error } = await supabaseClient
    .from('products')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('[Supabase] getAllProductsAdmin query failed:', error);
    throw error;
  }
  return (data || []).map(normalizeProduct);
}

/**
 * Fetch a single product by ID (handles UUID and numeric IDs safely).
 */
async function getProductById(id) {
  if (!id) return null;
  const targetId = String(id);

  if (!supabaseClient) {
    return getFallbackProducts().find(p => String(p.id) === targetId) || null;
  }

  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`[Supabase] getProductById(${id}) failed:`, error);
      return null;
    }
    return data ? normalizeProduct(data) : null;
  } catch (err) {
    console.error(`[Supabase] getProductById(${id}) unexpected error:`, err);
    return null;
  }
}

/**
 * Insert a new product via parameterized Supabase client methods.
 */
async function addProduct(data) {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in js/supabase.js.');
  }

  const payload = {
    name: String(data.name || '').trim(),
    cat: String(data.cat || '').trim(),
    price: Number(data.price),
    old: (data.old !== undefined && data.old !== null && data.old !== '') ? Number(data.old) : null,
    rating: data.rating !== undefined ? Number(data.rating) : 4.5,
    reviews: data.reviews !== undefined ? Number(data.reviews) : 0,
    desc: String(data.desc || '').trim(),
    info: Array.isArray(data.info) ? data.info.map(s => String(s).trim()).filter(Boolean) : [],
    image: data.image && String(data.image).trim() ? String(data.image).trim() : null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true
  };

  const { data: created, error } = await supabaseClient
    .from('products')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('[Supabase] addProduct failed:', error);
    throw error;
  }
  return normalizeProduct(created);
}

/**
 * Update an existing product by ID.
 */
async function updateProduct(id, data) {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in js/supabase.js.');
  }

  const payload = {};
  if (data.name !== undefined) payload.name = String(data.name).trim();
  if (data.cat !== undefined) payload.cat = String(data.cat).trim();
  if (data.price !== undefined) payload.price = Number(data.price);
  if (data.old !== undefined) {
    payload.old = (data.old !== null && data.old !== '') ? Number(data.old) : null;
  }
  if (data.rating !== undefined) payload.rating = Number(data.rating);
  if (data.reviews !== undefined) payload.reviews = Number(data.reviews);
  if (data.desc !== undefined) payload.desc = String(data.desc).trim();
  if (data.info !== undefined) {
    payload.info = Array.isArray(data.info) ? data.info.map(s => String(s).trim()).filter(Boolean) : [];
  }
  if (data.image !== undefined) {
    payload.image = data.image && String(data.image).trim() ? String(data.image).trim() : null;
  }
  if (data.tags !== undefined) payload.tags = Array.isArray(data.tags) ? data.tags : [];
  if (data.is_active !== undefined) payload.is_active = Boolean(data.is_active);

  const { data: updated, error } = await supabaseClient
    .from('products')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`[Supabase] updateProduct(${id}) failed:`, error);
    throw error;
  }
  return normalizeProduct(updated);
}

/**
 * Remove a product by ID.
 */
async function deleteProduct(id) {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in js/supabase.js.');
  }

  const { data, error } = await supabaseClient
    .from('products')
    .delete()
    .eq('id', id)
    .select();

  if (error) {
    console.error(`[Supabase] deleteProduct(${id}) failed:`, error);
    throw error;
  }
  return data;
}

/**
 * Ensures product records have uniform types across client scripts.
 */
function normalizeProduct(p) {
  if (!p) return null;
  return {
    ...p,
    id: String(p.id),
    name: p.name || 'Untitled Product',
    cat: p.cat || 'General',
    price: Number(p.price || 0),
    old: p.old !== null && p.old !== undefined ? Number(p.old) : null,
    rating: Number(p.rating || 0),
    reviews: Number(p.reviews || 0),
    desc: p.desc || '',
    info: Array.isArray(p.info) ? p.info : [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    image: p.image || null,
    is_active: p.is_active !== false
  };
}

/**
 * ------------------------------------------------------------------
 * 5. REAL-TIME SYNCHRONIZATION
 * ------------------------------------------------------------------
 * Subscribes to changes on the 'products' table using supabase.channel().
 */
let activeRealtimeChannel = null;

function subscribeToProducts(onChangeCallback) {
  if (!supabaseClient || typeof onChangeCallback !== 'function') {
    return null;
  }

  if (activeRealtimeChannel) {
    try {
      supabaseClient.removeChannel(activeRealtimeChannel);
    } catch (e) {
      /* ignore cleanup error */
    }
  }

  activeRealtimeChannel = supabaseClient
    .channel('storefront-products-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      (payload) => {
        console.info('[Realtime] Product mutation event received:', payload.eventType, payload);
        try {
          onChangeCallback(payload);
        } catch (cbErr) {
          console.error('[Realtime] Error executing subscriber callback:', cbErr);
        }
      }
    )
    .subscribe((status) => {
      console.info('[Realtime] Subscription status:', status);
    });

  return activeRealtimeChannel;
}

/**
 * Expose client and services to the window object for global availability.
 */
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.getAnonKey = getAnonKey;
window.setAnonKey = setAnonKey;
window.isSupabaseConfigured = isSupabaseConfigured;
window.supabaseClient = supabaseClient;
window.getProducts = getProducts;
window.getAllProductsAdmin = getAllProductsAdmin;
window.getProductById = getProductById;
window.addProduct = addProduct;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.subscribeToProducts = subscribeToProducts;
window.escapeHTML = escapeHTML;
window.sanitizeUrl = sanitizeUrl;
window.productImage = productImage;
window.getFallbackProducts = getFallbackProducts;
