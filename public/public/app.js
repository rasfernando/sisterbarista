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
    slot.className = `stamp-slot${i < stamps ? ' filled' : ''}`;
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
        ? `+${e.stamps_awarded} stamps (own cup bonus!)`
        : `+${e.stamps_awarded} stamp`;
      return `
        <div class="activity-item">
          <div>
            <div class="label">${label}</div>
            ${e.own_cup ? '<div class="bonus">🌱 Eco bonus</div>' : ''}
          </div>
          <div class="date">${date}</div>
        </div>
      `;
    }).join('');
  } else {
    activityList.innerHTML = '<p class="empty-state">No stamps yet — grab a coffee!</p>';
  }
}

// ============================================
// QR Code
// ============================================

function showQR() {
  const modal = document.getElementById('qr-modal');
  modal.style.display = 'flex';
  document.getElementById('qr-name').textContent = currentProfile.name;

  const canvas = document.getElementById('qr-canvas');
  QRCode.toCanvas(canvas, currentUser.id, {
    width: 200,
    margin: 2,
    color: { dark: '#2d1810', light: '#ffffff' }
  });
}

function closeQR() {
  document.getElementById('qr-modal').style.display = 'none';
}

// ============================================
// Staff View
// ============================================

let searchTimeout = null;

async function searchCustomers(query) {
  const resultsEl = document.getElementById('search-results');

  if (query.length < 2) {
    resultsEl.innerHTML = '';
    return;
  }

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const { data: customers } = await sb
      .from('profiles')
      .select('id, name')
      .eq('role', 'customer')
      .ilike('name', `%${query}%`)
      .limit(10);

    if (!customers || customers.length === 0) {
      resultsEl.innerHTML = '<p class="empty-state">No customers found</p>';
      return;
    }

    // Get active cards for these customers
    const customerIds = customers.map(c => c.id);
    const { data: cards } = await sb
      .from('stamp_cards')
      .select('customer_id, stamps_collected, is_complete, reward_redeemed')
      .in('customer_id', customerIds)
      .eq('is_complete', false);

    const cardMap = {};
    cards?.forEach(c => { cardMap[c.customer_id] = c; });

    resultsEl.innerHTML = customers.map(c => {
      const card = cardMap[c.id];
      const stamps = card ? card.stamps_collected : 0;
      return `
        <div class="search-result-item" onclick="selectCustomer('${c.id}', '${c.name.replace(/'/g, "\\'")}')">
          <span class="name">${c.name}</span>
          <span class="stamps">${stamps}/10 stamps</span>
        </div>
      `;
    }).join('');
  }, 300);
}

async function selectCustomer(id, name) {
  selectedCustomer = { id, name };

  document.getElementById('search-results').innerHTML = '';
  document.getElementById('staff-search-input').value = '';
  document.getElementById('selected-customer').style.display = 'block';
  document.getElementById('selected-name').textContent = name;

  await refreshSelectedCustomer();
}

async function refreshSelectedCustomer() {
  if (!selectedCustomer) return;

  const { data: cards } = await sb
    .from('stamp_cards')
    .select('*')
    .eq('customer_id', selectedCustomer.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const activeCard = cards?.find(c => !c.is_complete);
  const redeemableCard = cards?.find(c => c.is_complete && !c.reward_redeemed);
  const stamps = activeCard?.stamps_collected || 0;

  document.getElementById('selected-stamps').textContent =
    `${stamps}/10 stamps on current card`;

  const redeemBtn = document.getElementById('redeem-btn');
  redeemBtn.style.display = redeemableCard ? 'flex' : 'none';
}

function deselectCustomer() {
  selectedCustomer = null;
  document.getElementById('selected-customer').style.display = 'none';
  document.getElementById('staff-feedback').style.display = 'none';
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
    ? `+2 stamps awarded (own cup bonus!) — now ${data.stamps}/10`
    : `+1 stamp awarded — now ${data.stamps}/10`;

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
// QR Scanner (Staff)
// ============================================

let scannerStream = null;
let scannerInterval = null;

async function toggleStaffScanner() {
  const scannerEl = document.getElementById('staff-scanner');
  const video = document.getElementById('scanner-video');

  if (scannerStream) {
    stopScanner();
    return;
  }

  scannerEl.style.display = 'block';

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = scannerStream;

    // Use BarcodeDetector API if available
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      scannerInterval = setInterval(async () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0) {
              const uuid = barcodes[0].rawValue;
              if (isValidUUID(uuid)) {
                stopScanner();
                await lookupCustomerByQR(uuid);
              }
            }
          } catch (e) { /* ignore detection errors */ }
        }
      }, 500);
    } else {
      // Fallback: prompt for manual entry
      stopScanner();
      const uuid = prompt('QR scanning not supported on this device.\nEnter customer ID manually:');
      if (uuid && isValidUUID(uuid)) {
        await lookupCustomerByQR(uuid);
      }
    }
  } catch (err) {
    stopScanner();
    alert('Could not access camera. Please use customer search instead.');
  }
}

function stopScanner() {
  if (scannerStream) {
    scannerStream.getTracks().forEach(t => t.stop());
    scannerStream = null;
  }
  if (scannerInterval) {
    clearInterval(scannerInterval);
    scannerInterval = null;
  }
  document.getElementById('staff-scanner').style.display = 'none';
}

async function lookupCustomerByQR(uuid) {
  const { data: profile } = await sb
    .from('profiles')
    .select('id, name')
    .eq('id', uuid)
    .eq('role', 'customer')
    .single();

  if (profile) {
    selectCustomer(profile.id, profile.name);
  } else {
    alert('Customer not found');
  }
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
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
  } else {
    showScreen('customer-screen');
    await loadCustomerView();
  }
}

// Start the app
init();
