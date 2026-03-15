const socket = io();
let currentPhone = '';
let linkCode = '';

document.addEventListener('DOMContentLoaded', () => {
  const linkBtn = document.getElementById('link-btn');
  const phoneInput = document.getElementById('phone');
  const codeDisplay = document.getElementById('code-display');
  const linkScreen = document.getElementById('link-screen');
  const chatScreen = document.getElementById('chat-screen');
  const refreshCode = document.getElementById('refresh-code');
  const status = document.getElementById('status');

  linkBtn.addEventListener('click', linkPhone);
  refreshCode.addEventListener('click', refreshLinkCode);
  phoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') linkPhone();
  });

  socket.on('new_message', (msg) => {
    addMessage(msg);
  });

  socket.on('status_' + currentPhone, (data) => {
    if (data.status === 'ready') {
      status.textContent = '✅ Connected!';
      setTimeout(() => {
        linkScreen.classList.remove('active');
        chatScreen.classList.add('active');
      }, 1500);
    }
  });
});

async function linkPhone() {
  const phone = document.getElementById('phone').value.replace(/\D/g, '');
  
  if (!phone || phone.length < 10) {
    alert('Enter valid phone number');
    return;
  }

  try {
    const response = await fetch('/api/link-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await response.json();
    
    currentPhone = phone;
    linkCode = data.code;
    
    document.getElementById('code-display').textContent = linkCode;
    document.getElementById('link-code').style.display = 'block';
    document.getElementById('link-btn').style.display = 'none';
    
    socket.emit('join_phone', phone);
  } catch (err) {
    alert('Link failed: ' + err.message);
  }
}

async function refreshLinkCode() {
  const response = await fetch(`/api/link-code/${currentPhone}`);
  const data = await response.json();
  linkCode = data.code;
  document.getElementById('code-display').textContent = linkCode;
                          }
