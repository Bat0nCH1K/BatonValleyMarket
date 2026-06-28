// Wasteland Market Terminal — advisor.js v5.4 (owl-alpha, новые промпты, без эмодзи-ав)
let advisorHistory = JSON.parse(localStorage.getItem('wl_advisor_history') || '[]');

function getKey() {
    return atob('c2stb3ItdjEtODM0OGE1YmYzOGRiMTYyZGNmZGQxNTRkYjExYmEwYTA2NGY2YmRiNDg5M2Y0ZjMwMDNlNzY3ZTcyOTkxNDY3Ng==');
}

function getSupplyDemandAnalysis() {
    if (trades.length === 0) return '';
    
    const now = Date.now();
    const WEEK = 7 * 86400000;
    
    const recent = trades.filter(t => now - new Date(t.date).getTime() < WEEK);
    if (recent.length === 0) return '';
    
    const byItem = {};
    recent.forEach(t => {
        if (!byItem[t.item]) byItem[t.item] = { buyQty: 0, sellQty: 0 };
        if (t.type === 'buy') byItem[t.item].buyQty += t.qty;
        else byItem[t.item].sellQty += t.qty;
    });
    
    let analysis = '\nСпрос/предложение (7 дней):\n';
    let hasData = false;
    
    Object.entries(byItem).forEach(([item, stats]) => {
        if (stats.buyQty + stats.sellQty >= 2) {
            hasData = true;
            const ratio = stats.buyQty / (stats.buyQty + stats.sellQty || 1);
            let pressure = '';
            if (ratio > 0.6) pressure = 'ДЕФИЦИТ — цена растёт';
            else if (ratio < 0.4) pressure = 'ИЗБЫТОК — цена падает';
            else pressure = 'Баланс';
            analysis += `  ${item}: покупок ${stats.buyQty}шт / продаж ${stats.sellQty}шт → ${pressure}\n`;
        }
    });
    
    return hasData ? analysis : '\nСпрос/предложение: мало данных\n';
}

function getMarketSummary() {
    let s = '=== ДАННЫЕ ТЕРМИНАЛА ===\n\n';
    s += `Баланс: ${balance.toFixed(0)} голды\n`;
    
    if (storageItems.length === 0) {
        s += 'Склад: пусто\n';
    } else {
        s += 'Склад:\n';
        let tv = 0;
        storageItems.forEach(st => {
            const data = prices[st.item] || [];
            const item = items.find(i => i.name === st.item);
            const ls = item ? item.lotSize : 1;
            const pricePerUnit = data.length > 0 ? data[data.length - 1].sell / ls : 0;
            const val = pricePerUnit * st.qty;
            tv += val;
            s += `  ${st.item}: ${st.qty} шт, оценка ${val.toFixed(0)} голды\n`;
        });
        s += `  Склад: ${tv.toFixed(0)} | Общее: ${(balance + tv).toFixed(0)} голды\n`;
    }
    
    const withData = items.filter(i => (prices[i.name] || []).length >= 2);
    if (withData.length > 0) {
        s += '\nТренды:\n';
        withData.forEach(i => {
            const p = getPrediction(i.name);
            const trend = p.slope > 0.05 ? 'РАСТЁТ' : p.slope < -0.05 ? 'ПАДАЕТ' : 'стабилен';
            s += `  ${i.name}: ср.${p.avgBuy.toFixed(2)}/шт, ${trend}\n`;
        });
    }
    
    const ae = getActiveEvent();
    if (ae) s += `\nСобытие: ${ae.type} (до ${ae.end})\n`;
    
    s += getSupplyDemandAnalysis();
    
    if (goals.length > 0) {
        s += '\nЦели:\n';
        goals.forEach((g, idx) => {
            const isSave = !g.item || g.item === '';
            const isSell = !isSave && (g.text.includes('Продать') || g.text.includes('📤'));
            const isBuy = !isSave && (g.text.includes('Купить') || g.text.includes('📥'));
            
            if (isSave) {
                const need = Math.max(0, g.target - balance);
                s += `  ${idx+1}. Накопить ${g.target}г (есть ${balance.toFixed(0)}, ещё ${need.toFixed(0)})\n`;
            } else if (isSell) {
                const storage = storageItems.filter(s => s.item === g.item && !s.modded);
                const totalQty = storage.reduce((sum, s) => sum + s.qty, 0);
                const data = prices[g.item] || [];
                const itemObj = items.find(i => i.name === g.item);
                const ls = itemObj ? itemObj.lotSize : 1;
                const pricePerUnit = data.length > 0 ? data[data.length - 1].sell / ls : 0;
                const value = totalQty * pricePerUnit;
                s += `  ${idx+1}. Продать ${g.item} на ${g.target}г (склад: ${totalQty}шт ≈ ${value.toFixed(0)}г)${totalQty === 0 ? ' НЕТ' : ''}\n`;
            } else if (isBuy) {
                const data = prices[g.item] || [];
                const itemObj = items.find(i => i.name === g.item);
                const ls = itemObj ? itemObj.lotSize : 1;
                const pricePerUnit = data.length > 0 ? data[data.length - 1].buy / ls : 0;
                const maxQty = pricePerUnit > 0 ? Math.floor(balance / pricePerUnit) : 0;
                s += `  ${idx+1}. Купить ${g.item} на ${g.target}г (цена ${pricePerUnit.toFixed(2)}/шт, могу ${maxQty}шт)${balance < g.target ? ' МАЛО' : ''}\n`;
            }
        });
    }
    
    if (trades.length > 0) {
        s += '\nСделки:\n';
        const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
        sorted.forEach((t, idx) => {
            const type = t.type === 'buy' ? 'КУПИЛ' : 'ПРОДАЛ';
            const dateStr = new Date(t.date).toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            s += `  ${idx+1}. ${dateStr}: ${type} ${t.item} x${t.qty} по ${t.pricePerUnit.toFixed(2)} (${t.total.toFixed(0)}г)\n`;
        });
        const totalProfit = typeof getTotalProfit === 'function' ? getTotalProfit() : 0;
        s += `  Прибыль: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(0)}г\n`;
    }
    
    s += '\n=== КОНЕЦ ДАННЫХ. ОТВЕЧАЙ СТРОГО ПО НИМ. ===';
    
    return s;
}

async function askAdvisor() {
    const input = document.getElementById('advisorInput');
    const chat = document.getElementById('advisorChat');
    const msg = input.value.trim();
    if (!msg) return;
    
    chat.innerHTML += `<p style="color:#888;margin:4px 0;">👤 ${msg}</p>`;
    
    const loadingEl = document.createElement('p');
    loadingEl.style.cssText = 'color:#888;margin:4px 0;';
    loadingEl.textContent = '⏳ Анализирую...';
    chat.appendChild(loadingEl);
    chat.scrollTop = chat.scrollHeight;
    input.value = '';
    
    const summary = getMarketSummary();
    
    const systemPrompt = `Ты — OWL, торговый советник в Crossout Mobile.

ПРАВИЛА:
1. Только данные из раздела ДАННЫЕ ТЕРМИНАЛА. Не выдумывай.
2. Мало данных — честно скажи.
3. Конкретный совет: что, почём, сколько.
4. Кратко, 3-5 предложений. Без Markdown.
5. Для акцента — СЛОВО заглавными.
6. Комментируй сделки игрока: выгодно или нет.
7. 95% игроков — паникёры. Продают на падении (избыток → цена вниз), покупают на росте (дефицит → цена вверх).
8. Анализируй спрос/предложение из данных.
9. Не говори "как ИИ". Ты — OWL.
10. Поправляют — признай ошибку.`;

    advisorHistory = advisorHistory.slice(-8);
    advisorHistory.push({ role: 'user', content: msg });
    localStorage.setItem('wl_advisor_history', JSON.stringify(advisorHistory));
    
    try {
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getKey(),
                'HTTP-Referer': 'https://bat0nch1k.github.io',
                'X-Title': 'Wasteland Market'
            },
            body: JSON.stringify({
                model: 'openrouter/owl-alpha',
                messages: [
                    { role: 'system', content: systemPrompt + '\n\n' + summary },
                    ...advisorHistory
                ],
                temperature: 0.5,
                max_tokens: 300
            })
        });
        const data = await resp.json();
        const reply = data?.choices?.[0]?.message?.content?.trim() || 'Нет ответа.';
        
        loadingEl.remove();
        advisorHistory.push({ role: 'assistant', content: reply });
        localStorage.setItem('wl_advisor_history', JSON.stringify(advisorHistory));
        
        chat.innerHTML += `<p style="color:var(--accent);margin:4px 0;">🦉 ${reply}</p>`;
    } catch(e) {
        loadingEl.remove();
        chat.innerHTML += `<p style="color:var(--danger);margin:4px 0;">❌ Ошибка связи</p>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

function renderAdvisor() {
    const chat = document.getElementById('advisorChat');
    if (!chat) return;
    if (advisorHistory.length === 0) {
        chat.innerHTML = '<p style="color:var(--accent);">🦉 Я вижу твой рынок, склад и цели. Спроси что делать.</p>';
        return;
    }
    chat.innerHTML = advisorHistory.map(m => {
        if (m.role === 'user') return `<p style="color:#888;margin:4px 0;">👤 ${m.content}</p>`;
        return `<p style="color:var(--accent);margin:4px 0;">🦉 ${m.content}</p>`;
    }).join('');
    chat.scrollTop = chat.scrollHeight;
}
