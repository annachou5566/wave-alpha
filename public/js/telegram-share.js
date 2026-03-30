 // ==========================================

// FILE: script.js (Main Logic)

// Chú ý: Cấu hình Supabase và các hàm format (fmtNum...) đã được chuyển sang supabase-config.js và core-utils.js

// ==========================================



async function sendTelePhoto(comp, newTarget) {

    const chatId = '-1003355713341';



    const cardWrapper = document.querySelector(`.card-wrapper[data-id="${comp.db_id}"]`);

    if (!cardWrapper) {

        showToast("Error: Card element not found!", "error");

        return;

    }

    const cardElement = cardWrapper.querySelector('.tour-card');



    const cleanNum = (val) => {

        if (!val) return 0;

        return parseFloat(val.toString().replace(/,/g, '').trim()) || 0;

    };



    let currentPrice = (comp.market_analysis && comp.market_analysis.price) ? comp.market_analysis.price : (comp.cachedPrice || 0);

    

    let priceStr = "---";

    if (currentPrice > 0) {

        priceStr = '$' + currentPrice.toLocaleString('en-US', { maximumFractionDigits: 4 });

    }



    let qty = cleanNum(comp.rewardQty);

    let rewardVal = qty * currentPrice;

    let rewardHtml = fmtNum(qty); 

    if (rewardVal > 0) {

        let valStr = '~$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(rewardVal);

        rewardHtml += ` <span style="color:#0ECB81; font-size:0.8em; font-weight:bold;">${valStr}</span>`;

    }



    let statsGrid = cardElement.querySelector('.card-stats-grid');

    let oldRewardHTML = "", oldPriceHTML = "";

    let priceEl, rewardEl;



    if (statsGrid) {

        rewardEl = statsGrid.children[1].querySelector('.stat-val');

        if (rewardEl) {

            oldRewardHTML = rewardEl.innerHTML;

            rewardEl.innerHTML = rewardHtml; 

        }



        priceEl = statsGrid.children[2].querySelector('.stat-val');

        if (priceEl) {

            oldPriceHTML = priceEl.innerHTML;

            priceEl.innerHTML = priceStr;    

            priceEl.style.color = "#00F0FF"; 

        }

    }



    cardElement.classList.add('snapshot-mode');

    showToast("📸 Snapping...", "info");



    try {

        const canvas = await html2canvas(cardElement, {

            scale: 2,

            useCORS: true,

            backgroundColor: '#161a1e',

            logging: false,

            allowTaint: true,

            onclone: (clonedDoc) => {

                let clonedCard = clonedDoc.querySelector('.tour-card');

                if(clonedCard) {

                    clonedCard.style.transform = 'none';

                    clonedCard.style.boxShadow = 'none';

                }

            }

        });



        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));



        let rewardMsg = rewardVal > 0 ? `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(rewardVal)}` : '---';

        

        let changeText = "";

        let currVal = cleanNum(newTarget); 



        let history = comp.history ? [...comp.history] : [];

        history.sort((a, b) => new Date(a.date) - new Date(b.date));



        if (history.length >= 2) {

            let prevVal = cleanNum(history[history.length - 2].target);

            let diff = currVal - prevVal;

            

            if (diff !== 0) {

                let sign = diff > 0 ? '+' : '-';

                let icon = diff > 0 ? '📈' : '📉';

                let diffStr = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.abs(diff));

                changeText = ` (${icon} ${sign}$${diffStr})`;

            }

        } else if (currVal > 0) {

            changeText = ` (🚀 New)`;

        }



        const caption = `

🌊 <b>OFFICIAL UPDATE: ${comp.name}</b>

━━━━━━━━━━━━━━━━━━

🎯 <b>New Min Target:</b> <code>${newTarget}</code>${changeText}

💰 <b>Total Reward:</b> ${rewardMsg}

💵 <b>Current Price:</b> ${priceStr}



👇 <b>Tap to Open Wave Alpha Mini App</b>

        `.trim();



        const formData = new FormData();

        formData.append('chat_id', chatId);

        formData.append('photo', blob, 'update.png');

        formData.append('caption', caption);

        formData.append('parse_mode', 'HTML');

        

        const replyMarkup = {

            inline_keyboard: [[{ text: "🚀 Open Wave Alpha Mini App", url: "https://t.me/WaveAlphaSignal_bot/miniapp" }]]

        };

        formData.append('reply_markup', JSON.stringify(replyMarkup));



        // Đoạn fetch đã được dọn dẹp lỗi cú pháp

        const response = await fetch(`/api/telegram?method=sendPhoto`, {

            method: 'POST',

            body: formData

        });



        const result = await response.json();

        if (result.ok) {

            console.log("✅ Photo sent!");

            showToast("✅ Image sent to Telegram!", "success");

        } else {

            throw new Error(result.description || "API Error");

        }



    } catch (e) {

        console.error("Tele Photo Error:", e);

        showToast("❌ Failed: " + e.message, "error");

    } finally {

        cardElement.classList.remove('snapshot-mode');

        if (rewardEl && oldRewardHTML) rewardEl.innerHTML = oldRewardHTML;

        if (priceEl && oldPriceHTML) {

            priceEl.innerHTML = oldPriceHTML;

            priceEl.style.color = "";

        }

    }

}



function generateShareCard(userGuess = null) {

        let c = compList.find(x => x.db_id == currentPolyId);

        if(!c) return;





        document.getElementById('sc-token-name').innerText = c.name;





        let uName = userProfile?.nickname || "Trader";



        let uAvatar = userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${uName}&background=random&color=fff&size=128`;



        document.getElementById('sc-user-name').innerText = uName;





        let uaEl = document.getElementById('sc-user-avatar');

        uaEl.crossOrigin = "anonymous";

        uaEl.src = uAvatar + (uAvatar.includes('?')?'&':'?') + 't=' + new Date().getTime();

        uaEl.onerror = function(){ this.src = 'https://placehold.co/50/333/fff?text=' + uName.charAt(0); }; 





        const now = new Date();

        const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();

        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        document.getElementById('sc-date-display').innerText = `${dateStr} | ${timeStr}`;





        let imgEl = document.getElementById('sc-token-img');

        

        let rawName = c.name ? c.name.toUpperCase().trim() : "UNKNOWN";

let cleanSym = rawName.split('(')[0].trim();

let alphaData = alphaMarketCache[cleanSym] || {};

let localImgPath = c.logo || c.icon || alphaData.icon || './assets/tokens/default.png';

        



        imgEl.crossOrigin = "anonymous"; 

        imgEl.src = localImgPath;

        



        imgEl.onerror = function() { 

            this.style.display = 'none'; 

        };

        imgEl.onload = function() {

            this.style.display = 'block';

        };





        let curMin = (c.history && c.history.length>0) ? c.history[c.history.length-1].target : 0;

        document.getElementById('sc-min-vol').innerText = fmtNum(curMin);





        if(!userGuess && currentUser && c.predictions) {

            let myP = c.predictions.find(p => p.user_id === currentUser.id);

            if(myP) userGuess = myP.guess;

        }

        document.getElementById('sc-my-guess').innerText = userGuess ? fmtNum(userGuess) : '---';





        let qrBox = document.getElementById('sc-qr-target');

        qrBox.innerHTML = '';

        let link = siteConfig.affiliate?.binance || window.location.href;

        new QRCode(qrBox, { text: link, width: 50, height: 50 });





        new bootstrap.Modal(document.getElementById('shareCardModal')).show();

    }





    async function shareImageSmart(platform) {

        const element = document.getElementById('share-card-container');

        let c = compList.find(x => x.db_id == currentPolyId);

        let guess = document.getElementById('sc-my-guess').innerText;

        let webUrl = "https://wave-alpha.pages.dev";



        let text = "";

        if (platform === 'x') {

            text = `🚀 I predicted $${c.name} Min Volume: ${guess} on Wave Alpha!\n\nCan you beat me? 👇\n${webUrl}\n\n#WaveAlpha #Crypto #Trading`;

        } else {

            text = `🔥 I predict $${c.name} Min Volume: ${guess}!\nJoin Wave Alpha Terminal here: ${webUrl}`;

        }



        try {

            showToast("Generating image...", "info");





            const canvas = await html2canvas(element, {

                backgroundColor: '#161a1e', scale: 2, useCORS: true, allowTaint: true, logging: false

            });

            const blob = await new Promise(resolve => canvas.toBlob(resolve));

            const file = new File([blob], "WaveAlpha-Prediction.png", { type: "image/png" });





            if (navigator.canShare && navigator.canShare({ files: [file] })) {

                await navigator.share({

                    title: 'Wave Alpha Prediction',

                    text: text,

                    files: [file]

                });

                showToast("Shared successfully!", "success");

            } else {





                const link = document.createElement('a');

                link.download = 'WaveAlpha-Prediction.png';

                link.href = canvas.toDataURL('image/png');

                link.click();



                showToast("Image Saved! Please attach it to your post.", "success");



                setTimeout(() => {

                    let shareUrl = "";

                    if (platform === 'x') {

                        let hashtags = `WaveAlpha,Crypto,${c.name}`;

                        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

                    } else {

                        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(webUrl)}&text=${encodeURIComponent(text)}`;

                    }

                    window.open(shareUrl, '_blank');

                }, 1000);

            }



        } catch (e) {

            console.error(e);

            showToast("Share failed: " + e.message, "error");

        }

    }





    function shareToX() { shareImageSmart('x'); }

    function shareToTele() { shareImageSmart('tele'); }



    function downloadShareCard() {

        let element = document.getElementById('share-card-container');





        html2canvas(element, {

            backgroundColor: '#161a1e', 

            scale: 2, 

            useCORS: true, 

            allowTaint: true, 

            logging: false

        }).then(canvas => {

            let link = document.createElement('a');

            link.download = 'WaveAlpha-Prediction.png';

            link.href = canvas.toDataURL('image/png');

            link.click();

        });

    }



    function sendChat() {

        if(!currentUser) return showToast("Please login to chat!", "error");

        let txt = document.getElementById('chat-msg').value;

        if(!txt) return;

        let c = compList.find(x => x.db_id == currentPolyId);

        if(!c.comments) c.comments = [];



        let displayName = userProfile?.nickname || currentUser.email.split('@')[0];

        c.comments.push({

            user: displayName,

            text: txt,

            time: Date.now(),

            avatar: userProfile?.avatar_url || ''

        });



        let obj = {...c}; delete obj.db_id;

        const payload = {

            name: obj.name || c.name,

            contract: obj.contract || c.contract,

            data: obj

        };



        supabase.from('tournaments').update(payload).eq('id', currentPolyId).then(() => {

            loadFromCloud(false);

        });

        document.getElementById('chat-msg').value = '';

    }



window.sendReportFromUI = async function() {

    



    let name = document.getElementById('report-name').value;

    let vol = document.getElementById('report-vol').value;

    let time = document.getElementById('report-time').value;

    let date = new Date().toLocaleDateString('en-GB'); 





    let msg = `

<b>🔔 VOLUME UPDATE (${date})</b>



🏆 <b>Tournament:</b> ${name}

📊 <b>Min Volume:</b> <code>${vol}</code>

⏳ <b>Time Left:</b> ${time}



⚠️ <i>Alert: High volatility detected. Check your position!</i>



👉 <a href="https://t.me/WaveAlphaSignal_bot/miniapp">Open Wave Alpha Terminal</a>

    `;



    const url = `/api/telegram?method=sendMessage`;

    try {

        const res = await fetch(url, {

            method: 'POST',

            headers: {'Content-Type': 'application/json'},

            body: JSON.stringify({

                chat_id: '-1003355713341',

                text: msg,

                parse_mode: 'HTML',

                disable_web_page_preview: true

            })

        });

        const data = await res.json();

        if(data.ok) alert("✅ Alert sent to Channel successfully!");

        else alert("❌ Telegram Error: " + data.description);

    } catch (err) {

        alert("❌ Network Error!");

    }

}







    document.addEventListener('DOMContentLoaded', function() {

        const tg = window.Telegram.WebApp;

        



        tg.ready();

        tg.expand(); 







        const user = tg.initDataUnsafe?.user;

        if (user) {

            console.log("User from Tele:", user);





            if(document.getElementById('modal-p-name')) {

                document.getElementById('modal-p-name').value = user.username || user.first_name;

            }

        }







if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {

    tg.setHeaderColor('#161a1e');

} else {

    console.log("Telegram version 6.0: Header Color not supported (Skipped)");

}

    });

function checkTokenStatus() {

    const statusText = document.getElementById('token-status');

    if (localStorage.getItem('WAVE_TELE_TOKEN')) {

        statusText.innerText = "✅ Status: Token Ready. System Operational.";

        statusText.style.color = "#00ff88";

    } else {

        statusText.innerText = "⚠️ Status: Missing Token.";

        statusText.style.color = "orange";

    }

}
