(function(){
  const BLUE = '#1B4DB5';
  const RED = '#C41E3A';
  const DARK = '#0A1428';

  // Inject CSS
  const style = document.createElement('style');
  style.textContent = `
    .cw-btn { position:fixed; bottom:28px; right:28px; z-index:900; width:60px; height:60px; border-radius:50%; background:${BLUE}; border:none; cursor:pointer; box-shadow:0 4px 20px rgba(0,0,0,.3); display:flex; align-items:center; justify-content:center; transition:transform .2s,background .2s; }
    .cw-btn:hover { transform:scale(1.1); background:${DARK}; }
    .cw-btn svg { width:28px; height:28px; fill:#fff; }
    .cw-btn.has-dot::after { content:''; position:absolute; top:4px; right:4px; width:12px; height:12px; background:${RED}; border-radius:50%; border:2px solid #fff; }

    .cw-panel { position:fixed; bottom:100px; right:28px; z-index:901; width:380px; max-width:calc(100vw - 56px); height:520px; max-height:calc(100vh - 140px); background:#fff; border-radius:12px; box-shadow:0 12px 48px rgba(0,0,0,.2); display:none; flex-direction:column; overflow:hidden; }
    .cw-panel.open { display:flex; }

    @media (max-width:480px) {
      .cw-btn { bottom:16px; right:16px; width:52px; height:52px; }
      .cw-btn svg { width:24px; height:24px; }
      .cw-panel { bottom:0; right:0; left:0; width:100%; max-width:100%; height:100vh; max-height:100vh; border-radius:0; }
      .cw-header { padding:14px 16px; }
      .cw-messages { padding:12px; }
      .cw-msg { font-size:14px; }
      .cw-input-area { padding:10px; }
      .cw-input { font-size:16px; }
      .cw-quick { padding:0 12px 10px; }
      .cw-wa { margin:6px 12px; }
    }
    @media (max-width:768px) and (min-width:481px) {
      .cw-btn { bottom:20px; right:20px; }
      .cw-panel { bottom:84px; right:16px; width:340px; max-width:calc(100vw - 32px); height:480px; max-height:calc(100vh - 100px); }
    }

    .cw-header { background:${BLUE}; padding:16px 20px; display:flex; align-items:center; justify-content:space-between; }
    .cw-header-title { color:#fff; font-family:'Montserrat',sans-serif; font-size:14px; font-weight:700; }
    .cw-header-sub { color:rgba(255,255,255,.6); font-size:10px; }
    .cw-close { background:none; border:none; color:rgba(255,255,255,.6); font-size:22px; cursor:pointer; }
    .cw-close:hover { color:#fff; }

    .cw-messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; }
    .cw-msg { max-width:85%; padding:10px 14px; font-size:13px; line-height:1.5; font-family:'Inter',sans-serif; border-radius:12px; }
    .cw-msg-bot { background:#f0f2f5; color:#1a1a2e; align-self:flex-start; border-bottom-left-radius:4px; }
    .cw-msg-user { background:${BLUE}; color:#fff; align-self:flex-end; border-bottom-right-radius:4px; }
    .cw-msg-bot a { color:${BLUE}; font-weight:600; }
    .cw-typing { align-self:flex-start; padding:10px 14px; background:#f0f2f5; border-radius:12px; font-size:13px; color:#999; display:none; }
    .cw-typing.show { display:block; }

    .cw-input-area { border-top:1px solid #eee; padding:12px; display:flex; gap:8px; }
    .cw-input { flex:1; border:1px solid #ddd; border-radius:8px; padding:10px 14px; font-size:13px; font-family:'Inter',sans-serif; outline:none; resize:none; }
    .cw-input:focus { border-color:${BLUE}; }
    .cw-send { background:${BLUE}; border:none; border-radius:8px; width:40px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .cw-send:hover { background:${DARK}; }
    .cw-send svg { width:18px; height:18px; fill:#fff; }
    .cw-send:disabled { opacity:.4; cursor:not-allowed; }

    .cw-quick { display:flex; flex-wrap:wrap; gap:6px; padding:0 16px 12px; }
    .cw-quick-btn { padding:6px 12px; border:1px solid #ddd; border-radius:16px; background:#fff; font-size:11px; color:#666; cursor:pointer; font-family:'Inter',sans-serif; transition:all .15s; }
    .cw-quick-btn:hover { border-color:${BLUE}; color:${BLUE}; }

    .cw-wa { display:block; margin:8px 16px; padding:10px; background:#25D366; color:#fff; text-align:center; border-radius:8px; font-size:12px; font-weight:600; text-decoration:none; font-family:'Inter',sans-serif; }
    .cw-wa:hover { background:#1da851; }
  `;
  document.head.appendChild(style);

  // Create widget HTML
  const btn = document.createElement('button');
  btn.className = 'cw-btn has-dot';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
  btn.onclick = toggleChat;
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.className = 'cw-panel';
  panel.innerHTML = `
    <div class="cw-header">
      <div><div class="cw-header-title">akrobacja.com</div><div class="cw-header-sub">Asystent · zwykle odpowiada natychmiast</div></div>
      <button class="cw-close" onclick="document.querySelector('.cw-panel').classList.remove('open');document.querySelector('.cw-btn').classList.remove('has-dot')">&times;</button>
    </div>
    <div class="cw-messages" id="cwMessages">
      <div class="cw-msg cw-msg-bot">Cześć! Jestem asystentem akrobacja.com. Pytaj o loty, pokazy, sponsoring — albo pomogę wybrać pakiet.</div>
    </div>
    <div class="cw-quick" id="cwQuick">
      <button class="cw-quick-btn" onclick="cwSendQuick('Ile kosztuje lot akrobacyjny?')">Ile kosztuje lot?</button>
      <button class="cw-quick-btn" onclick="cwSendQuick('Jak wygląda lot?')">Jak wygląda lot?</button>
      <button class="cw-quick-btn" onclick="cwSendQuick('Chcę kupić voucher na prezent')">Voucher na prezent</button>
      <button class="cw-quick-btn" onclick="cwSendQuick('Interesują mnie pokazy lotnicze na event')">Pokazy na event</button>
    </div>
    <a class="cw-wa" href="https://wa.me/48535535221" target="_blank">💬 Napisz na WhatsApp</a>
    <div class="cw-input-area">
      <input class="cw-input" id="cwInput" placeholder="Napisz wiadomość..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();cwSend()}">
      <button class="cw-send" id="cwSendBtn" onclick="cwSend()"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
    </div>
  `;
  document.body.appendChild(panel);

  let history = [];

  function toggleChat() {
    panel.classList.toggle('open');
    btn.classList.remove('has-dot');
    if (panel.classList.contains('open')) {
      document.getElementById('cwInput').focus();
    }
  }

  window.cwSendQuick = function(text) {
    document.getElementById('cwQuick').style.display = 'none';
    sendMessage(text);
  };

  window.cwSend = function() {
    const input = document.getElementById('cwInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    document.getElementById('cwQuick').style.display = 'none';
    sendMessage(text);
  };

  async function sendMessage(text) {
    const msgs = document.getElementById('cwMessages');

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'cw-msg cw-msg-user';
    userMsg.textContent = text;
    msgs.appendChild(userMsg);

    // Add typing indicator
    const typing = document.createElement('div');
    typing.className = 'cw-typing show';
    typing.textContent = 'Pisze...';
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;

    // Send to API
    const sendBtn = document.getElementById('cwSendBtn');
    sendBtn.disabled = true;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history,
        }),
      });
      const data = await res.json();

      // Update history
      history.push({ role: 'user', content: text });
      history.push({ role: 'model', content: data.reply || data.error });

      // Keep last 10 exchanges
      if (history.length > 20) history = history.slice(-20);

      // Remove typing, add reply
      typing.remove();
      const botMsg = document.createElement('div');
      botMsg.className = 'cw-msg cw-msg-bot';
      // Convert URLs and WhatsApp links
      let reply = (data.reply || data.error || 'Przepraszam, spróbuj ponownie.');
      reply = reply.replace(/https:\/\/wa\.me\/\d+/g, '<a href="$&" target="_blank">WhatsApp</a>');
      reply = reply.replace(/https:\/\/akrobacja\.top[^\s)"]*/g, '<a href="$&">$&</a>');
      botMsg.innerHTML = reply;
      msgs.appendChild(botMsg);
    } catch (err) {
      typing.remove();
      const errMsg = document.createElement('div');
      errMsg.className = 'cw-msg cw-msg-bot';
      errMsg.textContent = 'Przepraszam, mam problem z połączeniem. Napisz na WhatsApp: +48 535 535 221';
      msgs.appendChild(errMsg);
    }

    sendBtn.disabled = false;
    msgs.scrollTop = msgs.scrollHeight;
  }
})();
