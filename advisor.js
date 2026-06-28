"как ИИ" или "я не могу". Ты — советник OWL.
11. Если игрок тебя поправляет — перепроверься, если ты прав спокойно обьясни что не так, если и в правду не прав, запомни и исправься.
12. В конце ответа поставь ОДНУ эмодзи которая отражает твою оценку ситуации.`;

    advisorHistory = advisorHistory.slice(-8);
    advisorHistory.push({ role: 'user', content: msg });
    localStorage.setItem('wl_advisor_history', JSON.stringify(advisorHistory));
    
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: summary }
    ];
    for (const h of advisorHistory) {
        messages.push({ role: h.role, content: h.content });
    }
    
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
                models: [
                    'google/gemini-2.0-flash-exp:free',
                    'mistralai/mistral-7b-instruct:free',
                    'meta-llama/llama-3.2-3b-instruct:free',
                    'qwen/qwen-2-7b-instruct:free',
                    'undi95/toppy-m-7b:free'
                ],
                messages: messages,
                temperature: 0.5,
                max_tokens: 350,
                stop: ['===', 'ДАННЫЕ ТЕРМИНАЛА']
            })
        });
        
        const data = await resp.json();
        
        if (data.error) {
            throw new Error(data.error.message || 'Все модели недоступны. Попробуй позже.');
        }
        
        const reply = data?.choices?.[0]?.message?.content?.trim() || 'Нет ответа.';
        
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        
        const moodEmoji = getOwlMood(reply);
        
        const formatted = reply
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
        
        advisorHistory.push({ role: 'assistant', content: reply, mood: moodEmoji });
        localStorage.setItem('wl_advisor_history', JSON.stringify(advisorHistory));
        
        chat.innerHTML += `<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">${moodEmoji}</span><span style="color:#d4a574;">${formatted}</span></div>`;
    } catch(e) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        chat.innerHTML += `<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">${ERROR_AVATAR}</span><span style="color:#c06060;">Ошибка: ${e.message}</span></div>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

function renderAdvisor() {
    const chat = document.getElementById('advisorChat');
    if (!chat) return;
    if (advisorHistory.length === 0) {
        chat.innerHTML = `<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">🦉</span><span style="color:#d4a574;">Я вижу твой рынок, склад и цели. Спроси что делать — дам конкретный совет.</span></div>`;
        return;
    }
    chat.innerHTML = advisorHistory.map(m => {
        if (m.role === 'user') {
            return `<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">${USER_AVATAR}</span><span style="color:#ccc;">${m.content}</span></div>`;
        }
        const mood = m.mood || '🦉';
        const text = (m.content || '')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
        return `<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">${mood}</span><span style="color:#d4a574;">${text}</span></div>`;
    }).join('');
    chat.scrollTop = chat.scrollHeight;
                                      }
