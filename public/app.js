// ============================================
// Sister Barista — Loyalty Card App
// ============================================

const SUPABASE_URL = 'https://utgjttxkajslmillhgtj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z2p0dHhrYWpzbG1pbGxoZ3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MDUyMzIsImV4cCI6MjA5MTM4MTIzMn0.iNjVX6tGSPX4s4jS1i46ja5f3LXSjWppQzcOcVQ6VIg';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;
let selectedCustomer = null;

// ============================================
// Auth
// ============================================

async function handleAuth() {
  const nameEl = document.getElementById('auth-name');
  const email = document.getElementById('auth-email').value.trim();
  const name = nameEl ? nameEl.value.trim() : '';
  const errorEl = document.getElementById('auth-error');
  const btn = document.getElementById('auth-submit');

  errorEl.style.display = 'none';

  if (!email) {
    errorEl.textContent = 'Please enter your email';
    errorEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending magic link...';

  const options = {
    emailRedirectTo: window.location.origin
  };
  if (name) {
    options.data = { name };
  }

  const { error } = await sb.auth.signInWithOtp({ email, options });

  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Send magic link';
    return;
  }

  document.getElementById('auth-step-email').style.display = 'none';
  document.getElementById('auth-step-otp').style.display = 'block';
  document.getElementById('auth-sent-email').textContent = email;
}

function showSignInMode() {
  document.getElementById('auth-name').style.display = 'none';
  document.getElementById('auth-submit').textContent = 'Send magic link';
  document.getElementById('auth-toggle').innerHTML = 'New here? <a href="#" onclick="showSignUpMode(); return false;">Sign up</a>';
}

function showSignUpMode() {
  document.getElementById('auth-name').style.display = 'block';
  document.getElementById('auth-submit').textContent = 'Get started';
  document.getElementById('auth-toggle').innerHTML = 'Already a member? <a href="#" onclick="showSignInMode(); return false;">Sign in</a>';
}

async function handleLogout() {
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  selectedCustomer = null;
  showScreen('auth-screen');
}

// ============================================
// Navigation
// ============================================

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ============================================
// Customer View
// ============================================

async function loadCustomerView() {
  const profile = currentProfile;
  document.getElementById('customer-name').textContent = profile.name || 'there';

  // Get active stamp card
  const { data: cards } = await sb
    .from('stamp_cards')
    .select('*')
    .eq('customer_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const activeCard = cards?.find(c => !c.is_complete);
  const redeemableCard = cards?.find(c => c.is_complete && !c.reward_redeemed);
  const stamps = activeCard?.stamps_collected || 0;

  // Update stamp count
  document.getElementById('stamp-count').textContent = `${stamps} / 10`;

  // Render stamp grid
  const grid = document.getElementById('stamps-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const slot = document.createElement('div');
    const isFilled = i < stamps;
    const isLastSlot = i === 9;
    slot.className = `stamp-slot${isFilled ? ' filled' : ''}`;
    
    if (isFilled) {
      if (isLastSlot) {
        // Gold star for completed 10th slot
        slot.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#d4a017" stroke="#d4a017" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      } else {
        // Coffee cup for filled slot
        slot.innerHTML = `<svg class="stamp-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 110 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/></svg>`;
      }
    } else if (isLastSlot) {
      // Gold star placeholder for empty 10th slot
      slot.innerHTML = `<svg class="star-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }
    
    grid.appendChild(slot);
  }

  // Reward banner
  const rewardBanner = document.getElementById('reward-banner');
  rewardBanner.style.display = redeemableCard ? 'flex' : 'none';

  // Load recent activity
  const { data: events } = await sb
    .from('stamp_events')
    .select('*')
    .eq('customer_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const activityList = document.getElementById('activity-list');
  if (events && events.length > 0) {
    activityList.innerHTML = events.map(e => {
      const date = new Date(e.created_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      const label = e.own_cup
        ? `+${e.stamps_awarded} stamp (own cup bonus!)`
        : `+${e.stamps_awarded} stamp`;
      const ecoIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 2px;"><path d="M7 21h10"/><path d="M12 21V11"/><path d="M5 11l2.5-7h9L19 11"/></svg>`;
      return `
        <div class="activity-item">
          <div>
            <div class="label">${label}</div>
            ${e.own_cup ? `<div class="bonus">${ecoIcon} Eco bonus</div>` : ''}
          </div>
          <div class="date">${date}</div>
        </div>
      `;
    }).join('');
  } else {
    activityList.innerHTML = '<p class="empty-state">No stamps yet - grab a coffee!</p>';
  }
}

// ============================================
// Staff View
// ============================================

let allCustomers = [];
let customerCards = {};

async function loadStaffView() {
  const listEl = document.getElementById('customer-list');
  listEl.innerHTML = '<p class="empty-state">Loading customers...</p>';

  // Load all customers
  const { data: customers, error } = await sb
    .from('profiles')
    .select('id, name, email')
    .eq('role', 'customer')
    .order('name', { ascending: true });

  if (error || !customers) {
    listEl.innerHTML = '<p class="empty-state">Could not load customers</p>';
    return;
  }

  allCustomers = customers;

  // Load all cards for these customers
  const customerIds = customers.map(c => c.id);
  if (customerIds.length > 0) {
    const { data: cards } = await sb
      .from('stamp_cards')
      .select('*')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false });

    // Group cards by customer
    customerCards = {};
    cards?.forEach(card => {
      if (!customerCards[card.customer_id]) {
        customerCards[card.customer_id] = [];
      }
      customerCards[card.customer_id].push(card);
    });
  }

  renderCustomerList(allCustomers);
}

function renderCustomerList(customers) {
  const listEl = document.getElementById('customer-list');

  if (!customers || customers.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No customers found</p>';
    return;
  }

  listEl.innerHTML = customers.map(c => {
    const cards = customerCards[c.id] || [];
    const activeCard = cards.find(card => !card.is_complete);
    const unredeemedCount = cards.filter(card => card.is_complete && !card.reward_redeemed).length;
    const stamps = activeCard?.stamps_collected || 0;

    const rewardBadge = unredeemedCount > 0 
      ? `<span class="reward-indicator">
           <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
           ${unredeemedCount}
         </span>`
      : '';

    return `
      <div class="customer-list-item" onclick="selectCustomer('${c.id}')">
        <div class="customer-info">
          <span class="name">${c.name || 'Unnamed'}</span>
          <span class="stamps">${stamps}/10 stamps</span>
        </div>
        <div class="customer-badges">
          ${rewardBadge}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    `;
  }).join('');
}

function filterCustomers(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderCustomerList(allCustomers);
    return;
  }
  const filtered = allCustomers.filter(c => 
    (c.name && c.name.toLowerCase().includes(q)) ||
    (c.email && c.email.toLowerCase().includes(q))
  );
  renderCustomerList(filtered);
}

async function selectCustomer(id) {
  const customer = allCustomers.find(c => c.id === id);
  if (!customer) return;

  selectedCustomer = { id, name: customer.name, email: customer.email };

  // Show detail view, hide list view
  document.getElementById('staff-list-view').style.display = 'none';
  document.getElementById('staff-detail-view').style.display = 'flex';

  document.getElementById('detail-name').textContent = customer.name || 'Unnamed';
  document.getElementById('detail-email').textContent = customer.email || '';

  await refreshSelectedCustomer();
}

async function refreshSelectedCustomer() {
  if (!selectedCustomer) return;

  // Reload cards for this customer
  const { data: cards } = await sb
    .from('stamp_cards')
    .select('*')
    .eq('customer_id', selectedCustomer.id)
    .order('created_at', { ascending: false });

  customerCards[selectedCustomer.id] = cards || [];

  const activeCard = cards?.find(c => !c.is_complete);
  const unredeemedCards = cards?.filter(c => c.is_complete && !c.reward_redeemed) || [];
  const redeemedCards = cards?.filter(c => c.is_complete && c.reward_redeemed) || [];

  // Rewards summary
  const summaryEl = document.getElementById('detail-rewards-summary');
  if (unredeemedCards.length > 0) {
    summaryEl.className = 'rewards-summary';
    summaryEl.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      ${unredeemedCards.length} free coffee${unredeemedCards.length > 1 ? 's' : ''} available
    `;
  } else {
    summaryEl.className = 'rewards-summary no-rewards';
    summaryEl.innerHTML = 'No rewards yet';
  }

  // Show redeemed count as a small badge
  const redeemedCountEl = document.getElementById('detail-redeemed-count');
  if (redeemedCards.length > 0) {
    redeemedCountEl.textContent = `${redeemedCards.length} free coffee${redeemedCards.length > 1 ? 's' : ''} redeemed`;
    redeemedCountEl.style.display = 'block';
  } else {
    redeemedCountEl.style.display = 'none';
  }

  // Render cards — active + unredeemed only
  const cardsEl = document.getElementById('detail-cards');
  let cardsHTML = '';

  // Active card first
  if (activeCard) {
    cardsHTML += renderStampCard(activeCard, 'active');
  } else {
    cardsHTML += renderStampCard({ stamps_collected: 0, is_complete: false }, 'active');
  }

  // Unredeemed completed cards
  unredeemedCards.forEach(card => {
    cardsHTML += renderStampCard(card, 'unredeemed');
  });

  cardsEl.innerHTML = cardsHTML;

  // Show/hide redeem button
  const redeemBtn = document.getElementById('redeem-btn');
  redeemBtn.style.display = unredeemedCards.length > 0 ? 'flex' : 'none';
}

function renderStampCard(card, type) {
  const stamps = card.stamps_collected || 0;
  
  let labelHTML = '';
  if (type === 'active') {
    labelHTML = '<span class="card-label current">Current card</span>';
  } else if (type === 'unredeemed') {
    labelHTML = `<span class="card-label free-coffee">
      <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      Free coffee available!
    </span>`;
  } else if (type === 'redeemed') {
    labelHTML = `<span class="card-label redeemed">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      Redeemed
    </span>`;
  }

  let slotsHTML = '';
  for (let i = 0; i < 10; i++) {
    const isFilled = i < stamps;
    const isLast = i === 9;
    
    let innerHTML = '';
    if (isFilled) {
      if (isLast) {
        innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#c9a84c" stroke="#c9a84c"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      } else {
        innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 8h1a4 4 0 110 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/></svg>`;
      }
    } else if (isLast) {
      innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }

    slotsHTML += `<div class="mini-stamp-slot${isFilled ? ' filled' : ''}">${innerHTML}</div>`;
  }

  return `
    <div class="staff-stamp-card ${type}">
      ${labelHTML}
      <div class="mini-stamps-grid">${slotsHTML}</div>
    </div>
  `;
}

function showCustomerList() {
  selectedCustomer = null;
  document.getElementById('staff-detail-view').style.display = 'none';
  document.getElementById('staff-list-view').style.display = 'flex';
  document.getElementById('staff-feedback').style.display = 'none';
  document.getElementById('staff-search-input').value = '';
  
  // Refresh the list in case stamps changed
  loadStaffView();
}

async function awardStamp(ownCup) {
  if (!selectedCustomer) return;

  const feedbackEl = document.getElementById('staff-feedback');

  const { data, error } = await sb.rpc('award_stamp', {
    p_customer_id: selectedCustomer.id,
    p_staff_id: currentUser.id,
    p_own_cup: ownCup
  });

  if (error) {
    feedbackEl.className = 'staff-feedback error';
    feedbackEl.textContent = `Error: ${error.message}`;
    feedbackEl.style.display = 'block';
    return;
  }

  const msg = ownCup
    ? `+1 bonus stamp (own cup!) — now ${data.stamps}/10`
    : `+1 stamp — now ${data.stamps}/10`;

  feedbackEl.className = 'staff-feedback success';
  feedbackEl.textContent = data.card_completed
    ? `🎉 ${msg} — FREE COFFEE EARNED!`
    : msg;
  feedbackEl.style.display = 'block';

  await refreshSelectedCustomer();

  setTimeout(() => { feedbackEl.style.display = 'none'; }, 3000);
}

async function redeemReward() {
  if (!selectedCustomer) return;

  if (!confirm(`Redeem free coffee for ${selectedCustomer.name}?`)) return;

  const feedbackEl = document.getElementById('staff-feedback');

  const { data, error } = await sb.rpc('redeem_reward', {
    p_customer_id: selectedCustomer.id,
    p_staff_id: currentUser.id
  });

  if (error) {
    feedbackEl.className = 'staff-feedback error';
    feedbackEl.textContent = `Error: ${error.message}`;
    feedbackEl.style.display = 'block';
    return;
  }

  if (!data.success) {
    feedbackEl.className = 'staff-feedback error';
    feedbackEl.textContent = data.error;
    feedbackEl.style.display = 'block';
    return;
  }

  feedbackEl.className = 'staff-feedback success';
  feedbackEl.textContent = '🎉 Free coffee redeemed! New card started.';
  feedbackEl.style.display = 'block';

  await refreshSelectedCustomer();

  setTimeout(() => { feedbackEl.style.display = 'none'; }, 3000);
}

// ============================================
// Init
// ============================================

async function init() {
  // Set up auth listener FIRST — this catches the magic link redirect
  // and also the INITIAL_SESSION event
  sb.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth event:', event, session ? 'has session' : 'no session');

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      if (session) {
        await onSignIn(session.user);
      }
    }

    if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      showScreen('auth-screen');
    }
  });

  // Also explicitly check for existing session as a fallback
  const { data: { session } } = await sb.auth.getSession();
  if (session && !currentProfile) {
    console.log('Fallback: found existing session');
    await onSignIn(session.user);
  }
}

async function onSignIn(user) {
  // Prevent double-loading
  if (currentProfile && currentUser?.id === user.id) {
  // Already signed in, just make sure correct screen is showing
  if (currentProfile.role === 'staff' || currentProfile.role === 'admin') {
  showScreen('staff-screen');
  loadStaffView();
  } else {
  showScreen('customer-screen');
  }
  return;
  }

  currentUser = user;
  console.log('Signing in user:', user.id, user.email);

  // Get or wait for profile (trigger might still be running)
  let profile = null;
  let lastError = null;
  let attempts = 0;

  while (!profile && attempts < 8) {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.warn('Profile fetch attempt', attempts + 1, ':', error.message);
      lastError = error;
    }
    profile = data;

    if (!profile) {
      attempts++;
      await new Promise(r => setTimeout(r, 600));
    }
  }

  if (!profile) {
    console.error('Could not load profile after', attempts, 'attempts. Last error:', lastError);
    // Show error to user instead of silently failing
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
      errorEl.textContent = 'Signed in but could not load your profile. Please refresh the page.';
      errorEl.style.display = 'block';
    }
    return;
  }

  currentProfile = profile;
  console.log('Profile loaded:', profile.name, 'role:', profile.role);

  // Update name if it changed
  const metaName = user.user_metadata?.name;
  if (metaName && metaName !== profile.name) {
    await sb
      .from('profiles')
      .update({ name: metaName })
      .eq('id', user.id);
    profile.name = metaName;
  }

  if (profile.role === 'staff' || profile.role === 'admin') {
  showScreen('staff-screen');
  await loadStaffView();
  } else {
  showScreen('customer-screen');
  await loadCustomerView();
  }
}

// Start the app
init();
