async function fetchUserProfile() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
    
    if (sessionError || !sessionData.user) return;

    const uid = sessionData.user.id;

    let { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();

    if (error) { console.error(error); return; }

    if (data) {
        userProfile = data;
        currentUser = sessionData.user;

        const userBtn = document.querySelector('.user-email'); 
        if (userBtn) userBtn.textContent = data.nickname || data.email; 

        const userNameDisplay = document.getElementById('userNameDisplay');
        if (userNameDisplay) userNameDisplay.innerText = data.nickname || currentUser.email.split('@')[0];

        let bal = data.balance_usdt !== null ? data.balance_usdt : 0;
        const userBalance = document.getElementById('user-balance');
        if (userBalance) userBalance.innerText = fmtNum(bal);
        userProfile.balance_usdt = bal;

        const navAvatar = document.getElementById('nav-avatar');
        if (navAvatar) {
            if (data.avatar_url) {
                navAvatar.src = data.avatar_url;
                navAvatar.style.display = 'block';
            } else {
                navAvatar.style.display = 'none';
            }
        }

        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.classList.remove('d-flex');
            loginBtn.classList.add('d-none');
        }

        const userProfileDiv = document.getElementById('userProfile');
        if (userProfileDiv) {
            userProfileDiv.classList.remove('d-none');
            userProfileDiv.classList.add('d-flex');
        }

        checkUserAdmin();
        checkDailyBonus();

        userProfile.tracker_data = data.tracker_data || {};

        if (userProfile.tracker_data && userProfile.tracker_data.meta_wallets) {
            accSettings = userProfile.tracker_data.meta_wallets;
            localStorage.setItem('wave_settings', JSON.stringify(accSettings));
        } else {
            updateCloudWallets(); 
        }

        if (typeof renderGrid === 'function') renderGrid();
    }
}

async function checkDailyBonus() {
    if(!currentUser || !userProfile) return;
    const today = new Date().toISOString().split('T')[0];
    const lastClaimKey = 'wave_daily_claim_' + currentUser.id;
    const lastClaim = localStorage.getItem(lastClaimKey);

    if(lastClaim !== today) {
        const bonus = 100;
        const newBal = (userProfile.balance_usdt || 0) + bonus;

        userProfile.balance_usdt = newBal;
        document.getElementById('user-balance').innerText = fmtNum(newBal);

        showToast(`🎉 Daily Login Bonus: +${bonus} USDT!`, 'success');
        localStorage.setItem(lastClaimKey, today);

        await supabase.from('profiles').update({ balance_usdt: newBal }).eq('id', currentUser.id);
    }
}

function openProfileModal() {
    if(!currentUser) return;
    document.getElementById('pf-nickname').value = userProfile?.nickname || '';
    document.getElementById('pf-avatar-url').value = userProfile?.avatar_url || '';

    let preview = document.getElementById('pf-preview');
    let placeholder = document.getElementById('pf-placeholder');
    if(userProfile?.avatar_url) {
        preview.src = userProfile.avatar_url;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        preview.style.display = 'none';
        placeholder.style.display = 'block';
    }
    new bootstrap.Modal(document.getElementById('profileModal')).show();
}

async function handleFileUpload(input) {
    if(!input.files || input.files.length === 0) return;
    if(!currentUser) return showToast("Please Login", "error");

    const file = input.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;

    let placeholder = document.getElementById('pf-placeholder');
    let loader = document.getElementById('upload-loading');
    loader.style.display = 'flex';

    try {
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
        if(uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser.id);

        document.getElementById('pf-avatar-url').value = publicUrl;
        document.getElementById('pf-preview').src = publicUrl;
        document.getElementById('pf-preview').style.display = 'block';
        placeholder.style.display = 'none';
        loader.style.display = 'none';
        showToast("Avatar updated successfully!", "success");
    } catch (error) {
        showToast("Upload failed: " + error.message, "error");
        loader.style.display = 'none';
    }
}

async function saveProfile() {
    const nickname = document.getElementById('pf-nickname').value.trim();
    const avatar_url = document.getElementById('pf-avatar-url').value.trim();
    const btn = document.getElementById('btn-save-profile');
    if(!nickname) return showToast("Nickname required", "error");
    btn.innerText = "SAVING..."; btn.disabled = true;
    const updates = { id: currentUser.id, nickname, avatar_url };
    const { error } = await supabase.from('profiles').upsert(updates);
    btn.innerText = "SAVE CHANGES"; btn.disabled = false;
    if(error) {
        if(error.code === '23505') showToast("Nickname already taken!", "error");
        else showToast(error.message, "error");
    } else {
        fetchUserProfile();
        bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();
        showToast("Profile Saved!", "success");
    }
}

async function uploadImage(input, previewId, valueId) {
    if (!input.files || input.files.length === 0) return;
    let previewEl = document.getElementById(previewId);
    previewEl.style.opacity = '0.5';

    try {
        const file = input.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `img_${Date.now()}_${Math.floor(Math.random()*1000)}.${fileExt}`;
        const { error } = await supabase.storage.from('avatars').upload(fileName, file);
        if (error) throw error;
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        const publicUrl = data.publicUrl;
        document.getElementById(valueId).value = publicUrl;
        previewEl.src = publicUrl;
        previewEl.style.display = 'block';
        previewEl.style.opacity = '1';
    } catch (e) {
        showToast("Upload Error: " + e.message, "error");
        previewEl.style.opacity = '1';
    }
}

function openLoginModal() { resetLoginModal(); new bootstrap.Modal(document.getElementById('loginModal')).show(); }
function resetLoginModal() { document.getElementById('login-step-1').style.display = 'block'; document.getElementById('login-step-2').style.display = 'none'; document.getElementById('otp-token').value = ''; }

async function sendOtpCode() {
    const email = document.getElementById('otp-email').value.trim();
    if(!email) return showToast("Please enter email", "error");
    let btn = document.querySelector('#login-step-1 button');
    let oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SENDING...'; btn.disabled = true;
    try {
        const { error } = await supabase.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
        if (error) throw error;
        document.getElementById('login-step-1').style.display = 'none';
        document.getElementById('login-step-2').style.display = 'block';
        setTimeout(() => document.getElementById('otp-token').focus(), 500);
        showToast("OTP Code sent to " + email, "success");
    } catch (e) { showToast("Error sending code: " + e.message, "error"); }
    finally { btn.innerHTML = oldText; btn.disabled = false; }
}

async function verifyOtpCode() {
    const email = document.getElementById('otp-email').value.trim();
    const token = document.getElementById('otp-token').value.trim();
    if(!token) return showToast("Enter code", "error");
    let btn = document.querySelector('#login-step-2 button');
    let oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> VERIFYING...'; btn.disabled = true;
    try {
        const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
        if (error) {
            console.log("Retrying with signup type...");
            const { data: data2, error: error2 } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
            if (error2) throw error;
        }
        window.location.reload();
    } catch (e) { showToast("Invalid Code or Expired.", "error"); btn.innerHTML = oldText; btn.disabled = false; }
}

async function handleLogout() { 
    await supabase.auth.signOut(); 
    localStorage.removeItem('wave_settings'); 
    window.location.reload(); 
}

function checkUserAdmin() {
    if (currentUser && userProfile && userProfile.role === 'admin') {
        document.body.classList.add('is-admin');
        console.log("👑 ADMIN ACCESS: Đã bật chế độ Admin!");
    } else {
        document.body.classList.remove('is-admin');
        console.log("👤 USER MODE: Chế độ người dùng thường.");
    }
    
    if (typeof renderGrid === "function") {
        renderGrid();
    }
}
