/**
 * Assistant Web - Enhanced Edition (Vibration & Mistake Review)
 */

// --- 1. IndexedDB Setup ---
const DB_NAME = 'AssistantDB';
const DB_VERSION = 1;
const STORE_NAME = 'tests';
let db;

const dbRequest = indexedDB.open(DB_NAME, DB_VERSION);
dbRequest.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'name' });
};
dbRequest.onsuccess = e => { db = e.target.result; renderCatalog(); };

// --- 2. State ---
let currentQuiz = { name: '', questions: [], activeQuestions: [] };
let currentQuestionIndex = 0;
let score = 0;
let isAnswered = false;
let currentMode = 'quiz'; // 'quiz', 'view', 'mistakes'
let catalogData = [];

// --- 3. DOM Elements ---
const screens = {
    welcome: document.getElementById('screen-welcome'),
    quiz: document.getElementById('screen-quiz'),
    view: document.getElementById('screen-viewing'),
    results: document.getElementById('screen-results'),
    dino: document.getElementById('screen-dino')
};

// --- 4. Theme, Search & Backup ---
const themeToggle = document.getElementById('theme-toggle');
const exportBtn = document.getElementById('export-db');
const importInput = document.getElementById('import-db-input');

exportBtn.onclick = () => {
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    store.getAll().onsuccess = e => {
        const data = e.target.result;
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `assistant_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
};

importInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm("Внимание! Импорт заменит существующие тесты с такими же названиями. Продолжить?")) return;

    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const importedData = JSON.parse(ev.target.result);
            if (!Array.isArray(importedData)) throw new Error("Неверный формат");

            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            importedData.forEach(test => store.put(test));
            
            tx.oncomplete = () => {
                alert("Данные успешно импортированы!");
                importInput.value = '';
                renderCatalog();
            };
        } catch (err) {
            alert("Ошибка при импорте: файл поврежден или имеет неверный формат.");
        }
    };
    reader.readAsText(file);
};

document.getElementById('catalog-search').oninput = e => {
    const term = e.target.value.toLowerCase();
    renderCatalogUI(catalogData.filter(t => t.name.toLowerCase().includes(term)));
};

// --- 5. Robust Parser ---
function parseTestContent(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const questions = [];
    let currentQ = null;

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('?')) {
            if (currentQ && currentQ.options.length > 0) questions.push(currentQ);
            currentQ = { 
                id: Date.now() + index, 
                questionParts: [trimmed.substring(1).trim()], 
                options: [] 
            };
        } else if (currentQ) {
            if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
                currentQ.options.push({ text: trimmed.substring(1).trim(), isCorrect: trimmed.startsWith('+') });
            } else if (trimmed.length > 0) {
                if (currentQ.options.length === 0) currentQ.questionParts.push(trimmed);
                else currentQ.options.push({ text: trimmed, isCorrect: false });
            }
        }
    });
    if (currentQ && currentQ.options.length > 0) questions.push(currentQ);
    return questions.map(q => ({ id: q.id, question: q.questionParts.join(' ').trim(), options: q.options })).filter(q => q.question !== '');
}

// --- 6. Catalog Logic ---
document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const questions = parseTestContent(ev.target.result);
        if (questions.length > 0) {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({ 
                name: file.name, 
                questions, 
                lastScore: null, 
                highScore: null, 
                lastIndexView: 0,
                failedIds: [], 
                date: Date.now() 
            });
            tx.oncomplete = () => { e.target.value = ''; renderCatalog(); };
        } else alert("Ошибка формата.");
    };
    reader.readAsText(file, 'UTF-8');
});

function renderCatalog() {
    if (!db) return;
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    store.getAll().onsuccess = e => {
        catalogData = e.target.result;
        renderCatalogUI(catalogData);
    };
}

function renderCatalogUI(tests) {
    const container = document.getElementById('tests-catalog');
    if (tests.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="logo">📘</div><p>Нет тестов. Нажмите +</p></div>`;
        return;
    }
    container.innerHTML = tests.map(test => {
        const progress = test.lastIndexView ? Math.round((test.lastIndexView / (test.questions.length - 1)) * 100) : 0;
        const mistakes = test.failedIds ? test.failedIds.length : 0;
        return `
        <div class="test-card">
            <div class="card-top">
                <div class="test-info"><h3>${test.name}</h3><p>${test.questions.length} вопр.</p></div>
                <button class="btn-delete" onclick="deleteTest('${test.name.replace(/'/g, "\\'")}')">🗑️</button>
            </div>
            <div class="card-stats">
                ${test.highScore !== null ? `<span class="stat-tag">🏆 ${test.highScore}</span>` : ''}
                ${progress > 0 ? `<span class="stat-tag">📖 ${progress}%</span>` : ''}
                ${mistakes > 0 ? `<span class="stat-tag" style="background: #FFF3E0; color: #E65100;">🔥 ${mistakes} ош.</span>` : ''}
            </div>
            <button class="btn-run" onclick="openModeSelection('${test.name.replace(/'/g, "\\'")}')">Открыть тест</button>
        </div>
    `}).join('');
}

window.deleteTest = name => {
    if (confirm(`Удалить тест "${name}"?`)) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(name);
        tx.oncomplete = renderCatalog;
    }
};

// --- 7. Mode Selection ---
window.openModeSelection = name => {
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    store.get(name).onsuccess = e => {
        currentQuiz = e.target.result;
        document.getElementById('modal-test-title').innerText = currentQuiz.name;
        
        const mistakesBtn = document.getElementById('mode-mistakes-btn');
        const mistakesCount = currentQuiz.failedIds ? currentQuiz.failedIds.length : 0;
        
        if (mistakesCount > 0) {
            mistakesBtn.classList.remove('hidden');
            document.getElementById('mistakes-count-label').innerText = `${mistakesCount} ошибок для повторения`;
        } else {
            mistakesBtn.classList.add('hidden');
        }

        document.getElementById('modal-mode').classList.remove('hidden');
    };
};

document.getElementById('modal-close-btn').onclick = () => document.getElementById('modal-mode').classList.add('hidden');

document.getElementById('mode-quiz-btn').onclick = () => {
    document.getElementById('modal-mode').classList.add('hidden');
    startQuizMode('quiz');
};

document.getElementById('mode-mistakes-btn').onclick = () => {
    document.getElementById('modal-mode').classList.add('hidden');
    startQuizMode('mistakes');
};

document.getElementById('mode-view-btn').onclick = () => {
    document.getElementById('modal-mode').classList.add('hidden');
    showScreen('view');
};

document.getElementById('dino-game-btn').onclick = () => {
    showScreen('dino');
    if (window.startDinoGame) window.startDinoGame();
};

document.getElementById('dino-back-btn').onclick = () => {
    showScreen('welcome');
};

function showScreen(id) {
    Object.keys(screens).forEach(k => screens[k].classList.toggle('hidden', k !== id));
}

document.querySelectorAll('.back-to-catalog').forEach(b => b.onclick = () => {
    if (screens.quiz.classList.contains('hidden') || confirm("Прервать и вернуться в меню?")) {
        showScreen('welcome');
        renderCatalog();
    }
});

document.getElementById('restartBtn').onclick = () => showScreen('welcome');

// --- 8. Quiz Mode (Standard & Mistakes) ---
function startQuizMode(mode) {
    currentMode = mode;
    currentQuestionIndex = 0;
    score = 0;
    
    if (mode === 'mistakes') {
        const failedQuestions = currentQuiz.questions.filter(q => currentQuiz.failedIds.includes(q.id));
        currentQuiz.activeQuestions = JSON.parse(JSON.stringify(failedQuestions));
    } else {
        const selectedCount = parseInt(document.getElementById('exam-q-count').value) || currentQuiz.questions.length;
        const allQuestions = JSON.parse(JSON.stringify(currentQuiz.questions));
        shuffle(allQuestions);
        currentQuiz.activeQuestions = allQuestions.slice(0, selectedCount);
    }
    
    if (mode !== 'mistakes') shuffle(currentQuiz.activeQuestions);
    showScreen('quiz');
    renderQuizQuestion();
}

function renderQuizQuestion() {
    isAnswered = false;
    document.getElementById('quiz-next-btn').classList.add('hidden');
    document.getElementById('quiz-skip-btn').classList.remove('hidden');
    const q = currentQuiz.activeQuestions[currentQuestionIndex];
    const total = currentQuiz.activeQuestions.length;

    document.getElementById('progress-text').innerText = `${currentMode === 'mistakes' ? '🔥 Ошибки:' : 'Вопрос'} ${currentQuestionIndex + 1} из ${total}`;
    document.getElementById('progress-fill').style.width = `${((currentQuestionIndex + 1) / total) * 100}%`;
    document.getElementById('question-text').innerText = q.question;

    const options = [...q.options];
    shuffle(options);
    document.getElementById('options-container').innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt.text;
        btn.onclick = () => handleAnswer(btn, opt.isCorrect, q.id);
        document.getElementById('options-container').appendChild(btn);
    });
}

function handleAnswer(btn, isCorrect, qId) {
    if (isAnswered) return;
    isAnswered = true;

    if (isCorrect) {
        score++;
        btn.classList.add('correct');
        if (navigator.vibrate) navigator.vibrate(40);
        
        if (currentQuiz.failedIds) {
            currentQuiz.failedIds = currentQuiz.failedIds.filter(id => id !== qId);
        }
    } else {
        btn.classList.add('wrong');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        
        if (!currentQuiz.failedIds) currentQuiz.failedIds = [];
        if (!currentQuiz.failedIds.includes(qId)) currentQuiz.failedIds.push(qId);
        
        const correctText = currentQuiz.activeQuestions[currentQuestionIndex].options.find(o => o.isCorrect).text;
        document.querySelectorAll('#options-container .option-btn').forEach(b => {
            if (b.innerText === correctText) b.classList.add('correct');
        });
    }
    document.getElementById('quiz-next-btn').classList.remove('hidden');
    document.getElementById('quiz-skip-btn').classList.add('hidden');
}

document.getElementById('quiz-next-btn').onclick = () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuiz.activeQuestions.length) renderQuizQuestion();
    else finishQuiz();
};

document.getElementById('quiz-skip-btn').onclick = () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuiz.activeQuestions.length) renderQuizQuestion();
    else finishQuiz();
};

document.getElementById('quiz-finish-btn').onclick = () => { if (confirm("Завершить тест?")) finishQuiz(); };

function finishQuiz() {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    if (currentMode === 'quiz') {
        currentQuiz.lastScore = score;
        if (currentQuiz.highScore === null || score > currentQuiz.highScore) {
            currentQuiz.highScore = score;
            document.getElementById('high-score-msg').innerText = "🎉 Новый рекорд!";
        } else document.getElementById('high-score-msg').innerText = "";
        currentQuiz.totalTaken++;
    } else {
        document.getElementById('high-score-msg').innerText = "💪 Работа над ошибками завершена!";
    }
    
    store.put(currentQuiz);
    tx.oncomplete = () => {
        document.getElementById('score-result').innerText = score;
        document.getElementById('total-questions').innerText = currentQuiz.activeQuestions.length;
        showScreen('results');
        renderCatalog();
    };
}

// --- 9. View Mode ---
function startViewMode() {
    currentMode = 'view';
    if (currentQuiz.lastIndexView > 0) {
        if (confirm(`Продолжить с №${currentQuiz.lastIndexView + 1}?`)) currentQuestionIndex = currentQuiz.lastIndexView;
        else currentQuestionIndex = 0;
    } else currentQuestionIndex = 0;
    showScreen('view');
    renderViewQuestion();
}

function renderViewQuestion() {
    const q = currentQuiz.questions[currentQuestionIndex];
    const total = currentQuiz.questions.length;
    const pct = Math.round(((currentQuestionIndex + 1) / total) * 100);

    document.getElementById('view-status').innerText = `Изучено: ${pct}%`;
    document.getElementById('view-progress-text').innerText = `Вопрос ${currentQuestionIndex + 1} из ${total}`;
    document.getElementById('view-progress-fill').style.width = `${pct}%`;
    document.getElementById('jumpToQuestion').value = currentQuestionIndex + 1;
    document.getElementById('view-question-text').innerText = q.question;

    document.getElementById('view-options-container').innerHTML = '';
    q.options.forEach(opt => {
        const div = document.createElement('div');
        div.className = 'option-btn' + (opt.isCorrect ? ' correct-view' : '');
        div.innerText = opt.text;
        document.getElementById('view-options-container').appendChild(div);
    });

    document.getElementById('prevQuestionBtn').disabled = (currentQuestionIndex === 0);
    document.getElementById('nextQuestionBtn').disabled = (currentQuestionIndex === total - 1);
    
    const tx = db.transaction(STORE_NAME, 'readwrite');
    currentQuiz.lastIndexView = currentQuestionIndex;
    tx.objectStore(STORE_NAME).put(currentQuiz);
}

document.getElementById('prevQuestionBtn').onclick = () => { if (currentQuestionIndex > 0) { currentQuestionIndex--; renderViewQuestion(); } };
document.getElementById('nextQuestionBtn').onclick = () => { if (currentQuestionIndex < currentQuiz.questions.length - 1) { currentQuestionIndex++; renderViewQuestion(); } };

const performJump = () => {
    let val = parseInt(document.getElementById('jumpToQuestion').value) - 1;
    if (val >= 0 && val < currentQuiz.questions.length) { currentQuestionIndex = val; renderViewQuestion(); }
    else document.getElementById('jumpToQuestion').value = currentQuestionIndex + 1;
};
document.getElementById('btn-jump').onclick = performJump;
document.getElementById('jumpToQuestion').onkeydown = e => { if (e.key === 'Enter') performJump(); };

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

