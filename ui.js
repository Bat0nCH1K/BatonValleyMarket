// Wasteland Market Terminal — ui.js
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
    document.getElementById('screen-' + screen).classList.add('active');
    if (screen === 'trades') renderTrades();
    if (screen === 'events') { initCalendar(); renderEvents(); }
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
    if (!name) return;
    addItem(name, type);
    document.getElementById('newItemName').value = '';
    renderItems();
}

function selectItem(name) {
    selectedItem = name;
    const container = document.getElementById('priceEntry');
    const item = items.find(i => i.name === name);
    const isPart = item && item.type === 'part';
    const now = new Date();
    now.setHours(now.getHours() + 3);
    const timeStr = now.toISOString().slice(0, 16);

    container.style.display = 'block';
    container.innerHTML = `
        <div class="price-panel">
            <h3>📝 ${name}</h3>
            <input type="datetime-local" id="entryTime" value="${timeStr}">
            <div class="row">
                <input type="number" id="entryBuy" placeholder="Цена покупки" step="0.01">
                <input type="number" id="entrySell" placeholder="Цена продажи" step="0.01">
            </div>
            ${isPart ? `
            <div style="display:flex;gap:12px;font-size:0.8em;margin-bottom:6px;">
                <label><input type="checkbox" id="entryNerf"> 🔻 Нерф</label>
                <label><input type="checkbox" id="entryBuff"> 🔺 Бафф</label>
            </div>` : ''}
            <select id="entryEvent">
                <option value="">Без события</option>
                <option value="factory">🏭 Фабрика</option>
                <option value="rating_end">⚔️ Рейтинг</option>
                <option value="battlepass">🎫 БП</option>
                <option value="road">🛣️ Наследие</option>
                <option value="raven">🐦‍⬛ Ворон</option>
                <option value="workshop">🔧 Цех</option>
                <option value="bounty">🎯 Охота</option>
            </select>
            <div class="row" style="margin-top:8px;">
                <button class="accent" onclick="submitPriceEntry()">ЗАПИСАТЬ</button>
                <button class="danger" onclick="deleteSelectedItem();renderItems();document.getElementById('priceEntry').style.display='none';">УДАЛИТЬ</button>
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
    if (items.length === 0) {
        list.innerHTML = '<p style="color:#888;text-align:center;">Нет предметов</p>';
        return;
    }
    list.innerHTML = items.map(item => {
        const data = prices[item.name] || [];
        const last = data[data.length - 1];
        const lastBuy = last ? last.buy.toFixed(2) : '—';
        return `<div class="item-card" onclick="selectItem('${item.name}')">
            <div class="name">${item.type === 'resource' ? '⛏️' : '🔧'} ${item.name}</div>
            <div class="stats">${data.length} записей | Последняя: ${lastBuy} ₽</div>
        </div>`;
    }).join('');
    updateTradeSelect();
}

function renderItemGraph() {
    if (!selectedItem) return;
    const data = prices[selectedItem] || [];
    const container = document.getElementById('itemGraph');
    if (data.length < 3) {
        container.innerHTML = '<p style="color:#888;font-size:0.8em;">📊 Нужно 3+ записи для графика</p>';
        return;
    }

    const buys = data.map(p => p.buy);
    const maxVal = Math.max(...buys);
    const minVal = Math.min(...buys);
    const range = maxVal - minVal || 1;
    const pred = getPrediction(selectedItem);

    // SVG график
    const w = 100, h = 40, pad = 2;
    let points = '';
    buys.forEach((b, i) => {
        const x = pad + (i / Math.max(buys.length - 1, 1)) * (w - pad * 2);
        const y = h - pad - ((b - minVal) / range) * (h - pad * 2);
        points += `${x},${y} `;
    });

    // Линия предсказания
    const lastX = pad + (w - pad * 2);
    const lastY = h - pad - ((buys[buys.length - 1] - minVal) / range) * (h - pad * 2);
    const predY = lastY - pred.slope * 3600 * 10; // проекция на 10 часов

    container.innerHTML = `
        <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:60px;background:#0a0f0f;border-radius:4px;margin-top:8px;">
            <polyline points="${points}" fill="none" stroke="#d4a574" stroke-width="1.5"/>
            <line x1="${lastX}" y1="${lastY}" x2="${w}" y2="${Math.max(0, Math.min(h, predY))}" stroke="#d4a574" stroke-width="1" stroke-dasharray="2,2" opacity="0.6"/>
        </svg>
        <div class="status-badge ${pred.class}">${pred.text}</div>
        <div class="stat-row">
            <div class="stat-box"><div class="val">${pred.avgBuy.toFixed(2)}</div><div class="lbl">Средняя</div></div>
            <div class="stat-box"><div class="val">${pred.volatility.toFixed(2)}</div><div class="lbl">Волатильность</div></div>
            <div class="stat-box"><div class="val">${(pred.confidence*100).toFixed(0)}%</div><div class="lbl">Уверенность</div></div>
            <div class="stat-box"><div class="val">${getModelAccuracy(selectedItem)}%</div><div class="lbl">Точность</div></div>
        </div>`;
}

// === СДЕЛКИ ===
function updateTradeSelect() {
    const select = document.getElementById('tradeItemSelect');
    select.innerHTML = items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
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
    const date = document.getElementById('eventDate').value;
    const type = document.getElementById('eventType').value;
    const desc = '';
    if (!date) return;
    addEvent(date, type, desc);
    renderEvents();
    initCalendar();
}

function renderEvents() {
    const list = document.getElementById('eventsList');
    if (events.length === 0) { list.innerHTML = '<p style="color:#888;">Нет событий</p>'; return; }
    const emoji = { factory: '🏭', rating_end: '⚔️', battlepass: '🎫', road: '🛣️', raven: '🐦‍⬛', workshop: '🔧', bounty: '🎯' };
    const tagClass = { factory: 'tag-factory', rating_end: 'tag-rating', battlepass: 'tag-battlepass', road: 'tag-road', raven: 'tag-raven', workshop: 'tag-workshop', bounty: 'tag-bounty' };
    list.innerHTML = events.map((e, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border);font-size:0.8em;">
            <span><span class="tag ${tagClass[e.type]||''}">${emoji[e.type]||'📌'}</span> ${e.date}</span>
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
        const hasEvent = events.some(e => e.date === dateStr);
        const isToday = dateStr === todayStr;
        let cls = 'calendar-day';
        if (isToday) cls += ' today';
        if (hasEvent) cls += ' has-event';
        html += `<div class="${cls}" onclick="document.getElementById('eventDate').value='${dateStr}'">${day}</div>`;
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

// === РЫНОК ===
function renderMarket() {
    const container = document.getElementById('marketContent');
    let filtered = items;
    if (marketTab === 'resources') filtered = items.filter(i => i.type === 'resource');
    if (marketTab === 'parts') filtered = items.filter(i => i.type === 'part');

    if (filtered.length === 0) {
        container.innerHTML = '<p style="color:#888;">Нет предметов в этой категории</p>';
        return;
    }

    let html = '';
    filtered.forEach(item => {
        const data = prices[item.name] || [];
        if (data.length < 2) return;
        const pred = getPrediction(item.name);
        html += `<div class="item-card" onclick="switchScreen('items');selectItem('${item.name}');" style="cursor:pointer;">
            <div class="name">${item.type==='resource'?'⛏️':'🔧'} ${item.name}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
                <span style="font-size:0.8em;">${pred.avgBuy.toFixed(2)} ₽</span>
                <span class="status-badge ${pred.class}" style="font-size:0.65em;padding:2px 6px;">${pred.slope > 0.5 ? '📈' : pred.slope < -0.5 ? '📉' : '📊'} ${pred.slope.toFixed(1)}/ч</span>
            </div>
        </div>`;
    });

    // Общий график рынка
    let allBuys = [];
    filtered.forEach(item => {
        (prices[item.name] || []).forEach(p => allBuys.push(p.buy));
    });
    if (allBuys.length > 2) {
        const avgAll = allBuys.reduce((a,b) => a+b, 0) / allBuys.length;
        html += `<div class="stat-box" style="margin-top:10px;"><div class="val">${avgAll.toFixed(2)}</div><div class="lbl">Средняя цена по категории</div></div>`;
    }

    container.innerHTML = html || '<p style="color:#888;">Недостаточно данных</p>';
}

// === ИНИЦИАЛИЗАЦИЯ ===
renderItems();
renderEvents();
updateTradeSelect();
if (items.length > 0) selectItem(items[0].name);
