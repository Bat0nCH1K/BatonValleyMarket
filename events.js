// Wasteland Market Terminal — events.js v3 (цели с типами + drag & drop)
let calendarYear, calendarMonth;

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
    let html = '<div class="calendar-header"><button onclick="changeMonth(-1)">←</button><span>' + new Date(calendarYear, calendarMonth).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) + '</span><button onclick="changeMonth(1)">→</button></div><div class="calendar-grid">';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(d => html += `<div class="calendar-day-name">${d}</div>`);
    for (let i = 1; i < firstDay; i++) html += '<div class="calendar-day other-month"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
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
document.addEventListener('DOMContentLoaded', function() {
    const typeEl = document.getElementById('goalType');
    if (typeEl) {
        typeEl.addEventListener('change', function() {
            const itemSelect = document.getElementById('goalItem');
            if (this.value === 'save') {
                itemSelect.style.display = 'none';
            } else {
                itemSelect.style.display = '';
                itemSelect.innerHTML = '<option value="">Выбери предмет</option>' + items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
            }
        });
    }
});

function submitGoal() {
    const type = document.getElementById('goalType').value;
    const amount = parseFloat(document.getElementById('goalAmount').value);
    const item = document.getElementById('goalItem').value;
    
    if (isNaN(amount) || amount <= 0) { alert('Введи сумму'); return; }
    if ((type === 'sell' || type === 'buy') && !item) { alert('Выбери предмет'); return; }
    
    let text;
    if (type === 'save') text = '💰 Накопить ' + amount + ' голды';
    else if (type === 'sell') text = '📤 Продать ' + item + ' за ' + amount;
    else text = '📥 Купить ' + item + ' за ' + amount;
    
    addGoal(text, amount, 0);
    document.getElementById('goalAmount').value = '';
    document.getElementById('goalItem').value = '';
    renderGoals();
}

function renderGoals() {
    const list = document.getElementById('goalsList');
    if (!list) return;
    if (goals.length === 0) { list.innerHTML = '<p style="color:#888;">Нет целей</p>'; return; }
    
    list.innerHTML = goals.map((g, i) => {
        const pct = Math.min(100, g.target > 0 ? (balance / g.target) * 100 : 0);
        const done = balance >= g.target;
        return `<div class="item-card" style="cursor:grab;" draggable="true" ondragstart="dragGoal(event,${i})" ondragover="event.preventDefault()" ondrop="dropGoal(event,${i})">
            <div class="name">${done ? '✅' : '🎯'} ${g.text}</div>
            <div style="font-size:0.8em;">Баланс: ${balance.toFixed(0)} / ${g.target.toFixed(0)}</div>
            <div style="height:6px;background:#1a2a2a;border-radius:3px;margin-top:4px;">
                <div style="height:100%;width:${pct}%;background:${done?'var(--profit)':'var(--accent)'};border-radius:3px;"></div>
            </div>
            <button class="delete-btn" onclick="goals.splice(${i},1);saveAll();renderGoals();">✕</button>
        </div>`;
    }).join('');
}

function dragGoal(e, index) {
    e.dataTransfer.setData('text/plain', index);
}

function dropGoal(e, toIndex) {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const item = goals.splice(fromIndex, 1)[0];
    goals.splice(toIndex, 0, item);
    saveAll();
    renderGoals();
}
