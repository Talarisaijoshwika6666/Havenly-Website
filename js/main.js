const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let processingTimer = 0;

function scopedStorageKey(key) {
  const user = window.HavenlyAuth?.getCurrentUser();
  return key === 'havenly-studio' && user ? `${key}:${user.id}` : key;
}

const storage = {
  get(key, fallback) {
    try {
      const storageKey = scopedStorageKey(key);
      const value = localStorage.getItem(storageKey);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.error(`Could not read Havenly data "${key}".`, error);
      toast('Saved browser data could not be read. Some demo features may be unavailable.');
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(scopedStorageKey(key), JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save Havenly data "${key}".`, error);
      toast('Your browser could not save this change. Check its storage settings.');
      return false;
    }
  }
};

const catalog = [
  ['sofa', 'Sofa', 'Furniture', 1280, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80'],
  ['accent-chair', 'Accent Chair', 'Furniture', 540, 'https://images.unsplash.com/photo-1512212621149-107ffe572d2f?auto=format&fit=crop&w=900&q=80'],
  ['coffee-table', 'Coffee Table', 'Furniture', 700, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'],
  ['pendant-light', 'Pendant Light', 'Lighting', 260, 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=80'],
  ['floor-lamp', 'Floor Lamp', 'Lighting', 390, 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80'],
  ['wall-art', 'Wall Art', 'Décor', 180, 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=900&q=80'],
  ['rug', 'Rug', 'Textiles', 220, 'https://images.unsplash.com/photo-1549187774-b4e9b0445b41?auto=format&fit=crop&w=900&q=80'],
  ['side-table', 'Side Table', 'Furniture', 340, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'],
  ['ceramic-vase', 'Ceramic Vase', 'Décor', 120, 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=80'],
  ['blackout-curtains', 'Blackout Curtains', 'Textiles', 190, 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80'],
  ['console-table', 'Console Table', 'Furniture', 890, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'],
  ['abstract-wall-art', 'Abstract Wall Art', 'Wall Art', 210, 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=900&q=80']
].map(([id, name, category, price, image]) => ({ id, name, category, price, image }));

function toast(message) {
  let element = $('.toast');
  if (!element) {
    element = document.createElement('div');
    element.className = 'toast';
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    document.body.append(element);
  }
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(element.hideTimer);
  element.hideTimer = setTimeout(() => element.classList.remove('show'), 2800);
}
window.havenlyToast = toast;

function getList(key) {
  const items = storage.get(key, []);
  if (!Array.isArray(items)) {
    console.error(`Havenly data "${key}" must be a list.`);
    toast('Saved browser data is invalid. This page is using an empty list.');
    return [];
  }
  return items.map(item => {
    if (typeof item === 'string') return catalog.find(product => product.id === item);
    return item;
  }).filter(Boolean);
}

function setList(key, items) {
  const saved = storage.set(key, items);
  if (saved && ['havenly-cart', 'havenly-wishlist'].includes(key)) {
    const user = window.HavenlyAuth?.getCurrentUser();
    if (user) window.HavenlyAuth.updateUser(user.id, { [key === 'havenly-cart' ? 'cart' : 'wishlist']: items });
    else storage.set(key === 'havenly-cart' ? 'havenly_guest_cart' : 'havenly_guest_wishlist', items);
  }
  return saved;
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function setupTheme() {
  const theme = storage.get('havenly-theme', 'light');
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('ai-dark', theme === 'dark' || (theme === 'system' && systemDark));
  if (theme === 'system') {
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', event => document.body.classList.toggle('ai-dark', event.matches));
  }
  $$('.theme-toggle').forEach(button => {
    button.setAttribute('aria-label', 'Toggle dark theme');
    button.setAttribute('aria-pressed', String(document.body.classList.contains('ai-dark')));
  });
  if (setupTheme.bound) return;
  document.addEventListener('click', event => {
    const button = event.target.closest('.theme-toggle');
    if (!button) return;
    const isDark = document.body.classList.toggle('ai-dark');
    $$('.theme-toggle').forEach(toggle => toggle.setAttribute('aria-pressed', String(isDark)));
    storage.set('havenly-theme', isDark ? 'dark' : 'light');
    const user = window.HavenlyAuth?.getCurrentUser();
    if (user) window.HavenlyAuth.updateUser(user.id, { preferences: { ...user.preferences, appearance: isDark ? 'dark' : 'light' } });
  });
  setupTheme.bound = true;
}

function setupAssistant() {
  const fab = $('.ai-fab');
  const chat = $('.ai-chat');
  if (!fab || !chat) return;
  fab.setAttribute('aria-expanded', 'false');
  let close = $('.ai-chat-close', chat);
  if (!close) {
    close = makeElement('button', 'ai-chat-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close Havenly AI Assistant');
    $('.ai-chat-head', chat)?.append(close);
  }
  const closeChat = () => {
    chat.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
    fab.focus();
  };
  close.addEventListener('click', closeChat);
  fab.addEventListener('click', () => {
    const isOpen = chat.classList.toggle('open');
    fab.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) $('.ai-chat-form input', chat)?.focus();
  });
  $('.ai-chat-form', chat)?.addEventListener('submit', event => {
    event.preventDefault();
    const input = $('input', event.currentTarget);
    const question = input.value.trim();
    if (!question) return;
    const body = $('.ai-chat-body', chat);
    const userMessage = document.createElement('div');
    userMessage.className = 'ai-msg';
    userMessage.textContent = `You: ${question}`;
    const response = document.createElement('div');
    response.className = 'ai-msg';
    response.textContent = `Havenly AI demo: ${assistantResponse(question)} This is a guided prototype, not a live AI service.`;
    body.append(userMessage, response);
    input.value = '';
    body.scrollTop = body.scrollHeight;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && chat.classList.contains('open')) closeChat();
  });
}

function assistantResponse(question) {
  if (/budget|price/i.test(question)) return 'I can help outline a room plan around your budget and prioritize high-impact pieces.';
  if (/color|colour|palette/i.test(question)) return 'Try a balanced palette with warm ivory, walnut, muted sage and one accent colour.';
  if (/bedroom/i.test(question)) return 'For a bedroom, consider layered warm lighting, soft textiles, hidden storage and a calm focal wall.';
  return 'I can help you think through room styles, furniture pairings, palettes, layouts and budget planning.';
}

function productFromCard(card) {
  const name = $('h3', card)?.textContent.trim() || 'Havenly product';
  const category = $('.product-category', card)?.textContent.trim() || 'Home';
  const rawPrice = $('.product-price', card)?.textContent || '';
  const price = Number(rawPrice.replace(/[^\d.]/g, ''));
  const image = $('img', card)?.getAttribute('src') || '';
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { id, name, category, price: Number.isFinite(price) ? price : 0, image, quantity: 1 };
}

function updateHeaderCounts() {
  const totals = {
    cart: getList('havenly-cart').reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0),
    wishlist: getList('havenly-wishlist').length
  };
  $$('a[href="cart.html"]').forEach(link => addCount(link, totals.cart, 'cart'));
  $$('a[href="wishlist.html"]').forEach(link => addCount(link, totals.wishlist, 'wishlist'));
}

function addCount(link, count, name) {
  let badge = $('.nav-count', link);
  if (count === 0) {
    badge?.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'nav-count';
    link.append(badge);
  }
  badge.textContent = String(count);
  badge.setAttribute('aria-label', `${count} ${name} ${count === 1 ? 'item' : 'items'}`);
}

function saveProduct(key, product) {
  const items = getList(key);
  const existing = items.find(item => item.id === product.id);
  if (existing && key === 'havenly-cart') {
    existing.quantity = (Number(existing.quantity) || 1) + 1;
  } else if (!existing) {
    items.push({ ...product });
  }
  if (setList(key, items)) {
    updateHeaderCounts();
    if (key === 'havenly-cart') renderCart();
    if (key === 'havenly-wishlist') renderWishlist();
    toast(key === 'havenly-cart' ? `${product.name} added to your cart.` : `${product.name} saved to your wishlist.`);
    if (key === 'havenly-wishlist') window.HavenlyAuth?.notify(`${product.name} added to your wishlist.`, 'wishlist');
  }
}

function setupProducts() {
  const cards = $$('.product-card');
  if (!cards.length) return;

  cards.forEach(card => {
    const product = productFromCard(card);
    const favorite = $('.product-favorite', card);
    if (favorite) {
      favorite.dataset.productId = product.id;
      favorite.setAttribute('aria-label', `Add ${product.name} to wishlist`);
      const isSaved = getList('havenly-wishlist').some(item => item.id === product.id);
      favorite.setAttribute('aria-pressed', String(isSaved));
      if (isSaved) favorite.classList.add('is-saved');
    }
    const oldAction = $('.product-content .btn', card);
    if (oldAction) {
      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className = oldAction.className;
      addButton.dataset.addToCart = product.id;
      addButton.textContent = 'Add to Cart';
      const detailsLink = document.createElement('a');
      detailsLink.className = 'btn btn-secondary btn-small';
      detailsLink.href = `product-details.html?id=${encodeURIComponent(product.id)}`;
      detailsLink.textContent = 'View Details';
      const actions = makeElement('div', 'product-card-actions');
      const quickView = makeElement('button', 'btn btn-secondary btn-small', 'Quick View');
      quickView.type = 'button';
      quickView.dataset.quickView = product.id;
      const compare = makeElement('button', 'btn btn-secondary btn-small', 'Compare');
      compare.type = 'button';
      compare.dataset.compareProduct = product.id;
      actions.append(detailsLink, quickView, compare, addButton);
      oldAction.replaceWith(actions);
    }
  });

  const toolbar = $('.product-toolbar');
  const productGrid = $('.products-layout');
  if (toolbar && productGrid) {
    productGrid.id = 'product-list';
    const controls = document.createElement('div');
    controls.className = 'product-search-controls';
    controls.innerHTML = '<label class="sr-only" for="product-search">Search products</label><input id="product-search" type="search" placeholder="Search products..." autocomplete="off"><label class="sr-only" for="product-sort">Sort products</label><select id="product-sort"><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name: A to Z</option></select>';
    toolbar.append(controls);
    $('#product-search', controls).addEventListener('input', filterProducts);
    $('#product-sort', controls).addEventListener('change', sortProducts);
    addActionLink(toolbar, 'Compare selected', 'compare.html', 'btn btn-secondary btn-small');
    const pagination = makeElement('nav', 'pagination');
    pagination.setAttribute('aria-label', 'Product pages');
    productGrid.after(pagination);
    const style = window.HavenlyAuth?.getCurrentUser()?.preferences?.favoriteStyle;
    if (style) toolbar.prepend(makeElement('p', 'recommendation-banner', `Rules-based demo recommendations for your ${style} style · AI Match 94%`));
  }
  const params = new URLSearchParams(location.search);
  if (params.has('category')) {
    const requestedCategory = params.get('category').toLowerCase();
    const categoryButton = $$('.category-pill').find(pill => pill.textContent.trim().toLowerCase() === requestedCategory);
    if (categoryButton) {
      $$('.category-pill').forEach(pill => pill.classList.toggle('active', pill === categoryButton));
    }
  }
  $$('.category-pill').forEach(pill => pill.addEventListener('click', event => {
    event.preventDefault();
    $$('.category-pill').forEach(item => item.classList.remove('active'));
    pill.classList.add('active');
    filterProducts();
  }));
  filterProducts();
}

function setupSearchNavigation() {
  $$('a.nav-icon[aria-label="Search"]').forEach(link => {
    link.href = '#search';
    link.setAttribute('aria-label', 'Search products, rooms and styles');
  });
  if (location.hash === '#product-search') {
    $('#product-search')?.focus();
  }
}

function filterProducts() {
  const query = ($('#product-search')?.value || '').trim().toLowerCase();
  const category = $('.category-pill.active')?.textContent.trim().toLowerCase() || 'all';
  let page = 1;
  $$('.product-card').forEach(card => {
    const product = productFromCard(card);
    const matchesQuery = `${product.name} ${product.category}`.toLowerCase().includes(query);
    const matchesCategory = category === 'all' || product.category.toLowerCase() === category;
    card.dataset.filteredOut = String(!matchesQuery || !matchesCategory);
  });
  renderProducts(page);
}

function renderProducts(requestedPage = 1) {
  const grid = $('.products-layout');
  if (!grid) return;
  const itemsPerPage = 6;
  const cards = $$('.product-card', grid);
  const visible = cards.filter(card => card.dataset.filteredOut !== 'true');
  const pageCount = Math.max(1, Math.ceil(visible.length / itemsPerPage));
  const currentPage = Math.min(Math.max(1, requestedPage), pageCount);
  let shown = 0;
  cards.forEach(card => {
    const eligible = card.dataset.filteredOut !== 'true';
    card.hidden = !eligible || shown < (currentPage - 1) * itemsPerPage || shown >= currentPage * itemsPerPage;
    if (eligible) shown += 1;
  });
  let empty = $('.product-no-results');
  if (!visible.length) {
    if (!empty) {
      empty = makeElement('p', 'product-no-results', 'No products match those filters. Try another search or category.');
      empty.setAttribute('role', 'status');
      grid.after(empty);
    }
  } else empty?.remove();
  const pagination = $('.pagination');
  if (!pagination) return;
  pagination.replaceChildren();
  if (pageCount <= 1) return;
  const addPageButton = (label, page, disabled = false, current = false) => {
    const button = makeElement('button', current ? 'active' : '', label);
    button.type = 'button';
    button.disabled = disabled;
    button.setAttribute('aria-label', /^\d+$/.test(label) ? `Page ${label}` : label);
    if (current) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => {
      renderProducts(page);
      window.scrollTo(0, 0);
    });
    pagination.append(button);
  };
  addPageButton('← Previous', currentPage - 1, currentPage === 1);
  for (let page = 1; page <= pageCount; page += 1) addPageButton(String(page), page, false, page === currentPage);
  addPageButton('Next →', currentPage + 1, currentPage === pageCount);
}

function sortProducts() {
  const grid = $('.products-layout');
  if (!grid) return;
  const sort = $('#product-sort')?.value;
  const cards = $$('.product-card', grid);
  cards.sort((left, right) => {
    const a = productFromCard(left);
    const b = productFromCard(right);
    if (sort === 'price-asc') return a.price - b.price;
    if (sort === 'price-desc') return b.price - a.price;
    if (sort === 'name') return a.name.localeCompare(b.name);
    return catalog.findIndex(item => item.id === a.id) - catalog.findIndex(item => item.id === b.id);
  }).forEach(card => grid.append(card));
  renderProducts(1);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderCart() {
  const container = $('.cart-items');
  if (!container) return;
  const items = getList('havenly-cart');
  container.replaceChildren();
  let subtotal = 0;
  items.forEach(item => {
    item.quantity = Math.max(1, Number(item.quantity) || 1);
    subtotal += (Number(item.price) || 0) * item.quantity;
    const article = makeElement('article', 'cart-item');
    const image = document.createElement('img');
    image.src = item.image;
    image.alt = item.name;
    const content = makeElement('div', 'cart-item-content');
    content.append(makeElement('h3', '', item.name), makeElement('p', '', item.category));
    const controls = makeElement('div', 'cart-controls');
    const label = makeElement('label', '', 'Qty');
    const quantity = document.createElement('input');
    quantity.type = 'number';
    quantity.min = '1';
    quantity.max = '99';
    quantity.value = String(item.quantity);
    quantity.setAttribute('aria-label', `Quantity for ${item.name}`);
    quantity.addEventListener('change', () => {
      const updated = getList('havenly-cart');
      const match = updated.find(entry => entry.id === item.id);
      if (!match) return;
      match.quantity = Math.min(99, Math.max(1, Number(quantity.value) || 1));
      setList('havenly-cart', updated);
      renderCart();
      updateHeaderCounts();
    });
    const remove = makeElement('button', 'text-button', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => removeProduct('havenly-cart', item.id));
    controls.append(label, quantity, remove);
    content.append(controls);
    article.append(image, content, makeElement('div', 'product-price', formatPrice((Number(item.price) || 0) * item.quantity)));
    container.append(article);
  });

  if (!items.length) {
    const empty = makeElement('div', 'empty-state');
    empty.append(makeElement('h2', '', 'Your cart is empty.'), makeElement('p', '', 'Find pieces you love and add them to your cart.'));
    const browse = document.createElement('a');
    browse.href = 'products.html';
    browse.className = 'btn btn-primary';
    browse.textContent = 'Browse the Shop';
    empty.append(browse);
    container.append(empty);
  }

  const summary = $('.summary-card');
  if (summary) {
    const rows = $$('.summary-row', summary);
    if (rows[0]) rows[0].lastElementChild.textContent = formatPrice(subtotal);
    if (rows[1]) rows[1].lastElementChild.textContent = subtotal === 0 || subtotal >= 2000 ? 'Free' : formatPrice(80);
    if (rows[2]) rows[2].lastElementChild.textContent = formatPrice(subtotal + (subtotal > 0 && subtotal < 2000 ? 80 : 0));
    const checkout = $('a[href="checkout.html"]', summary);
    if (checkout) {
      checkout.setAttribute('aria-disabled', String(items.length === 0));
      checkout.classList.toggle('is-disabled', items.length === 0);
    }
  }
  const badge = $('.page-badges');
  if (badge) {
    const first = badge.firstElementChild;
    if (first) first.textContent = `${items.reduce((sum, item) => sum + item.quantity, 0)} Items`;
  }
}

function renderWishlist() {
  const grid = $('.wishlist-grid');
  if (!grid) return;
  const items = getList('havenly-wishlist');
  grid.replaceChildren();
  items.forEach(item => {
    const article = makeElement('article', 'wishlist-card');
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    image.src = item.image;
    image.alt = item.name;
    figure.append(image);
    const content = makeElement('div', 'wishlist-content');
    content.append(makeElement('h3', '', item.name), makeElement('p', 'product-price', formatPrice(item.price)));
    const actions = makeElement('div', 'wishlist-actions');
    const remove = makeElement('button', 'btn btn-secondary btn-small', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => removeProduct('havenly-wishlist', item.id));
    const move = makeElement('button', 'btn btn-primary btn-small', 'Move to Cart');
    move.type = 'button';
    move.addEventListener('click', () => {
      const cart = getList('havenly-cart');
      const existing = cart.find(entry => entry.id === item.id);
      if (existing) existing.quantity = (Number(existing.quantity) || 1) + 1;
      else cart.push({ ...item, quantity: 1 });
      const remaining = getList('havenly-wishlist').filter(entry => entry.id !== item.id);
      if (setList('havenly-cart', cart) && setList('havenly-wishlist', remaining)) {
        renderWishlist();
        renderCart();
        updateHeaderCounts();
        toast(`${item.name} moved to your cart.`);
      }
    });
    actions.append(remove, move);
    content.append(actions);
    article.append(figure, content);
    grid.append(article);
  });
  const empty = $('.empty-state');
  if (empty) empty.hidden = items.length > 0;
}

function removeProduct(key, id) {
  const items = getList(key).filter(item => item.id !== id);
  if (!setList(key, items)) return;
  if (key === 'havenly-cart') renderCart();
  else renderWishlist();
  updateHeaderCounts();
  toast('Item removed.');
  if (key === 'havenly-wishlist') window.HavenlyAuth?.notify('Product removed from your wishlist.', 'wishlist');
}

function setupForms() {
  $$('form').forEach(form => {
    if (['signup-form', 'login-form', 'forgot-form', 'reset-form', 'account-edit-form', 'settings-form', 'change-password-form'].includes(form.id)) return;
    if (form.classList.contains('ai-chat-form') || form.id === 'design-form') return;
    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    $$('input[type="date"]', form).forEach(input => {
      input.min = localDate;
    });
    const type = form.getAttribute('aria-label');
    if (type === 'Login form') {
      $('#login-email', form).required = true;
      $('#login-password', form).required = true;
    } else if (type === 'Sign up form') {
      $('#signup-name', form).required = true;
      $('#signup-email', form).required = true;
      $('#signup-password', form).required = true;
      $('#signup-password', form).minLength = 8;
      $('#signup-confirm', form).required = true;
      $('input[name="terms"]', form).required = true;
    } else {
      $$('input:not([type="checkbox"]):not([type="range"]):not([type="color"]), textarea', form).forEach(field => {
        if (field.type !== 'file') field.required = true;
      });
    }
    form.addEventListener('submit', event => {
      if (!form.reportValidity()) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      if (type === 'Sign up form') {
        const password = $('#signup-password', form).value;
        const confirmation = $('#signup-confirm', form).value;
        if (password !== confirmation) {
          $('#signup-confirm', form).setCustomValidity('Passwords do not match.');
          $('#signup-confirm', form).reportValidity();
          $('#signup-confirm', form).addEventListener('input', () => $('#signup-confirm', form).setCustomValidity(''), { once: true });
          return;
        }
        const profile = { name: $('#signup-name', form).value.trim(), email: $('#signup-email', form).value.trim() };
        if (storage.set('havenly-demo-profile', profile)) {
          toast('Demo profile saved in this browser. Connect a backend to enable secure accounts and sign-in.');
          form.reset();
        }
        return;
      }
      if (type === 'Login form') {
        toast('Secure sign-in is unavailable in this frontend demo. Connect an authentication backend.');
        return;
      }
      if (type === 'Contact form') {
        const messages = storage.get('havenly-demo-messages', []);
        if (!Array.isArray(messages)) {
          toast('The message could not be recorded because the saved demo data is invalid.');
          return;
        }
        const message = {
          name: $('#contact-name', form)?.value.trim(),
          email: $('#contact-email', form)?.value.trim(),
          subject: $('#contact-subject', form)?.value.trim(),
          message: $('#contact-message', form)?.value.trim(),
          createdAt: new Date().toISOString()
        };
        if (!storage.set('havenly-demo-messages', [message, ...messages].slice(0, 20))) return;
        toast('Thank you. Your message has been recorded in this demo.');
        form.reset();
        return;
      }
      toast('Form validated locally. Connect a backend to receive and process submissions.');
    });
  });
}

function setupProfile() {
  const profile = storage.get('havenly-demo-profile', null);
  if (profile && typeof profile === 'object') {
    const heading = $('.profile-overview h2');
    const email = $('.profile-overview p');
    const welcome = $('.hero-info .page-title');
    if (heading) heading.textContent = profile.name || 'Havenly member';
    if (email) email.textContent = profile.email || '';
    if (welcome) welcome.textContent = `Welcome back, ${profile.name ? profile.name.split(' ')[0] : 'home'}.`;
  }
  const profileCards = $$('.profile-body .profile-card');
  const designs = storage.get('havenly-designs', []);
  if (profileCards[0] && Array.isArray(designs)) {
    const list = $('ul', profileCards[0]);
    if (list) {
      list.replaceChildren();
      if (!designs.length) list.append(makeElement('li', '', 'No saved design concepts yet.'));
      designs.forEach(design => {
        const item = makeElement('li');
        item.append(makeElement('span', '', `${design.style} ${design.room}`), makeElement('strong', '', 'Saved'));
        list.append(item);
      });
    }
  }
  if (profileCards[1]) {
    const list = $('ul', profileCards[1]);
    if (list) {
      const wishlist = getList('havenly-wishlist');
      list.replaceChildren();
      if (!wishlist.length) list.append(makeElement('li', '', 'No wishlist items yet.'));
      wishlist.forEach(product => {
        const item = makeElement('li');
        item.append(makeElement('span', '', product.name), makeElement('strong', '', formatPrice(product.price)));
        list.append(item);
      });
    }
  }
  const designsList = $('#profile-design-list');
  if (designsList && Array.isArray(designs)) {
    designsList.replaceChildren();
    if (!designs.length) designsList.append(makeElement('li', '', 'No saved design concepts yet.'));
    designs.forEach(design => {
      const item = makeElement('li');
      item.append(makeElement('span', '', `${design.style || 'Room'} ${design.room || 'Design'}`), makeElement('strong', '', 'Saved'));
      designsList.append(item);
    });
  }
  const wishlistList = $('#profile-wishlist-list');
  if (wishlistList) {
    const wishlist = getList('havenly-wishlist');
    wishlistList.replaceChildren();
    if (!wishlist.length) wishlistList.append(makeElement('li', '', 'No saved products yet.'));
    wishlist.forEach(product => {
      const item = makeElement('li');
      item.append(makeElement('span', '', product.name), makeElement('strong', '', formatPrice(product.price)));
      wishlistList.append(item);
    });
  }
  $$('.sidebar-nav a').forEach(link => {
    const section = link.textContent.trim().toLowerCase();
    if (section === 'wishlist') link.href = 'wishlist.html';
    if (section === 'my designs') link.href = 'ai-studio.html';
    if (section === 'orders' || section === 'consultations' || section === 'settings') {
      link.addEventListener('click', event => {
        event.preventDefault();
        toast(`${section[0].toUpperCase()}${section.slice(1)} need a connected account backend.`);
      });
    }
    if (section === 'logout') {
      link.addEventListener('click', event => {
        event.preventDefault();
        try {
          localStorage.removeItem('havenly-demo-profile');
          toast('Demo profile cleared from this browser.');
          setTimeout(() => location.reload(), 600);
        } catch (error) {
          console.error('Could not clear the local demo profile.', error);
          toast('The browser could not clear this profile.');
        }
      });
    }
  });
}

function setupUnavailableControls() {
  $$('footer a[href="#"]').forEach(link => {
    const label = link.textContent.trim();
    if (label === 'FAQ') {
      link.href = 'contact.html#faq';
      return;
    }
    const text = makeElement('span', '', label);
    text.title = `${label} is not connected in this frontend demo.`;
    link.replaceWith(text);
  });
  $('.form-links a[href="#"]')?.addEventListener('click', event => {
    event.preventDefault();
    toast('Password recovery requires a connected authentication backend.');
  });
  $('.google-btn')?.addEventListener('click', () => toast('Google sign-in requires OAuth configuration on a backend.'));
  $('.profile-header > .btn')?.addEventListener('click', () => toast('Profile editing requires an account backend.'));
  $('#demo-logout')?.addEventListener('click', () => {
    try {
      localStorage.removeItem('havenly-demo-profile');
      toast('Demo profile cleared.');
    } catch (error) {
      console.error('Could not clear the demo profile.', error);
      toast('The browser could not clear this profile.');
    }
  });
  $('#save-storage')?.addEventListener('click', () => {
    const value = $('#storage-note')?.value || '';
    if (storage.set('havenly-fsd-demo', value)) {
      try {
        sessionStorage.setItem('havenly-fsd-session', value);
        toast('Saved to localStorage and sessionStorage.');
      } catch (error) {
        console.error('Could not write sessionStorage demo data.', error);
        toast('Local storage saved, but session storage is unavailable.');
      }
    }
  });
  $('#read-storage')?.addEventListener('click', () => {
    let sessionValue = 'unavailable';
    try {
      sessionValue = sessionStorage.getItem('havenly-fsd-session') || 'empty';
    } catch (error) {
      console.error('Could not read sessionStorage demo data.', error);
    }
    const status = $('#storage-status');
    if (status) status.textContent = `localStorage: ${storage.get('havenly-fsd-demo', 'empty')} · sessionStorage: ${sessionValue}`;
  });
}

function setupStudio() {
  const form = $('#design-form');
  if (!form) return;
  const imageInput = $('input[type="file"]', form);
  let previewUrl = '';
  imageInput?.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      imageInput.value = '';
      toast('Choose a valid image file.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    let preview = $('.room-upload-preview', form);
    if (!preview) {
      preview = document.createElement('img');
      preview.className = 'room-upload-preview';
      preview.alt = 'Selected room preview';
      imageInput.after(preview);
    }
    preview.src = previewUrl;
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const room = $('#room', form).value;
    const style = $('#style', form).value;
    const mood = $('#mood', form).value;
    const budget = Number($('#budget', form).value);
    if (!Number.isFinite(budget) || budget < 5000) {
      $('#budget', form).setCustomValidity('Enter a budget of at least ₹5,000.');
      $('#budget', form).reportValidity();
      $('#budget', form).addEventListener('input', () => $('#budget', form).setCustomValidity(''), { once: true });
      return;
    }
    const prompt = $('#prompt', form).value.trim();
    $('#concept-title').textContent = `${style} ${room}`;
    const result = $('#ai-result');
    result.replaceChildren();
    result.append(
      makeElement('strong', '', `${mood} ${style} concept`),
      makeElement('p', '', 'Plan a balanced focal layout with layered lighting, tactile materials and purposeful negative space.'),
      makeElement('p', '', `Suggested budget: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(budget)}. ${prompt ? `Your brief: ${prompt}` : ''}`),
      makeElement('p', '', 'Prototype suggestion only — this is not generated by a live AI model.')
    );
    const recommendations = $('#recommendations');
    recommendations.replaceChildren(
      makeElement('li', '', 'Choose one statement piece that anchors the room.'),
      makeElement('li', '', 'Layer ambient, task and accent lighting.'),
      makeElement('li', '', 'Keep 10% of the budget for décor and finishing.')
    );
    let saveButton = $('#save-design');
    if (!saveButton) {
      saveButton = makeElement('button', 'btn btn-secondary', 'Save Concept');
      saveButton.type = 'button';
      saveButton.id = 'save-design';
      recommendations.after(saveButton);
    }
    const concept = { room, style, mood, budget, prompt, createdAt: new Date().toISOString() };
    saveButton.onclick = () => {
      const designs = storage.get('havenly-designs', []);
      if (!Array.isArray(designs)) {
        toast('Saved design data is invalid. Unable to save this concept.');
        return;
      }
      designs.unshift(concept);
      if (storage.set('havenly-designs', designs.slice(0, 20))) toast('Concept saved in this browser.');
    };
    toast('Design concept prepared in prototype mode. No AI service was called.');
  });
}

function setupCheckout() {
  const checkout = $('.summary-card a[href="checkout.html"]');
  if (!checkout) return;
  checkout.addEventListener('click', event => {
    event.preventDefault();
    if (getList('havenly-cart').length === 0) {
      toast('Add a product before checkout.');
      return;
    }
    if (!window.HavenlyAuth?.isLoggedIn()) {
      location.href = `login.html?returnTo=${encodeURIComponent('checkout.html')}`;
      return;
    }
    location.href = 'checkout.html';
  });
}

const roomDetails = {
  'living-room': ['Living Room', 'Modern comfort', 'A welcoming focal point, layered seating and flexible light make this gathering space easy to live in.', 'Warm ivory · Walnut · Sage', 'Sofa, accent chair, coffee table', '₹50,000–₹2,00,000'],
  bedroom: ['Bedroom', 'Calm retreat', 'Create a restful sanctuary with tactile linens, useful storage and warm layered lighting.', 'Oat · Clay · Soft olive', 'Bed frame, bedside tables, soft rug', '₹40,000–₹1,80,000'],
  kitchen: ['Kitchen', 'Thoughtful function', 'Balance durable finishes, clear work zones and inviting details for an everyday kitchen.', 'Cream · Oak · Deep green', 'Dining stools, pendant lighting, storage', '₹60,000–₹2,50,000'],
  'dining-room': ['Dining Room', 'Gathering space', 'A strong table, comfortable seating and considered lighting turn meals into moments.', 'Linen · Natural wood · Terracotta', 'Dining table, chairs, pendant light', '₹45,000–₹2,00,000'],
  'study-room': ['Study Room', 'Focused and grounded', 'Build a focused corner with comfortable seating, task light and calm, organized storage.', 'Warm white · Walnut · Ink blue', 'Desk, ergonomic chair, task light', '₹25,000–₹1,00,000'],
  office: ['Office', 'Productive workspace', 'A practical workspace pairs ergonomic essentials with a comfortable and personal finish.', 'Stone · Oak · Forest green', 'Desk, office chair, task and ambient lighting', '₹30,000–₹1,50,000']
};
const roomDemoImages = {
  'Living Room': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80',
  Bedroom: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
  Kitchen: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80',
  'Dining Room': 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80',
  'Study Room': 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
  Office: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80'
};
const roomRecommendations = {
  'Living Room': [
    ['Anchor the room with one statement piece.', 'Layer ambient, task and accent lighting.', 'Balance natural texture with a calm palette.'],
    ['Create a comfortable seating focal point.', 'Layer warm light for different times of day.', 'Mix tactile materials with a calm palette.']
  ],
  Bedroom: [
    ['Keep the bed as the visual focal point.', 'Use warm layered lighting.', 'Add soft textiles for comfort.'],
    ['Choose a restful palette around the bed.', 'Add gentle bedside and ambient lighting.', 'Layer linens and soft textures.']
  ],
  Kitchen: [
    ['Prioritize clear preparation space.', 'Use practical task lighting.', 'Keep storage visually organized.'],
    ['Keep work zones open and easy to use.', 'Light counters for everyday tasks.', 'Choose useful, uncluttered storage.']
  ],
  'Dining Room': [
    ['Center the design around the dining table.', 'Add a pendant light above the table.', 'Keep circulation space comfortable.'],
    ['Choose a table as the room’s focal point.', 'Use warm pendant lighting overhead.', 'Leave comfortable space around seating.']
  ],
  'Study Room': [
    ['Prioritize an ergonomic workspace.', 'Use focused task lighting.', 'Keep visual distractions minimal.'],
    ['Set up a supportive desk and chair.', 'Add clear, focused task lighting.', 'Keep the work surface organized.']
  ],
  Office: [
    ['Use an ergonomic desk layout.', 'Provide practical storage.', 'Balance professional design with comfort.'],
    ['Arrange a comfortable, ergonomic workstation.', 'Keep everyday storage close at hand.', 'Add warm details to balance the workspace.']
  ]
};
let studioRecommendationVersion = 0;

function resolveStudioRoom(room) {
  const normalized = String(room || 'Living Room').trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const selected = Object.keys(roomDemoImages).find(name => name.toLowerCase() === normalized)
    || (normalized === 'study' ? 'Study Room' : null)
    || (normalized === 'home office' ? 'Office' : null);
  const name = selected || 'Living Room';
  return { name, image: roomDemoImages[name] };
}

const styleDetails = {
  modern: ['Modern', 'Clean lines, sculptural forms and a balance of warmth and polish.', 'Ivory · Charcoal · Walnut', 'Stone, glass, refined wood', 'Streamlined sofas and sculptural tables', 'Architectural pendants'],
  minimalist: ['Minimalist', 'Thoughtful restraint, quiet textures and a beautifully edited palette.', 'Warm white · Sand · Black', 'Linen, oak, plaster', 'Simple silhouettes and hidden storage', 'Soft, indirect lighting'],
  luxury: ['Luxury', 'Rich materials, elevated finishes and confident statement details.', 'Ivory · Brass · Deep green', 'Marble, velvet, brass', 'Tailored upholstery and statement tables', 'Sculptural chandeliers'],
  japandi: ['Japandi', 'Japanese simplicity meets Scandinavian warmth through natural materials and calm forms.', 'Oat · Clay · Charcoal', 'Oak, paper, linen', 'Low-profile furniture and simple storage', 'Warm diffused lamps'],
  scandinavian: ['Scandinavian', 'Soft neutrals, natural light and timeless everyday comfort.', 'White · Birch · Sage', 'Light timber, wool, cotton', 'Practical pale-wood furniture', 'Lightweight pendants'],
  bohemian: ['Bohemian', 'Layered textures, collected treasures and a relaxed, expressive palette.', 'Rust · Ochre · Teal', 'Rattan, cotton, jute', 'Vintage-inspired pieces and layered textiles', 'Woven pendants and ambient lamps'],
  industrial: ['Industrial', 'Honest structure and clean utility pair with warm tactile accents.', 'Charcoal · Brick · Tobacco', 'Metal, leather, reclaimed wood', 'Robust simple forms', 'Metal task lights'],
  biophilic: ['Biophilic', 'Natural light, organic shapes and greenery bring a restorative feeling indoors.', 'Leaf green · Sand · Stone', 'Wood, stone, natural fibers', 'Organic silhouettes and plant stands', 'Daylight-led layered light'],
  'art-deco': ['Art Deco', 'Geometric forms, polished accents and bold rhythm bring celebratory glamour.', 'Jade · Gold · Ink', 'Lacquer, velvet, brass', 'Curved statement forms', 'Geometric feature lighting'],
  futuristic: ['Futuristic', 'Sleek forms and expressive lighting create a forward-looking, adaptable interior.', 'Silver · White · Violet', 'Glass, metal, technical textiles', 'Modular sculptural furniture', 'Linear and smart lighting']
};
const designers = {
  'emma-rowan': ['Emma Rowan', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80', 'Warm modern interiors', '8 years', '4.9', 'Emma creates warm, modern interiors with characterful layering and effortless function, with a special focus on compact city homes.', 'Modern · Japandi · Minimalist'],
  'oliver-james': ['Oliver James', 'media/oliver-james-portrait.jpg', 'Contemporary spaces', '10 years', '4.8', 'Oliver pairs thoughtful architectural details with practical, contemporary furnishings for everyday family life.', 'Modern · Industrial · Luxury'],
  'maya-patel': ['Maya Patel', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80', 'Colourful, collected homes', '6 years', '4.9', 'Maya layers expressive colour and collected pieces into personal, welcoming homes.', 'Bohemian · Art Deco · Biophilic']
};

function addActionLink(parent, label, href, className = 'btn btn-primary') {
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.textContent = label;
  parent.append(link);
}

function setupDetails() {
  const target = $('#detail-content');
  if (!target) return;
  const params = new URLSearchParams(location.search);
  const file = location.pathname.split('/').pop();
  let title = '';
  let image = '';
  let description = '';
  const details = makeElement('div', 'detail-copy');
  if (file === 'product-details.html') {
    const product = catalog.find(item => item.id === params.get('id')) || catalog[0];
    title = product.name;
    image = product.image;
    description = `${product.name} brings considered proportions and everyday comfort to a ${product.category.toLowerCase()} setting.`;
    details.append(makeElement('span', 'eyebrow', product.category), makeElement('h1', '', title), makeElement('p', 'detail-rating', '★ 4.8 · Curated Havenly pick'), makeElement('p', '', description), makeElement('p', '', 'Material: Natural wood and premium upholstery'), makeElement('p', '', 'Dimensions: Designed for modern homes'), makeElement('p', '', 'Color: Warm neutral'), makeElement('p', '', 'AI Match: 92% style compatibility (demo)'));
    details.append(makeElement('strong', 'detail-price', formatPrice(product.price)));
    const actions = makeElement('div', 'hero-actions');
    const add = makeElement('button', 'btn btn-primary', 'Add to Cart');
    add.type = 'button';
    add.addEventListener('click', () => saveProduct('havenly-cart', product));
    actions.append(add);
    const wishlist = makeElement('button', 'btn btn-secondary', 'Add to Wishlist');
    wishlist.type = 'button';
    wishlist.addEventListener('click', () => saveProduct('havenly-wishlist', product));
    actions.append(wishlist);
    const compare = makeElement('button', 'btn btn-secondary', 'Compare');
    compare.type = 'button';
    compare.dataset.compareProduct = product.id;
    actions.append(compare);
    addActionLink(actions, 'View in My Room', 'ai-studio.html');
    details.append(actions);
  } else if (file === 'room-details.html') {
    const data = roomDetails[params.get('room')] || roomDetails['living-room'];
    [title, , description] = data;
    image = 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85';
    details.append(makeElement('span', 'eyebrow', data[1]), makeElement('h1', '', title), makeElement('p', '', description), makeElement('p', '', `Color palette: ${data[3]}`), makeElement('p', '', `Furniture recommendations: ${data[4]}`), makeElement('p', '', `Estimated budget: ${data[5]}`));
    const actions = makeElement('div', 'hero-actions');
    addActionLink(actions, 'Design This Room', `ai-studio.html?room=${encodeURIComponent(params.get('room') || 'living-room')}`);
    addActionLink(actions, 'Shop This Room', `products.html?category=furniture`);
    details.append(actions);
  } else if (file === 'style-details.html') {
    const data = styleDetails[params.get('style')] || styleDetails.modern;
    [title, description] = data;
    image = 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85';
    details.append(makeElement('span', 'eyebrow', 'Interior style'), makeElement('h1', '', title), makeElement('p', '', description), makeElement('p', '', `Color palette: ${data[2]}`), makeElement('p', '', `Materials: ${data[3]}`), makeElement('p', '', `Furniture: ${data[4]}`), makeElement('p', '', `Lighting: ${data[5]}`));
    const actions = makeElement('div', 'hero-actions');
    addActionLink(actions, 'Design with This Style', `ai-studio.html?style=${encodeURIComponent(params.get('style') || 'modern')}`);
    addActionLink(actions, 'Shop This Style', 'products.html');
    details.append(actions);
  } else {
    const data = designers[params.get('id')] || designers['emma-rowan'];
    [title, image] = data;
    details.append(makeElement('span', 'eyebrow', 'Havenly Designer'), makeElement('h1', '', title), makeElement('p', '', `Specialization: ${data[2]}`), makeElement('p', '', `Experience: ${data[3]}`), makeElement('p', '', `Rating: ★ ${data[4]}`), makeElement('p', '', data[5]), makeElement('p', '', `Design styles: ${data[6]}`));
    const actions = makeElement('div', 'hero-actions');
    addActionLink(actions, 'View Portfolio', 'gallery.html');
    addActionLink(actions, 'Book Consultation', 'contact.html#consultation', 'btn btn-secondary');
    details.append(actions);
  }
  const photo = document.createElement('img');
  photo.className = 'detail-image';
  photo.src = image;
  photo.alt = title;
  const breadcrumbs = makeElement('nav', 'breadcrumbs');
  breadcrumbs.setAttribute('aria-label', 'Breadcrumb');
  addActionLink(breadcrumbs, 'Home', 'index.html', 'breadcrumb-link');
  if (file === 'product-details.html') addActionLink(breadcrumbs, 'Products', 'products.html', 'breadcrumb-link');
  if (file === 'room-details.html') addActionLink(breadcrumbs, 'Rooms', 'rooms.html', 'breadcrumb-link');
  if (file === 'style-details.html') addActionLink(breadcrumbs, 'Styles', 'styles.html', 'breadcrumb-link');
  breadcrumbs.append(makeElement('span', '', title));
  target.before(breadcrumbs);
  target.append(photo, details);
  if (file === 'product-details.html') {
    const recent = storage.get('havenly-recently-viewed', []);
    const viewedProduct = catalog.find(item => item.id === params.get('id'));
    const next = [viewedProduct, ...(Array.isArray(recent) ? recent : []).filter(item => item?.id !== params.get('id'))].filter(Boolean).slice(0, 8);
    storage.set('havenly-recently-viewed', next);
  }
  document.title = `${title} | Havenly AI`;
}

function setupTabs() {
  const tabs = $$('[data-tab-target]');
  if (!tabs.length) return;
  const panels = $$('.tab-panel');
  const activate = (tab, focus = false) => {
    const id = tab.dataset.tabTarget;
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      item.classList.toggle('active', selected);
    });
    panels.forEach(panel => {
      const active = panel.id === id;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      activate(tabs[next], true);
    });
  });
  const selected = tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0];
  activate(selected);
}

function setupWizard() {
  const steps = $$('.wizard-step');
  if (!steps.length) return;
  let currentStep = 1;
  const showStep = step => {
    const selected = steps.find(section => Number(section.dataset.step) === step);
    if (!selected) return;
    steps.forEach(section => {
      section.hidden = section !== selected;
      section.classList.toggle('step-enter', section === selected);
    });
    currentStep = step;
    const indicator = $('.wizard-progress');
    if (indicator) indicator.textContent = `Step ${step} of ${steps.length}`;
    const progress = $('.wizard-progress-track');
    if (progress) {
      progress.setAttribute('aria-valuenow', String(step));
      const fill = $('span', progress);
      if (fill) fill.style.width = `${step / steps.length * 100}%`;
    }
    selected.focus({ preventScroll: true });
  };
  steps.forEach(step => {
    $$('[data-next]', step).forEach(button => button.addEventListener('click', () => {
      if (step.dataset.step === '5') {
        const selectedBudget = $('input[name="budget"]:checked', step);
        if (!selectedBudget) {
          toast('Select a budget to continue.');
          return;
        }
        storage.set('havenly-studio', { ...storage.get('havenly-studio', {}), budget: selectedBudget.value });
      }
      if (step.dataset.step === '1') {
        const file = $('input[type="file"]', step)?.files?.[0];
        if (file) storage.set('havenly-studio-image-name', file.name);
      }
      if (step.dataset.step === '6') showStep(7);
      else if (step.dataset.step === '5') startProcessing(showStep);
      else showStep(currentStep + 1);
    }));
    $$('[data-previous]', step).forEach(button => button.addEventListener('click', () => {
      clearTimeout(processingTimer);
      showStep(currentStep - 1);
    }));
  });
  $$('[data-choice-group]').forEach(group => {
    $$('button[data-choice]', group).forEach(button => button.addEventListener('click', () => {
      $$('button[data-choice]', group).forEach(item => {
        item.classList.toggle('selected', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      const state = storage.get('havenly-studio', {});
      state[group.dataset.choiceGroup] = button.dataset.choice;
      storage.set('havenly-studio', state);
    }));
  });
  const upload = $('#studio-upload');
  upload?.addEventListener('change', () => {
    const file = upload.files?.[0];
    if (!file || !file.type.startsWith('image/')) return toast('Choose an image file.');
    const preview = $('#upload-preview');
    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    }
  });
  $('#use-demo-image')?.addEventListener('click', () => {
    const room = resolveStudioRoom(storage.get('havenly-studio', {}).room);
    const preview = $('#upload-preview');
    if (preview) {
      preview.src = room.image;
      preview.alt = `${room.name} sample room`;
      preview.hidden = false;
    }
    storage.set('havenly-studio-image-name', 'Havenly sample room');
    toast('Sample room selected.');
  });
  $('#save-studio-result')?.addEventListener('click', () => {
    const state = storage.get('havenly-studio', {});
    if (window.HavenlyAuth?.isLoggedIn()) {
      window.HavenlyAuth.addSavedDesign(state);
    } else {
      const modal = makeElement('div', 'account-modal');
      const panel = makeElement('section');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.append(makeElement('h2', '', 'Sign in to save your design.'), makeElement('p', '', 'Create an account or sign in to keep designs with your profile.'));
      addActionLink(panel, 'SIGN IN', `login.html?returnTo=${encodeURIComponent('ai-studio.html')}`);
      const cancel = makeElement('button', 'btn btn-secondary', 'NOT NOW');
      cancel.type = 'button';
      cancel.addEventListener('click', () => modal.remove());
      panel.append(cancel);
      modal.append(panel);
      document.body.append(modal);
    }
  });
  $('#restart-studio')?.addEventListener('click', () => {
    storage.set('havenly-studio', {});
    showStep(1);
  });
  $('#regenerate-studio')?.addEventListener('click', () => startProcessing(showStep));
  const params = new URLSearchParams(location.search);
  const saved = storage.get('havenly-studio', {});
  const accountPreferences = window.HavenlyAuth?.getCurrentUser()?.preferences || {};
  if (!saved.room && accountPreferences.favoriteRoom) saved.room = accountPreferences.favoriteRoom;
  if (!saved.style && accountPreferences.favoriteStyle) saved.style = accountPreferences.favoriteStyle;
  if (!saved.mood && accountPreferences.preferredMood) saved.mood = accountPreferences.preferredMood;
  if (!saved.budget && accountPreferences.budgetPreference) {
    saved.budget = ({ Budget: '₹25,000', Balanced: '₹50,000', Premium: '₹1,00,000', Luxury: '₹2,00,000+' })[accountPreferences.budgetPreference] || '';
  }
  if (Object.keys(saved).length) storage.set('havenly-studio', saved);
  if (window.HavenlyAuth?.getCurrentUser()?.preferences) {
    $('.wizard-heading')?.append(makeElement('span', 'ai-pill personalized-label', 'PERSONALIZED FOR YOU'));
  }
  if (params.has('room') || params.has('style')) {
    if (params.has('room')) saved.room = params.get('room');
    if (params.has('style')) saved.style = params.get('style');
    storage.set('havenly-studio', saved);
  }
  ['room', 'style', 'mood'].forEach(group => {
    if (!saved[group]) return;
    const savedChoice = saved[group].toLowerCase().replace(/-/g, ' ');
    const choice = $$(`[data-choice-group="${group}"] [data-choice]`).find(button =>
      button.dataset.choice.toLowerCase() === savedChoice
      || (group === 'room' && savedChoice === 'study' && button.dataset.choice === 'Study Room')
    );
    choice?.click();
  });
  showStep(1);
}

function startProcessing(showStep) {
  showStep(6);
  const list = $('#processing-list');
  if (list) {
    list.replaceChildren();
    ['Analyzing room', 'Choosing style', 'Matching colors', 'Finding furniture', 'Creating design'].forEach((label, index) => {
      const item = makeElement('li', 'processing-item', label);
      list.append(item);
      setTimeout(() => item.classList.add('complete'), 250 * (index + 1));
    });
  }
  const state = storage.get('havenly-studio', {});
  const room = resolveStudioRoom(state.room);
  const resultState = { ...state, room: room.name, image: room.image, createdAt: new Date().toISOString() };
  storage.set('havenly-studio', resultState);
  const user = window.HavenlyAuth?.getCurrentUser();
  if (user) window.HavenlyAuth.updateUser(user.id, { aiDesignCount: (user.aiDesignCount || 0) + 1 });
  const result = $('#studio-result');
  if (result) result.textContent = `${state.mood || 'Warm'} ${state.style || 'Modern'} concept · ${room.name} · ${state.budget || '₹50,000'}`;
  const image = $('#studio-result-image');
  if (image) {
    image.src = room.image;
    image.alt = `${room.name} design prototype`;
  }
  const recommendations = $('#studio-recommendations');
  if (recommendations) {
    const options = roomRecommendations[room.name];
    const selected = options[studioRecommendationVersion % options.length];
    studioRecommendationVersion += 1;
    recommendations.replaceChildren(...selected.map(text => makeElement('li', '', text)));
  }
  clearTimeout(processingTimer);
  processingTimer = setTimeout(() => showStep(7), 1600);
}

function setupCheckoutWizard() {
  const checkout = $('#checkout-wizard');
  if (!checkout) return;
  const steps = $$('.checkout-step', checkout);
  let current = 1;
  const show = number => {
    const active = steps.find(step => Number(step.dataset.checkoutStep) === number);
    if (!active) return;
    steps.forEach(step => { step.hidden = step !== active; });
    current = number;
    $('.checkout-progress').textContent = `Step ${number} of ${steps.length}`;
  };
  $$('.checkout-next', checkout).forEach(button => button.addEventListener('click', () => {
    const form = $('form', steps.find(step => Number(step.dataset.checkoutStep) === current));
    if (form && !form.reportValidity()) return;
    if (current === 4) {
    const items = getList('havenly-cart');
    const total = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    const addressForm = $('form', steps.find(step => Number(step.dataset.checkoutStep) === 1));
    const address = addressForm ? [...addressForm.querySelectorAll('input')].map(input => input.value).filter(Boolean).join(', ') : '';
    const payment = $('input[name="payment"]:checked', checkout)?.value || 'demo';
    const order = { id: `HV-${Date.now()}`, createdAt: new Date().toISOString(), items, total: formatPrice(total), subtotal: total, delivery: 'Free', address, payment: 'Demo payment method', status: 'Confirmed' };
    if (window.HavenlyAuth?.isLoggedIn() && !window.HavenlyAuth.saveOrder(order)) return;
    if (!storage.set('havenly-demo-order', order)) return;
      setList('havenly-cart', []);
      renderCart();
      updateHeaderCounts();
      const orderId = $('#demo-order-id');
      if (orderId) orderId.textContent = order.id;
    }
    if (current === 3) renderCheckoutReview();
    show(current + 1);
  }));
  $$('.checkout-previous', checkout).forEach(button => button.addEventListener('click', () => show(current - 1)));
  show(1);
}

function renderCheckoutReview() {
  const list = $('#checkout-review');
  if (!list) return;
  list.replaceChildren();
  const cart = getList('havenly-cart');
  if (!cart.length) list.append(makeElement('li', '', 'Your cart is empty.'));
  cart.forEach(item => {
    const entry = makeElement('li');
    entry.append(makeElement('span', '', `${item.name} × ${item.quantity || 1}`), makeElement('strong', '', formatPrice(item.price * (item.quantity || 1))));
    list.append(entry);
  });
}

function setupSdlcStages() {
  const buttons = $$('.stage-tabs [data-stage]');
  if (!buttons.length) return;
  const content = {
    Requirements: 'Collect and prioritize user needs, accessibility goals and backend integration requirements.',
    Planning: 'Break the backlog into achievable iterations and define acceptance criteria, ownership and estimates.',
    Design: 'Prototype clear navigation and accessible screens before validating the experience with users.',
    Development: 'Deliver small increments, reuse components and keep frontend and backend contracts explicit.',
    Testing: 'Test flows, keyboard access, responsive behavior, data validation and service integration.',
    Deployment: 'Release a reviewed build, monitor service health and keep rollback paths available.',
    Review: 'Collect feedback, inspect outcomes and use the learning to prioritize the next iteration.'
  };
  buttons.forEach(button => button.addEventListener('click', () => {
    buttons.forEach(item => item.classList.toggle('active', item === button));
    $('#stage-title').textContent = button.dataset.stage;
    $('#stage-description').textContent = content[button.dataset.stage];
  }));
  buttons[0].classList.add('active');
  const agilePanel = $('#model-agile');
  if (agilePanel && !$('.account-sprints', agilePanel)) {
    const sprints = makeElement('div', 'account-sprints');
    sprints.append(
      makeElement('h3', '', 'Havenly account-work sprints'),
      makeElement('p', '', 'SPRINT 9 · Authentication, user profile and personalization'),
      makeElement('p', '', 'SPRINT 10 · Saved designs, orders and notifications'),
      makeElement('p', '', 'SPRINT 11 · Public marketing website'),
      makeElement('p', '', 'SPRINT 12 · Authentication redesign'),
      makeElement('p', '', 'SPRINT 13 · First-time onboarding'),
      makeElement('p', '', 'SPRINT 14 · Authenticated dashboard')
    );
    agilePanel.append(sprints);
  }
}

function setupDetailsPageLinks() {
  if (!$('#detail-content')) return;
  setupDetails();
}

function setupSearchModal() {
  const triggers = $$('a.nav-icon[aria-label*="Search"]');
  if (!triggers.length) return;
  const modal = makeElement('div', 'modal search-modal');
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'site-search-title');
  const content = makeElement('div', 'modal-content');
  const heading = makeElement('h2', '', 'Search Havenly');
  heading.id = 'site-search-title';
  const close = makeElement('button', 'modal-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close search');
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Search products, rooms and styles...';
  input.setAttribute('aria-label', 'Search Havenly');
  const results = makeElement('div', 'search-results');
  const recentSearches = makeElement('div', 'recent-searches');
  content.append(close, heading, input, recentSearches, results);
  modal.append(content);
  document.body.append(modal);
  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  };
  const update = () => {
    const query = input.value.trim().toLowerCase();
    results.replaceChildren();
    const history = storage.get('havenly-search-history', []);
    recentSearches.replaceChildren();
    if (!query && Array.isArray(history) && history.length) {
      recentSearches.append(makeElement('strong', '', 'Recent Searches'));
      history.forEach(term => {
        const item = makeElement('button', 'search-result', term);
        item.type = 'button';
        item.addEventListener('click', () => { input.value = term; update(); });
        recentSearches.append(item);
      });
      const clear = makeElement('button', 'clear-search-history', 'Clear History');
      clear.type = 'button';
      clear.addEventListener('click', () => { storage.set('havenly-search-history', []); recentSearches.replaceChildren(); });
      recentSearches.append(clear);
    }
    if (!query) return;
    const matches = [
      ...catalog.filter(item => `${item.name} ${item.category}`.toLowerCase().includes(query)).map(item => [item.name, `product-details.html?id=${encodeURIComponent(item.id)}`]),
      ...Object.entries(roomDetails).filter(([, item]) => item[0].toLowerCase().includes(query)).map(([key, item]) => [item[0], `room-details.html?room=${key}`]),
      ...Object.entries(styleDetails).filter(([, item]) => item[0].toLowerCase().includes(query)).map(([key, item]) => [item[0], `style-details.html?style=${key}`])
    ].slice(0, 10);
    if (!matches.length) results.append(makeElement('p', '', 'No matching products, rooms or styles.'));
    matches.forEach(([label, href]) => addActionLink(results, label, href, 'search-result'));
  };
  document.addEventListener('click', event => {
    const trigger = event.target.closest('a.nav-icon[aria-label*="Search"]');
    if (!trigger) return;
    event.preventDefault();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    update();
    input.focus();
  });
  input.addEventListener('input', update);
  results.addEventListener('click', event => {
    if (!event.target.closest('a.search-result') || input.value.trim().length < 2) return;
    const query = input.value.trim();
    const history = storage.get('havenly-search-history', []);
    if (Array.isArray(history)) storage.set('havenly-search-history', [query, ...history.filter(term => term.toLowerCase() !== query.toLowerCase())].slice(0, 6));
  });
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || input.value.trim().length < 2) return;
    const query = input.value.trim();
    const history = storage.get('havenly-search-history', []);
    if (Array.isArray(history)) storage.set('havenly-search-history', [query, ...history.filter(term => term.toLowerCase() !== query.toLowerCase())].slice(0, 6));
  });
  close.addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
}

function setupGalleryLightbox() {
  const gallery = $('.gallery-grid');
  if (!gallery) return;
  const anchors = $$('a', gallery);
  const pageSize = 8;
  let page = 0;
  const pageCount = Math.ceil(anchors.length / pageSize);
  const pagination = makeElement('nav', 'pagination');
  pagination.setAttribute('aria-label', 'Gallery pages');
  gallery.after(pagination);
  const render = () => {
    anchors.forEach((anchor, index) => { anchor.hidden = Math.floor(index / pageSize) !== page; });
    pagination.replaceChildren();
    const previous = makeElement('button', '', '← Previous');
    previous.type = 'button';
    previous.disabled = page === 0;
    previous.addEventListener('click', () => { page -= 1; render(); });
    const status = makeElement('span', '', `Page ${page + 1} / ${pageCount}`);
    const next = makeElement('button', '', 'Next →');
    next.type = 'button';
    next.disabled = page === pageCount - 1;
    next.addEventListener('click', () => { page += 1; render(); });
    pagination.append(previous, status, next);
  };
  render();
  const modal = makeElement('div', 'modal gallery-lightbox');
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const content = makeElement('div', 'modal-content lightbox-content');
  const close = makeElement('button', 'modal-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close image');
  const previous = makeElement('button', 'lightbox-previous', '← Previous Image');
  previous.type = 'button';
  const image = document.createElement('img');
  image.alt = 'Interior design inspiration';
  const next = makeElement('button', 'lightbox-next', 'Next Image →');
  next.type = 'button';
  const caption = makeElement('p', 'lightbox-caption');
  const actions = makeElement('div', 'hero-actions');
  const save = makeElement('button', 'btn btn-secondary', 'Save');
  save.type = 'button';
  const recreate = makeElement('a', 'btn btn-primary', 'Recreate with AI');
  recreate.href = 'ai-studio.html';
  actions.append(save, recreate);
  content.append(close, previous, image, next, caption, actions);
  modal.append(content);
  document.body.append(modal);
  let activeIndex = 0;
  const showImage = index => {
    activeIndex = (index + anchors.length) % anchors.length;
    const anchor = anchors[activeIndex];
    image.src = $('img', anchor).src.replace(/w=450/, 'w=1400');
    caption.textContent = `Design ${activeIndex + 1} · ${activeIndex % 2 ? 'Bedroom' : 'Living Room'} · ${activeIndex % 2 ? 'Japandi' : 'Modern'}`;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    close.focus();
  };
  const closeModal = () => { modal.hidden = true; document.body.classList.remove('modal-open'); };
  anchors.forEach((anchor, index) => anchor.addEventListener('click', event => { event.preventDefault(); showImage(index); }));
  close.addEventListener('click', closeModal);
  previous.addEventListener('click', () => showImage(activeIndex - 1));
  next.addEventListener('click', () => showImage(activeIndex + 1));
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  save.addEventListener('click', () => {
    const saved = storage.get('havenly-saved-gallery', []);
    const key = String(activeIndex);
    if (!saved.includes(key)) saved.push(key);
    if (storage.set('havenly-saved-gallery', saved)) toast('Gallery inspiration saved.');
  });
  document.addEventListener('keydown', event => {
    if (modal.hidden) return;
    if (event.key === 'Escape') closeModal();
    if (event.key === 'ArrowLeft') showImage(activeIndex - 1);
    if (event.key === 'ArrowRight') showImage(activeIndex + 1);
  });
}

function setupDesignerCards() {
  $$('.designer-card').forEach(card => {
    const name = $('h3', card)?.textContent.trim();
    const id = name?.toLowerCase().replace(/\s+/g, '-');
    if (!name || !id) return;
    const link = $('a', card);
    if (link) {
      link.href = `designer-details.html?id=${encodeURIComponent(id)}`;
      link.textContent = 'View Designer';
      link.classList.add('btn');
    }
  });
}

function setupStyleFavorites() {
  const savedStyles = window.HavenlyAuth?.getSavedStyles() || [];
  $$('.style-selection > a.selection-card').forEach(card => {
    const style = $('span', card)?.textContent.trim();
    if (!style) return;
    const group = makeElement('div', 'style-choice');
    card.replaceWith(group);
    const favorite = makeElement('button', 'btn btn-secondary btn-small style-favorite', savedStyles.includes(style) ? 'Saved Style' : 'Save Style');
    favorite.type = 'button';
    favorite.dataset.favoriteStyle = style;
    favorite.setAttribute('aria-pressed', String(savedStyles.includes(style)));
    group.append(card, favorite);
  });
  if (location.pathname.endsWith('style-details.html')) {
    const styleName = $('.detail-copy h1')?.textContent.trim();
    const actions = $('.detail-copy .hero-actions');
    if (styleName && actions) {
      const favorite = makeElement('button', 'btn btn-secondary style-favorite', savedStyles.includes(styleName) ? 'Saved Style' : 'Save Style');
      favorite.type = 'button';
      favorite.dataset.favoriteStyle = styleName;
      favorite.setAttribute('aria-pressed', String(savedStyles.includes(styleName)));
      actions.append(favorite);
    }
  }
}

function toggleCompare(productId) {
  const selected = storage.get('havenly-compare', []);
  const ids = Array.isArray(selected) ? selected.map(item => typeof item === 'string' ? item : item.id) : [];
  if (ids.includes(productId)) {
    storage.set('havenly-compare', ids.filter(id => id !== productId));
    toast('Product removed from comparison.');
    return;
  }
  if (ids.length >= 3) {
    toast('Compare up to three products at a time.');
    return;
  }
  storage.set('havenly-compare', [...ids, productId]);
  toast('Product added to comparison.');
}

function showProductQuickView(product) {
  const modal = makeElement('div', 'account-modal quick-view-modal');
  const panel = makeElement('section', 'quick-view-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'quick-view-title');
  const close = makeElement('button', 'modal-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close quick view');
  const image = document.createElement('img');
  image.src = product.image;
  image.alt = product.name;
  panel.append(close, image, makeElement('span', 'eyebrow', product.category), makeElement('h2', '', product.name), makeElement('p', '', '★ 4.8 · AI Match 92% (demo)'), makeElement('strong', '', formatPrice(product.price)), makeElement('p', '', `${product.name} brings considered proportions and everyday comfort to your home.`));
  const actions = makeElement('div', 'wizard-actions');
  addActionLink(actions, 'VIEW DETAILS', `product-details.html?id=${encodeURIComponent(product.id)}`);
  const add = makeElement('button', 'btn btn-primary', 'ADD TO CART');
  add.type = 'button';
  add.addEventListener('click', () => { saveProduct('havenly-cart', product); modal.remove(); });
  const wishlist = makeElement('button', 'btn btn-secondary', 'WISHLIST');
  wishlist.type = 'button';
  wishlist.addEventListener('click', () => { saveProduct('havenly-wishlist', product); modal.remove(); });
  actions.append(add, wishlist);
  panel.append(actions);
  modal.append(panel);
  document.body.append(modal);
  let escapeHandler;
  const closeModal = () => {
    modal.remove();
    if (escapeHandler) document.removeEventListener('keydown', escapeHandler);
  };
  close.addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  escapeHandler = event => {
    if (event.key === 'Escape') {
      closeModal();
    }
  };
  document.addEventListener('keydown', escapeHandler);
  close.focus();
}

function setupCompare() {
  const container = $('#compare-grid');
  if (!container) return;
  const ids = storage.get('havenly-compare', []);
  const products = Array.isArray(ids) ? ids.map(id => catalog.find(item => item.id === (typeof id === 'string' ? id : id.id))).filter(Boolean).slice(0, 3) : [];
  container.replaceChildren();
  if (!products.length) {
    container.append(makeElement('p', 'empty-state', 'Select up to three products from the catalog to compare.'));
    return;
  }
  const fields = [
    ['Price', product => formatPrice(product.price)],
    ['Rating', () => '★ 4.8 (demo)'],
    ['Material', () => 'Natural wood and premium upholstery'],
    ['Dimensions', () => 'Designed for modern homes'],
    ['Style', () => 'Modern · Japandi · Contemporary'],
    ['Room', () => 'Living room · Bedroom'],
    ['AI Match', () => '92% (rules-based demo)']
  ];
  fields.forEach(([label, readValue]) => {
    const row = makeElement('div', 'compare-row');
    row.append(makeElement('strong', '', label));
    products.forEach(product => row.append(makeElement('span', '', readValue(product))));
    container.append(row);
  });
  const cards = makeElement('div', 'compare-products');
  products.forEach(product => {
    const card = makeElement('article', 'compare-product');
    const image = document.createElement('img');
    image.src = product.image;
    image.alt = product.name;
    card.append(image, makeElement('h2', '', product.name));
    const add = makeElement('button', 'btn btn-primary', 'ADD TO CART');
    add.type = 'button';
    add.addEventListener('click', () => saveProduct('havenly-cart', product));
    const remove = makeElement('button', 'btn btn-secondary', 'REMOVE');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      storage.set('havenly-compare', products.filter(item => item.id !== product.id).map(item => item.id));
      setupCompare();
    });
    card.append(add, remove);
    cards.append(card);
  });
  container.prepend(cards);
}

const havenlyAuthReady = new Promise(resolve => {
  const authScript = document.createElement('script');
  authScript.src = 'js/auth.js';
  authScript.addEventListener('load', resolve, { once: true });
  authScript.addEventListener('error', () => {
    console.error('Could not load the Havenly authentication prototype.');
    toast('Account features could not be loaded.');
    resolve();
  }, { once: true });
  document.head.append(authScript);
});

document.addEventListener('DOMContentLoaded', async () => {
  await havenlyAuthReady;
  setupTheme();
  setupAssistant();
  setupProducts();
  setupSearchNavigation();
  renderCart();
  renderWishlist();
  updateHeaderCounts();
  setupForms();
  setupProfile();
  setupUnavailableControls();
  setupStudio();
  setupCheckout();
  setupTabs();
  setupWizard();
  setupCheckoutWizard();
  setupDetailsPageLinks();
  setupStyleFavorites();
  setupSearchModal();
  setupGalleryLightbox();
  setupDesignerCards();
  setupCompare();
  setupSdlcStages();
});

document.addEventListener('click', event => {
  const styleFavorite = event.target.closest('[data-favorite-style]');
  if (styleFavorite) {
    const isSaved = window.HavenlyAuth?.toggleSavedStyle(styleFavorite.dataset.favoriteStyle);
    if (isSaved === undefined || isSaved === null) {
      styleFavorite.textContent = 'Save Style';
      styleFavorite.setAttribute('aria-pressed', 'false');
    } else {
      styleFavorite.textContent = isSaved ? 'Saved Style' : 'Save Style';
      styleFavorite.setAttribute('aria-pressed', String(isSaved));
    }
    return;
  }
  const quickView = event.target.closest('[data-quick-view]');
  if (quickView) {
    const product = catalog.find(item => item.id === quickView.dataset.quickView);
    if (product) showProductQuickView(product);
    return;
  }
  const compareButton = event.target.closest('[data-compare-product]');
  if (compareButton) {
    toggleCompare(compareButton.dataset.compareProduct);
    return;
  }
  const favorite = event.target.closest('.product-favorite');
  if (favorite) {
    const product = productFromCard(favorite.closest('.product-card'));
    const items = getList('havenly-wishlist');
    const exists = items.some(item => item.id === product.id);
    const updated = exists ? items.filter(item => item.id !== product.id) : [...items, product];
    if (setList('havenly-wishlist', updated)) {
      favorite.classList.toggle('is-saved', !exists);
      favorite.setAttribute('aria-pressed', String(!exists));
      favorite.setAttribute('aria-label', `${exists ? 'Add' : 'Remove'} ${product.name} ${exists ? 'to' : 'from'} wishlist`);
      updateHeaderCounts();
      toast(exists ? `${product.name} removed from your wishlist.` : `${product.name} saved to your wishlist.`);
      if (!exists) window.HavenlyAuth?.notify(`${product.name} added to your wishlist.`, 'wishlist');
    }
    return;
  }
  const addButton = event.target.closest('[data-add-to-cart]');
  if (addButton) {
    const product = productFromCard(addButton.closest('.product-card'));
    saveProduct('havenly-cart', product);
  }
});

window.addEventListener('storage', event => {
  if (['havenly-cart', 'havenly-wishlist'].includes(event.key)) {
    updateHeaderCounts();
    renderCart();
    renderWishlist();
  }
});
