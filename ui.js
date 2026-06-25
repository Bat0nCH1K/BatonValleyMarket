// Wasteland Market Terminal — ui.js v5
let currentScreen = 'items';
let marketTab = 'overview';
let calendarYear, calendarMonth;

document.getElementById('balanceInput').value = balance;

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
    if (screen === 'events') { initCalendar(); renderEvents(); }
    if (screen === 'storage') renderStorage();
    if (screen === 'goals') renderGoals();
    if (screen === 'market') renderMarket();
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
    const lotSize = parseInt(prompt('Размер лота (1 = поштучно, 10 = десяток, 100 = сотня):', '1')) || 1;
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
    const now = new Date();
    now.setHours(now.getHours() + 3);
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
    if (activeEvent) {
        const selected = activeEvent.type;
        eventOptions.forEach((opt, i) => {
            if (opt.includes('value="' + selected + '"')) {
                eventOptions[i] = opt.replace('">', '" selected>');
            }
        });
    }

    document.getElementById('screen-item-detail').classList.add('active');
    document.getElementById('screen-items').classList.remove('active');
    document.getElementById('detailTitle').textContent = `${item.type==='resource'?'⛏️':'🔧'} ${name} (лот: ${item.lotSize} шт)`;
    
    document.getElementById('detailContent').innerHTML = `
        <div class="price-panel">
            <input type="datetime-local" id="entryTime" value="${timeStr}">
            <div class="row">
                <input type="number" id="entryBuy" placeholder="Цена покупки (за лот)" step="0.01">
                <input type="number" id="entrySell" placeholder="Цена продажи (за лот)" step="0.01">
            </div>
            ${isPart ? `
            <div style="display:flex;gap:12px;font-size:0.8em;margin-bottom:6px;">
                <label><input type="checkbox" id="entryNerf"> 🔻 Нерф</label>
                <label><input type="checkbox" id="entryBuff"> 🔺 Бафф</label>
            </div>` : ''}
            <select id="entryEvent">${eventOptions.join('')}</select>
            ${activeEvent ? `<div style="font-size:0.7em;color:var(--accent);margin-top:4px;">📅 Сейчас идёт: ${activeEvent.type}</div>` : ''}
            <div class="row" style="margin-top:8px;">
                <button class="accent" onclick="submitPriceEntry()">ЗАПИСАТЬ</button>
                <button class="danger" onclick="deleteSelectedItem();switchScreen('items');">УДАЛИТЬ</button>
            </div>
            <div id="itemGraph"></div>
        </div>`;
    
    renderItemGraph();
}

function submitPriceEntry() {
    const now = new Date();
    now.setHours(now.getHours() + 3);
    const time = document.getElementById('entryTime').value || now.toISOString().slice(0, 16);
    const buy = parseFloat(document.getElementById('entryBuy').value);
    const sell = parseFloat(document.getElementById('entrySell').value);
    const event = document.getElementById('entryEvent').value;
    const nerf = document.getElementById('entryNerf')?.checked || false;
    const buff = document.getElementById('entryBuff')?.checked || false;
    if (isNaN(buy) || isNaN(sell)) { alert('Введи цены'); return; }
    addPriceEntry(time, buy, sell, event, nerf, buff);
    renderItems();
    selectItem(selectedItem);
}

function renderItems() {
    const list = document.getElementById('itemsList');
    if (!list) return;
    if (items.length === 0) {
        list.innerHTML = '<p style="color:#888;text-align:center;">Нет предметов</p>';
        return;
    }
    list.innerHTML = items.map(item => {
        const data = prices[item.name] || [];
        const last = data[data.length - 1];
        const lastBuy = last ? (last.buy / item.lotSize).toFixed(2) : '—';
        return `<div class="item-card" onclick="selectItem('${item.name}')">
            <div class="name">${item.type==='resource'?'⛏️':'🔧'} ${item.name} <span style="font-size:0.7em;color:#888;">(×${item.lotSize})</span></div>
            <div class="stats">${data.length} записей | Последняя: ${lastBuy} ₽/шт</div>
        </div>`;
    }).join('');
    updateTradeSelect();
    updateStorageSelect();
}

function renderItemGraph() {
    if (!selectedItem) return;
    const data = prices[selectedItem] || [];
    const item = items.find(i => i.name === selectedItem);
    const lotSize = item ? item.lotSize : 1;
    const container = document.getElementById('itemGraph');
    if (data.length < 3) {
        container.innerHTML = '<p style="color:#888;font-size:0.8em;">📊 Нужно 3+ записи для графика</p>';
        return;
    }
    const pred = getPrediction(selectedItem);
    const buys = data.map(p => p.buy / lotSize);
    const maxVal = Math.max(...buys);
    const minVal = Math.min(...buys);
    const range = maxVal - minVal || 1;
    const w = 100, h = 40, pad = 2;
    let points = '';
    buys.forEach((b, i) => {
        const x = pad + (i / Math.max(buys.length - 1, 1)) * (w - pad * 2);
        const y = h - pad - ((b - minVal) / range) * (h - pad * 2);
        points += `${x},${y} `;
    });
    const lastX = pad + (w - pad * 2);
    const lastY = h - pad - ((buys[buys.length - 1] - minVal) / range) * (h - pad * 2);
    const predY = lastY - pred.slope * 3600 * 10 / lotSize;

    container.innerHTML = `
        <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:60px;background:#0a0f0f;border-radius:4px;margin-top:8px;">
            <polyline points="${points}" fill="none" stroke="#d4a574" stroke-width="1.5"/>
            <line x1="${lastX}" y1="${lastY}" x2="${w}" y2="${Math.max(0, Math.min(h, predY))}" stroke="#d4a574" stroke-width="1" stroke-dasharray="2,2" opacity="0.6"/>
        </svg>
        <div class="status-badge ${pred.class}">${pred.text}</div>
        <div class="stat-row">
            <div class="stat-box"><div class="val">${pred.avgBuy.toFixed(2)}</div><div class="lbl">Средняя/шт</div></div>
            <div class="stat-box"><div class="val">${pred.volatility.toFixed(2)}</div><div class="lbl">Волатильность</div></div>
            <div class="stat-box"><div class="val">${(pred.confidence*100).toFixed(0)}%</div><div class="lbl">Уверенность</div></div>
            <div class="stat-box"><div class="val">${getModelAccuracy(selectedItem)}%</div><div class="lbl">Точность</div></div>
        </div>`;
}

// === СКЛАД ===
function updateStorageSelect() {
    const select = document.getElementById('storageItemSelect');
    if (select) select.innerHTML = items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
}

function addToStorage() {
    const item = document.getElementById('storageItemSelect').value;
    const qty = parseInt(document.getElementById('storageQty').value);
    const buyPrice = parseFloat(document.getElementById('storageBuyPrice').value);
    const modded = document.getElementById('storageModded').checked;
    if (!item || isNaN(qty) || isNaN(buyPrice)) { alert('Заполни'); return; }
    addToStorage(item, qty, buyPrice, modded);
    document.getElementById('storageBuyPrice').value = '';
    document.getElementById('storageQty').value = '1';
    renderStorage();
}

function renderStorage() {
    const list = document.getElementById('storageList');
    if (!list) return;
    if (storageItems.length === 0) {
        list.innerHTML = '<p style="color:#888;">Склад пуст</p>';
        return;
    }
    let totalValue = 0;
    list.innerHTML = storageItems.map((s, i) => {
        const currentData = prices[s.item] || [];
        const currentPrice = currentData.length > 0 ? currentData[currentData.length - 1].sell : 0;
        const item = items.find(it => it.name === s.item);
        const lotSize = item ? item.lotSize : 1;
        const currentValue = currentPrice * s.qty / lotSize;
        const profit = currentValue - s.buyPrice * s.qty;
        totalValue += currentValue;
        return `<div class="item-card">
            <div class="name">${s.item} ×${s.qty} ${s.modded ? '🔧' : ''}</div>
            <div class="stats">Куплено за: ${(s.buyPrice * s.qty).toFixed(2)} | Сейчас: ${currentValue.toFixed(2)} | <span style="color:${profit>=0?'var(--profit)':'var(--loss)'}">${profit>=0?'+':''}${profit.toFixed(2)}</span></div>
            <button class="delete-btn" onclick="removeFromStorage(${i});renderStorage();">✕</button>
        </div>`;
    }).join('');
    list.innerHTML += `<div class="stat-box" style="margin-top:8px;"><div class="val">${totalValue.toFixed(2)}</div><div class="lbl">Общая стоимость склада</div></div>`;
}

// === СДЕЛКИ ===
function updateTradeSelect() {
    const select = document.getElementById('tradeItemSelect');
    if (select) select.innerHTML = items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
}

function submitTrade() {
    const item = document.getElementById('tradeItemSelect').value;
    const buyPrice = parseFloat(document.getElementById('tradeBuyPrice').value);
    const sellPrice = parseFloat(document.getElementById('tradeSellPrice').value);
    if (!item || isNaN(buyPrice) || isNaN(sellPrice)) { alert('Заполни'); return; }
    addTrade(item, buyPrice, sellPrice);
    document.getElementById('tradeBuyPrice').value = '';
    document.getElementById('tradeSellPrice').value = '';
    renderTrades();
}

function renderTrades() {
    const tbody = document.querySelector('#tradesTable tbody');
    if (!tbody) return;
    tbody.innerHTML = trades.map((t, i) => `
        <tr>
            <td>${t.item}</td><td>${t.buyPrice.toFixed(2)}</td><td>${t.sellPrice.toFixed(2)}</td>
            <td style="color:${t.profit>=0?'var(--profit)':'var(--loss)'}">${t.profit.toFixed(2)}</td>
            <td style="color:${t.profit>=0?'var(--profit)':'var(--loss)'}">${t.profitPct.toFixed(1)}%</td>
            <td><button class="delete-btn" onclick="trades.splice(${i},1);saveAll();renderTrades();">✕</button></td>
        </tr>
    `).join('');
    const tp = trades.reduce((a,b) => a + b.profit, 0);
    const wr = trades.length > 0 ? (trades.filter(t => t.profit > 0).length / trades.length * 100) : 0;
    document.getElementById('tradeStats').innerHTML = `
        <div class="stat-row">
            <div class="stat-box"><div class="val" style="color:${tp>=0?'var(--profit)':'var(--loss)'}">${tp.toFixed(2)}</div><div class="lbl">Прибыль</div></div>
            <div class="stat-box"><div class="val">${trades.length}</div><div class="lbl">Сделок</div></div>
            <div class="stat-box"><div class="val">${wr.toFixed(0)}%</div><div class="lbl">Успех</div></div>
            <div class="stat-box"><div class="val">${getGlobalAccuracy()}%</div><div class="lbl">Точность</div></div>
        </div>`;
}

// === СОБЫТИЯ ===
function submitEvent() {
    const start = document.getElementById('eventStart').value;
    const end = document.getElementById('eventEnd').value || start;
    const type = document.getElementById('eventType').value;
    if (!start) return;
    addEvent(start, end, type, '');
    renderEvents();
    initCalendar();
}

function renderEvents() {
    const list = document.getElementById('eventsList');
    if (!list) return;
    if (events.length === 0) { list.innerHTML = '<p style="color:#888;">Нет событий</p>'; return; }
    const emoji = { factory: '🏭', rating_end: '⚔️', battlepass: '🎫', road: '🛣️', raven: '🐦‍⬛', workshop: '🔧', bounty: '🎯' };
    const tagClass = { factory: 'tag-factory', rating_end: 'tag-rating', battlepass: 'tag-battlepass', road: 'tag-road', raven: 'tag-raven', workshop: 'tag-workshop', bounty: 'tag-bounty' };
    list.innerHTML = events.map((e, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border);font-size:0.8em;">
            <span><span class="tag ${tagClass[e.type]||''}">${emoji[e.type]||'📌'}</span> ${e.start} → ${e.end}</span>
            <button class="delete-btn" onclick="deleteEvent(${i});renderEvents();initCalendar();">✕</button>
        </div>
    `).join('');
}

function initCalendar() {
    const now = new Date();
    if (!calendarYear) { calendarYear = now.getFullYear(); calendarMonth = now.getMonth(); }
    renderCalendar();
}

function renderCalendar() {
    const container = document.getElementById('calendarWidget');
    if (!container) return;
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay() || 7;
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    let html = '<div class="calendar-header">';
    html += `<button onclick="changeMonth(-1)">←</button>`;
    html += `<span>${new Date(calendarYear, calendarMonth).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>`;
    html += `<button onclick="changeMonth(1)">→</button>`;
    html += '</div><div class="calendar-grid">';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(d => html += `<div class="calendar-day-name">${d}</div>`);
    for (let i = 1; i < firstDay; i++) html += '<div class="calendar-day other-month"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const hasEvent = events.some(e => e.start <= dateStr && e.end >= dateStr);
        const isToday = dateStr === todayStr;
        let cls = 'calendar-day';
        if (isToday) cls += ' today';
        if (hasEvent) cls += ' has-event';
        html += `<div class="${cls}" onclick="document.getElementById('eventStart').value='${dateStr}'">${day}</div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

function changeMonth(delta) {
    calendarMonth += delta;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    renderCalendar();
}

// === ЦЕЛИ ===
function addGoal() {
    const text = document.getElementById('goalText').value.trim();
    const target = parseFloat(document.getElementById('goalTarget').value);
    const current = parseFloat(document.getElementById('goalCurrent').value) || 0;
    if (!text || isNaN(target)) { alert('Заполни'); return; }
    addGoal(text, target, current);
    document.getElementById('goalText').value = '';
    document.getElementById('goalTarget').value = '';
    document.getElementById('goalCurrent').value = '';
    renderGoals();
}

function renderGoals() {
    const list = document.getElementById('goalsList');
    if (!list) return;
    if (goals.length === 0) { list.innerHTML = '<p style="color:#888;">Нет целей</p>'; return; }
    list.innerHTML = goals.map((g, i) => {
        const pct = Math.min(100, (g.current / g.target) * 100);
        return `<div class="item-card">
            <div class="name">🎯 ${g.text}</div>
            <div style="font-size:0.8em;">${g.current.toFixed(2)} / ${g.target.toFixed(2)} ₽</div>
            <div style="height:6px;background:#1a2a2a;border-radius:3px;margin-top:4px;">
                <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px;"></div>
            </div>
            <button class="delete-btn" onclick="deleteGoal(${i});renderGoals();">✕</button>
        </div>`;
    }).join('');
}

// === ОБЗОР РЫНКА ===
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
        html += `<div class="item-card" onclick="switchScreen('items');selectItem('${item.name}');">
            <div class="name">${item.type==='resource'?'⛏️':'🔧'} ${item.name}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
                <span style="font-size:0.8em;">${pred.avgBuy.toFixed(2)} ₽/шт</span>
                <span class="status-badge ${pred.class}" style="font-size:0.65em;padding:2px 6px;">${pred.slope > 0.1 ? '📈' : pred.slope < -0.1 ? '📉' : '📊'} ${pred.slope.toFixed(2)}/ч</span>
            </div>
        </div>`;
    });
    container.innerHTML = html || '<p style="color:#888;">Недостаточно данных</p>';
}

// === ИНИЦИАЛИЗАЦИЯ ===
renderItems();
renderEvents();
updateTradeSelect();
updateStorageSelect();
