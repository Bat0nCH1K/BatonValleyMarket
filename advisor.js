// Wasteland Market Terminal — advisor.js v5.5 (короткая история + кнопка очистки)
let advisorHistory = JSON.parse(localStorage.getItem('wl_advisor_history') || '[]');

function getKey() {
    return atob('c2stb3ItdjEtODM0OGE1YmYzOGRiMTYyZGNmZGQxNTRkYjExYmEwYTA2NGY2YmRiNDg5M2Y0ZjMwMDNlNzY3ZTcyOTkxNDY3Ng==');
}

function clearAdvisorHistory() {
    advisorHistory = [];
    localStorage.setItem('wl_advisor_history', JSON.stringify(advisorHistory));
    const chat = document.getElementById('advisorChat');
    if (chat) {
        chat.innerHTML = '<p style="color:var(--accent);">🦉 История очищена. Спроси что делать.</p>';
    }
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
    let analysis = '\nСпрос/предложение (7д):\n';
    let hasData = false;
    Object.entries(byItem).forEach(([item, stats]) => {
        if (stats.buyQty + stats.sellQty >= 2) {
            hasData = true;
            const ratio = stats.buyQty / (stats.buyQty + stats.sellQty || 1);
            let pressure = ratio > 0.6 ? 'ДЕФИЦИТ' : ratio < 0.4 ? 'ИЗБЫТОК' : 'Баланс';
            analysis += `  ${item}: ${pressure} (куп ${stats.buyQty}/прод ${stats.sellQty})\n`;
        }
    });
    return hasData ? analysis : '';
}

function getMarketSummary() {
    let s = '=== ДАННЫЕ ===\n';
    s += `Баланс: ${balance.toFixed(0)}г\n`;
    
    if (storageItems.length > 0) {
        let tv = 0;
        s += 'Склад: ';
        storageItems.forEach(st => {
            const data = prices[st.item] || [];
            const item = items.find(i => i.name === st.item);
            const ls = item ? item.lotSize : 1;
            const pricePerUnit = data.length > 0 ? data[data.length - 1].sell / ls : 0;
            const val = pricePerUnit * st.qty;
            tv += val;
            s += `${st.item}×${st.qty}(${val.toFixed(0)}г) `;
        });
        s += `| Всего: ${(balance+tv).toFixed(0)}г\n`;
    }
    
    const withData = items.filter(i => (prices[i.name] || []).length >= 2);
    if (withData.length > 0) {
        s += 'Тренды: ';
        withData.forEach(i => {
            const p = getPrediction(i.name);
            s += `${i.name} ${p.avgBuy.toFixed(1)}/шт `;
        });
        s += '\n';
    }
    
    s += getSupplyDemandAnalysis();
    
    if (goals.length > 0) {
        s += 'Цели: ';
        goals.forEach((g, idx) => {
            const isSave = !g.item || g.item === '';
            if (isSave) s += `${idx+1}.Накопить ${g.target}г `;
            else s += `${idx+1}.${g.text} `;
        });
        s += '\n';
    }
    
    if (trades.length > 0) {
        const sorted = [...trades].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
        s += 'Последние сделки: ';
        sorted.forEach(t => {
            const type = t.type === 'buy' ? 'Купил' : 'Продал';
            s += `${type} ${t.item}×${t.qty} `;
        });
        const tp = typeof getTotalProfit === 'function' ? getTotalProfit() : 0;
        s += `| Прибыль: ${tp>=0?'+':''}${tp.toFixed(0)}г\n`;
    }
    
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
    const systemPrompt = `Ты OWL, советник в Crossout. Данные терминала выше. Конкретный совет (3-5 предложений). 95% игроков паникуют: продают на падении→избыток, покупают на росте→дефицит. Анализируй спрос/предложение. Не выдумывай. Не говори "как ИИ".`;
    
    advisorHistory = advisorHistory.slice(-3);
    advisorHistory.push({ role: 'user', content: msg });
    
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
                max_tokens: 200
            })
        });
        const data = await resp.json();
        
        if (data.error) {
            advisorHistory = [{ role: 'user', content: msg }];
            throw new Error(data.error.message || 'Ошибка');
        }
        
        const reply = data?.choices?.[0]?.message?.content?.trim() || 'Нет ответа.';
        loadingEl.remove();
        advisorHistory.push({ role: 'assistant', content: reply });
        localStorage.setItem('wl_advisor_history', JSON.stringify(advisorHistory));
        chat.innerHTML += `<p style="color:var(--accent);margin:4px 0;">🦉 ${reply}</p>`;
    } catch(e) {
        loadingEl.remove();
        chat.innerHTML += `<p style="color:var(--danger);margin:4px 0;">❌ ${e.message} <button onclick="clearAdvisorHistory()" style="font-size:0.65em;padding:2px 6px;">Очистить</button></p>`;
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
    chat.innerHTML += '<p style="margin-top:8px;"><button onclick="clearAdvisorHistory()" style="font-size:0.65em;padding:3px 8px;background:#2a1a1a;border:1px solid var(--border);color:#888;">🗑 Очистить историю</button></p>';
    chat.scrollTop = chat.scrollHeight;
}
