(() => {
  const KEYS = {
    users: 'havenly_users',
    session: 'havenly_current_user',
    cart: 'havenly-cart',
    wishlist: 'havenly-wishlist',
    designs: 'havenly-designs',
    notifications: 'havenly-notifications',
    preferences: 'havenly-preferences',
    theme: 'havenly-theme'
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let menuDocumentHandlersBound = false;

  function read(key, fallback, area = localStorage) {
    try {
      const value = area.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.error(`Could not read ${key}.`, error);
      return fallback;
    }
  }

  function write(key, value, area = localStorage) {
    try {
      area.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save ${key}.`, error);
      window.havenlyToast?.('Your browser could not save this change.');
      return false;
    }
  }

  const users = () => {
    const saved = read(KEYS.users, []);
    return Array.isArray(saved) ? saved : [];
  };
  const session = () => read(KEYS.session, null, sessionStorage) || read(KEYS.session, null);
  const getCurrentUser = () => {
    const active = session();
    return active ? users().find(user => user.id === active.id) || null : null;
  };
  const isLoggedIn = () => Boolean(getCurrentUser());
  const notify = (message, type = 'general') => {
    const user = getCurrentUser();
    if (!user) return;
    user.notifications = Array.isArray(user.notifications) ? user.notifications : [];
    user.notifications.unshift({ id: crypto.randomUUID?.() || `N-${Date.now()}`, message, type, createdAt: new Date().toISOString(), read: false });
    updateUser(user.id, { notifications: user.notifications.slice(0, 30) });
  };
  const toast = message => window.havenlyToast?.(message);
  const formatDemoPrice = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);

  function updateUser(id, updates) {
    const all = users();
    const index = all.findIndex(user => user.id === id);
    if (index < 0) return false;
    all[index] = { ...all[index], ...updates, updatedAt: new Date().toISOString() };
    if (!write(KEYS.users, all)) return false;
    renderHeader();
    return true;
  }

  function registerUser({ name, email, mobile, password }) {
    const all = users();
    const normalizedEmail = email.trim().toLowerCase();
    if (all.some(user => user.email.toLowerCase() === normalizedEmail)) {
      return { ok: false, reason: 'duplicate' };
    }
    const user = {
      id: `HVU-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      password,
      createdAt: new Date().toISOString(),
      preferences: {},
      savedDesigns: [],
      savedStyles: [],
      orders: [],
      wishlist: [],
      cart: [],
      notifications: [],
      onboardingComplete: false
    };
    if (!write(KEYS.users, [...all, user])) return { ok: false, reason: 'storage' };
    return { ok: true, user };
  }

  function rememberUser(id, remember) {
    sessionStorage.removeItem(KEYS.session);
    localStorage.removeItem(KEYS.session);
    return write(KEYS.session, { id, createdAt: new Date().toISOString() }, remember ? localStorage : sessionStorage);
  }

  function mergeItems(first, second, quantity = false) {
    const merged = [...(Array.isArray(first) ? first : [])];
    (Array.isArray(second) ? second : []).forEach(item => {
      const found = merged.find(current => current.id === item.id);
      if (found && quantity) found.quantity = (Number(found.quantity) || 1) + (Number(item.quantity) || 1);
      else if (!found) merged.push(item);
    });
    return merged;
  }

  function loginUser(email, password, remember = false) {
    const targetUser = users().find(item => item.email === email.trim().toLowerCase() && item.password === password);
    if (!targetUser) return { ok: false, reason: 'invalid' };
    const activeUser = getCurrentUser();
    if (activeUser && !updateUser(activeUser.id, { cart: read(KEYS.cart, []), wishlist: read(KEYS.wishlist, []) })) return { ok: false, reason: 'storage' };
    const user = users().find(item => item.id === targetUser.id);
    const guestCart = activeUser ? read('havenly_guest_cart', []) : read(KEYS.cart, []);
    const guestWishlist = activeUser ? read('havenly_guest_wishlist', []) : read(KEYS.wishlist, []);
    if (!localStorage.getItem('havenly_guest_cart')) write('havenly_guest_cart', guestCart);
    if (!localStorage.getItem('havenly_guest_wishlist')) write('havenly_guest_wishlist', guestWishlist);
    if (activeUser?.id !== user.id) {
      user.cart = mergeItems(user.cart, guestCart, true);
      user.wishlist = mergeItems(user.wishlist, guestWishlist);
      const guestStyles = read('havenly-favorite-styles', []);
      user.savedStyles = [...new Set([...(Array.isArray(user.savedStyles) ? user.savedStyles : []), ...(Array.isArray(guestStyles) ? guestStyles : [])])];
    }
    if (!write(KEYS.users, users().map(item => item.id === user.id ? user : item))) return { ok: false, reason: 'storage' };
    if (activeUser?.id !== user.id) write('havenly-favorite-styles', []);
    if (!rememberUser(user.id, remember)) return { ok: false, reason: 'storage' };
    write(KEYS.cart, user.cart);
    write(KEYS.wishlist, user.wishlist);
    if (user.preferences?.appearance) write(KEYS.theme, user.preferences.appearance);
    return { ok: true, user };
  }

  function logoutUser() {
    const user = getCurrentUser();
    if (user) {
      user.cart = read(KEYS.cart, []);
      user.wishlist = read(KEYS.wishlist, []);
      updateUser(user.id, { cart: user.cart, wishlist: user.wishlist });
    }
    sessionStorage.removeItem(KEYS.session);
    localStorage.removeItem(KEYS.session);
    write(KEYS.cart, read('havenly_guest_cart', []));
    write(KEYS.wishlist, read('havenly_guest_wishlist', []));
    renderHeader();
  }

  function changePassword(currentPassword, nextPassword) {
    const user = getCurrentUser();
    if (!user || user.password !== currentPassword) return false;
    return updateUser(user.id, { password: nextPassword });
  }

  function addSavedDesign(design) {
    const user = getCurrentUser();
    if (!user) return false;
    const designs = Array.isArray(user.savedDesigns) ? user.savedDesigns : [];
    const record = { ...design, id: design.id || `DES-${Date.now()}`, createdAt: design.createdAt || new Date().toISOString() };
    if (updateUser(user.id, { savedDesigns: [record, ...designs].slice(0, 30) })) {
      write(KEYS.designs, [record, ...designs].slice(0, 30));
      notify('Design saved to your profile.', 'design');
      toast('Design saved to your profile.');
      return true;
    }
    return false;
  }

  function saveOrder(order) {
    const user = getCurrentUser();
    if (!user) return false;
    const orders = Array.isArray(user.orders) ? user.orders : [];
    if (!updateUser(user.id, { orders: [order, ...orders] })) return false;
    notify(`Order ${order.id} confirmed.`, 'order');
    return true;
  }

  function toggleSavedStyle(style) {
    const user = getCurrentUser();
    const stored = read('havenly-favorite-styles', []);
    const saved = user ? [...(Array.isArray(user.savedStyles) ? user.savedStyles : [])] : (Array.isArray(stored) ? stored : []);
    const exists = saved.includes(style);
    const updated = exists ? saved.filter(item => item !== style) : [...saved, style];
    const success = user ? updateUser(user.id, { savedStyles: updated }) : write('havenly-favorite-styles', updated);
    if (!success) return null;
    toast(exists ? `${style} removed from saved styles.` : `${style} saved to your styles.`);
    return !exists;
  }

  function getSavedStyles() {
    const saved = getCurrentUser()?.savedStyles;
    const guest = read('havenly-favorite-styles', []);
    return Array.isArray(saved) ? saved : (Array.isArray(guest) ? guest : []);
  }

  function initials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'HA';
  }

  function renderHeader() {
    const user = getCurrentUser();
    const page = location.pathname.split('/').pop() || 'index.html';
    const authPage = ['login.html', 'signup.html', 'forgot-password.html', 'reset-password.html'].includes(page);
    const onboardingPage = page === 'onboarding.html';
    const appPage = Boolean(user) && !authPage && !onboardingPage && !['index.html', 'about.html', 'features.html', 'roadmap.html', 'pricing.html', 'contact.html'].includes(page);
    $$('.site-header .navbar').forEach(navbar => {
      navbar.replaceChildren();
      const brand = document.createElement('a');
      brand.className = 'brand';
      brand.href = 'index.html';
      brand.setAttribute('aria-label', 'Havenly AI home');
      brand.innerHTML = 'HAVENLY <span class="ai-gradient">AI</span>';
      navbar.append(brand);
      if (authPage) return;
      if (onboardingPage) {
        const progress = document.createElement('span');
        progress.className = 'onboarding-progress';
        progress.id = 'onboarding-progress';
        progress.textContent = '01 / 04';
        navbar.append(progress);
        return;
      }
      const nav = document.createElement('nav');
      nav.setAttribute('aria-label', appPage ? 'Application navigation' : 'Public navigation');
      const list = document.createElement('ul');
      list.className = 'nav-links';
      const links = appPage
        ? [['Dashboard', 'dashboard.html'], ['AI Studio', 'ai-studio.html'], ['Rooms', 'rooms.html'], ['Products', 'products.html'], ['Styles', 'styles.html'], ['Designers', 'designer.html'], ['Gallery', 'gallery.html']]
        : [['Home', 'index.html'], ['About', 'about.html'], ['Features', 'features.html'], ['Roadmap', 'roadmap.html'], ['Pricing', 'pricing.html']];
      links.forEach(([label, href]) => {
        const item = document.createElement('li');
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.textContent = label;
        if (page === href) anchor.className = 'current';
        item.append(anchor);
        list.append(item);
      });
      nav.append(list);
      navbar.append(nav);
      const actions = document.createElement('div');
      actions.className = 'nav-actions';
      if (appPage) {
        const theme = document.createElement('button');
        theme.type = 'button';
        theme.className = 'theme-toggle';
        theme.setAttribute('aria-label', 'Toggle theme');
        theme.textContent = '◐';
        actions.append(theme);
        const search = document.createElement('a');
        search.href = '#search';
        search.className = 'nav-icon';
        search.setAttribute('aria-label', 'Search products, rooms and styles');
        search.textContent = '⌕';
        actions.append(search);
        [['wishlist.html', 'Wishlist', '♡'], ['cart.html', 'Cart', '🛒']].forEach(([href, label, icon]) => {
          const link = document.createElement('a');
          link.href = href;
          link.className = 'nav-icon';
          link.setAttribute('aria-label', label);
          link.textContent = icon;
          actions.append(link);
        });
        const notification = document.createElement('div');
        notification.className = 'notification-control';
        notification.innerHTML = '<button type="button" class="notification-trigger" aria-label="Notifications" aria-expanded="false">♧<span class="notification-count"></span></button><div class="notification-menu" hidden><div class="notification-heading"><strong>Notifications</strong><button type="button" class="mark-read">Mark all read</button></div><div class="notification-list"></div><button type="button" class="clear-notifications">Clear</button></div>';
        actions.append(notification);
        renderNotifications(user, notification);
      } else {
        const signin = document.createElement('a');
        signin.className = 'auth-signin';
        signin.href = user ? 'dashboard.html' : 'login.html';
        signin.textContent = user ? 'Open App →' : 'Sign In';
        actions.append(signin);
        const signup = document.createElement('a');
        signup.className = 'auth-signup';
        signup.href = user ? 'dashboard.html' : 'signup.html';
        signup.textContent = user ? 'Dashboard' : 'Get Started →';
        actions.append(signup);
      }
      if (appPage) {
        const control = document.createElement('div');
        control.className = 'auth-control';
        control.innerHTML = `<button type="button" class="account-trigger" aria-expanded="false" aria-haspopup="true"><span class="account-avatar">${initials(user.name)}</span><span class="account-greeting">Hi, ${escapeHtml(user.name.split(' ')[0])}</span></button><div class="account-menu" hidden><a href="profile.html">My Profile</a><a href="saved-designs.html">Saved Designs</a><a href="orders.html">Orders</a><a href="settings.html">Settings</a><hr><button type="button" class="logout-trigger">Logout</button></div>`;
        actions.append(control);
        const avatar = $('.account-avatar', control);
        if (user.photo) {
          const image = document.createElement('img');
          image.src = user.photo;
          image.alt = '';
          image.className = 'account-avatar-image';
          avatar.replaceChildren(image);
        }
      }
      navbar.append(actions);
      const toggle = document.createElement('button');
      toggle.className = 'nav-menu-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
      toggle.textContent = '☰';
      navbar.append(toggle);
      nav.addEventListener('click', event => {
        if (event.target.closest('a')) {
          navbar.classList.remove('nav-open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-label', 'Open navigation menu');
        }
      });
      toggle.addEventListener('click', () => {
        const open = navbar.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      });
    });
    setupAccountMenu();
    setupPublicCallsToAction(user);
  }

  function setupPublicCallsToAction(user) {
    $$('[data-public-cta]').forEach(link => {
      link.href = user ? 'dashboard.html' : 'signup.html';
      link.textContent = user ? 'OPEN APP →' : (link.dataset.publicCta || 'GET STARTED →');
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function renderNotifications(user, container) {
    const list = $('.notification-list', container);
    const notifications = Array.isArray(user.notifications) ? user.notifications : [];
    const unread = notifications.filter(item => !item.read).length;
    const badge = $('.notification-count', container);
    badge.textContent = unread ? String(unread) : '';
    list.replaceChildren();
    if (!notifications.length) {
      list.textContent = "You're all caught up.";
      return;
    }
    notifications.slice(0, 8).forEach(item => {
      const row = document.createElement('p');
      row.className = item.read ? 'notification-item' : 'notification-item unread';
      const icon = ({ design: '✦', wishlist: '♡', order: '✓', profile: '◉', recommendation: '✧' })[item.type] || '•';
      row.textContent = `${icon} ${item.message} · ${new Date(item.createdAt).toLocaleString()}`;
      list.append(row);
    });
  }

  function setupAccountMenu() {
    $$('.account-trigger').forEach(trigger => {
      const menu = $('.account-menu', trigger.parentElement);
      trigger.onclick = () => {
        const open = menu.hidden;
        menu.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
      };
      $('.logout-trigger', menu)?.addEventListener('click', openLogoutModal);
    });
    $$('.notification-trigger').forEach(trigger => {
      const menu = $('.notification-menu', trigger.parentElement);
      trigger.onclick = () => {
        menu.hidden = !menu.hidden;
        trigger.setAttribute('aria-expanded', String(!menu.hidden));
      };
      $('.mark-read', menu)?.addEventListener('click', () => {
        const user = getCurrentUser();
        if (!user) return;
        user.notifications = (user.notifications || []).map(item => ({ ...item, read: true }));
        updateUser(user.id, { notifications: user.notifications });
      });
      $('.clear-notifications', menu)?.addEventListener('click', () => {
        const user = getCurrentUser();
        if (user) updateUser(user.id, { notifications: [] });
      });
    });
    if (!menuDocumentHandlersBound) {
      document.addEventListener('click', event => {
        if (!event.target.closest('.auth-control')) $$('.account-menu').forEach(menu => {
          menu.hidden = true;
          $('.account-trigger', menu.parentElement)?.setAttribute('aria-expanded', 'false');
        });
        if (!event.target.closest('.notification-control')) $$('.notification-menu').forEach(menu => {
          menu.hidden = true;
          $('.notification-trigger', menu.parentElement)?.setAttribute('aria-expanded', 'false');
        });
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          $$('.account-menu,.notification-menu').forEach(menu => { menu.hidden = true; });
          $$('.account-trigger,.notification-trigger').forEach(button => button.setAttribute('aria-expanded', 'false'));
        }
      });
      menuDocumentHandlersBound = true;
    }
  }

  function openLogoutModal() {
    const modal = document.createElement('div');
    modal.className = 'account-modal';
    modal.innerHTML = '<section role="dialog" aria-modal="true" aria-labelledby="logout-heading"><button type="button" class="modal-close" aria-label="Close">×</button><h2 id="logout-heading">Sign out of Havenly AI?</h2><p>You can sign back in whenever you are ready to design again.</p><div class="wizard-actions"><button type="button" class="btn btn-secondary cancel-logout">Cancel</button><button type="button" class="btn btn-primary confirm-logout">SIGN OUT</button></div></section>';
    document.body.append(modal);
    let escape;
    const close = () => {
      modal.remove();
      if (escape) document.removeEventListener('keydown', escape);
    };
    $('.modal-close', modal).onclick = close;
    $('.cancel-logout', modal).onclick = close;
    $('.confirm-logout', modal).onclick = () => {
      close();
      logoutUser();
      toast('You have been logged out.');
      setTimeout(() => { location.href = 'index.html'; }, 500);
    };
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    escape = event => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', escape);
    $('.cancel-logout', modal).focus();
  }

  function setFieldError(field, message) {
    const holder = field.closest('.field') || field.parentElement;
    let error = $('.error-message', holder);
    if (!error) {
      error = document.createElement('small');
      error.className = 'error-message';
      error.setAttribute('aria-live', 'polite');
      holder.append(error);
    }
    error.textContent = message;
    field.classList.toggle('valid', !message);
    field.setAttribute('aria-invalid', String(Boolean(message)));
  }

  function setupPasswordControls() {
    $$('[data-password-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
      });
    });
    const password = $('#signup-password, #reset-password, #change-password-new');
    if (!password) return;
    password.addEventListener('input', () => {
      const checks = [
        password.value.length >= 8,
        /[A-Z]/.test(password.value),
        /[a-z]/.test(password.value),
        /\d/.test(password.value),
        /[^A-Za-z0-9]/.test(password.value)
      ];
      const score = checks.filter(Boolean).length;
      const strength = $('#password-strength');
      if (strength) {
        strength.dataset.level = score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong';
        strength.textContent = `Password strength: ${score < 3 ? 'Weak' : score < 5 ? 'Medium' : 'Strong'}`;
      }
      $$('.password-requirements li').forEach((item, index) => item.classList.toggle('valid', checks[index]));
    });
  }

  function setupSignup() {
    const form = $('#signup-form');
    if (!form) return;
    if (isLoggedIn()) {
      location.replace('dashboard.html');
      return;
    }
    $('#signup-email').addEventListener('input', () => $('.duplicate-account')?.remove());
    form.addEventListener('submit', event => {
      event.preventDefault();
      const name = $('#signup-name');
      const email = $('#signup-email');
      const mobile = $('#signup-mobile');
      const password = $('#signup-password');
      const confirm = $('#signup-confirm');
      const checks = [
        [name, name.value.trim().length >= 2 && /^[\p{L} ]+$/u.test(name.value.trim()), 'Enter a valid name using letters and spaces.'],
        [email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()), 'Enter a valid email address.'],
        [mobile, /^(?:\+91[\s-]?)?[6-9]\d{9}$/.test(mobile.value.replace(/\s/g, '')), 'Enter a valid 10-digit Indian mobile number.'],
        [password, password.value.length >= 8 && /[A-Z]/.test(password.value) && /[a-z]/.test(password.value) && /\d/.test(password.value) && /[^A-Za-z0-9]/.test(password.value), 'Use 8+ characters with uppercase, lowercase, a number and a special character.'],
        [confirm, confirm.value === password.value, 'Passwords must match.']
      ];
      let valid = true;
      checks.forEach(([field, ok, message]) => { setFieldError(field, ok ? '' : message); valid = valid && ok; });
      const terms = $('#signup-terms');
      setFieldError(terms, terms.checked ? '' : 'Please accept Terms & Privacy.');
      valid = valid && terms.checked;
      if (!valid) return;
      const result = registerUser({ name: name.value, email: email.value, mobile: mobile.value, password: password.value });
      if (!result.ok) {
        if (result.reason === 'duplicate') {
          setFieldError(email, 'An account with this email already exists.');
          $('.duplicate-account')?.remove();
          const link = document.createElement('a');
          link.className = 'duplicate-account';
          const query = new URLSearchParams({ email: email.value.trim() });
          const returnTo = new URLSearchParams(location.search).get('returnTo');
          if (returnTo) query.set('returnTo', returnTo);
          link.href = `login.html?${query}`;
          link.textContent = 'SIGN IN INSTEAD';
          email.closest('.field').append(link);
        } else {
          const message = $('.auth-error', form);
          if (message) message.textContent = 'The account could not be saved in this browser. Check storage permissions and try again.';
          else toast('The account could not be saved in this browser. Check storage permissions and try again.');
        }
        return;
      }
      const loginResult = loginUser(result.user.email, password.value, false);
      if (!loginResult.ok) {
        $('.auth-error', form).textContent = 'Your account was created, but this browser could not start a session. Please sign in.';
        return;
      }
      form.reset();
      form.hidden = true;
      $('#signup-success')?.removeAttribute('hidden');
      const continueButton = $('#signup-success-continue');
      if (continueButton) {
        const returnTo = safeReturnTo(new URLSearchParams(location.search).get('returnTo'));
        continueButton.href = `onboarding.html${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
      }
    });
  }

  function setupLogin() {
    const form = $('#login-form');
    if (!form) return;
    if (isLoggedIn()) {
      location.replace('dashboard.html');
      return;
    }
    const params = new URLSearchParams(location.search);
    if (params.has('email')) $('#login-email').value = params.get('email');
    if (params.has('returnTo')) form.dataset.returnTo = safeReturnTo(params.get('returnTo'));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const email = $('#login-email');
      const password = $('#login-password');
      const message = $('.auth-error', form);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        setFieldError(email, 'Enter a valid email address.');
        return;
      }
      const button = $('button[type="submit"]', form);
      button.disabled = true;
      button.textContent = 'Signing in...';
      const result = loginUser(email.value, password.value, $('#login-remember').checked);
      setTimeout(() => {
        button.disabled = false;
        button.textContent = 'SIGN IN →';
        if (!result.ok) {
          message.textContent = result.reason === 'invalid' ? 'Incorrect email or password.' : 'Could not create a session in browser storage.';
          return;
        }
        message.textContent = `Welcome back, ${result.user.name.split(' ')[0]}!`;
        renderHeader();
        const returnTo = form.dataset.returnTo;
        toast(`Welcome back, ${result.user.name.split(' ')[0]}!`);
        const destination = returnTo || (result.user.onboardingComplete ? 'dashboard.html' : 'onboarding.html');
        setTimeout(() => { location.href = destination; }, 500);
      }, 250);
    });
  }

  function safeReturnTo(value) {
    return /^(?:dashboard|onboarding|profile|checkout|ai-studio|saved-designs|orders|settings|order-details|cart|wishlist)\.html(?:\?[A-Za-z0-9%._~=&+-]*)?$/.test(value || '') ? value : '';
  }

  function requireAuth() {
    const protectedPages = ['dashboard.html', 'onboarding.html', 'profile.html', 'checkout.html', 'saved-designs.html', 'orders.html', 'settings.html', 'order-details.html'];
    const page = location.pathname.split('/').pop();
    if (!protectedPages.includes(page) || isLoggedIn()) return;
    const returnTo = `${page}${location.search}`;
    location.replace(`login.html?returnTo=${encodeURIComponent(returnTo)}`);
  }

  function setupOnboarding() {
    const root = $('#onboarding-flow');
    if (!root) return;
    const user = getCurrentUser();
    if (!user) return;
    if (user.onboardingComplete) {
      location.replace('dashboard.html');
      return;
    }
    let step = 0;
    const selections = { ...(user.preferences || {}) };
    const panels = $$('.onboarding-step', root);
    const render = () => {
      panels.forEach((panel, index) => { panel.hidden = index !== step; });
      $('#onboarding-progress').textContent = `0${step + 1} / 04`;
      root.querySelectorAll('[data-onboarding-option]').forEach(option => {
        const key = option.dataset.preference;
        option.setAttribute('aria-pressed', String(selections[key] === option.dataset.onboardingOption));
      });
      $('#onboarding-back').hidden = step === 0;
      $('#onboarding-next').hidden = step === panels.length - 1;
      $('#onboarding-complete').hidden = step !== panels.length - 1;
    };
    const done = event => {
      const option = event.target.closest('[data-onboarding-option]');
      if (!option) return;
      selections[option.dataset.preference] = option.dataset.onboardingOption;
      render();
    };
    root.addEventListener('click', done);
    $('#onboarding-back').addEventListener('click', () => { if (step > 0) { step -= 1; render(); } });
    $('#onboarding-next').addEventListener('click', () => {
      const key = ['room', 'favoriteStyle', 'mood'][step];
      if (!selections[key]) { toast('Choose an option to continue.'); return; }
      step = Math.min(step + 1, panels.length - 1);
      render();
    });
    $('#onboarding-complete').addEventListener('click', () => {
      if (!selections.budget) { toast('Choose a budget to finish setup.'); return; }
      const roomMap = { 'Home Office': 'Office' };
      const moodMap = { 'Warm & Cozy': 'Warm', 'Clean & Neutral': 'Neutral', 'Dark & Luxurious': 'Dark Luxury', 'Natural & Earthy': 'Earthy', 'Bright & Airy': 'Cool', 'Bold & Creative': 'Pastel' };
      const budgetMap = {
        'Under ₹25,000': 'Budget',
        '₹25,000 – ₹50,000': 'Budget',
        '₹50,000 – ₹1,00,000': 'Balanced',
        '₹1,00,000 – ₹2,00,000': 'Premium',
        '₹2,00,000+': 'Luxury'
      };
      const preferences = {
        ...selections,
        favoriteRoom: roomMap[selections.room] || selections.room,
        preferredMood: moodMap[selections.mood] || selections.mood,
        budgetPreference: budgetMap[selections.budget]
      };
      if (!updateUser(user.id, { preferences, onboardingComplete: true })) return;
      write(KEYS.preferences, preferences);
      write('havenly-studio-preferences', preferences);
      const returnTo = safeReturnTo(new URLSearchParams(location.search).get('returnTo'));
      root.hidden = true;
      $('#onboarding-finished').hidden = false;
      $('#onboarding-finished-room').textContent = preferences.room;
      $('#onboarding-finished-style').textContent = preferences.favoriteStyle;
      $('#onboarding-finished-mood').textContent = preferences.mood;
      $('#onboarding-finished-budget').textContent = preferences.budget;
      $('#onboarding-enter').href = returnTo || 'dashboard.html';
    });
    render();
  }

  function setupDashboard() {
    const dashboard = $('#account-dashboard');
    const user = getCurrentUser();
    if (!dashboard || !user) return;
    $('#dashboard-welcome').textContent = `Welcome back, ${user.name.split(' ')[0]}.`;
    const preferences = user.preferences || {};
    $('#dashboard-style').textContent = preferences.favoriteStyle || 'Discover your style';
    $('#dashboard-room').textContent = preferences.room || 'Choose a room';
    $('#dashboard-mood').textContent = preferences.mood || 'Set your mood';
    $('#dashboard-recommendation').textContent = preferences.favoriteStyle
      ? `Warm oak furniture could complement your ${preferences.favoriteStyle} style and ${preferences.mood || 'preferred'} palette.`
      : 'Explore styles to get a more personal furniture recommendation.';
    $('#dashboard-design-count').textContent = String((user.savedDesigns || []).length);
    $('#dashboard-wishlist-count').textContent = String((user.wishlist || []).length);
    const latest = (user.savedDesigns || [])[0];
    const designName = $('#dashboard-current-design');
    if (latest) {
      designName.textContent = latest.name || `${latest.style || 'Personalized'} ${latest.room || 'room'} concept`;
      $('#dashboard-current-detail').textContent = [latest.style, latest.room, latest.budget].filter(Boolean).join(' · ');
    } else {
      designName.textContent = 'Your first design is waiting';
      $('#dashboard-current-detail').textContent = 'Start a new concept in AI Studio.';
    }
    const recent = read('havenly-recently-viewed', []);
    const recentList = $('#dashboard-recent-products');
    if (recentList) {
      recentList.replaceChildren();
      (Array.isArray(recent) ? recent.slice(0, 4) : []).forEach(product => {
        const link = document.createElement('a');
        link.href = `product-details.html?id=${encodeURIComponent(product.id)}`;
        if (product.image) {
          const image = document.createElement('img');
          image.src = product.image;
          image.alt = '';
          link.append(image);
        }
        const label = document.createElement('span');
        label.textContent = product.name || 'Recently viewed item';
        link.append(label);
        recentList.append(link);
      });
      if (!recentList.childElementCount) recentList.textContent = 'Your product discoveries will appear here.';
    }
  }

  function setupRecovery() {
    const recovery = $('#forgot-form');
    recovery?.addEventListener('submit', event => {
      event.preventDefault();
      const email = $('#recovery-email').value.trim().toLowerCase();
      const user = users().find(item => item.email === email);
      const message = $('.auth-error', recovery);
      if (!user) {
        message.textContent = 'No Havenly account was found for this email.';
        return;
      }
      sessionStorage.setItem('havenly_recovery_email', email);
      $('#recovery-form-step').hidden = true;
      $('#recovery-success-step').hidden = false;
      $('#recovery-success-step a').href = 'reset-password.html';
    });
    const reset = $('#reset-form');
    reset?.addEventListener('submit', event => {
      event.preventDefault();
      const email = sessionStorage.getItem('havenly_recovery_email');
      const user = users().find(item => item.email === email);
      const password = $('#reset-password');
      const confirm = $('#reset-confirm');
      const validPassword = password.value.length >= 8 && /[A-Z]/.test(password.value) && /[a-z]/.test(password.value) && /\d/.test(password.value) && /[^A-Za-z0-9]/.test(password.value);
      setFieldError(password, validPassword ? '' : 'Use 8+ characters with uppercase, lowercase, a number and a special character.');
      setFieldError(confirm, confirm.value === password.value ? '' : 'Passwords must match.');
      if (!user) { $('.auth-error', reset).textContent = 'Return to password recovery and confirm an account email first.'; return; }
      if (!validPassword || password.value !== confirm.value) return;
      const all = users().map(item => item.id === user.id ? { ...item, password: password.value } : item);
      if (write(KEYS.users, all)) {
        sessionStorage.removeItem('havenly_recovery_email');
        $('#reset-success').hidden = false;
        reset.hidden = true;
      }
    });
  }

  function setupProfilePage() {
    const page = $('#account-profile');
    if (!page) return;
    const user = getCurrentUser();
    if (!user) return;
    const avatar = $('.profile-avatar-large', page);
    const name = $('#account-name');
    const email = $('#account-email');
    const mobile = $('#account-mobile');
    if (avatar) {
      avatar.textContent = initials(user.name);
      if (user.photo) {
        const image = document.createElement('img');
        image.src = user.photo;
        image.alt = 'Profile photo';
        avatar.replaceChildren(image);
      }
    }
    if (name) name.textContent = user.name;
    if (email) email.textContent = user.email;
    if (mobile) mobile.textContent = user.mobile || 'Not set';
    const member = $('#member-since');
    if (member) member.textContent = new Date(user.createdAt).toLocaleDateString();
    const stats = {
      'stat-designs': (user.savedDesigns || []).length,
      'stat-wishlist': (user.wishlist || []).length,
      'stat-orders': (user.orders || []).length,
      'stat-ai': user.aiDesignCount || 0
    };
    Object.entries(stats).forEach(([id, count]) => { const target = document.getElementById(id); if (target) target.textContent = String(count); });
    const styleList = $('#profile-style-list');
    if (styleList) {
      styleList.replaceChildren();
      const styles = getSavedStyles();
      if (!styles.length) styleList.append(Object.assign(document.createElement('li'), { textContent: 'No saved styles yet.' }));
      styles.forEach(style => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `style-details.html?style=${encodeURIComponent(style.toLowerCase().replace(/\s+/g, '-'))}`;
        link.textContent = style;
        item.append(link);
        styleList.append(item);
      });
    }
    const recentHost = $('#recently-viewed');
    if (recentHost) {
      recentHost.replaceChildren();
      const recent = read('havenly-recently-viewed', []);
      if (Array.isArray(recent) && recent.length) {
        recentHost.append(Object.assign(document.createElement('h2'), { textContent: 'Recently Viewed' }));
        const row = document.createElement('div');
        row.className = 'recently-viewed-row';
        recent.forEach(product => {
          if (!product || !product.id) return;
          const link = document.createElement('a');
          link.href = `product-details.html?id=${encodeURIComponent(product.id)}`;
          link.textContent = product.name;
          row.append(link);
        });
        recentHost.append(row);
      }
    }
    const form = $('#account-edit-form');
    if (form) {
      $('#edit-name').value = user.name;
      $('#edit-email').value = user.email;
      $('#edit-mobile').value = user.mobile || '';
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!$('#edit-name').value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('#edit-email').value.trim())) {
          $('.auth-error', form).textContent = 'Enter a valid name and email address.';
          return;
        }
        const collision = users().some(item => item.id !== user.id && item.email === $('#edit-email').value.trim().toLowerCase());
        if (collision) { $('.auth-error', form).textContent = 'This email is already in use.'; return; }
        updateUser(user.id, { name: $('#edit-name').value.trim(), email: $('#edit-email').value.trim().toLowerCase(), mobile: $('#edit-mobile').value.trim() });
        notify('Profile updated successfully.', 'profile');
        toast('Profile updated successfully.');
        location.reload();
      });
    }
    setupPhotoUpload(user);
  }

  function setupPhotoUpload(user) {
    const input = $('#profile-photo');
    const preview = $('#profile-photo-preview');
    if (!input || !preview) return;
    if (user.photo) { preview.src = user.photo; preview.hidden = false; }
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      if (file.size > 500000) { toast('Choose an image under 500 KB for browser storage.'); input.value = ''; return; }
      const reader = new FileReader();
      reader.onload = () => {
        preview.src = String(reader.result);
        preview.hidden = false;
        updateUser(user.id, { photo: String(reader.result) });
      };
      reader.onerror = () => toast('Could not read this image file.');
      reader.readAsDataURL(file);
    });
    $('#remove-profile-photo')?.addEventListener('click', () => confirmAction('Remove profile photo?', 'Your avatar will return to initials.', () => {
      updateUser(user.id, { photo: '' });
      preview.removeAttribute('src');
      preview.hidden = true;
    }));
  }

  function setupSettings() {
    const form = $('#settings-form');
    const user = getCurrentUser();
    if (!form || !user) return;
    const passwordForm = $('#change-password-form');
    const accountTab = $('[data-tab-target="settings-account"]');
    if (passwordForm) {
      passwordForm.hidden = accountTab?.getAttribute('aria-selected') !== 'true';
      $$('[data-tab-target^="settings-"]').forEach(tab => tab.addEventListener('click', () => {
        passwordForm.hidden = tab.dataset.tabTarget !== 'settings-account';
      }));
    }
    const prefs = user.preferences || {};
    $$('[name="appearance"]').forEach(input => { input.checked = (prefs.appearance || read(KEYS.theme, 'light')) === input.value; });
    $$('[data-preference]').forEach(input => {
      const value = prefs[input.dataset.preference];
      if (input.type === 'checkbox') input.checked = value !== false;
      else if (value) input.value = value;
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const next = { ...(getCurrentUser().preferences || {}) };
      $$('[name="appearance"]:checked', form).forEach(input => { next.appearance = input.value; });
      $$('[data-preference]', form).forEach(input => { next[input.dataset.preference] = input.type === 'checkbox' ? input.checked : input.value; });
      updateUser(user.id, { preferences: next });
      notify('Settings saved.', 'settings');
      const appearance = next.appearance || 'light';
      const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      document.body.classList.toggle('ai-dark', appearance === 'dark' || (appearance === 'system' && systemDark));
      write(KEYS.theme, appearance);
      toast('Settings saved.');
    });
    $('#change-password-form')?.addEventListener('submit', event => {
      event.preventDefault();
      const current = $('#change-password-current').value;
      const next = $('#change-password-new').value;
      const confirm = $('#change-password-confirm').value;
      const valid = next.length >= 8 && /[A-Z]/.test(next) && /[a-z]/.test(next) && /\d/.test(next) && /[^A-Za-z0-9]/.test(next);
      const message = $('.auth-error', event.currentTarget);
      if (!valid || next !== confirm) { message.textContent = 'Enter a strong matching new password.'; return; }
      if (!changePassword(current, next)) { message.textContent = 'Current password is incorrect.'; return; }
      message.textContent = 'Password changed successfully.';
      toast('Password changed successfully.');
      event.currentTarget.reset();
    });
  }

  function setupSavedDesigns() {
    const container = $('#saved-design-list');
    if (!container) return;
    const user = getCurrentUser();
    const designs = user?.savedDesigns || [];
    container.replaceChildren();
    if (!designs.length) {
      container.innerHTML = '<div class="empty-state"><h2>No saved designs yet.</h2><p>Start designing your dream space.</p><a class="btn btn-primary" href="ai-studio.html">CREATE YOUR FIRST DESIGN →</a></div>';
      return;
    }
    designs.forEach(design => {
      const card = document.createElement('article');
      card.className = 'account-card';
      const previewImage = design.image ? `<img src="${escapeHtml(design.image)}" alt="${escapeHtml(`${design.room || 'Room'} design preview`)}">` : '';
      card.innerHTML = `<div class="design-preview">${previewImage}<span>${escapeHtml(design.style || 'Modern')}</span></div><span class="ai-pill">SAVED DESIGN</span><h2>${escapeHtml(`${design.style || 'Modern'} ${design.room || 'Room'}`)}</h2><p>${escapeHtml(`${design.mood || 'Warm'} mood · ${design.budget || 'Budget not set'}`)}</p><small>${new Date(design.createdAt).toLocaleDateString()}</small><div class="wizard-actions"><button class="btn btn-secondary view-design" type="button">VIEW</button><a class="btn btn-secondary" href="ai-studio.html?room=${encodeURIComponent(design.room || '')}&style=${encodeURIComponent(design.style || '')}">CONTINUE DESIGNING</a><a class="btn btn-primary" href="products.html">SHOP THIS LOOK</a><button class="btn btn-secondary delete-design" type="button">DELETE</button></div>`;
      $('.view-design', card).onclick = () => showInfoModal('Saved Design', `${design.style || 'Modern'} ${design.room || 'room'} · ${design.mood || 'Warm'} · ${design.budget || 'Budget not set'}`);
      $('.delete-design', card).onclick = () => confirmAction('Delete saved design?', 'This design will be removed from your profile.', () => {
        updateUser(user.id, { savedDesigns: user.savedDesigns.filter(item => item.id !== design.id) });
        setupSavedDesigns();
        toast('Design deleted.');
      });
      container.append(card);
    });
  }

  function setupOrders() {
    const container = $('#order-list');
    if (!container) return;
    const orders = getCurrentUser()?.orders || [];
    container.replaceChildren();
    if (!orders.length) {
      container.innerHTML = '<div class="empty-state"><h2>No orders yet.</h2><a class="btn btn-primary" href="products.html">START SHOPPING →</a></div>';
      return;
    }
    orders.forEach(order => {
      const row = document.createElement('article');
      row.className = 'account-card order-card';
      row.innerHTML = `<div><strong>${escapeHtml(order.id)}</strong><p>${new Date(order.createdAt).toLocaleDateString()} · ${(order.items || []).length} item types</p></div><strong>${escapeHtml(order.total || '')}</strong><span class="ai-pill">${escapeHtml(order.status || 'Confirmed')} · DEMO</span><a class="btn btn-secondary" href="order-details.html?id=${encodeURIComponent(order.id)}">VIEW ORDER</a>`;
      container.append(row);
    });
  }

  function setupOrderDetails() {
    const container = $('#order-detail');
    if (!container) return;
    const id = new URLSearchParams(location.search).get('id');
    const order = (getCurrentUser()?.orders || []).find(item => item.id === id);
    if (!order) { container.textContent = 'This demo order could not be found.'; return; }
    const title = document.createElement('h1');
    title.textContent = `Order ${order.id}`;
    const rows = document.createElement('ul');
    (order.items || []).forEach(item => {
      const row = document.createElement('li');
      row.textContent = `${item.name} × ${item.quantity || 1} — ${formatDemoPrice(item.price)}`;
      rows.append(row);
    });
    container.append(title, document.createTextNode(new Date(order.createdAt).toLocaleString()), rows, document.createTextNode(`Delivery: ${order.address || 'Demo address'} · Payment: ${order.payment || 'Demo payment'} · Status: ${order.status || 'Confirmed'} · Total: ${order.total || ''}`));
  }

  function confirmAction(title, description, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'account-modal';
    modal.innerHTML = `<section role="dialog" aria-modal="true"><button type="button" class="modal-close" aria-label="Close">×</button><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><div class="wizard-actions"><button type="button" class="btn btn-secondary cancel-action">Cancel</button><button type="button" class="btn btn-primary confirm-action">Confirm</button></div></section>`;
    document.body.append(modal);
    let escape;
    const close = () => {
      modal.remove();
      if (escape) document.removeEventListener('keydown', escape);
    };
    $$('.modal-close,.cancel-action', modal).forEach(button => { button.onclick = close; });
    $('.confirm-action', modal).onclick = () => { close(); onConfirm(); };
    escape = event => {
      if (event.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', escape);
  }

  function showInfoModal(title, description) {
    const modal = document.createElement('div');
    modal.className = 'account-modal';
    modal.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="account-modal-title"><button type="button" class="modal-close" aria-label="Close">×</button><h2 id="account-modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><button type="button" class="btn btn-primary modal-dismiss">CLOSE</button></section>`;
    document.body.append(modal);
    let escape;
    const close = () => {
      modal.remove();
      if (escape) document.removeEventListener('keydown', escape);
    };
    $$('.modal-close,.modal-dismiss', modal).forEach(button => { button.onclick = close; });
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    escape = event => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', escape);
  }

  function personalizeHome() {
    const user = getCurrentUser();
    const title = $('.hero-content h1');
    if (!user || !title) return;
    title.textContent = `Welcome back, ${user.name.split(' ')[0]}`;
    const paragraph = $('.hero-content > p');
    if (paragraph) paragraph.textContent = 'Your Havenly space is ready. Continue designing or explore pieces selected for you.';
    const primary = $('.hero-actions a');
    if (primary) { primary.textContent = 'Continue Designing'; primary.href = 'ai-studio.html'; }
  }

  function setupFooter() {
    $$('footer.site-footer .footer-grid > div').forEach(column => {
      if (!/Explore/i.test($('h4', column)?.textContent || '')) return;
      const list = $('ul', column);
      if (!list) return;
      const links = [
        ['Home', 'index.html'], ['AI Studio', 'ai-studio.html'], ['FSD Lab', 'fsd-lab.html'], ['SDLC', 'sdlc.html']
      ];
      links.forEach(([label, href]) => {
        if ([...list.querySelectorAll('a')].some(anchor => anchor.href.endsWith(href))) return;
        const item = document.createElement('li');
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.textContent = label;
        item.append(anchor);
        list.append(item);
      });
      const accountHref = isLoggedIn() ? 'profile.html' : 'login.html';
      if (![...list.querySelectorAll('a')].some(anchor => anchor.href.endsWith(accountHref))) {
        const item = document.createElement('li');
        const anchor = document.createElement('a');
        anchor.href = accountHref;
        anchor.textContent = isLoggedIn() ? 'My Profile' : 'Sign In';
        item.append(anchor);
        list.append(item);
      }
    });
  }

  function setupPublicFooter() {
    $$('.public-footer').forEach(footer => {
      footer.innerHTML = '<div class="container public-footer-grid"><div class="public-footer-brand"><a class="brand" href="index.html">HAVENLY <span class="ai-gradient">AI</span></a><p>Design intelligence for spaces that feel like you.</p><a class="btn btn-primary" data-public-cta="GET STARTED →" href="signup.html">GET STARTED →</a></div><div><h2>Explore</h2><a href="index.html">Home</a><a href="about.html">About</a><a href="features.html">Features</a><a href="roadmap.html">Roadmap</a><a href="pricing.html">Pricing</a></div><div><h2>Product</h2><a href="ai-studio.html">AI Studio</a><a href="rooms.html">Rooms</a><a href="products.html">Furniture</a></div><div><h2>Company</h2><a href="contact.html">Contact</a><a href="fsd-lab.html">FSD Project</a><a href="sdlc.html">SDLC</a></div><small class="public-footer-note">© Havenly AI · Design preview and account features are frontend prototypes.</small></div>';
      setupPublicCallsToAction(getCurrentUser());
    });
  }

  function setupMarketingInteractions() {
    const dialog = $('#feature-dialog');
    $$('[data-feature-open]').forEach(button => button.addEventListener('click', () => {
      if (!dialog) return;
      $('#feature-dialog-title').textContent = button.dataset.featureOpen;
      $('#feature-dialog-copy').textContent = `${button.dataset.featureCopy} This project experience is a frontend prototype.`;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }));
    $('[data-close-dialog]')?.addEventListener('click', () => dialog?.close());
    dialog?.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    $$('[data-plan]').forEach(button => button.addEventListener('click', event => {
      if (!isLoggedIn()) return;
      event.preventDefault();
      toast('Plan selection is available in demo mode.');
    }));
  }

  function init() {
    if (!localStorage.getItem('havenly_guest_cart')) write('havenly_guest_cart', read(KEYS.cart, []));
    if (!localStorage.getItem('havenly_guest_wishlist')) write('havenly_guest_wishlist', read(KEYS.wishlist, []));
    const active = getCurrentUser();
    if (active) {
      write(KEYS.cart, Array.isArray(active.cart) ? active.cart : []);
      write(KEYS.wishlist, Array.isArray(active.wishlist) ? active.wishlist : []);
      if (active.preferences?.appearance) write(KEYS.theme, active.preferences.appearance);
      if (active.preferences?.favoriteStyle && !(active.notifications || []).some(item => item.type === 'recommendation')) {
        notify(`New rules-based recommendation for your ${active.preferences.favoriteStyle} style.`, 'recommendation');
      }
    }
    renderHeader();
    requireAuth();
    setupPasswordControls();
    setupSignup();
    setupLogin();
    setupRecovery();
    setupProfilePage();
    setupSettings();
    setupSavedDesigns();
    setupOrders();
    setupOrderDetails();
    setupFooter();
    setupPublicFooter();
    setupMarketingInteractions();
    setupOnboarding();
    setupDashboard();
  }

  window.HavenlyAuth = {
    registerUser, loginUser, logoutUser, getCurrentUser, isLoggedIn, updateUser,
    changePassword, rememberUser, addSavedDesign, saveOrder, notify, renderHeader, toggleSavedStyle, getSavedStyles,
    getUserData: getCurrentUser, read, write, keys: KEYS, safeReturnTo
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
