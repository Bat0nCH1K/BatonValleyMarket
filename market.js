// Wasteland Market Terminal — market.js v9 (фикс склада, целей, советника)
let currentScreen = 'items';
let marketTab = 'overview';

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('open');
}

function switchScreen(screen) {
    currentScreen = screen;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + screen);
    if (target) target.classList.add('active');
    if (screen === 'items') renderItems();
    if (screen === 'trades') renderTrades();
    if (screen === 'events') { if (typeof initCalendar === 'function') initCalendar(); if (typeof renderEvents === 'function') renderEvents(); }
    if (screen === 'storage') renderStorage();
    if (screen === 'goals') { if (typeof renderGoals === 'function') renderGoals(); }
    if (screen === 'market') renderMarket();
    if (screen === 'advisor') { if (typeof renderAdvisor === 'function') renderAdvisor(); }
}

function switchMarketTab(tab) {
    marketTab = tab;
    document.querySelectorAll('.market-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderMarket();
}

// === ПРЕДМЕТЫ ===
function addItemForm() {
    const name = document.getElementById('newItemName').value.trim();
    const type = document.getElementById('newItemType').value;
    const lotSize = parseInt(document.getElementById('newLotSize').value || '1') || 1;
    if (!name) return;
    addItem(name, type, lotSize);
    document.getElementById('newItemName').value = '';
    renderItems();
}

function selectItem(name) {
    selectedItem = name;
    const item = items.find(i => i.name === name);
    if (!item) return;
    const isPart = item.type === 'part';
    const now = new Date(); now.setHours(now.getHours() + 3);
    const timeStr = now.toISOString().slice(0, 16);
    const activeEvent = getActiveEvent();
    const eventOptions = [
        '<option value="">Без события</option>',
        '<option value="factory">🏭 Фабрика</option>',
        '<option value="rating_end">⚔️ Рейтинг</option>',
        '<option value="battlepass">🎫 БП</option>',
        '<option value="road">🛣️ Наследие</option>',
        '<option value="raven">🐦‍⬛ Ворон</option>',
        '<option value="workshop">🔧 Цех</option>',
        '<option value="bounty">🎯 Охота</option>'
    ];
    if (activeEvent) eventOptions.forEach((opt, i) => { if (opt.includes('value="' + activeEvent.type + '"')) eventOptions[i] = opt.replace('">', '" selected>'); });

    document.getElementById('screen-item-detail').classList.add('active');
    document.getElementById('screen-items').classList.remove('active');
    document.getElementById('detailTitle').textContent = (item.type==='resource'?'⛏️':'🔧') + ' ' + name + ' (лот: ' + item.lotSize + ' шт)';
    
    document.getElementById('detailContent').innerHTML = `
        <div class="price-panel">
            <input type="datetime-local" id="entryTime" value="${timeStr}">
            <div class="row">
                <input type="number" id="entryBuy" placeholder="Цена покупки (за лот)" step="0.01">
                <input type="number" id="entrySell" placeholder="Цена продажи (за лот)" step="0.01">
            </div>
            ${isPart ? `<div style="display:flex;gap:12px;font-size:0.8em;margin-bottom:6px;"><label><input type="checkbox" id="entryNerf"> 🔻 Нерф</label><label><input type="checkbox" id="entryBuff"> 🔺 Бафф</label></div>` : ''}
            <select id="entryEvent">${eventOptions.join('')}</select>
            ${activeEvent ? `<div style="font-size:0.7em;color:var(--accent);margin-top:4px;">📅 Сейчас: ${activeEvent.type}</div>` : ''}
            <div class="row" style="margin-top:8px;"><button class="accent" onclick="submitPriceEntry()">ЗАПИСАТЬ</button><button class="danger" onclick="deleteSelectedItem();switchScreen('items');">УДАЛИТЬ</button></div>
            <div id="itemGraph"></div>
        </div>`;
    renderItemGraph();
}

function submitPriceEntry() {
    const now = new Date(); now.setHours(now.getHours() + 3);
    const time = document.getElementById('entryTime').value || now.toISOString().slice(0, 16);
    const buy = parseFloat(document.getElementById('entryBuy').value);
    const sell = parseFloat(document.getElementById('entrySell').value);
    const event = document.getElementById('entryEvent').value;
    const nerf = document.getElementById('entryNerf')?.checked || false;
    const buff = document.getElementById('entryBuff')?.checked || false;
    if (isNaN(buy) || isNaN(sell)) { alert('Введи цены'); return; }
    addPriceEntry(time, buy, sell, event, nerf, buff);
    renderItems(); selectItem(selectedItem);
}

function renderItems() {
    const list = document.getElementById('itemsList');
    if (!list) return;
    if (items.length === 0) { list.innerHTML = '<p style="color:#888;">Нет предметов</p>'; return; }
    list.innerHTML = items.map(item => {
        const data = prices[item.name] || [];
        const last = data[data.length - 1];
        const lastBuy = last ? (last.buy / item.lotSize).toFixed(2) : '—';
        return `<div class="item-card" onclick="selectItem('${item.name}')"><div class="name">${item.type==='resource'?'⛏️':'🔧'} ${item.name} (×${item.lotSize})</div><div class="stats">${data.length} зап. | ${lastBuy} ₽/шт</div></div>`;
    }).join('');
    updateTradeSelect(); updateStorageSelect();
}

function renderItemGraph() {
    if (!selectedItem) return;
    const data = prices[selectedItem] || [];
    const item = items.find(i => i.name === selectedItem);
    const lotSize = item ? item.lotSize : 1;
    const container = document.getElementById('itemGraph');
    if (data.length < 3) { container.innerHTML = '<p style="color:#888;">📊 Нужно 3+ записи</p>'; return; }
    const pred = getPrediction(selectedItem);
    const buys = data.map(p => p.buy / lotSize);
    const maxVal = Math.max(...buys), minVal = Math.min(...buys), range = maxVal - minVal || 1;
    const W = 300, H = 120, pad = 30;
    let grid = '';
    for (let i = 0; i <= 4; i++) {
        const y = pad + (H - pad * 2) * i / 4;
        grid += `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="#1a2a2a" stroke-width="0.5"/>`;
        grid += `<text x="${pad - 4}" y="${y + 3}" fill="#555" font-size="8" text-anchor="end">${(maxVal - range * i / 4).toFixed(1)}</text>`;
    }
    let pts = '', dots = '';
    buys.forEach((b, i) => {
        const x = pad + (i / Math.max(buys.length - 1, 1)) * (W - pad * 2);
        const y = H - pad - ((b - minVal) / range) * (H - pad * 2);
        pts += `${x},${y} `;
        dots += `<circle cx="${x}" cy="${y}" r="4" fill="#d4a574" stroke="#0a0f0f" stroke-width="1" onclick="alert('${data[i].time.slice(0,16)}\nПокупка: ${(data[i].buy/lotSize).toFixed(2)}/шт\nПродажа: ${(data[i].sell/lotSize).toFixed(2)}/шт')" style="cursor:pointer;"/>`;
    });
    const lx = pad + (W - pad * 2), ly = H - pad - ((buys[buys.length-1] - minVal) / range) * (H - pad * 2);
    const py = Math.max(pad, Math.min(H - pad, ly - pred.slope * 3600 * 10));
    container.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;background:#0a0f0f;border-radius:6px;border:1px solid var(--border);margin-top:8px;">
            ${grid}<polyline points="${pts}" fill="none" stroke="#d4a574" stroke-width="2"/>${dots}
            <line x1="${lx}" y1="${ly}" x2="${W}" y2="${py}" stroke="#d4a574" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6"/>
        </svg>
        <div class="status-badge ${pred.class}">${pred.text}</div>
        <div class="stat-row">
            <div class="stat-box"><div class="val">${pred.avgBuy.toFixed(2)}</div><div class="lbl">Средняя/шт</div></div>
            <div class="stat-box"><div class="val">${(pred.confidence*100).toFixed(0)}%</div><div class="lbl">Уверенность</div></div>
        </div>`;
}

// === СКЛАД ===
function updateStorageSelect() {
    const s = document.getElementById('storageItemSelect');
    if (s) s.innerHTML = items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
}

function addToStorageUI() {
    const select = document.getElementById('storageItemSelect');
    const qtyEl = document.getElementById('storageQty');
    const modEl = document.getElementById('storageModded');
    if (!select || !qtyEl || !modEl) return;
    
    const item = select.value;
    const qty = parseInt(qtyEl.value) || 1;
    const modded = modEl.checked;
    if (!item) { alert('Выбери предмет'); return; }
    
    const data = prices[item] || [];
    const buyPrice = data.length > 0 ? Number(data[data.length - 1].buy) : 0;
    
    storageItems.push({ item, qty, buyPrice, modded, date: new Date().toISOString() });
    saveAll();
    qtyEl.value = '1';
    modEl.checked = false;
    renderStorage();
}

function renderStorage() {
    const list = document.getElementById('storageList');
    const totalEl = document.getElementById('storageTotal');
    if (!list) return;
    if (storageItems.length === 0) {
        list.innerHTML = '<p style="color:#888;">Склад пуст</p>';
        if (totalEl) totalEl.innerHTML = '';
        return;
    }
    let tv = 0, ti = 0;
    list.innerHTML = storageItems.map((s, i) => {
        const data = prices[s.item] || [];
        const price = data.length > 0 ? data[data.length - 1].sell : 0;
        const item = items.find(it => it.name === s.item);
        const ls = item ? item.lotSize : 1;
        // buyPrice уже за лот, current price за лот
        const val = price; // цена продажи за лот
        const inv = (s.buyPrice || 0); // цена покупки за лот
        const prof = val - inv;
        tv += val * s.qty;
        ti += inv * s.qty;
        return `<div class="item-card"><div class="name">${s.item} ×${s.qty} ${s.modded?'🔧':''}</div><div class="stats">Вложено: ${(inv*s.qty).toFixed(0)} | Сейчас: ${(val*s.qty).toFixed(0)} | <span style="color:${prof>=0?'var(--profit)':'var(--loss)'}">${prof>=0?'+':''}${(prof*s.qty).toFixed(0)}</span></div><button class="delete-btn" onclick="storageItems.splice(${i},1);saveAll();renderStorage();">✕</button></div>`;
    }).join('');
    const tp = tv - ti;
    if (totalEl) totalEl.innerHTML = `<div class="stat-row" style="margin-top:10px;"><div class="stat-box"><div class="val">${tv.toFixed(0)}</div><div class="lbl">Оценка склада</div></div><div class="stat-box"><div class="val" style="color:${tp>=0?'var(--profit)':'var(--loss)'}">${tp>=0?'+':''}${tp.toFixed(0)}</div><div class="lbl">Потенциал</div></div></div>`;
}

// === СДЕЛКИ ===
function updateTradeSelect() { const s = document.getElementById('tradeItemSelect'); if (s) s.innerHTML = items.map(i => `<option value="${i.name}">${i.name}</option>`).join(''); }
function submitTrade() {
    const item = document.getElementById('tradeItemSelect').value;
    const buy = parseFloat(document.getElementById('tradeBuyPrice').value);
    const sell = parseFloat(document.getElementById('tradeSellPrice').value);
    if (!item || isNaN(buy) || isNaN(sell)) { alert('Заполни'); return; }
    addTrade(item, buy, sell);
    document.getElementById('tradeBuyPrice').value = '';
    document.getElementById('tradeSellPrice').value = '';
    renderTrades(); renderStorage();
}
function renderTrades() {
    const tbody = document.querySelector('#tradesTable tbody');
    if (!tbody) return;
    tbody.innerHTML = trades.map((t, i) => `<tr><td>${t.item}</td><td>${t.buyPrice.toFixed(0)}</td><td>${t.sellPrice.toFixed(0)}</td><td style="color:${t.profit>=0?'var(--profit)':'var(--loss)'}">${t.profit.toFixed(0)}</td><td style="color:${t.profit>=0?'var(--profit)':'var(--loss)'}">${t.profitPct.toFixed(1)}%</td><td><button class="delete-btn" onclick="trades.splice(${i},1);saveAll();renderTrades();">✕</button></td></tr>`).join('');
    const tp = trades.reduce((a,b)=>a+b.profit,0);
    document.getElementById('tradeStats').innerHTML = `<div class="stat-row"><div class="stat-box"><div class="val" style="color:${tp>=0?'var(--profit)':'var(--loss)'}">${tp.toFixed(0)}</div><div class="lbl">Прибыль</div></div><div class="stat-box"><div class="val">${trades.length}</div><div class="lbl">Сделок</div></div></div>`;
}

// === ОБЗОР ===
function renderMarket() {
    const container = document.getElementById('marketContent');
    if (!container) return;
    let filtered = items;
    if (marketTab === 'resources') filtered = items.filter(i => i.type === 'resource');
    if (marketTab === 'parts') filtered = items.filter(i => i.type === 'part');
    if (filtered.length === 0) { container.innerHTML = '<p style="color:#888;">Нет предметов</p>'; return; }
    let html = '';
    filtered.forEach(item => {
        const data = prices[item.name] || [];
        if (data.length < 2) return;
        const pred = getPrediction(item.name);
        html += `<div class="item-card" onclick="switchScreen('items');selectItem('${item.name}');"><div class="name">${item.type==='resource'?'⛏️':'🔧'} ${item.name}</div><div style="display:flex;gap:8px;margin-top:4px;"><span style="font-size:0.8em;">${pred.avgBuy.toFixed(2)} ₽/шт</span><span class="status-badge ${pred.class}" style="font-size:0.65em;">${pred.slope>0.1?'📈':pred.slope<-0.1?'📉':'📊'}</span></div></div>`;
    });
    container.innerHTML = html || '<p style="color:#888;">Недостаточно данных</p>';
}

// Инициализация
document.getElementById('balanceInput').value = balance;
renderItems();
updateTradeSelect();
updateStorageSelect();
if (typeof renderEvents === 'function') renderEvents();
if (typeof initCalendar === 'function') initCalendar();
if (typeof renderGoals === 'function') renderGoals();
