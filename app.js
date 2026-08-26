const views = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-link');
let currentUser = null;
let currentView='home';
let previousView='home';

function showView(name) {
  if(name!==currentView){previousView=currentView;currentView=name;}
  views.forEach(v => v.classList.toggle('active', v.id === `${name}-view`));
  navLinks.forEach(n => n.classList.toggle('active', n.dataset.view === name));
  if (name !== 'settings') document.querySelectorAll('[data-settings-open]').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.customer-nav [data-view],.mobile-nav [data-view]').forEach(item => {
    const mobileTrackSettings=name==='track'&&item.closest('.mobile-nav')&&item.dataset.view==='settings';
    item.classList.toggle('active',(item.dataset.view===name||mobileTrackSettings)&&!item.hasAttribute('data-focus-booking'));
  });
  const mobileActive=document.querySelector('.mobile-nav button.active');
  if(mobileActive) updateMobileNavBubble(mobileActive);
  document.body.classList.toggle('driver-mode', name === 'driver');
  closeNotifications();
  // On desktop the content section scrolls, not the window.
  document.querySelector('.app-main')?.scrollTo({top: 0, behavior: 'smooth'});
  window.scrollTo({top: 0, behavior: 'smooth'});
  if (name === 'wallet') loadWallet();
  if (name === 'places') loadSavedPlaces();
  setTimeout(() => {
    if (bookingMap) bookingMap.invalidateSize();
    if (inlineOrderMap) inlineOrderMap.invalidateSize();
    if (trackedMap) trackedMap.invalidateSize();
    if (liveMap) {
      liveMap.invalidateSize();
      liveMap.fitBounds([pickupPoint, dropPoint], { padding: [45, 45], maxZoom: 13 });
    }
  }, 180);
}

document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => {
    // Settings rows use the same single selection state as the rest of the app.
    // Opening Settings itself must not leave Profile selected by default.
    if (button.dataset.view === 'settings' && button.closest('.mobile-nav')) {
      document.querySelectorAll('.settings-bars button').forEach(item => item.classList.remove('active'));
      settingsApp?.classList.remove('detail-open');
    }
    // Saved places is a settings row with its own view, so mark it before opening.
    if (button.dataset.view === 'places' && button.closest('.settings-bars')) {
      document.querySelectorAll('.settings-bars button').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      settingsApp?.classList.remove('detail-open');
    }
    if (button.dataset.view === 'booking') {
      bookingFlowSource = null;
      document.getElementById('savedRouteNotice')?.classList.add('hidden');
      setBookingBackLabel();
    }
    showView(button.dataset.view);
    if (button.hasAttribute('data-focus-booking')) setTimeout(() => document.querySelector('.booking-card').scrollIntoView({behavior:'smooth',block:'center'}),180);
  });
});

function updateMobileNavBubble(button,pressed=false){
  const nav=button?.closest('.mobile-nav');if(!nav)return;
  nav.style.setProperty('--bubble-left',`${button.offsetLeft + 4}px`);
  nav.style.setProperty('--bubble-width',`${Math.max(0,button.offsetWidth - 8)}px`);
  nav.classList.toggle('is-pressing',pressed);
  if(pressed)setTimeout(()=>nav.classList.remove('is-pressing'),260);
}
document.querySelectorAll('.mobile-nav').forEach(nav=>{
  let dragging=false, pointerId=null, bubbleWidth=0, frameId=0, pendingX=0;
  const moveBubble=(clientX,stretch=false)=>{
    const rect=nav.getBoundingClientRect();
    const width=bubbleWidth||Math.max(0,nav.querySelector('button')?.offsetWidth-8||0);
    const left=Math.max(4,Math.min(rect.width-width-4,clientX-rect.left-width/2));
    nav.style.setProperty('--bubble-left',`${left}px`);
    nav.style.setProperty('--bubble-width',`${width}px`);
    nav.classList.toggle('is-dragging',stretch);
  };
  nav.addEventListener('pointerdown',event=>{
    if(!event.target.closest('button')) return;
    dragging=true;pointerId=event.pointerId;bubbleWidth=Math.max(0,event.target.closest('button').offsetWidth-8);
    nav.setPointerCapture?.(pointerId);
    moveBubble(event.clientX,true);
    event.preventDefault();
  });
  nav.addEventListener('pointermove',event=>{
    if(!dragging||event.pointerId!==pointerId)return;
    pendingX=event.clientX;
    if(frameId)return;
    frameId=requestAnimationFrame(()=>{frameId=0;moveBubble(pendingX,true);});
  });
  const release=event=>{
    if(!dragging||event.pointerId!==pointerId)return;
    dragging=false;nav.classList.remove('is-dragging');
    if(frameId){cancelAnimationFrame(frameId);frameId=0;}
    nav.releasePointerCapture?.(pointerId);
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.mobile-nav button');
    if(target){target.click();setTimeout(()=>updateMobileNavBubble(target),0);}
    else setTimeout(()=>updateMobileNavBubble(nav.querySelector('button.active')),0);
    pointerId=null;
  };
  nav.addEventListener('pointerup',release);
  nav.addEventListener('pointercancel',release);
  // A release outside the bar must still end the elastic drag state.
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',release);
  nav.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>setTimeout(()=>updateMobileNavBubble(button),0)));
});
window.addEventListener('load',()=>updateMobileNavBubble(document.querySelector('.mobile-nav button.active')));

// Whole-app language selection. Google Translate applies to static screens and
// dynamically rendered booking/order content after the page reloads.
window.googleTranslateElementInit = function () {
  if (!window.google?.translate?.TranslateElement) return;
  new google.translate.TranslateElement({pageLanguage:'en',includedLanguages:'en,hi,ta,te,bn,mr,gu,kn,ml,pa',autoDisplay:false},'googleTranslateMount');
};
const languageBtn=document.getElementById('languageBtn');
const languageMenu=document.getElementById('languageMenu');
function updateLanguageSelection(){const selected=localStorage.getItem('haulr-language')||'en';document.querySelectorAll('[data-language]').forEach(item=>item.classList.toggle('selected',item.dataset.language===selected));}
languageBtn?.addEventListener('click',event=>{event.stopPropagation();const open=languageMenu.classList.toggle('open');languageBtn.setAttribute('aria-expanded',String(open));});
document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>{const code=button.dataset.language;const name=button.textContent.trim();const overlay=document.getElementById('languageSwitchOverlay');localStorage.setItem('haulr-language',code);updateLanguageSelection();document.getElementById('languageSwitchText').textContent=`Switching to ${name}`;overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');if(code==='en'){document.cookie='googtrans=;path=/;max-age=0';}else{document.cookie=`googtrans=/en/${code};path=/;max-age=31536000`; }setTimeout(()=>window.location.reload(),140);}));
window.addEventListener('load',updateLanguageSelection);
document.addEventListener('click',event=>{if(!event.target.closest('.language-wrap')){languageMenu?.classList.remove('open');languageBtn?.setAttribute('aria-expanded','false');}});
const inputLanguageCopy={
  en:{drop:'Search area, landmark or address',dropRequired:'Please enter a drop location',description:'e.g. 2 wooden tables and 4 chairs'},
  hi:{drop:'क्षेत्र, लैंडमार्क या पता खोजें',dropRequired:'कृपया डिलीवरी स्थान दर्ज करें',description:'जैसे 2 लकड़ी की मेज़ और 4 कुर्सियाँ'},
  ta:{drop:'பகுதி, அடையாளம் அல்லது முகவரியைத் தேடுங்கள்',dropRequired:'தயவுசெய்து டெலிவரி இடத்தை உள்ளிடவும்',description:'எ.கா. 2 மர மேசைகள் மற்றும் 4 நாற்காலிகள்'},
  te:{drop:'ప్రాంతం, ల్యాండ్‌మార్క్ లేదా చిరునామాను వెతకండి',dropRequired:'దయచేసి డెలివరీ స్థలాన్ని నమోదు చేయండి',description:'ఉదా. 2 చెక్క బల్లలు మరియు 4 కుర్చీలు'},
  bn:{drop:'এলাকা, ল্যান্ডমার্ক বা ঠিকানা খুঁজুন',dropRequired:'অনুগ্রহ করে ডেলিভারির স্থান লিখুন',description:'যেমন ২টি কাঠের টেবিল ও ৪টি চেয়ার'},
  mr:{drop:'परिसर, लँडमार्क किंवा पत्ता शोधा',dropRequired:'कृपया डिलिव्हरीचे ठिकाण भरा',description:'उदा. २ लाकडी टेबल आणि ४ खुर्च्या'},
  gu:{drop:'વિસ્તાર, સીમાચિહ્ન અથવા સરનામું શોધો',dropRequired:'કૃપા કરીને ડિલિવરીનું સ્થાન દાખલ કરો',description:'દા.ત. 2 લાકડાના ટેબલ અને 4 ખુરશીઓ'},
  kn:{drop:'ಪ್ರದೇಶ, ಹೆಗ್ಗುರುತು ಅಥವಾ ವಿಳಾಸ ಹುಡುಕಿ',dropRequired:'ದಯವಿಟ್ಟು ವಿತರಣಾ ಸ್ಥಳವನ್ನು ನಮೂದಿಸಿ',description:'ಉದಾ. 2 ಮರದ ಮೇಜುಗಳು ಮತ್ತು 4 ಕುರ್ಚಿಗಳು'},
  ml:{drop:'പ്രദേശം, ലാൻഡ്മാർക്ക് അല്ലെങ്കിൽ വിലാസം തിരയുക',dropRequired:'ദയവായി ഡെലിവറി സ്ഥലം നൽകുക',description:'ഉദാ. 2 മരമേശകളും 4 കസേരകളും'},
  pa:{drop:'ਖੇਤਰ, ਨਿਸ਼ਾਨੀ ਜਾਂ ਪਤਾ ਖੋਜੋ',dropRequired:'ਕਿਰਪਾ ਕਰਕੇ ਡਿਲੀਵਰੀ ਸਥਾਨ ਦਰਜ ਕਰੋ',description:'ਜਿਵੇਂ 2 ਲੱਕੜੀ ਦੇ ਮੇਜ਼ ਅਤੇ 4 ਕੁਰਸੀਆਂ'}
};
function inputCopy(key){const code=localStorage.getItem('haulr-language')||'en';return (inputLanguageCopy[code]||inputLanguageCopy.en)[key]||inputLanguageCopy.en[key];}
function applyInputLanguage(){const pickup=document.getElementById('pickup');const drop=document.getElementById('drop');const description=document.getElementById('description');if(pickup)pickup.placeholder='Search pickup area, landmark or address';if(drop)drop.placeholder=inputCopy('drop');if(description)description.placeholder=inputCopy('description');}
window.addEventListener('load',applyInputLanguage);
const spendCaption={en:'total spend',hi:'कुल खर्च',ta:'மொத்த செலவு',te:'మొత్తం ఖర్చు',bn:'মোট খরচ',mr:'एकूण खर्च',gu:'કુલ ખર્ચ',kn:'ಒಟ್ಟು ವೆಚ್ಚ',ml:'ആകെ ചെലവ്',pa:'ਕੁੱਲ ਖਰਚ'};
function totalSpendCaption(){return spendCaption[localStorage.getItem('haulr-language')||'en']||spendCaption.en;}
function hideTranslateBar(){document.querySelectorAll('iframe.skiptranslate,iframe.goog-te-banner-frame,.goog-te-banner-frame,[class*="goog-te-banner"]').forEach(node=>{node.style.setProperty('display','none','important');node.style.setProperty('visibility','hidden','important');node.style.setProperty('height','0','important');});document.body.style.setProperty('top','0px','important');}
window.addEventListener('load',()=>{hideTranslateBar();setTimeout(hideTranslateBar,500);setTimeout(hideTranslateBar,1600);});
document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => {
  const names={places:'Saved places will appear after you complete deliveries.'};
  showNotice(names[button.dataset.panel]);
}));

const helpTopics={
  booking:{icon:'package-search',eyebrow:'BOOKING & DELIVERY',title:'Booking and delivery help',text:'Get clear answers about creating a delivery, driver assignment and live tracking.',items:[['How do I book a delivery?','Open Book, add pickup and drop locations, choose your load and vehicle, then complete payment.'],['Where can I track my order?','Open My deliveries or Track an order. You will see the route, latest status and driver information once assigned.'],['My driver has not been assigned yet','Haulr is matching your booking with nearby verified drivers. You will receive an alert as soon as one accepts.']]},
  payments:{icon:'wallet-cards',eyebrow:'PAYMENTS & REFUNDS',title:'Payment help',text:'Manage UPI, cards and cash-on-delivery with confidence.',items:[['Which payment methods can I use?','You can use a saved UPI ID, a card saved in this browser session, or cash on delivery.'],['Where is my payment confirmation?','After payment, the receipt and reference appear in My deliveries and your notifications.'],['I need help with a payment','Choose Contact support below and include your HLR order number so the team can find the payment quickly.']]},
  account:{icon:'shield-check',eyebrow:'ACCOUNT & SECURITY',title:'Account and security help',text:'Control your details, saved locations and sign-in security.',items:[['How do I change my password?','Go to Settings → Security → Change password.'],['How do Saved Places work?','Your completed pickup and drop locations appear in Saved places, where one tap starts a new booking using that route.'],['How do I sign out of another device?','Go to Settings → Security → Active sessions and remove any device you do not recognise.']]},
  contact:{icon:'messages-square',eyebrow:'CONTACT SUPPORT',title:'Talk to Haulr support',text:'For urgent help with a current delivery, send your order number and a short description.',items:[['In-app support','Open the relevant order in My deliveries, then use the order details to provide your HLR number.'],['Email support','Send your order number, registered email and issue details to support@haulr.local.'],['Safety concern','If you feel unsafe during a delivery, contact local emergency services first, then report the issue to Haulr support.']]}
};
function openHelpTopic(topic){const data=helpTopics[topic];if(!data)return;const detail=document.getElementById('supportDetail');document.getElementById('supportHome').classList.add('hidden');detail.classList.remove('hidden');document.getElementById('supportDetailContent').innerHTML=`<div class="support-detail-head"><span><i data-lucide="${data.icon}"></i></span><div><small>${data.eyebrow}</small><h2>${data.title}</h2><p>${data.text}</p></div></div><div class="support-answer-list">${data.items.map(([q,a])=>`<article><b>${q}</b><p>${a}</p></article>`).join('')}</div>${topic==='contact'?'<button class="primary-btn support-mail" type="button" id="supportMail">Email support <span>→</span></button>':''}`;document.querySelector('.app-main')?.scrollTo({top:0,behavior:'smooth'});if(window.lucide)lucide.createIcons();document.getElementById('supportMail')?.addEventListener('click',()=>{window.location.href='mailto:support@haulr.local?subject=Haulr%20support%20request';});}
document.querySelectorAll('[data-help-topic]').forEach(button=>button.addEventListener('click',()=>openHelpTopic(button.dataset.helpTopic)));
document.getElementById('supportBack')?.addEventListener('click',()=>{document.getElementById('supportDetail').classList.add('hidden');document.getElementById('supportHome').classList.remove('hidden');document.querySelector('.app-main')?.scrollTo({top:0,behavior:'smooth'});});
document.querySelectorAll('[data-quick-load]').forEach(button=>button.addEventListener('click',()=>{
  const load=button.dataset.quickLoad;const option=[...document.querySelectorAll('.load-option')].find(item=>item.dataset.load===load);
  if(option){document.querySelectorAll('.load-option').forEach(item=>item.classList.remove('active'));option.classList.add('active');}
  showView('booking');
}));

let toastTimer=null;
function dismissToast(){const toast=document.getElementById('toast');toast.classList.remove('show','success-toast');if(toastTimer){clearTimeout(toastTimer);toastTimer=null;}}
function showNotice(message) {
  dismissToast();const toast=document.getElementById('toast');toast.querySelector('b').textContent='Haulr';toast.querySelector('span').textContent=message;toast.classList.add('show');toastTimer=setTimeout(dismissToast,2400);
}
function showSuccess(title,message){dismissToast();const toast=document.getElementById('toast');toast.querySelector('b').textContent=title;toast.querySelector('span').textContent=message;toast.classList.add('success-toast','show');toastTimer=setTimeout(dismissToast,2600)}
document.getElementById('toast').addEventListener('click',dismissToast);
document.addEventListener('pointerdown',event=>{const toast=document.getElementById('toast');if(toast.classList.contains('show')&&!event.target.closest('#toast'))dismissToast();});

let currentStep = 1;
// A saved route should return to the address book, while a normal booking
// keeps the usual previous-step behaviour.
let bookingFlowSource = null;
function setStep(step) {
  currentStep = step;
  document.querySelectorAll('.form-step').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === step));
  document.getElementById('stepNum').textContent = step;
  document.getElementById('progressBar').style.width = `${step * 33.333}%`;
  if (step === 3) updateRealRoute();
}

document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => {
  if (currentStep === 1 && !document.getElementById('pickup').value.trim()) {
    document.getElementById('pickup').focus();
    document.getElementById('pickup').placeholder = 'Please enter a pickup location';
    return;
  }
  if (currentStep === 1 && !document.getElementById('drop').value.trim()) {
    document.getElementById('drop').focus();
    document.getElementById('drop').placeholder = inputCopy('dropRequired');
    return;
  }
  if (currentStep === 2 && document.querySelector('.load-option.active')?.id === 'otherLoadOption' && document.getElementById('otherLoadOption').dataset.load === 'Other') {
    openOtherLoadSheet();
    return;
  }
  setStep(Math.min(3, currentStep + 1));
}));
document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => {
  if (currentStep === 2 && bookingFlowSource === 'saved-places') {
    showView('places');
    return;
  }
  setStep(Math.max(1, currentStep - 1));
}));

function setBookingBackLabel() {
  const savedRoute = bookingFlowSource === 'saved-places';
  const loadBack = document.querySelector('.form-step[data-step="2"] [data-back]');
  if (loadBack) loadBack.innerHTML = savedRoute ? '← Saved places' : '← Back';
}

document.querySelectorAll('.load-option').forEach(option => option.addEventListener('click', () => {
  document.querySelectorAll('.load-option').forEach(x => x.classList.remove('active'));
  option.classList.add('active');
  if (option.id === 'otherLoadOption') openOtherLoadSheet();
}));

const otherOverlay = document.getElementById('otherOverlay');
function openOtherLoadSheet() {
  otherOverlay.classList.add('open');
  otherOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('otherLoadName').focus(), 220);
}
function closeOtherLoadSheet() {
  otherOverlay.classList.remove('open');
  otherOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
document.getElementById('otherClose').addEventListener('click', closeOtherLoadSheet);
otherOverlay.addEventListener('click', event => { if (event.target === otherOverlay) closeOtherLoadSheet(); });
document.querySelectorAll('.other-suggestions button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.other-suggestions button').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  document.getElementById('otherLoadName').value = button.textContent;
}));
document.getElementById('otherInstructions').addEventListener('input', event => {
  document.getElementById('otherCharCount').textContent = `${event.target.value.length}/180`;
});
document.getElementById('otherLoadForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = document.getElementById('otherLoadName').value.trim();
  if (!name) return;
  const option = document.getElementById('otherLoadOption');
  option.dataset.load = name;
  document.getElementById('otherLoadLabel').textContent = name.length > 18 ? `${name.slice(0,18)}…` : name;
  const instructions = document.getElementById('otherInstructions').value.trim();
  if (instructions) document.getElementById('description').value = instructions;
  closeOtherLoadSheet();
});

// Unified pointer and touch effects for interactive surfaces.
function initializeMotionEffects(root = document) {
  const boxSelector = '.main-metrics article,.main-sections>section,.quick-loads button,.wallet-summary>div,.payment-methods-panel,.settings-grid>section,.ride,.load-option,.booking-card,.track-result';
  const buttonSelector = 'button,.customer-nav button,.mobile-nav button,.settings-action,.payment-choices label span';
  root.querySelectorAll(boxSelector).forEach(box => {
    if (box.dataset.motionReady) return;
    box.dataset.motionReady = 'true'; box.classList.add('motion-box');
    box.addEventListener('pointermove', event => {
      const rect=box.getBoundingClientRect();
      box.style.setProperty('--pointer-x',`${event.clientX-rect.left}px`);box.style.setProperty('--pointer-y',`${event.clientY-rect.top}px`);
    });
    box.addEventListener('pointerdown',()=>box.classList.add('is-touched'));
    ['pointerup','pointercancel','pointerleave'].forEach(type=>box.addEventListener(type,()=>box.classList.remove('is-touched')));
  });
  root.querySelectorAll(buttonSelector).forEach(button => {
    if (button.dataset.pressReady) return;
    button.dataset.pressReady='true';button.classList.add('motion-button');
    button.addEventListener('pointerdown',event=>{
      button.classList.add('is-touched');const rect=button.getBoundingClientRect();const ripple=document.createElement('i');ripple.className='touch-ripple';ripple.style.left=`${event.clientX-rect.left}px`;ripple.style.top=`${event.clientY-rect.top}px`;button.appendChild(ripple);setTimeout(()=>ripple.remove(),600);
    });
    ['pointerup','pointercancel','pointerleave'].forEach(type=>button.addEventListener(type,()=>button.classList.remove('is-touched')));
  });
}
window.addEventListener('load',()=>initializeMotionEffects());

document.querySelectorAll('.ride').forEach(ride => ride.addEventListener('click', () => {
  document.querySelectorAll('.ride').forEach(x => x.classList.remove('active'));
  ride.classList.add('active');
  updateFareQuote();
}));
document.getElementById('helpers').addEventListener('change', updateFareQuote);

let activeBookingId = null;
const bookingSubmitButton=document.querySelector('#bookingForm button[type="submit"]');
document.body.insertAdjacentHTML('beforeend',`<div class="checkout-result-overlay" id="checkoutResult" aria-hidden="true"><section class="checkout-result-card"><div class="checkout-success-icon"><i data-lucide="check"></i></div><small id="checkoutResultEyebrow">PAYMENT SUCCESSFUL</small><h2 id="checkoutResultTitle">Paid successfully</h2><p id="checkoutResultMessage">Your delivery has been booked and added to My Orders.</p><strong id="checkoutPaidAmount">₹0</strong><div class="checkout-receipt"><div><small>ORDER</small><b id="checkoutOrderId">#HLR-0000</b></div><div><small>PAYMENT</small><b id="checkoutPaymentMethod">UPI</b></div><div><small>FROM</small><b id="checkoutPickup">—</b></div><div><small>TO</small><b id="checkoutDrop">—</b></div><div class="checkout-reference"><small>TRANSACTION REFERENCE</small><b id="checkoutReference">—</b></div></div><div class="checkout-result-actions"><button type="button" class="primary-btn" id="checkoutViewOrder">View my order <span>→</span></button><button type="button" class="checkout-done" id="checkoutDone">Done</button></div></section></div>`);

function updateCheckoutButton(){
  const choice=document.querySelector('input[name="payment"]:checked')?.value;
  bookingSubmitButton.innerHTML=choice==='Cash'?'Place order · Pay on delivery <span>→</span>':'Pay now <span>→</span>';
}
function showCheckoutResult(booking){
  const cash=booking.payment_status==='due_on_delivery';
  document.getElementById('checkoutResultEyebrow').textContent=cash?'ORDER CONFIRMED':'PAYMENT SUCCESSFUL';
  document.getElementById('checkoutResultTitle').textContent=cash?'Booking placed successfully':'Paid successfully';
  document.getElementById('checkoutResultMessage').textContent=cash?'Cash payment is due to the driver after delivery. Your booking is now in My Orders.':'Your payment was approved and the delivery was automatically added to My Orders.';
  document.getElementById('checkoutPaidAmount').textContent=`₹${booking.fare}`;
  document.getElementById('checkoutPaidAmount').classList.toggle('amount-due',cash);
  document.getElementById('checkoutOrderId').textContent=`#HLR-${String(booking.id).padStart(4,'0')}`;
  document.getElementById('checkoutPaymentMethod').textContent=cash?'Cash · due on delivery':booking.payment_method;
  document.getElementById('checkoutPickup').textContent=booking.pickup;
  document.getElementById('checkoutDrop').textContent=booking.drop_location;
  document.getElementById('checkoutReference').textContent=booking.payment_reference||'Pay after delivery';
  const overlay=document.getElementById('checkoutResult');overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  if(window.lucide)lucide.createIcons();
}
function closeCheckoutResult(){document.getElementById('checkoutResult').classList.remove('open');document.getElementById('checkoutResult').setAttribute('aria-hidden','true');document.body.style.overflow='';}
document.getElementById('checkoutViewOrder').addEventListener('click',()=>{closeCheckoutResult();showView('orders');});
document.getElementById('checkoutDone').addEventListener('click',()=>{closeCheckoutResult();showView('home');});
document.querySelectorAll('input[name="payment"]').forEach(input=>input.addEventListener('change',updateCheckoutButton));
updateCheckoutButton();

function resetBookingForNextOrder(){
  document.getElementById('pickup').value='';
  document.getElementById('drop').value='';
  document.getElementById('weight').value='150';
  document.getElementById('description').value='';
  document.getElementById('schedule').value='now';
  document.getElementById('helpers').value='0';
  document.querySelectorAll('.load-option').forEach((item,index)=>item.classList.toggle('active',index===0));
  document.getElementById('otherLoadOption').dataset.load='Other';
  document.getElementById('otherLoadLabel').textContent='Other';
  document.querySelectorAll('.ride').forEach((item,index)=>{item.classList.toggle('active',index===0);item.querySelector('input').checked=index===0;});
  pickupPoint=[23.2248,72.6492];dropPoint=[23.2156,72.6369];
  pickupMarker?.setLatLng(pickupPoint);dropMarker?.setLatLng(dropPoint);bookingRoute?.setLatLngs([pickupPoint,dropPoint]);
  bookingMap?.setView([23.2208,72.643],12);
  document.getElementById('routeDistance').textContent='Calculating…';document.getElementById('routeDuration').textContent='—';
  setStep(1);updateFareQuote();
}

document.getElementById('bookingForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) {
    openAuth();
    return;
  }
  const paymentChoice = document.querySelector('input[name="payment"]:checked').value;
  if (paymentChoice === 'UPI' && !savedUpi) {
    openMethodScreen('upi');
    return;
  }
  if (paymentChoice === 'Card' && !savedCard) {
    openCardSheet();
    return;
  }
  const submit = event.submitter;
  const selectedRide = document.querySelector('input[name="ride"]:checked');
  const selectedLoad = document.querySelector('.load-option.active');
  const fare = Number(document.getElementById('fareValue').textContent.replace(/\D/g, ''));
  const payload = {
    pickup: document.getElementById('pickup').value,
    drop_location: document.getElementById('drop').value,
    load_type: selectedLoad.dataset.load,
    weight: document.getElementById('weight').value,
    phone: document.getElementById('phone').value,
    description: document.getElementById('description').value,
    vehicle: selectedRide.value,
    fare,
    schedule: document.getElementById('schedule').value,
    helpers: document.getElementById('helpers').value,
    payment_method: paymentChoice === 'Card' ? `${savedCard.issuer} ${savedCard.type} ending ${savedCard.last4}` : paymentChoice === 'UPI' ? `${savedUpi.provider} · ${savedUpi.id}` : paymentChoice,
    distance_km: Number(document.getElementById('routeDistance').textContent.replace(/[^\d.]/g, '')) || 0
    ,pickup_lat: pickupPoint[0], pickup_lng: pickupPoint[1], drop_lat: dropPoint[0], drop_lng: dropPoint[1]
  };
  submit.disabled = true;
  submit.classList.add('is-loading');
  try {
    const response = await fetch('/api/bookings', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error((await response.json()).error || 'Booking failed');
    const booking = await response.json();
    activeBookingId = booking.id;
    populateDriverRequest(booking);
    await loadLatestBooking();
    await loadNotifications();
    showCheckoutResult(booking);
    resetBookingForNextOrder();
  } catch (error) {
    alert(error.message);
    submit.disabled = false;
    submit.classList.remove('is-loading');
    return;
  }
  submit.disabled = false;
  submit.classList.remove('is-loading');
});

document.getElementById('trackBtn').addEventListener('click', event => {
  event.currentTarget.textContent = '✓  Live location refreshed';
  setTimeout(() => event.currentTarget.innerHTML = '⌖ &nbsp; Live track delivery', 1800);
});

const requestCard = document.getElementById('requestCard');
function populateDriverRequest(booking) {
  if (!booking) return;
  activeBookingId = booking.id;
  document.getElementById('requestFare').innerHTML = `₹${booking.fare} <small>estimated</small>`;
  document.getElementById('requestPickup').textContent = booking.pickup;
  document.getElementById('requestDrop').textContent = booking.drop_location;
  document.getElementById('requestLoad').textContent = `${booking.load_type} · ${booking.weight} kg`;
}

async function changeBookingStatus(status) {
  if (!activeBookingId) return true;
  const response = await fetch(`/api/bookings/${activeBookingId}/status`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status}) });
  if(response.ok)loadNotifications();
  return response.ok;
}

document.getElementById('acceptBtn').addEventListener('click', async () => {
  if (!await changeBookingStatus('accepted')) return;
  requestCard.innerHTML = '<div style="text-align:center;padding:42px 10px"><div style="font-size:42px">✓</div><h2>Booking accepted</h2><p style="color:#6e756f">Navigate to ABC Market, Sector 11 for pickup.</p><button class="accept" style="padding:12px 25px;border-radius:8px">Start navigation</button></div>';
});
document.getElementById('rejectBtn').addEventListener('click', async () => {
  if (!await changeBookingStatus('rejected')) return;
  requestCard.style.opacity = '.35';
  requestCard.style.pointerEvents = 'none';
  document.querySelector('.timer').textContent = 'Declined';
});

let seconds = 28;
setInterval(() => {
  const timer = document.getElementById('timer');
  if (timer && seconds > 0) timer.textContent = String(--seconds).padStart(2, '0');
}, 1000);

// Interactive maps powered by OpenStreetMap + Leaflet.
let pickupPoint = [23.2248, 72.6492];
let dropPoint = [23.2156, 72.6369];
let bookingMap;
let liveMap;
let pickupMarker;
let dropMarker;
let bookingRoute;
// A compact, standard road map: readable road/place labels without the large
// city captions used by the previous visual tile theme.
const mapTileUrl='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const mapTileOptions={maxZoom:19,subdomains:'abc',attribution:'&copy; OpenStreetMap contributors'};

function protectLiveMap(id) {
  const node=document.getElementById(id);
  if (!node) return;
  node.classList.add('notranslate');
  node.setAttribute('translate','no');
}

function pinIcon(kind = 'pickup') {
  return L.divIcon({
    className: '',
    html: `<div class="premium-pin ${kind === 'drop' ? 'drop-pin' : ''}"></div>`,
    iconSize: [30, 35], iconAnchor: [15, 30]
  });
}

function initMaps() {
  if (typeof L === 'undefined') return;
  protectLiveMap('bookingMap');protectLiveMap('liveMap');
  bookingMap = L.map('bookingMap', { zoomControl: false, scrollWheelZoom: false }).setView([23.2208, 72.643], 12);
  L.tileLayer(mapTileUrl,mapTileOptions).addTo(bookingMap);
  L.control.zoom({ position: 'bottomright' }).addTo(bookingMap);
  pickupMarker = L.marker(pickupPoint, { icon: pinIcon(), draggable: true }).addTo(bookingMap).bindPopup('Pickup · Sector 21');
  dropMarker = L.marker(dropPoint, { icon: pinIcon('drop'), draggable: true }).addTo(bookingMap).bindPopup('Drop · Railway Station Road');
  bookingRoute = L.polyline([pickupPoint, dropPoint], { color: '#6856D9', weight: 4, opacity: .88 }).addTo(bookingMap);
  pickupMarker.on('dragend', () => markerMoved('pickup'));
  dropMarker.on('dragend', () => markerMoved('drop'));
  bookingMap.on('click', event => {
    const target = document.activeElement.id === 'pickup' ? 'pickup' : 'drop';
    if (target === 'pickup') pickupMarker.setLatLng(event.latlng); else dropMarker.setLatLng(event.latlng);
    markerMoved(target);
  });

  document.getElementById('locateBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const point = [coords.latitude, coords.longitude];
      pickupMarker.setLatLng(point);
      bookingMap.setView(point, 13);
      pickupPoint = point;
      updateRealRoute();
      document.getElementById('pickup').value = 'Current location';
      addressResolved.pickup = 'Current location';
      clearMapNotice();
    });
  });
  document.getElementById('mapExpand').addEventListener('click', event => {
    const wrap = document.querySelector('.booking-map-wrap');
    wrap.classList.toggle('expanded');
    event.currentTarget.textContent = wrap.classList.contains('expanded') ? '×' : '↗';
    setTimeout(() => bookingMap.invalidateSize(), 220);
  });

  liveMap = L.map('liveMap', { zoomControl: false, scrollWheelZoom: false }).setView([23.2205, 72.6425], 13);
  L.tileLayer(mapTileUrl,mapTileOptions).addTo(liveMap);
  const routePoints = [pickupPoint, [23.2228,72.646], [23.2208,72.642], [23.2184,72.639], dropPoint];
  L.polyline(routePoints, { color: '#fff', weight: 9, opacity: .95 }).addTo(liveMap);
  L.polyline(routePoints, { color: '#6856D9', weight: 5, opacity: 1 }).addTo(liveMap);
  L.marker(pickupPoint, { icon: pinIcon() }).addTo(liveMap).bindPopup('Pickup completed');
  L.marker(dropPoint, { icon: pinIcon('drop') }).addTo(liveMap).bindPopup('Delivery destination');
  const vehicleIcon = L.divIcon({ className: '', html: '<div class="vehicle-marker"><svg viewBox="0 0 24 24"><path d="M10 17h4V5H2v12h3m14 0h3v-5l-3-4h-5v9h1M7.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm10 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg></div>', iconSize: [42,42], iconAnchor: [21,21] });
  const vehicle = L.marker(routePoints[2], { icon: vehicleIcon }).addTo(liveMap).bindPopup('Rahul is on the way');
  let position = 2;
  setInterval(() => { position = position >= routePoints.length - 1 ? 1 : position + 1; vehicle.setLatLng(routePoints[position]); }, 4500);
}

window.addEventListener('load', initMaps);

function debounce(callback, delay = 450) {
  let timeout;
  return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => callback(...args), delay); };
}

async function reverseGeocode(point) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point[0]}&lon=${point[1]}`);
    const data = await response.json();
    return data.display_name || `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`;
  } catch (_) { return `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`; }
}

async function markerMoved(kind) {
  const marker = kind === 'pickup' ? pickupMarker : dropMarker;
  const position = marker.getLatLng();
  const point = [position.lat, position.lng];
  if (kind === 'pickup') pickupPoint = point; else dropPoint = point;
  document.getElementById(kind).value = await reverseGeocode(point);
  addressResolved[kind] = document.getElementById(kind).value;
  clearMapNotice();
  updateRealRoute();
}

// The map section reports an address it cannot place instead of leaving the
// previous pin standing, which would show the wrong place for the typed text.
function showMapNotice(kind, query) {
  const notice = document.getElementById('mapNotice');
  if (!notice) return;
  document.getElementById('mapNoticeDetail').textContent = `“${query}” is not a ${kind === 'pickup' ? 'pickup' : 'drop'} location we can find on the map.`;
  notice.hidden = false;
  if (window.lucide) lucide.createIcons();
}
function clearMapNotice() {
  const notice = document.getElementById('mapNotice');
  if (notice) notice.hidden = true;
}

// Puts a confirmed address on the map: moves that pin, refits both points and
// redraws the route. Returns false when the address does not resolve.
function placeOnMap(kind, point) {
  if (kind === 'pickup') { pickupPoint = point; pickupMarker.setLatLng(point); }
  else { dropPoint = point; dropMarker.setLatLng(point); }
  clearMapNotice();
  bookingMap.fitBounds([pickupPoint, dropPoint], { padding: [35,35], maxZoom: 13 });
  updateRealRoute();
}

// Used when the field is committed without picking a suggestion.
async function locateTypedAddress(kind, query) {
  const text = query.trim();
  if (text.length < 3) { clearMapNotice(); return; }
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&limit=1&q=${encodeURIComponent(text)}`);
    const [match] = await response.json();
    if (!match) { showMapNotice(kind, text); return; }
    placeOnMap(kind, [Number(match.lat), Number(match.lon)]);
  } catch (_) { showMapNotice(kind, text); }
}

async function searchAddress(kind, query) {
  const box = document.getElementById(`${kind}Suggestions`);
  if (query.trim().length < 3) { box.classList.remove('show'); return; }
  box.innerHTML = '<span class="searching">Searching real locations…</span>';
  box.classList.add('show');
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&limit=5&q=${encodeURIComponent(query)}`);
    const results = await response.json();
    box.innerHTML = results.length ? results.map((result, index) => `<button type="button" data-index="${index}"><i>⌖</i><span>${result.display_name}</span></button>`).join('') : '<span class="searching">No locations found</span>';
    if (!results.length) showMapNotice(kind, query.trim());
    box.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      const result = results[Number(button.dataset.index)];
      document.getElementById(kind).value = result.display_name;
      addressResolved[kind] = result.display_name;
      box.classList.remove('show');
      placeOnMap(kind, [Number(result.lat), Number(result.lon)]);
    }));
  } catch (_) { box.innerHTML = '<span class="searching">Location service unavailable</span>'; }
}

// Remembers the text already placed on the map, so committing an untouched
// field does not geocode the same address a second time.
const addressResolved = {pickup: '', drop: ''};
['pickup', 'drop'].forEach(kind => {
  const input = document.getElementById(kind);
  input.addEventListener('input', debounce(event => searchAddress(kind, event.target.value)));
  input.addEventListener('change', () => {
    if (input.value.trim() === addressResolved[kind].trim()) return;
    addressResolved[kind] = input.value;
    locateTypedAddress(kind, input.value);
  });
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addressResolved[kind] = input.value;
    document.getElementById(`${kind}Suggestions`).classList.remove('show');
    locateTypedAddress(kind, input.value);
  });
});
document.addEventListener('click', event => {
  if (!event.target.closest('.location-field')) document.querySelectorAll('.suggestions').forEach(box => box.classList.remove('show'));
});

async function updateRealRoute() {
  if (!bookingRoute || !pickupPoint || !dropPoint) return;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${pickupPoint[1]},${pickupPoint[0]};${dropPoint[1]},${dropPoint[0]}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.routes?.length) throw new Error('No route');
    const route = data.routes[0];
    const points = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    bookingRoute.setLatLngs(points);
    bookingMap.fitBounds(bookingRoute.getBounds(), { padding: [28,28], maxZoom: 13 });
    document.getElementById('routeDistance').textContent = `${(route.distance / 1000).toFixed(1)} km`;
    document.getElementById('routeDuration').textContent = `${Math.round(route.duration / 60)} min`;
  } catch (_) {
    bookingRoute.setLatLngs([pickupPoint, dropPoint]);
  }
  updateFareQuote();
}

async function updateFareQuote() {
  const vehicle = document.querySelector('input[name="ride"]:checked')?.value || 'Loading Rickshaw';
  try {
    const response = await fetch('/api/fare-quote', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ pickup: pickupPoint, drop: dropPoint, vehicle, helpers: document.getElementById('helpers').value }) });
    const quote = await response.json();
    document.getElementById('fareValue').textContent = `₹${quote.fare}`;
    if (document.getElementById('routeDistance').textContent === 'Calculating…') document.getElementById('routeDistance').textContent = `${quote.distance_km} km`;
    if (document.getElementById('routeDuration').textContent === '—') document.getElementById('routeDuration').textContent = `${quote.duration_minutes} min`;
  } catch (_) { /* retain displayed fallback fare */ }
}

async function loadLatestBooking() {
  try {
    const response = await fetch('/api/bookings');
    if (!response.ok) return;
    const bookings = await response.json();
    const pending = bookings.find(item => item.status === 'searching');
    if (pending) populateDriverRequest(pending);
    renderCustomerDashboard(bookings);
    if (bookings.length) {
      document.getElementById('ordersEmpty').classList.add('hidden');
      document.getElementById('ordersGrid').classList.remove('hidden');
      renderOrders(bookings, bookings[0].id);
    } else {
      document.getElementById('ordersEmpty').classList.remove('hidden');
      document.getElementById('ordersGrid').classList.add('hidden');
    }
  } catch (_) {
    // Static-file preview remains usable when the Python server is not running.
  }
}

function safe(value) { const node=document.createElement('span');node.textContent=String(value??'');return node.innerHTML; }
const statusInfo={searching:['Searching for driver','search'],accepted:['Driver assigned','user-check'],pickup:['Driver at pickup','package-check'],in_transit:['In transit','navigation'],delivered:['Delivered','circle-check'],rejected:['Cancelled','circle-x']};
// Bar with rounded top corners only, so the mark stays anchored to the baseline.
function barPath(x, y, width, height, radius) {
  const r = Math.min(radius, height, width / 2);
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

// Fourteen-day delivery activity, plotted from the account's real bookings.
function renderActivityGraph(bookings) {
  const shell = document.getElementById('activityGraph');
  const summary = document.getElementById('graphSummary');
  if (!shell) return;
  const days = 14;
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const buckets = Array.from({length: days}, (_, index) => {
    const date = new Date(midnight);
    date.setDate(date.getDate() - (days - 1 - index));
    return {date, count: 0, fare: 0};
  });
  bookings.forEach(item => {
    const created = new Date(item.created_at);
    if (Number.isNaN(created.getTime())) return;
    created.setHours(0, 0, 0, 0);
    const bucket = buckets.find(entry => entry.date.getTime() === created.getTime());
    if (bucket) { bucket.count += 1; bucket.fare += Number(item.fare || 0); }
  });
  const total = buckets.reduce((sum, entry) => sum + entry.count, 0);
  summary.textContent = total ? `${total} ${total === 1 ? 'delivery' : 'deliveries'} booked` : 'No delivery data yet';
  if (!total) {
    shell.innerHTML = '<p class="graph-empty">Your booking activity will plot here once you complete a delivery.</p>';
    return;
  }
  const width = 320, height = 158, left = 22, right = 4, top = 10, bottom = 22;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const ceiling = Math.max(2, ...buckets.map(entry => entry.count));
  const step = plotWidth / days, barWidth = Math.min(24, step * 0.56);
  const ticks = [0, Math.round(ceiling / 2), ceiling].filter((value, index, list) => list.indexOf(value) === index);
  const grid = ticks.map(value => {
    const y = top + plotHeight - (value / ceiling) * plotHeight;
    return `<line class="graph-grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line><text class="graph-axis" x="${left - 8}" y="${y + 3}" text-anchor="end">${value}</text>`;
  }).join('');
  const columns = buckets.map((entry, index) => {
    const centre = left + step * index + step / 2;
    const barHeight = (entry.count / ceiling) * plotHeight;
    const y = top + plotHeight - barHeight;
    const label = index % 2 === 0 ? `<text class="graph-axis" x="${centre}" y="${height - 6}" text-anchor="middle">${entry.date.toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}</text>` : '';
    const bar = entry.count ? `<path class="graph-bar" d="${barPath(centre - barWidth / 2, y, barWidth, barHeight, 4)}"></path>` : '';
    return `<g class="graph-col" data-day="${entry.date.toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}" data-count="${entry.count}" data-fare="${entry.fare}" data-x="${(centre / width) * 100}" data-y="${(y / height) * 100}">
      <rect class="graph-band" x="${centre - step / 2}" y="${top}" width="${step}" height="${plotHeight}" rx="6"></rect>${bar}${label}
      <rect class="graph-bar-hit" x="${centre - step / 2}" y="${top}" width="${step}" height="${plotHeight}"></rect></g>`;
  }).join('');
  shell.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Deliveries booked per day over the last 14 days">${grid}${columns}</svg><div class="graph-tip" id="graphTip"></div>`;
  const tip = document.getElementById('graphTip');
  shell.querySelectorAll('.graph-col').forEach(column => {
    const show = () => {
      const count = Number(column.dataset.count);
      tip.innerHTML = `<b>${count} ${count === 1 ? 'delivery' : 'deliveries'}</b><span>${column.dataset.day}${count ? ` · ₹${column.dataset.fare}` : ''}</span>`;
      tip.style.left = `${column.dataset.x}%`;
      tip.style.top = `${count ? column.dataset.y : 100}%`;
      tip.classList.add('show');
    };
    column.addEventListener('mouseenter', show);
    column.addEventListener('focus', show);
    column.addEventListener('mouseleave', () => tip.classList.remove('show'));
  });
}

// Spend share by vehicle — Royal Indigo shades.
const spendRamp = ['#28205A', '#5142BD', '#6856D9', '#9387EA', '#D6D0FA'];
// The dashboard begins with the same delivery activity snapshot as the local
// installation. Live bookings replace this immediately once the account has data.
const dashboardActivitySnapshot = [
  {id:6,pickup:'Sector 21, Gandhinagar',drop_location:'Gandhinagar',load_type:'Furniture',weight:150,vehicle:'Loading Rickshaw',fare:249,status:'searching',created_at:'2026-08-08T04:54:35.764540+00:00'},
  {id:5,pickup:'Sector 21, Gandhinagar',drop_location:'Gandhinagar',load_type:'Electronics',weight:150,vehicle:'Loading Rickshaw',fare:140,status:'searching',created_at:'2026-08-06T19:29:16.759750+00:00'},
  {id:4,pickup:'Sector 21, Gandhinagar',drop_location:'SH133, Gandhinagar',load_type:'Electronics',weight:150,vehicle:'Tata Ace',fare:290,status:'searching',created_at:'2026-08-06T19:23:52.779645+00:00'},
  {id:3,pickup:'Sector 21, Gandhinagar',drop_location:'Gandhinagar',load_type:'Cement',weight:150,vehicle:'Pickup 8ft',fare:520,status:'searching',created_at:'2026-08-06T19:19:32.170930+00:00'},
  {id:2,pickup:'Sector 21, Gandhinagar',drop_location:'Sector 20, Gandhinagar',load_type:'Grocery',weight:148,vehicle:'Tata Ace',fare:340,status:'searching',created_at:'2026-08-06T19:15:56.652638+00:00'},
  {id:1,pickup:'Sector 21, Gandhinagar',drop_location:'Delhi',load_type:'Cement',weight:150,vehicle:'Tata Ace',fare:389,status:'delivered',created_at:'2026-08-06T19:11:44.682982+00:00'}
];
function renderSpendDonut(bookings) {
  const shell = document.getElementById('spendDonut');
  if (!shell) return;
  const totals = new Map();
  bookings.forEach(item => {
    const fare = Number(item.fare || 0);
    if (fare > 0) totals.set(item.vehicle, (totals.get(item.vehicle) || 0) + fare);
  });
  const slices = [...totals.entries()].map(([label, value]) => ({label, value})).sort((a, b) => b.value - a.value);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const badge = document.getElementById('graphSummary');
  if (badge) badge.textContent = bookings.length ? `${bookings.length} ${bookings.length === 1 ? 'delivery' : 'deliveries'} booked` : 'No delivery data yet';
  // The ring always draws, so the graph is visible before any delivery exists.
  if (!total) {
    shell.innerHTML = `<svg viewBox="0 0 140 140" role="img" aria-label="No delivery spend recorded yet">
        <circle cx="70" cy="70" r="52" fill="none" stroke="#E4E0FA" stroke-width="16"></circle>
        <text class="donut-total" x="70" y="68" text-anchor="middle">₹0</text>
        <text class="donut-caption" x="70" y="82" text-anchor="middle">${totalSpendCaption()}</text>
      </svg>`;
    return;
  }
  const merged = slices.length > spendRamp.length
    ? [...slices.slice(0, spendRamp.length - 1), {label: 'Other', value: slices.slice(spendRamp.length - 1).reduce((sum, slice) => sum + slice.value, 0)}]
    : slices;
  const radius = 52, thickness = 16, circumference = 2 * Math.PI * radius, gap = merged.length > 1 ? 3 : 0;
  let offset = 0;
  const arcs = merged.map((slice, index) => {
    const length = (slice.value / total) * circumference;
    const arc = `<circle class="donut-arc" cx="70" cy="70" r="${radius}" fill="none" stroke="${spendRamp[index]}" stroke-width="${thickness}"
      stroke-dasharray="${Math.max(0, length - gap)} ${circumference - Math.max(0, length - gap)}" stroke-dashoffset="${-offset}"
      data-label="${safe(slice.label)}" data-value="${slice.value}"><title>${safe(slice.label)}: ₹${slice.value}</title></circle>`;
    offset += length;
    return arc;
  }).join('');
  const legend = merged.map((slice, index) => `<li><i style="background:${spendRamp[index]}"></i><b>${safe(slice.label)}</b><em>₹${slice.value}</em></li>`).join('');
  shell.innerHTML = `<svg viewBox="0 0 140 140" role="img" aria-label="Delivery spend split by vehicle type">
      <circle cx="70" cy="70" r="${radius}" fill="none" stroke="#E4E0FA" stroke-width="${thickness}"></circle>
      <g transform="rotate(-90 70 70)">${arcs}</g>
      <text class="donut-total" x="70" y="68" text-anchor="middle">₹${total}</text>
      <text class="donut-caption" x="70" y="82" text-anchor="middle">${totalSpendCaption()}</text>
    </svg><ul class="donut-legend">${legend}</ul>`;
}

function renderCustomerDashboard(bookings) {
  const dashboardBookings=bookings.length ? bookings : dashboardActivitySnapshot;
  const active=dashboardBookings.filter(item=>['searching','accepted','pickup','in_transit'].includes(item.status)).length;
  const spend=dashboardBookings.reduce((total,item)=>total+Number(item.fare||0),0);
  const firstBooking=dashboardBookings.map(item=>new Date(item.created_at).getTime()).filter(Number.isFinite).sort((a,b)=>a-b)[0];
  const days=firstBooking ? Math.max(1,Math.ceil((Date.now()-firstBooking)/86400000)) : 1;
  const daysValue=document.getElementById('daysWithHaulr');
  const daysRing=document.querySelector('.days-dial-progress');
  if(daysValue) daysValue.textContent=days;
  if(daysRing){const circumference=2*Math.PI*52; daysRing.style.strokeDasharray=`${circumference}`; daysRing.style.strokeDashoffset=`${circumference*(1-Math.min(days,30)/30)}`;}
  document.getElementById('dashTotal').textContent=dashboardBookings.length;
  document.getElementById('jarvisValue').textContent=active;
  document.getElementById('jarvisLabel').textContent=active===1?'Active delivery':'Active deliveries';
  const jarvisV2Value=document.getElementById('jarvisV2Value');
  const jarvisV2Label=document.getElementById('jarvisV2Label');
  if(jarvisV2Value)jarvisV2Value.textContent=active;
  if(jarvisV2Label)jarvisV2Label.textContent=active===1?'Active delivery':'Active deliveries';
  renderSpendDonut(dashboardBookings);
  const recent=document.getElementById('dashboardRecent');
  recent.className='';
  recent.innerHTML=dashboardBookings.slice(0,3).map(item=>`<div class="dashboard-order"><span><i data-lucide="${statusInfo[item.status]?.[1]||'package'}"></i></span><div><b>${safe(item.pickup)} → ${safe(item.drop_location)}</b><small>#HLR-${String(item.id).padStart(4,'0')} · ${safe(statusInfo[item.status]?.[0]||item.status)}</small></div><strong>₹${item.fare}</strong></div>`).join('');
  if(window.lucide)lucide.createIcons();
  initializeMotionEffects(recent);
}
function renderOrders(bookings, selectedId) {
  const selected=bookings.find(item=>item.id===Number(selectedId))||bookings[0];
  const steps=['accepted','pickup','in_transit','delivered'];
  const currentIndex=steps.indexOf(selected.status);
  const timeline=steps.map((step,index)=>`<div class="${selected.status==='delivered'||index<currentIndex?'done':index===currentIndex?'current':''}"><i>${selected.status==='delivered'||index<currentIndex?'✓':''}</i><span><b>${statusInfo[step][0]}</b><small>${index<=currentIndex?'Updated':'Waiting'}</small></span></div>`).join('');
  const driver=selected.driver_name?`<div class="driver-card"><div class="avatar">${safe(initials(selected.driver_name))}</div><div><small>ASSIGNED DRIVER</small><h3>${safe(selected.driver_name)}</h3><p>${safe(selected.vehicle_number||'Vehicle verification pending')} · ${safe(selected.vehicle)}</p></div></div>`:`<div class="driver-card searching-driver"><span><i data-lucide="radar"></i></span><div><small>DRIVER MATCHING</small><h3>Finding a verified driver</h3><p>You will see verified driver details after acceptance.</p></div></div>`;
  const paymentState=selected.payment_status==='paid'?'Paid successfully':selected.payment_status==='due_on_delivery'?'Due on delivery':'Pending';
  document.getElementById('ordersGrid').innerHTML=`<div class="real-orders-list"><div class="orders-list-head"><small>ALL SHIPMENTS</small><b>${bookings.length}</b></div>${bookings.map(item=>`<button class="real-order-item ${item.id===selected.id?'active':''}" data-order-id="${item.id}"><span><i data-lucide="${statusInfo[item.status]?.[1]||'package'}"></i></span><div><b>#HLR-${String(item.id).padStart(4,'0')}</b><small>${safe(item.load_type)} · ${new Date(item.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</small></div><em>${safe(statusInfo[item.status]?.[0]||item.status)}</em><strong class="order-currency">₹${item.fare}</strong></button>`).join('')}</div><article class="real-order-detail"><div class="order-top"><div><span class="live-pill"><i></i> ${selected.status==='delivered'?'COMPLETE':'LIVE'}</span><small>ORDER #HLR-${String(selected.id).padStart(4,'0')}</small></div><strong class="order-currency order-currency-large">₹${selected.fare}</strong></div><div class="order-payment-state ${selected.payment_status==='paid'?'paid':'due'}"><i data-lucide="${selected.payment_status==='paid'?'badge-check':'clock-3'}"></i><span><small>PAYMENT STATUS</small><b>${paymentState}</b></span>${selected.payment_reference?`<em>${safe(selected.payment_reference)}</em>`:''}</div><div class="order-inline-map-shell"><div id="orderInlineMap" class="order-inline-map"></div><button type="button" class="order-map-focus" data-focus-vehicle><i data-lucide="navigation"></i>${selected.status==='delivered'?'Delivered at destination':'Current vehicle position'}</button></div><button class="order-track-action" type="button" data-track-selected="${selected.id}"><i data-lucide="locate-fixed"></i> Open live tracking <i data-lucide="arrow-right"></i></button>${driver}<div class="real-route"><div><i class="green"></i><span><small>PICKUP</small><b>${safe(selected.pickup)}</b></span></div><div><i class="orange"></i><span><small>DROP</small><b>${safe(selected.drop_location)}</b></span></div></div><div class="order-facts"><span><small>LOAD</small><b>${safe(selected.load_type)} · ${selected.weight} kg</b></span><span><small>VEHICLE</small><b>${safe(selected.vehicle)}</b></span><span><small>PAYMENT</small><b>${safe(selected.payment_method)}</b></span><span><small>PICKUP</small><b>${safe(selected.schedule)}</b></span></div><div class="timeline">${timeline}</div></article>`;
  document.querySelectorAll('[data-order-id]').forEach(button=>button.addEventListener('click',()=>{
    renderOrders(bookings,button.dataset.orderId);
    setTimeout(()=>document.querySelector('.real-order-detail')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
  }));
  document.querySelector('[data-track-selected]')?.addEventListener('click',event=>{const id=event.currentTarget.dataset.trackSelected;showView('track');const input=document.getElementById('trackOrderInput');input.value=id;document.getElementById('trackOrderForm').requestSubmit();});
  if(window.lucide)lucide.createIcons();
  buildInlineOrderMap(selected);
}

let inlineOrderMap=null;
let inlineOrderTimer=null;
async function buildInlineOrderMap(order){
  if(typeof L==='undefined'||!document.getElementById('orderInlineMap'))return;
  protectLiveMap('orderInlineMap');
  if(inlineOrderTimer)clearInterval(inlineOrderTimer);if(inlineOrderMap)inlineOrderMap.remove();
  const start=Number(order.pickup_lat)&&Number(order.pickup_lng)?[Number(order.pickup_lat),Number(order.pickup_lng)]:[23.2248,72.6492];
  const end=Number(order.drop_lat)&&Number(order.drop_lng)?[Number(order.drop_lat),Number(order.drop_lng)]:[23.2156,72.6369];
  inlineOrderMap=L.map('orderInlineMap',{zoomControl:false,scrollWheelZoom:false,dragging:true}).setView(start,12);
  L.tileLayer(mapTileUrl,mapTileOptions).addTo(inlineOrderMap);
  L.marker(start,{icon:pinIcon()}).addTo(inlineOrderMap);L.marker(end,{icon:pinIcon('drop')}).addTo(inlineOrderMap);
  let points=[start,end];try{const response=await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);const data=await response.json();if(data.routes?.[0])points=data.routes[0].geometry.coordinates.map(([lng,lat])=>[lat,lng]);}catch(_){}
  L.polyline(points,{color:'#fff',weight:9,opacity:.95}).addTo(inlineOrderMap);L.polyline(points,{color:'#126149',weight:5}).addTo(inlineOrderMap);
  const fractions={searching:0,accepted:.12,pickup:.03,in_transit:.46,delivered:1,rejected:0};let index=Math.min(points.length-1,Math.floor((fractions[order.status]??0)*points.length));
  const icon=L.divIcon({className:'',html:'<div class="vehicle-marker"><svg viewBox="0 0 24 24"><path d="M10 17h4V5H2v12h3m14 0h3v-5l-3-4h-5v9h1M7.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm10 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg></div>',iconSize:[42,42],iconAnchor:[21,21]});const marker=L.marker(points[index],{icon,zIndexOffset:500}).addTo(inlineOrderMap).bindPopup(order.driver_name?`${safe(order.driver_name)} · current vehicle position`:'Current vehicle position');
  document.querySelector('[data-focus-vehicle]')?.addEventListener('click',()=>{inlineOrderMap.setView(marker.getLatLng(),16,{animate:true});marker.openPopup();});
  inlineOrderMap.fitBounds(L.latLngBounds(points),{padding:[28,28],maxZoom:13});
  if(['accepted','pickup','in_transit'].includes(order.status)&&points.length>2){const finish=Math.max(index+1,Math.floor(points.length*.94));inlineOrderTimer=setInterval(()=>{index=index>=finish?Math.floor(points.length*.08):index+1;marker.setLatLng(points[index]);},800);}
  inlineOrderMap.whenReady(()=>{inlineOrderMap.invalidateSize();setTimeout(()=>inlineOrderMap?.invalidateSize(),350);});
}

const settingsApp=document.querySelector('.settings-app');
// The first settings page is visible in the markup, but no row is selected
// until the customer deliberately opens one.
document.querySelector('[data-settings-page="profile"]')?.classList.remove('active');
function activateSettingsPage(page, {openDetail = true} = {}) {
  // Include Saved places as well: it opens a separate view but still belongs
  // to this one-choice settings menu.
  const buttons = [...document.querySelectorAll('.settings-bars button')];
  const selected = buttons.find(item => item.dataset.settingsPage === page);
  // Explicit removal avoids stale visual states on touch browsers.
  buttons.forEach(item => item.classList.remove('active'));
  selected?.classList.add('active');
  document.querySelectorAll('[data-settings-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.settingsPanel === page);
  });
  settingsApp?.classList.toggle('detail-open', openDetail);
}
document.querySelector('[data-settings-page="payments"]')?.remove();
document.querySelector('[data-settings-panel="payments"]')?.remove();
document.querySelectorAll('[data-settings-panel]').forEach(panel=>panel.insertAdjacentHTML('afterbegin','<button type="button" class="settings-back"><i data-lucide="arrow-left"></i><span>Back to settings</span></button>'));
document.querySelector('.track-hero')?.insertAdjacentHTML('afterbegin','<button type="button" class="track-page-back" id="trackPageBack"><i data-lucide="arrow-left"></i><span>Go back</span></button>');
document.querySelectorAll('.settings-back').forEach(button=>button.addEventListener('click',()=>settingsApp?.classList.remove('detail-open')));
document.getElementById('placesBack')?.addEventListener('click',()=>showView(previousView&&previousView!=='places'?previousView:'home'));
document.getElementById('trackPageBack')?.addEventListener('click',()=>{
  showView(previousView||'settings');
  if(currentView!=='settings')return;
  activateSettingsPage('tracking',{openDetail:false});
});
document.querySelectorAll('[data-settings-page]').forEach(button=>button.addEventListener('click',()=>{
  const page=button.dataset.settingsPage;
  activateSettingsPage(page);
  if(window.lucide)lucide.createIcons();
}));
const securityPanel=document.querySelector('[data-settings-panel="security"]');
const securityActions=securityPanel?.querySelectorAll('.settings-launch');
if(securityActions?.length===2){
  securityActions[0].id='openChangePassword';securityActions[1].id='openActiveSessions';
  securityPanel.insertAdjacentHTML('beforeend',`<div class="security-subpage" id="changePasswordPage"><button type="button" class="security-sub-back"><i data-lucide="arrow-left"></i> Security</button><div class="security-form-head"><span><i data-lucide="key-round"></i></span><div><small>SECURE ACCOUNT</small><h3>Change password</h3><p>Confirm your existing password before choosing a new one.</p></div></div><form id="changePasswordForm"><label>Current password<div class="payment-field"><i data-lucide="lock"></i><input id="currentPassword" type="password" required autocomplete="current-password"></div></label><label>New password<div class="payment-field"><i data-lucide="key-round"></i><input id="newPassword" type="password" minlength="8" required autocomplete="new-password"></div></label><label>Confirm new password<div class="payment-field"><i data-lucide="shield-check"></i><input id="confirmPassword" type="password" minlength="8" required autocomplete="new-password"></div></label><p class="security-error" id="passwordError"></p><button class="primary-btn" type="submit">Update password <span>→</span></button></form><div class="recovery-note"><i data-lucide="mail-check"></i><span><b>Security notification</b><small>A confirmation appears in your Haulr notifications. External email or SMS delivery requires a configured mail/SMS provider.</small></span></div></div><div class="security-subpage" id="activeSessionsPage"><button type="button" class="security-sub-back"><i data-lucide="arrow-left"></i> Security</button><div class="security-form-head"><span><i data-lucide="smartphone"></i></span><div><small>YOUR DEVICES</small><h3>Active sessions</h3><p>Review browsers signed into your Haulr account.</p></div></div><div id="sessionsList" class="sessions-list"></div></div>`);
}
function openSecuritySubpage(id){securityPanel.classList.add('show-subpage');securityPanel.querySelector('.settings-page-head')?.classList.add('security-menu-hidden');securityActions?.forEach(action=>action.classList.add('security-menu-hidden'));securityPanel.querySelectorAll('.security-subpage').forEach(page=>page.classList.toggle('active',page.id===id));if(id==='activeSessionsPage')loadAccountSessions();if(window.lucide)lucide.createIcons();}
document.getElementById('openChangePassword')?.addEventListener('click',()=>openSecuritySubpage('changePasswordPage'));
document.getElementById('openActiveSessions')?.addEventListener('click',()=>openSecuritySubpage('activeSessionsPage'));
document.querySelectorAll('.security-sub-back').forEach(button=>button.addEventListener('click',()=>{securityPanel.classList.remove('show-subpage');securityPanel.querySelector('.settings-page-head')?.classList.remove('security-menu-hidden');securityActions?.forEach(action=>action.classList.remove('security-menu-hidden'));securityPanel.querySelectorAll('.security-subpage').forEach(page=>page.classList.remove('active'));}));
document.getElementById('changePasswordForm')?.addEventListener('submit',async event=>{event.preventDefault();const error=document.getElementById('passwordError');const current=document.getElementById('currentPassword').value;const next=document.getElementById('newPassword').value;if(next!==document.getElementById('confirmPassword').value){error.textContent='New passwords do not match.';return;}const response=await fetch('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_password:current,new_password:next})});const data=await response.json();if(!response.ok){error.textContent=data.error||'Unable to change password.';return;}event.target.reset();error.textContent='';showSuccess('Password updated','Your account password was changed securely.');await loadNotifications();securityPanel.classList.remove('show-subpage');});
async function loadAccountSessions(){const list=document.getElementById('sessionsList');list.innerHTML='<p>Loading signed-in devices…</p>';const response=await fetch('/api/auth/sessions');const sessions=await response.json();if(!response.ok){list.innerHTML=`<p>${safe(sessions.error)}</p>`;return;}list.innerHTML=sessions.length?sessions.map(item=>`<article><span><i data-lucide="${/mobile|iphone|android/i.test(item.device)?'smartphone':'monitor'}"></i></span><div><b>${item.current?'This device':'Signed-in browser'}</b><small>${safe(item.device)}</small><em>${safe(item.ip_address||'Local network')} · ${new Date(item.last_active).toLocaleString()}</em></div><button data-revoke-session="${item.id}">${item.current?'Sign out':'Revoke'}</button></article>`).join(''):'<p>No active sessions found.</p>';list.querySelectorAll('[data-revoke-session]').forEach(button=>button.addEventListener('click',async()=>{const result=await fetch(`/api/auth/sessions/${button.dataset.revokeSession}`,{method:'DELETE'});const data=await result.json();if(data.status==='signed_out'){renderAccount(null);showView('home');showNotice('This session was signed out.');}else loadAccountSessions();}));if(window.lucide)lucide.createIcons();}
document.getElementById('settingsTrackOrder').addEventListener('click',()=>showView('track'));
let trackedMap=null;
let trackedVehicleTimer=null;

async function buildOrderTrackingMap(order){
  if(typeof L==='undefined'||!document.getElementById('trackedLiveMap'))return;
  if(trackedVehicleTimer){clearInterval(trackedVehicleTimer);trackedVehicleTimer=null;}
  if(trackedMap){trackedMap.remove();trackedMap=null;}
  const validPoint=(lat,lng,fallback)=>Number(lat)&&Number(lng)?[Number(lat),Number(lng)]:fallback;
  const start=validPoint(order.pickup_lat,order.pickup_lng,[23.2248,72.6492]);
  const end=validPoint(order.drop_lat,order.drop_lng,[23.2156,72.6369]);
  protectLiveMap('trackedLiveMap');
  trackedMap=L.map('trackedLiveMap',{zoomControl:false,scrollWheelZoom:false}).setView(start,12);
  L.tileLayer(mapTileUrl,mapTileOptions).addTo(trackedMap);
  L.control.zoom({position:'bottomright'}).addTo(trackedMap);
  L.marker(start,{icon:pinIcon()}).addTo(trackedMap).bindPopup(`Pickup · ${safe(order.pickup)}`);
  L.marker(end,{icon:pinIcon('drop')}).addTo(trackedMap).bindPopup(`Drop · ${safe(order.drop_location)}`);
  let points=[start,end];
  try{
    const response=await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
    const data=await response.json();
    if(data.routes?.[0])points=data.routes[0].geometry.coordinates.map(([lng,lat])=>[lat,lng]);
  }catch(_){/* Straight route remains available if routing is offline. */}
  L.polyline(points,{color:'#fff',weight:10,opacity:.94}).addTo(trackedMap);
  L.polyline(points,{color:'#126449',weight:5,opacity:1}).addTo(trackedMap);
  const fractions={searching:0,accepted:.12,pickup:.03,in_transit:.42,delivered:1,rejected:0};
  let index=Math.min(points.length-1,Math.floor((fractions[order.status]??0)*points.length));
  const vehicleIcon=L.divIcon({className:'',html:'<div class="vehicle-marker tracked-vehicle"><svg viewBox="0 0 24 24"><path d="M10 17h4V5H2v12h3m14 0h3v-5l-3-4h-5v9h1M7.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm10 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg></div>',iconSize:[42,42],iconAnchor:[21,21]});
  const vehicle=L.marker(points[index],{icon:vehicleIcon,zIndexOffset:500}).addTo(trackedMap).bindPopup(order.driver_name?`${safe(order.driver_name)} · live position`:'Vehicle position');
  trackedMap.fitBounds(L.latLngBounds(points),{padding:[38,38],maxZoom:13});
  if(['accepted','pickup','in_transit'].includes(order.status)&&points.length>2){
    const finish=Math.max(index+1,Math.floor(points.length*.94));
    trackedVehicleTimer=setInterval(()=>{index=index>=finish?Math.max(0,Math.floor(points.length*.08)):index+1;vehicle.setLatLng(points[index]);},700);
  }
  setTimeout(()=>trackedMap?.invalidateSize(),100);
}
document.getElementById('trackOrderInput').addEventListener('input',event=>{event.target.value=event.target.value.replace(/\D/g,'').slice(0,8)});
document.getElementById('trackOrderForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!currentUser){openAuth();return;}
  const id=Number(document.getElementById('trackOrderInput').value);const result=document.getElementById('trackResult');
  result.innerHTML='<span><i data-lucide="loader-circle"></i></span><h2>Checking live status…</h2><p>Reading the latest update from your account.</p>';if(window.lucide)lucide.createIcons();
  try{
    const response=await fetch(`/api/bookings/${id}`);const order=await response.json();if(!response.ok)throw new Error(order.error);
    const status=statusInfo[order.status]?.[0]||order.status;
    result.innerHTML=`<div class="tracked-order"><div class="tracked-status"><div><small>ORDER NUMBER</small><strong>#HLR-${String(order.id).padStart(4,'0')}</strong></div><span><i></i>${safe(status)}</span></div><div class="tracked-map-shell"><div id="trackedLiveMap" class="tracked-live-map"></div><div class="tracked-map-label"><small>LIVE VEHICLE POSITION</small><b>${order.status==='delivered'?'Delivery completed':'Updating on route'}</b></div></div><div class="real-route"><div><i class="green"></i><span><small>PICKUP</small><b>${safe(order.pickup)}</b></span></div><div><i class="orange"></i><span><small>DROP</small><b>${safe(order.drop_location)}</b></span></div></div><div class="order-facts"><span><small>LOAD</small><b>${safe(order.load_type)} · ${order.weight} kg</b></span><span><small>VEHICLE</small><b>${safe(order.vehicle)}</b></span><span><small>PAYMENT</small><b>${safe(order.payment_method)}</b></span><span><small>FARE</small><b>₹${order.fare}</b></span></div>${order.driver_name?`<div class="driver-card"><div class="avatar">${initials(order.driver_name)}</div><div><small>ASSIGNED DRIVER</small><h3>${safe(order.driver_name)}</h3><p>${safe(order.vehicle_number||'Vehicle pending')}</p></div></div>`:'<div class="driver-card searching-driver"><span><i data-lucide="radar"></i></span><div><small>DRIVER MATCHING</small><h3>Awaiting verified driver</h3><p>No driver information is available yet.</p></div></div>'}</div>`;
    await buildOrderTrackingMap(order);
  }catch(error){result.innerHTML=`<span><i data-lucide="circle-alert"></i></span><h2>Order not found</h2><p>${safe(error.message||'Check the order number and try again.')}</p>`;}
  if(window.lucide)lucide.createIcons();
});

window.addEventListener('load', loadLatestBooking);
window.addEventListener('load', () => { if (window.lucide) lucide.createIcons(); });

// Persistent session account UI.
const authOverlay = document.getElementById('authOverlay');
const accountMenu = document.getElementById('accountMenu');
const entryGate = document.getElementById('entryGate');
function initials(name) { return name.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
function renderAccount(user) {
  currentUser = user;
  entryGate?.classList.toggle('hidden', Boolean(user));
  entryGate?.setAttribute('aria-hidden', user ? 'true' : 'false');
  const initialBox = document.getElementById('accountInitials');
  if (user) {
    initialBox.textContent = initials(user.name);
    document.getElementById('accountName').textContent = user.name.split(' ')[0];
    document.getElementById('menuAvatar').textContent = initials(user.name);
    document.getElementById('menuName').textContent = user.name;
    document.getElementById('menuEmail').textContent = user.email;
    document.getElementById('profileAction').classList.add('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('phone').value = user.phone;
    document.getElementById('settingsName').value = user.name;
    document.getElementById('settingsEmail').value = user.email;
    document.getElementById('settingsPhone').value = user.phone;
    document.getElementById('dashboardGreeting').innerHTML = `Good to see you, ${safe(user.name.split(' ')[0])}.<br><em>What are we moving?</em>`;
    if (user.role === 'driver') renderDriverWorkspace(user);
    loadWallet();
    loadNotifications();
  } else {
    initialBox.innerHTML = '<i data-lucide="user"></i>';
    document.getElementById('accountName').textContent = 'Sign in';
    document.getElementById('menuAvatar').textContent = 'U';
    document.getElementById('menuName').textContent = 'Guest';
    document.getElementById('menuEmail').textContent = 'Sign in to manage deliveries';
    document.getElementById('profileAction').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');
    ['settingsName','settingsEmail','settingsPhone'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('dashboardGreeting').innerHTML = 'Move anything.<br><em>Without the stress.</em>';
    renderNotifications([]);
  }
  if (window.lucide) lucide.createIcons();
}

function renderDriverWorkspace(user) {
  const driverView = document.getElementById('driver-view');
  if (!driverView) return;
  driverView.querySelector('.dash-head h1').textContent = `Welcome, ${user.name.split(' ')[0]}`;
  driverView.querySelector('.dash-head p').textContent = 'DRIVER WORKSPACE · VERIFIED DELIVERY PARTNER';
  initializeDriverPortal(driverView, user);
  const card = driverView.querySelector('.request-card');
  if (card && !card.querySelector('.driver-onboarding-note')) {
    card.insertAdjacentHTML('beforeend', '<p class="driver-onboarding-note"><i data-lucide="shield-check"></i> Complete document verification to receive live booking requests.</p>');
  }
  setTimeout(() => showView('driver'), 0);
}

function initializeDriverPortal(driverView, user) {
  const sidebar = driverView.querySelector('.side-nav');
  const home = driverView.querySelector('.dash-content');
  if (!sidebar || !home) return;

  home.classList.add('driver-section', 'active');
  home.dataset.driverSection = 'home';
  if (!driverView.querySelector('[data-driver-section="orders"]')) {
    home.insertAdjacentHTML('afterend', `
      <section class="driver-section driver-utility" data-driver-section="orders">
        <div class="driver-section-head"><small>LIVE WORK</small><h1>Orders</h1><p>Review new loading requests and your active delivery trips.</p></div>
        <div class="driver-order-grid">
          <article><span><i data-lucide="radio-tower"></i></span><small>NEW REQUEST</small><h2>Waiting for a nearby customer</h2><p>Go online to receive verified load delivery requests.</p><button type="button" class="driver-action" data-driver-home>Open driver home <i data-lucide="arrow-right"></i></button></article>
          <article><span><i data-lucide="route"></i></span><small>ACTIVE TRIPS</small><h2>Trip updates in one place</h2><p>Accepted pickup and delivery progress will appear here automatically.</p><button type="button" class="driver-action" data-driver-home>View current request <i data-lucide="arrow-right"></i></button></article>
        </div>
      </section>
      <section class="driver-section driver-utility" data-driver-section="deliveries">
        <div class="driver-section-head"><small>TRIP HISTORY</small><h1>Previous deliveries</h1><p>Your completed trips and earnings summary.</p></div>
        <div class="driver-history"><article><span><i data-lucide="circle-check"></i></span><div><b>Sector 7 → Infocity</b><small>Completed today · 5.2 km</small></div><strong>₹280</strong></article><article><span><i data-lucide="circle-check"></i></span><div><b>Kudasan → Sargasan</b><small>Completed today · 3.7 km</small></div><strong>₹220</strong></article><article><span><i data-lucide="circle-check"></i></span><div><b>Sector 21 → Pethapur</b><small>Completed yesterday · 8.1 km</small></div><strong>₹410</strong></article></div>
      </section>
      <section class="driver-section driver-utility" data-driver-section="settings">
        <div class="driver-section-head"><small>DRIVER ACCOUNT</small><h1>Settings</h1><p>Manage availability, vehicle information and verification documents.</p></div>
        <div class="driver-settings-list"><article><span><i data-lucide="badge-check"></i></span><div><b>Document verification</b><small>Aadhaar, driving licence, RC and profile photo</small></div><em>Pending review</em></article><article><span><i data-lucide="truck"></i></span><div><b>Vehicle details</b><small>Loading vehicle and registration details</small></div><em>Update</em></article><article><span><i data-lucide="bell-ring"></i></span><div><b>Trip alerts</b><small>Booking, pickup and payment notifications</small></div><em>Enabled</em></article></div>
      </section>`);
  }

  sidebar.innerHTML = `<div><p>HAULR DRIVER</p><button class="active" data-driver-view="home"><i data-lucide="house"></i><span>Home</span></button><button data-driver-view="orders"><i data-lucide="clipboard-list"></i><span>Orders</span></button><button data-driver-view="deliveries"><i data-lucide="history"></i><span>Previous deliveries</span></button><button data-driver-view="settings"><i data-lucide="settings-2"></i><span>Settings</span></button></div><button class="sign-out" id="driverSignOut"><i data-lucide="log-out"></i><span>Sign out</span></button>`;
  const select = section => {
    driverView.querySelectorAll('[data-driver-section]').forEach(panel => panel.classList.toggle('active', panel.dataset.driverSection === section));
    sidebar.querySelectorAll('[data-driver-view]').forEach(button => button.classList.toggle('active', button.dataset.driverView === section));
    driverView.querySelector('.dash-content')?.scrollTo({top:0, behavior:'smooth'});
    if (window.lucide) lucide.createIcons();
  };
  sidebar.querySelectorAll('[data-driver-view]').forEach(button => button.addEventListener('click', () => select(button.dataset.driverView)));
  driverView.querySelectorAll('[data-driver-home]').forEach(button => button.addEventListener('click', () => select('home')));
  sidebar.querySelector('#driverSignOut')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', {method:'POST'});
    renderAccount(null);
    showView('home');
  });
  if (window.lucide) lucide.createIcons();
}

function addRolePicker(form, fieldId) {
  if (!form || form.querySelector('.role-picker')) return;
  form.insertAdjacentHTML('afterbegin', `<fieldset class="role-picker"><legend>Register in Haulr as</legend><input type="hidden" id="${fieldId}" value="customer"><div><button type="button" class="active" data-register-role="customer"><i data-lucide="package-check"></i><span><b>Customer</b><small>Book and track deliveries</small></span></button><button type="button" data-register-role="driver"><i data-lucide="truck"></i><span><b>Driver</b><small>Deliver and earn with Haulr</small></span></button></div></fieldset>`);
  form.querySelectorAll('[data-register-role]').forEach(button => button.addEventListener('click', () => {
    form.querySelectorAll('[data-register-role]').forEach(item => item.classList.toggle('active', item === button));
    form.querySelector(`#${fieldId}`).value = button.dataset.registerRole;
    if (window.lucide) lucide.createIcons();
  }));
}
addRolePicker(document.getElementById('entryRegisterForm'), 'entryRegisterRole');
addRolePicker(document.getElementById('registerForm'), 'registerRole');
function openAuth() { authOverlay.classList.add('open'); authOverlay.setAttribute('aria-hidden','false'); accountMenu.classList.remove('open'); document.body.style.overflow='hidden'; setTimeout(initGoogleIdentity, 60); }
function closeAuth() { authOverlay.classList.remove('open'); authOverlay.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
document.getElementById('accountBtn').addEventListener('click', event => { event.stopPropagation(); accountMenu.classList.toggle('open'); });
document.addEventListener('click', event => { if (!event.target.closest('.account-wrap')) accountMenu.classList.remove('open'); });
document.getElementById('profileAction').addEventListener('click', openAuth);
function showEntryPage(page){
  entryGate?.querySelectorAll('[data-entry-page]').forEach(item=>item.classList.toggle('hidden',item.dataset.entryPage!==page));
  if(window.lucide)lucide.createIcons();
}
document.querySelectorAll('[data-entry-auth]').forEach(button=>button.addEventListener('click',()=>{
  if(entryGate && !entryGate.classList.contains('hidden')){showEntryPage(button.dataset.entryAuth);return;}
  openAuth();
  document.querySelector(`[data-auth-tab="${button.dataset.entryAuth}"]`)?.click();
}));
document.querySelectorAll('[data-entry-back]').forEach(button=>button.addEventListener('click',()=>showEntryPage('start')));
async function entryAuthRequest(path,payload,errorId){
  const error=document.getElementById(errorId);error.textContent='';error.className='auth-error';
  try{
    const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json();
    if(!response.ok){error.className='auth-error';error.textContent=data.error||'Unable to continue.';return;}
    if(data.requires_login){
      document.getElementById('entryLoginEmail').value=data.email;
      document.getElementById('entryLoginPassword').value='';
      showEntryPage('login');
      document.getElementById('entryLoginError').className='auth-error auth-success';
      document.getElementById('entryLoginError').textContent='Account created successfully. Sign in with your password.';
      document.getElementById('entryLoginPassword').focus();
      return;
    }
    renderAccount(data);loadLatestBooking();
  }catch(_){error.className='auth-error';error.textContent='Unable to reach Haulr right now.';}
}
document.getElementById('entryLoginForm')?.addEventListener('submit',event=>{event.preventDefault();entryAuthRequest('/api/auth/login',{email:document.getElementById('entryLoginEmail').value,password:document.getElementById('entryLoginPassword').value},'entryLoginError');});
document.getElementById('entryRegisterForm')?.addEventListener('submit',event=>{event.preventDefault();entryAuthRequest('/api/auth/register',{name:document.getElementById('entryRegisterName').value,email:document.getElementById('entryRegisterEmail').value,phone:document.getElementById('entryRegisterPhone').value,password:document.getElementById('entryRegisterPassword').value,role:document.getElementById('entryRegisterRole').value},'entryRegisterError');});
async function launchGoogleSignIn(event) {
  event?.preventDefault();
  const error = document.getElementById('loginError') || document.getElementById('entryLoginError');
  if (error) { error.textContent = ''; error.className = 'auth-error'; }
  try {
    const response = await fetch('/api/auth/google/status');
    const data = await response.json();
    if (!data.configured) throw new Error('Google sign-in is not configured yet.');
    const popup = window.open('/api/auth/google/start?popup=1', 'haulrGoogleSignIn', 'popup=yes,width=520,height=680,resizable=yes,scrollbars=yes');
    // A browser may block popups; keep a same-window path as a safe fallback.
    if (!popup) { window.location.assign('/api/auth/google/start'); return; }
  } catch (issue) {
    if (error) error.textContent = issue.message || 'Unable to start Google sign-in right now.';
  }
}
document.getElementById('googleAuthBtn').addEventListener('click', launchGoogleSignIn);
document.querySelectorAll('.entry-google').forEach(button => button.addEventListener('click', launchGoogleSignIn));
window.addEventListener('message', async event => {
  if (event.origin !== window.location.origin || event.data?.type !== 'haulr-google-signed-in') return;
  const response = await fetch('/api/auth/me');
  const data = await response.json();
  if (data.user) { renderAccount(data.user); loadLatestBooking(); }
});
document.getElementById('authClose').addEventListener('click', closeAuth);
authOverlay.addEventListener('click', event => { if (event.target === authOverlay) closeAuth(); });
document.querySelectorAll('[data-auth-tab]').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('[data-auth-tab]').forEach(item => item.classList.toggle('active', item === tab));
  document.querySelectorAll('[data-auth-form]').forEach(form => form.classList.toggle('active', form.dataset.authForm === tab.dataset.authTab));
  const showGoogle=tab.dataset.authTab==='login';
  document.getElementById('googleAuthBtn').classList.toggle('hidden',!showGoogle);
  document.getElementById('googleAuthDivider').classList.toggle('hidden',!showGoogle);
}));
async function authRequest(path, payload, errorId) {
  const error = document.getElementById(errorId); error.textContent = '';
  const response = await fetch(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data = await response.json();
  if (!response.ok) { error.textContent = data.error || 'Unable to continue'; return; }
  if (data.requires_login) {
    document.querySelectorAll('[data-auth-tab]').forEach(item=>item.classList.toggle('active',item.dataset.authTab==='login'));
    document.querySelectorAll('[data-auth-form]').forEach(form=>form.classList.toggle('active',form.dataset.authForm==='login'));
    document.getElementById('loginEmail').value=data.email;
    document.getElementById('loginPassword').value='';
    document.getElementById('googleAuthBtn').classList.remove('hidden');
    document.getElementById('googleAuthDivider').classList.remove('hidden');
    document.getElementById('loginError').className='auth-error auth-success';
    document.getElementById('loginError').textContent='Account created successfully. Sign in with your password.';
    setTimeout(()=>document.getElementById('loginPassword').focus(),100);
    return;
  }
  renderAccount(data); closeAuth(); loadLatestBooking();
}
document.getElementById('loginForm').addEventListener('submit', event => {
  event.preventDefault(); authRequest('/api/auth/login',{email:document.getElementById('loginEmail').value,password:document.getElementById('loginPassword').value},'loginError');
});
document.getElementById('registerForm').addEventListener('submit', event => {
  event.preventDefault(); authRequest('/api/auth/register',{name:document.getElementById('registerName').value,email:document.getElementById('registerEmail').value,phone:document.getElementById('registerPhone').value,password:document.getElementById('registerPassword').value,role:document.getElementById('registerRole').value},'registerError');
});
document.getElementById('logoutBtn').addEventListener('click', async () => { await fetch('/api/auth/logout',{method:'POST'}); renderAccount(null); renderCustomerDashboard([]); document.getElementById('ordersEmpty').classList.remove('hidden'); document.getElementById('ordersGrid').classList.add('hidden'); accountMenu.classList.remove('open'); showView('home'); });
async function restoreSession() {
  const authParams=new URLSearchParams(window.location.search);
  const googleSuccess=authParams.get('auth')==='google_success';
  try {
    const response=await fetch('/api/auth/me');
    const data=await response.json();
    renderAccount(data.user);
    if (data.user && googleSuccess) {
      document.getElementById('loginError').textContent='';
      closeAuth();
      loadLatestBooking();
      showSuccess('Signed in',`Welcome back, ${data.user.name.split(' ')[0]}.`);
      if (authParams.get('popup') === '1' && window.opener) {
        window.opener.postMessage({type:'haulr-google-signed-in'}, window.location.origin);
        setTimeout(() => window.close(), 120);
      }
    }
  } catch (_) { renderAccount(null); }
}
window.addEventListener('load', restoreSession);

const notificationOverlay=document.getElementById('notificationOverlay');
function openNotifications(){notificationOverlay.classList.add('open');notificationOverlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';accountMenu.classList.remove('open');loadNotifications();}
function closeNotifications(){if(!notificationOverlay.classList.contains('open'))return;notificationOverlay.classList.remove('open');notificationOverlay.setAttribute('aria-hidden','true');document.body.style.overflow='';}
document.getElementById('notificationBtn').addEventListener('click',event=>{event.stopPropagation();if(notificationOverlay.classList.contains('open'))closeNotifications();else openNotifications();});
document.getElementById('notificationClose').addEventListener('click',closeNotifications);
notificationOverlay.addEventListener('click',event=>{if(event.target===notificationOverlay)closeNotifications()});
function notificationAge(value){const seconds=Math.max(0,(Date.now()-new Date(value).getTime())/1000);if(seconds<60)return 'Just now';if(seconds<3600)return `${Math.floor(seconds/60)} min ago`;if(seconds<86400)return `${Math.floor(seconds/3600)} hr ago`;return new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short'});}
function renderNotifications(items){const list=document.getElementById('notificationList');const unread=items.filter(item=>!item.is_read).length;const button=document.getElementById('notificationBtn');button.classList.toggle('has-unread',unread>0);document.getElementById('notificationCount').textContent=unread>9?'9+':unread;document.getElementById('markNotificationsRead').classList.toggle('hidden',unread===0);const icons={booking:'package-plus',accepted:'user-check',pickup:'package-check',in_transit:'navigation',delivered:'circle-check',rejected:'refresh-cw'};list.innerHTML=items.length?items.map(item=>`<article class="notification-item ${item.is_read?'':'unread'}"><span><i data-lucide="${icons[item.kind]||'bell'}"></i></span><div><b>${safe(item.title)}</b><p>${safe(item.message)}</p><small>${notificationAge(item.created_at)}</small></div></article>`).join(''):'<div class="notification-empty"><i data-lucide="bell-ring"></i><b>No notifications</b><span>Booking and delivery updates will appear here.</span></div>';if(window.lucide)lucide.createIcons();}
async function loadNotifications(){if(!currentUser){renderNotifications([]);return;}try{const response=await fetch('/api/notifications');if(response.ok)renderNotifications(await response.json());}catch(_){/* keep current panel */}}
document.getElementById('markNotificationsRead').addEventListener('click',async()=>{const action=document.getElementById('markNotificationsRead');action.disabled=true;action.textContent='Updating…';const response=await fetch('/api/notifications/read',{method:'PATCH'});if(response.ok){await loadNotifications();setTimeout(closeNotifications,300);showSuccess('Notifications updated','All account notifications are marked as read.');}action.disabled=false;action.textContent='Mark all read';});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeNotifications()});
window.addEventListener('load',()=>{
  const params=new URLSearchParams(window.location.search);
  if(params.get('auth_error')){openAuth();document.getElementById('loginError').textContent='Google sign-in could not be completed. Check the server OAuth configuration and try again.';}
  if(params.has('auth')||params.has('auth_error')) history.replaceState({},'',window.location.pathname);
});

async function loadWallet() {
  if (!currentUser) { openAuth(); return; }
  try {
    const response=await fetch('/api/wallet'); if(!response.ok)return; const wallet=await response.json();
    document.getElementById('walletBalance').textContent=`₹${Number(wallet.balance).toFixed(2)}`;
    document.getElementById('totalSpend').textContent=`₹${Number(wallet.total_spend).toFixed(0)}`;
    document.getElementById('completedCount').textContent=wallet.completed;
    if(wallet.upi_id){savedUpi={id:wallet.upi_id,provider:wallet.upi_provider||'UPI'};document.getElementById('upiMethodStatus').textContent=`${savedUpi.provider} · ${wallet.upi_id}`;document.getElementById('paymentUpiLabel').textContent=`${savedUpi.provider} · ${wallet.upi_id}`;document.getElementById('upiId').value=wallet.upi_id;}
    document.getElementById('cashDefault').checked=wallet.cash_preferred;
    if(wallet.cash_preferred){document.getElementById('cashMethodStatus').textContent='Saved as preferred payment method';document.getElementById('cashMethodBadge').innerHTML='<i data-lucide="circle-check"></i> Saved';document.querySelector('input[name="payment"][value="Cash"]').checked=true;if(window.lucide)lucide.createIcons();}else{document.getElementById('cashMethodStatus').textContent='Pay the driver after delivery';document.getElementById('cashMethodBadge').innerHTML='Details <i data-lucide="chevron-right"></i>';}
  } catch(_){/* retain zero-value safe state */}
}
document.getElementById('walletAddCard').addEventListener('click',openCardSheet);
document.getElementById('addMoneyBtn').addEventListener('click',openCardSheet);

const methodOverlay=document.getElementById('methodOverlay');
let savedUpi=null;
let selectedUpiProvider='';
const upiProviderConfig={
  'Google Pay':{logo:'https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg',label:'Google Pay UPI ID',help:'Find this under Google Pay → Bank account → Manage UPI IDs.',extraLabel:'Google Pay registered mobile number',extraType:'tel',extraIcon:'smartphone'},
  'PhonePe':{logo:'https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg',label:'PhonePe UPI ID',help:'Use the active UPI ID displayed in your PhonePe profile.',extraLabel:'PhonePe registered mobile number',extraType:'tel',extraIcon:'phone'},
  'Paytm':{logo:'https://upload.wikimedia.org/wikipedia/commons/4/42/Paytm_logo.png',label:'Paytm UPI ID',help:'Use the active UPI ID shown under your Paytm UPI settings.',extraLabel:'Paytm registered mobile or email',extraType:'text',extraIcon:'user-round'},
  'BHIM':{logo:'https://upload.wikimedia.org/wikipedia/commons/9/90/Bhim-logo.png',label:'BHIM virtual payment address',help:'Use the VPA connected to your selected BHIM bank account.',extraLabel:'Bank-linked mobile number',extraType:'tel',extraIcon:'landmark'},
  'Other UPI':{logo:'',label:'Bank UPI ID / VPA',help:'Enter the VPA issued by your bank or another UPI application.',extraLabel:'Bank or UPI application name',extraType:'text',extraIcon:'building-2'}
};
document.querySelectorAll('[data-upi-app]').forEach(button=>{const config=upiProviderConfig[button.dataset.upiApp];const badge=button.querySelector('b');if(config?.logo)badge.innerHTML=`<img src="${config.logo}" alt="${button.dataset.upiApp}">`;});
document.querySelector('#upiForm label')?.insertAdjacentHTML('beforeend','<small class="upi-provider-help" id="upiProviderHelp">Choose a payment application above to see the required details.</small>');
document.getElementById('upiForm')?.insertAdjacentHTML('afterbegin','<label class="upi-extra-field" id="upiExtraField"><span id="upiExtraLabel">Provider account detail</span><div class="payment-field"><i id="upiExtraIcon" data-lucide="smartphone"></i><input id="upiExtraValue" autocomplete="off"></div></label>');
function openMethodScreen(name){if(!currentUser){openAuth();return;}methodOverlay.classList.add('open');methodOverlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';document.querySelectorAll('.method-screen').forEach(screen=>screen.classList.toggle('active',screen.id===`${name}Screen`));if(window.lucide)lucide.createIcons();}
function closeMethodScreen(){methodOverlay.classList.remove('open');methodOverlay.setAttribute('aria-hidden','true');document.body.style.overflow='';}
document.getElementById('upiMethod').addEventListener('click',()=>openMethodScreen('upi'));
document.getElementById('cashMethod').addEventListener('click',()=>openMethodScreen('cash'));
['upiMethod','cashMethod'].forEach(id=>document.getElementById(id).addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')openMethodScreen(id==='upiMethod'?'upi':'cash')}));
document.getElementById('methodClose').addEventListener('click',closeMethodScreen);methodOverlay.addEventListener('click',event=>{if(event.target===methodOverlay)closeMethodScreen()});
document.querySelectorAll('[data-upi-app]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-upi-app]').forEach(item=>item.classList.remove('active'));button.classList.add('active');selectedUpiProvider=button.dataset.upiApp;const config=upiProviderConfig[selectedUpiProvider];document.getElementById('selectedUpiName').textContent=config.label;document.getElementById('selectedUpiMark').innerHTML=config.logo?`<img src="${config.logo}" alt="${selectedUpiProvider}">`:'UPI';document.getElementById('upiSetupTitle').textContent=`Connect ${selectedUpiProvider}`;document.getElementById('upiId').value='';document.getElementById('upiId').placeholder='';document.getElementById('upiProviderHelp').textContent=config.help;document.getElementById('upiExtraLabel').textContent=config.extraLabel;const extra=document.getElementById('upiExtraValue');extra.value='';extra.type=config.extraType;extra.inputMode=config.extraType==='tel'?'numeric':'text';document.getElementById('upiExtraIcon').setAttribute('data-lucide',config.extraIcon);document.getElementById('upiError').textContent='';if(window.lucide)lucide.createIcons();extra.focus();}));
document.getElementById('upiForm').addEventListener('submit',async event=>{event.preventDefault();const upi=document.getElementById('upiId').value.trim().toLowerCase();const extra=document.getElementById('upiExtraValue').value.trim();const error=document.getElementById('upiError');if(!selectedUpiProvider){error.textContent='Select the UPI application you use.';return;}if(!extra){error.textContent=`Enter your ${upiProviderConfig[selectedUpiProvider].extraLabel.toLowerCase()}.`;return;}if(['Google Pay','PhonePe','BHIM'].includes(selectedUpiProvider)&&!/^[+]?[0-9 ]{10,14}$/.test(extra)){error.textContent='Enter a valid registered mobile number.';return;}if(!/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/i.test(upi)){error.textContent=`Enter a valid ${upiProviderConfig[selectedUpiProvider].label}.`;return;}const response=await fetch('/api/payment-preferences',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({upi_id:upi,upi_provider:selectedUpiProvider})});if(!response.ok){error.textContent='Unable to save this UPI ID.';return;}error.textContent='';savedUpi={id:upi,provider:selectedUpiProvider};document.getElementById('upiMethodStatus').textContent=`${selectedUpiProvider} · ${upi}`;document.getElementById('paymentUpiLabel').textContent=`${selectedUpiProvider} · ${upi}`;document.getElementById('successUpiProvider').textContent=selectedUpiProvider;document.getElementById('successUpiId').textContent=upi;document.getElementById('successUpiMark').innerHTML=document.getElementById('selectedUpiMark').innerHTML;document.querySelectorAll('.method-screen').forEach(screen=>screen.classList.toggle('active',screen.id==='upiSuccessScreen'));if(window.lucide)lucide.createIcons();});
document.getElementById('upiSuccessDone').addEventListener('click',()=>{closeMethodScreen();showNotice('UPI payment method saved and ready for booking.');});
document.getElementById('saveCashPreference').addEventListener('click',async()=>{const preferred=true;document.getElementById('cashDefault').checked=true;const response=await fetch('/api/payment-preferences',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({cash_preferred:preferred})});if(response.ok){document.getElementById('cashMethodStatus').textContent='Saved as preferred payment method';document.getElementById('cashMethodBadge').innerHTML='<i data-lucide="circle-check"></i> Saved';document.querySelector('input[name="payment"][value="Cash"]').checked=true;closeMethodScreen();if(window.lucide)lucide.createIcons();showSuccess('Cash on Delivery saved','Cash will be selected automatically for your next booking.');}});

// Card details are validated in-browser and never persisted or sent to Haulr.
const paymentOverlay = document.getElementById('paymentOverlay');
const cardForm = document.getElementById('cardForm');
let savedCard = null;

function openCardSheet() {
  paymentOverlay.classList.add('open');
  paymentOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('cardName').focus(), 250);
}

function closeCardSheet() {
  paymentOverlay.classList.remove('open');
  paymentOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document.querySelectorAll('input[name="payment"]').forEach(input => input.addEventListener('change', () => {
  if (input.value === 'Card' && input.checked) openCardSheet();
}));
document.getElementById('paymentClose').addEventListener('click', closeCardSheet);
paymentOverlay.addEventListener('click', event => { if (event.target === paymentOverlay) closeCardSheet(); });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (paymentOverlay.classList.contains('open')) closeCardSheet();
  if (otherOverlay.classList.contains('open')) closeOtherLoadSheet();
});
// Each entry ends with the issuer's brand colour, used for the monogram mark that
// replaces the icon whenever the bank's own logo cannot be fetched.
const indianBanks = [
  ['SBI','State Bank of India','sbi.co.in','ATM / Debit','#22409A'], ['HDFC','HDFC Bank','hdfcbank.com','Debit / Credit','#004C8F'],
  ['ICICI','ICICI Bank','icicibank.com','Debit / Credit','#AE275F'], ['Axis','Axis Bank','axisbank.com','Debit / Credit','#97144D'],
  ['Kotak','Kotak Mahindra Bank','kotak.com','Debit / Credit','#003874'], ['PNB','Punjab National Bank','pnbindia.in','ATM / Debit','#A6192E'],
  ['Canara','Canara Bank','canarabank.com','ATM / Debit','#00539F'],
  ['Union','Union Bank of India','unionbankofindia.co.in','ATM / Debit','#C8102E'], ['Indian Bank','Indian Bank','indianbank.in','ATM / Debit','#1B3A93'],
  ['BoI','Bank of India','bankofindia.co.in','ATM / Debit','#164194'], ['IndusInd','IndusInd Bank','indusind.com','Debit / Credit','#7D2248'],
  ['Other bank','Other Indian bank','rbi.org.in','Any bank card','#125F46']
];
let selectedBank = 'SBI';
let banksExpanded = false;

function bankMonogram(value) {
  const words = value.replace(/&/g, ' ').split(/\s+/).filter(Boolean);
  if (/^[A-Z]{2,}$/.test(words[0])) return words[0].slice(0, 5);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map(word => word[0]).join('').slice(0, 2).toUpperCase();
}

// Brand-coloured mark drawn locally, so a tile never falls back to a generic grey globe.
function bankMonogramIcon(value, color) {
  const mark = value === 'Other bank'
    ? '<path d="M32 13 13 23h38zM12 50h40M19 27v19M32 27v19M45 27v19" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    : `<text x="32" y="40" text-anchor="middle" fill="#fff" font-family="Manrope,Segoe UI,Arial,sans-serif" font-size="${[26,26,26,20,16,13][bankMonogram(value).length]}" font-weight="800" letter-spacing="0.5">${bankMonogram(value)}</text>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/>${mark}</svg>`)}`;
}

// Official mark first, the issuer's own favicon next, brand monogram last.
function bankIconChain(domain) {
  return [`https://icons.duckduckgo.com/ip3/${domain}.ico`, `https://${domain}/favicon.ico`];
}

// The icon service answers "no logo" with a 48x48 placeholder image rather than an
// HTTP failure, so a decoded 48x48 result from that first source counts as a miss too.
function bankIconMissed(image) {
  return Number(image.dataset.bankStep || 0) === 0 && image.naturalWidth === 48 && image.naturalHeight === 48;
}

function attachBankIconFallbacks(root) {
  root.querySelectorAll('img[data-bank-fallback]').forEach(image => {
    const advance = () => {
      const chain = JSON.parse(image.dataset.bankChain || '[]');
      const step = Number(image.dataset.bankStep || 0) + 1;
      image.dataset.bankStep = step;
      image.src = chain[step] || image.dataset.bankFallback;
    };
    image.addEventListener('error', advance);
    image.addEventListener('load', () => { if (bankIconMissed(image)) advance(); });
    if (image.complete && image.naturalWidth && bankIconMissed(image)) advance();
  });
}

function renderBanks(query = '') {
  const options = document.getElementById('bankCardOptions');
  const matches = indianBanks.filter(bank => `${bank[0]} ${bank[1]}`.toLowerCase().includes(query.toLowerCase()));
  const visible = banksExpanded ? matches : indianBanks.slice(0, 4);
  options.innerHTML = visible.length ? visible.map(([value,name,domain,type,color]) => {
    const fallback = bankMonogramIcon(value, color);
    const chain = value === 'Other bank' ? [] : bankIconChain(domain);
    return `<label title="${name}"><input type="radio" name="bankIssuer" value="${value}" ${value === selectedBank ? 'checked' : ''}><span><img src="${chain[0] || fallback}" alt="${name}" loading="lazy" style="--bank-brand:${color}" data-bank-step="0" data-bank-chain='${JSON.stringify(chain)}' data-bank-fallback="${fallback}"><b>${value}</b><small>${type}</small><i data-lucide="check"></i></span></label>`;
  }).join('') : '<div class="no-bank-result">No matching bank found</div>';
  attachBankIconFallbacks(options);
  document.getElementById('bankCount').textContent = banksExpanded ? `${matches.length} banks` : '';
  if (window.lucide) lucide.createIcons();
}

document.getElementById('toggleBanks').addEventListener('click', event => {
  banksExpanded = !banksExpanded;
  document.getElementById('bankCardOptions').classList.toggle('expanded', banksExpanded);
  document.getElementById('bankSearchWrap').classList.toggle('show', banksExpanded);
  event.currentTarget.textContent = banksExpanded ? 'Show less' : 'View all';
  renderBanks(document.getElementById('bankSearch').value);
});
document.getElementById('bankSearch').addEventListener('input', event => renderBanks(event.target.value));
document.getElementById('bankCardOptions').addEventListener('change', event => {
  if (event.target.name !== 'bankIssuer') return;
  const issuer = event.target.value;
  selectedBank = issuer;
  document.getElementById('virtualBank').textContent = issuer === 'Other bank' ? 'BANK CARD' : issuer;
  const virtualCard = document.getElementById('virtualCard');
  virtualCard.className = 'virtual-card';
  const theme = {HDFC:'bank-hdfc', ICICI:'bank-icici', Axis:'bank-axis', Kotak:'bank-kotak'}[issuer];
  if (theme) virtualCard.classList.add(theme);
});
renderBanks();

const cardNumber = document.getElementById('cardNumber');
const cardExpiry = document.getElementById('cardExpiry');
const cardName = document.getElementById('cardName');
const cardCvv = document.getElementById('cardCvv');

cardNumber.addEventListener('input', event => {
  const digits = event.target.value.replace(/\D/g, '').slice(0, 16);
  event.target.value = digits.replace(/(.{4})/g, '$1 ').trim();
  document.getElementById('cardPreview').textContent = (digits.padEnd(16, '•').match(/.{1,4}/g) || []).join('  ');
  const brand = digits.startsWith('4') ? 'VISA' : /^5[1-5]/.test(digits) ? 'MASTERCARD' : /^3[47]/.test(digits) ? 'AMEX' : /^6/.test(digits) ? 'RUPAY' : 'CARD';
  document.getElementById('cardBrand').textContent = brand;
  const brandAssets = {
    VISA: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Visa_2021.svg',
    MASTERCARD: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Mastercard-logo.svg',
    RUPAY: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/RuPay.svg',
    AMEX: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/American_Express_logo_(2018).svg'
  };
  const networkLogo = document.getElementById('virtualNetwork');
  networkLogo.classList.toggle('show', brand !== 'CARD');
  if (brandAssets[brand]) { networkLogo.src = brandAssets[brand]; networkLogo.alt = brand; }
  const brandRow = document.querySelector('.accepted-cards');
  brandRow.classList.toggle('has-detected', brand !== 'CARD');
  brandRow.querySelectorAll('[data-brand-logo]').forEach(logo => logo.classList.toggle('detected', logo.dataset.brandLogo === brand));
});
cardName.addEventListener('input', event => { document.getElementById('namePreview').textContent = event.target.value.toUpperCase() || 'CARDHOLDER NAME'; });
cardExpiry.addEventListener('input', event => {
  let digits = event.target.value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 2) digits = `${digits.slice(0,2)}/${digits.slice(2)}`;
  event.target.value = digits;
  document.getElementById('expiryPreview').textContent = digits || 'MM/YY';
});
cardCvv.addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g, '').slice(0,4); });

function passesLuhn(value) {
  const digits = value.replace(/\D/g, '').split('').reverse().map(Number);
  return digits.length >= 13 && digits.reduce((sum, digit, index) => {
    if (index % 2) { digit *= 2; if (digit > 9) digit -= 9; }
    return sum + digit;
  }, 0) % 10 === 0;
}

cardForm.addEventListener('submit', event => {
  event.preventDefault();
  const error = document.getElementById('cardError');
  const [month, year] = cardExpiry.value.split('/').map(Number);
  const today = new Date();
  const validExpiry = month >= 1 && month <= 12 && year && (2000 + year > today.getFullYear() || (2000 + year === today.getFullYear() && month >= today.getMonth() + 1));
  if (cardName.value.trim().length < 3) error.textContent = 'Enter the name printed on your card.';
  else if (!passesLuhn(cardNumber.value)) error.textContent = 'Enter a valid debit or credit card number.';
  else if (!validExpiry) error.textContent = 'Enter a valid future expiry date.';
  else if (!/^\d{3,4}$/.test(cardCvv.value)) error.textContent = 'Enter the 3 or 4 digit security code.';
  else {
    const digits = cardNumber.value.replace(/\D/g, '');
    savedCard = { last4: digits.slice(-4), type: document.querySelector('input[name="cardType"]:checked').value, issuer: selectedBank };
    error.textContent = '';
    const cardPaymentLabel = document.querySelector('input[name="payment"][value="Card"] + span');
    cardPaymentLabel.innerHTML = `${savedCard.issuer} •••• ${savedCard.last4}`;
    document.getElementById('savedCardTitle').textContent = `${savedCard.issuer} ${savedCard.type} •••• ${savedCard.last4}`;
    document.getElementById('savedCardMethod').classList.remove('hidden');
    closeCardSheet();
    cardForm.reset();
    document.getElementById('cardPreview').textContent = '••••  ••••  ••••  ••••';
    document.getElementById('cardBrand').textContent = 'CARD';
    document.getElementById('virtualNetwork').classList.remove('show');
    document.querySelector('.accepted-cards').classList.remove('has-detected');
    document.querySelectorAll('[data-brand-logo]').forEach(logo => logo.classList.remove('detected'));
  }
});

// Leaflet needs a size refresh after a hidden view becomes visible.
navLinks.forEach(link => link.addEventListener('click', () => {
  setTimeout(() => {
    if (bookingMap) bookingMap.invalidateSize();
    if (liveMap) liveMap.invalidateSize();
  }, 120);
}));

// Scroll drives the status dial, so the rings track the page as it moves.
const jarvisCore = document.getElementById('jarvisCore');
if (jarvisCore && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const appMain = document.querySelector('.app-main');
  let jarvisQueued = false;
  const spinFromScroll = () => {
    if (jarvisQueued) return;
    jarvisQueued = true;
    requestAnimationFrame(() => {
      const offset = (appMain && appMain.scrollTop) || window.scrollY || 0;
      jarvisCore.style.setProperty('--jarvis-spin', `${(offset * 0.16).toFixed(1)}deg`);
      jarvisQueued = false;
    });
  };
  window.addEventListener('scroll', spinFromScroll, {passive: true});
  appMain?.addEventListener('scroll', spinFromScroll, {passive: true});
}

// Desktop: settings pages are opened straight from the side menu.
document.querySelectorAll('[data-settings-open]').forEach(button => button.addEventListener('click', () => {
  const page = button.dataset.settingsOpen;
  showView('settings');
  activateSettingsPage(page);
  document.querySelectorAll('.customer-nav button').forEach(item => item.classList.toggle('active', item === button));
  settingsApp?.classList.add('detail-open');
  if (window.lucide) lucide.createIcons();
}));

// Saved places: pickup and drop addresses recovered from the account's booking history.
function placeAge(value) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (Number.isNaN(days)) return '';
  if (days <= 0) return 'Used today';
  if (days === 1) return 'Used yesterday';
  if (days < 30) return `Used ${days} days ago`;
  return `Last used ${new Date(value).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}`;
}

function applySavedPlace(place, kind, allPlaces = []) {
  bookingFlowSource = 'saved-places';
  const otherKind = kind === 'pickup' ? 'drop' : 'pickup';
  const companion = allPlaces.find(item => item.label !== place.label && item.kinds.includes(otherKind));
  const setPlace = (targetKind, targetPlace) => {
    if (!targetPlace) return;
    const point = [Number(targetPlace.lat), Number(targetPlace.lng)];
    const usable = Number.isFinite(point[0]) && Number.isFinite(point[1]) && (point[0] !== 0 || point[1] !== 0);
    document.getElementById(targetKind).value = targetPlace.label;
    if (!usable) return;
    if (targetKind === 'pickup') { pickupPoint = point; pickupMarker?.setLatLng(point); }
    else { dropPoint = point; dropMarker?.setLatLng(point); }
  };
  setPlace(kind, place);
  if (!document.getElementById(otherKind).value.trim() && companion) setPlace(otherKind, companion);
  const pickup = document.getElementById('pickup').value.trim();
  const drop = document.getElementById('drop').value.trim();
  const notice = document.getElementById('savedRouteNotice');
  notice.querySelector('[data-saved-pickup]').textContent = pickup || 'Choose pickup';
  notice.querySelector('[data-saved-drop]').textContent = drop || 'Choose drop';
  notice.classList.toggle('hidden', !(pickup && drop));
  showView('booking');
  setStep(pickup && drop ? 2 : 1);
  setBookingBackLabel();
  setTimeout(() => {
    bookingMap?.invalidateSize();
    if (pickup && drop) bookingMap?.fitBounds([pickupPoint, dropPoint], {padding: [35, 35],maxZoom:13});
    updateRealRoute();
  }, 240);
  showSuccess('Saved route ready', pickup && drop ? 'Pickup and drop were added. Continue with load details.' : 'Saved place added. Choose the other location to continue.');
}

async function loadSavedPlaces() {
  const list = document.getElementById('placesList');
  if (!list) return;
  if (!currentUser) { openAuth(); return; }
  list.innerHTML = '<p class="places-loading">Loading your addresses…</p>';
  let places = [];
  try {
    const response = await fetch('/api/saved-places');
    if (response.ok) places = await response.json();
  } catch (_) { /* fall through to the empty state */ }
  if (!places.length) {
    list.innerHTML = '<div class="places-empty"><span><i data-lucide="map-pinned"></i></span><h2>No saved places yet</h2><p>Every pickup and drop address you book is remembered here automatically.</p></div>';
    if (window.lucide) lucide.createIcons();
    return;
  }
  list.innerHTML = places.map((place, index) => {
    const located = Number(place.lat) || Number(place.lng);
    return `<article class="place-card">
      <span class="place-mark"><i data-lucide="${place.kinds.includes('pickup') ? 'circle-dot' : 'map-pin'}"></i></span>
      <div class="place-body">
        <b>${safe(place.label)}</b>
        <small>${place.uses} ${place.uses === 1 ? 'delivery' : 'deliveries'} · ${safe(placeAge(place.last_used))}</small>
        <em>${located ? `${Number(place.lat).toFixed(4)}, ${Number(place.lng).toFixed(4)}` : 'Coordinates not stored — address only'}</em>
      </div>
      <div class="place-actions">
        <button data-place="${index}" data-kind="${place.kinds.includes('pickup') ? 'pickup' : 'drop'}"><i data-lucide="arrow-right"></i> Continue booking</button>
      </div>
    </article>`;
  }).join('');
  list.querySelectorAll('[data-place]').forEach(button => button.addEventListener('click', () =>
    applySavedPlace(places[Number(button.dataset.place)], button.dataset.kind, places)));
  if (window.lucide) lucide.createIcons();
  initializeMotionEffects(list);
}

// Google Identity Services: signs in with an ID token, so no redirect URI is involved.
async function handleGoogleCredential(response) {
  const error = document.getElementById('loginError');
  error.className = 'auth-error';
  error.textContent = '';
  try {
    const result = await fetch('/api/auth/google/token', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({credential: response.credential})
    });
    const data = await result.json();
    if (!result.ok) { error.textContent = data.error || 'Google sign-in failed.'; return; }
    renderAccount(data);
    closeAuth();
    loadLatestBooking();
    showSuccess('Signed in', `Welcome back, ${data.name.split(' ')[0]}.`);
  } catch (_) {
    error.textContent = 'Google sign-in could not reach the server.';
  }
}

let googleButtonRendered = false;
async function initGoogleIdentity() {
  const host = document.getElementById('googleButtonHost');
  if (!host || googleButtonRendered) return;
  // Use the server OAuth flow for every production login.  Google Identity's
  // embedded token callback can be blocked by browser privacy settings and
  // produces a misleading “could not reach the server” message after account
  // selection.  The regular button below sends users to /api/auth/google/start,
  // where the verified Vercel callback finishes the login securely.
  document.getElementById('googleAuthBtn')?.classList.remove('hidden');
  host.replaceChildren();
  googleButtonRendered = true;
  return;
  let config;
  try {
    const response = await fetch('/api/auth/google/status');
    config = await response.json();
  } catch (_) { config = null; }
  const showFallback = () => document.getElementById('googleAuthBtn')?.classList.remove('hidden');
  if (!config?.configured || !config.client_id) { showFallback(); return; }
  for (let attempt = 0; attempt < 50 && !window.google?.accounts?.id; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!window.google?.accounts?.id) { showFallback(); return; }
  try {
    google.accounts.id.initialize({client_id: config.client_id, callback: handleGoogleCredential, locale: 'en'});
    google.accounts.id.renderButton(host, {theme: 'outline', size: 'large', text: 'continue_with', width: 330, locale: 'en'});
  } catch (_) { showFallback(); return; }
  // Only trust the in-page button once it has actually painted.
  setTimeout(() => {
    googleButtonRendered = host.childElementCount > 0;
    if (!googleButtonRendered) showFallback();
  }, 800);
}
// Rendered when the sheet opens, so the container has real dimensions.
window.addEventListener('load', initGoogleIdentity);
