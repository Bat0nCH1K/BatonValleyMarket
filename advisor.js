// Wasteland Market Terminal — advisor.js v4.1 (без отладки, с фиксом всех целей)
let advisorHistory = JSON.parse(localStorage.getItem('wl_advisor_history') || '[]');

function getKey() {
    return atob('c2stb3ItdjEtODM0OGE1YmYzOGRiMTYyZGNmZGQxNTRkYjExYmEwYTA2NGY2YmRiNDg5M2Y0ZjMwMDNlNzY3ZTcyOTkxNDY3Ng==');
}

function getMarketSummary() {
    let s = 'ТЕРМИНАЛ WASTELAND MARKET\n\n';
    s += `Баланс: ${balance.toFixed(0)} голды | Предметов: ${items.length}\n`;
    
    const withData = items.filter(i => (prices[i.name]||[]).length >= 2);
    if (withData.length > 0) {
        s += '\nТРЕНДЫ:\n';
        withData.forEach(i => {
            const p = getPrediction(i.name);
            s += `${i.name}: ср.${p.avgBuy.toFixed(1)}/шт, ${p.slope>0.05?'растёт':p.slope<-0.05?'падает':'стабилен'}\n`;
        });
    }
    
    if (storageItems.length > 0) {
        s += '\nСКЛАД:\n';
        let tv = 0;
        storageItems.forEach(st => {
            const data = prices[st.item] || [];
            const item = items.find(i=>i.name===st.item);
            const ls = item ? item.lotSize : 1;
            const pricePerUnit = data.length>0 ? data[data.length-1].sell / ls : 0;
            const val = pricePerUnit * st.qty; tv += val;
            s += `${st.item} ×${st.qty}: ${val.toFixed(0)}г${st.modded?' [МОД]':''}\n`;
        });
        s += `Склад: ${tv.toFixed(0)}г | Общее: ${(balance+tv).toFixed(0)}г\n`;
    }
    
    const ae = getActiveEvent();
    if (ae) s += `\nСобытие: ${ae.type} (до ${ae.end})\n`;
    
    if (goals.length > 0) {
        s += '\nЦЕЛИ:\n';
        goals.forEach((g, idx) => {
            const isSave = !g.item || g.item === '';
            const isSell = !isSave && (g.text.includes('Продать') || g.text.includes('📤'));
            const isBuy = !isSave && (g.text.includes('Купить') || g.text.includes('📥'));
            
            if (isSave) {
                const need = Math.max(0, g.target - balance);
                s += `${idx+1}. ${g.text}: есть ${balance.toFixed(0)}, нужно ещё ${need.toFixed(0)}\n`;
            } else if (isSell) {
                const storage = storageItems.filter(s => s.item === g.item && !s.modded);
                const totalQty = storage.reduce((sum, s) => sum + s.qty, 0);
                const data = prices[g.item] || [];
                const itemObj = items.find(i => i.name === g.item);
                const ls = itemObj ? itemObj.lotSize : 1;
                const pricePerUnit = data.length>0 ? data[data.length-1].sell/ls : 0;
                const value = totalQty * pricePerUnit;
                s += `${idx+1}. ${g.text}: на складе ${totalQty}шт (${value.toFixed(0)}г)${value>=g.target?' ✅':''}\n`;
            } else if (isBuy) {
                const data = prices[g.item] || [];
                const itemObj = items.find(i => i.name === g.item);
                const ls = itemObj ? itemObj.lotSize : 1;
                const pricePerUnit = data.length>0 ? data[data.length-1].buy/ls : 0;
                s += `${idx+1}. ${g.text}: цена ${pricePerUnit.toFixed(2)}/шт, баланс ${balance.toFixed(0)}${balance>=g.target?' ✅':''}\n`;
            } else {
                s += `${idx+1}. ${g.text} (тип не определён)\n`;
            }
        });
    }
    
    if (trades.length > 0) {
        const tp = trades.reduce((a,b)=>a+b.profit,0);
        s += `\nСделок: ${trades.length}, прибыль: ${tp.toFixed(0)}\n`;
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
    const systemPrompt = `Ты — OWL, торговый советник в Crossout Mobile. Стиль: деловой, краткий (2-5 предложений). Видишь рынок, склад, цели. Для каждой цели даёшь конкретный совет. Не пишешь "как ИИ".`;
    
    advisorHistory = advisorHistory.slice(-10);
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
                messages: [{ role: 'system', content: systemPrompt + '\n\n' + summary }, ...advisorHistory],
                temperature: 0.5,
                max_tokens: 250
            })
        });
        const data = await resp.json();
        const reply = data?.choices?.[0]?.message?.content?.trim() || 'Нет ответа.';
        advisorHistory.push({ role: 'assistant', content: reply });
        localStorage.setItem('wl_advisor_history', JSON.stringify(advisorHistory));
        loadingEl.remove();
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
