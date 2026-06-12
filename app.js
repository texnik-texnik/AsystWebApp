/**
 * Assistant Web - Advanced Persistence & UI Fixes
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
let currentMode = 'quiz';
let catalogData = [];

// --- 3. DOM Elements ---
const screens = {
    welcome: document.getElementById('screen-welcome'),
    quiz: document.getElementById('screen-quiz'),
    view: document.getElementById('screen-viewing'),
    results: document.getElementById('screen-results')
};

// --- 4. Theme & Search ---
const themeToggle = document.getElementById('theme-toggle');
if (localStorage.getItem('theme') === 'dark') document.body.classList.replace('light-theme', 'dark-theme');

themeToggle.onclick = () => {
    const isDark = document.body.classList.contains('dark-theme');
    document.body.classList.toggle('dark-theme', !isDark);
    document.body.classList.toggle('light-theme', isDark);
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
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

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('?')) {
            if (currentQ && currentQ.options.length > 0) questions.push(currentQ);
            currentQ = { questionParts: [trimmed.substring(1).trim()], options: [] };
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
    return questions.map(q => ({ question: q.questionParts.join(' ').trim(), options: q.options })).filter(q => q.question !== '');
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
                lastIndexQuiz: 0,
                lastIndexView: 0,
                totalTaken: 0, 
                date: Date.now() 
            });
            tx.oncomplete = () => { e.target.value = ''; renderCatalog(); };
        } else alert("Ошибка: Неверный формат файла.");
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
        container.innerHTML = `<div class="empty-state"><div class="logo">${document.getElementById('catalog-search').value ? '🔍' : '📘'}</div><p>${document.getElementById('catalog-search').value ? 'Ничего не найдено' : 'Нет тестов. Нажмите +'}</p></div>`;
        return;
    }
    container.innerHTML = tests.map(test => {
        const progress = test.lastIndexView ? Math.round((test.lastIndexView / (test.questions.length - 1)) * 100) : 0;
        return `
        <div class="test-card">
            <div class="card-top">
                <div class="test-info"><h3>${test.name}</h3><p>${test.questions.length} вопр.</p></div>
                <button class="btn-delete" onclick="deleteTest('${test.name.replace(/'/g, "\\'")}')">🗑️</button>
            </div>
            <div class="card-stats">
                ${test.highScore !== null ? `<span class="stat-tag">🏆 ${test.highScore}</span>` : ''}
                ${progress > 0 ? `<span class="stat-tag">📖 ${progress}%</span>` : ''}
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

// --- 7. Mode & Navigation ---
window.openModeSelection = name => {
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    store.get(name).onsuccess = e => {
        currentQuiz = e.target.result;
        document.getElementById('modal-test-title').innerText = currentQuiz.name;
        document.getElementById('test-stats-brief').innerText = currentQuiz.highScore !== null ? `Рекорд: ${currentQuiz.highScore} из ${currentQuiz.questions.length}` : 'Вы еще не проходили этот тест';
        document.getElementById('modal-mode').classList.remove('hidden');
    };
};

document.getElementById('modal-close-btn').onclick = () => document.getElementById('modal-mode').classList.add('hidden');

document.getElementById('mode-quiz-btn').onclick = () => {
    document.getElementById('modal-mode').classList.add('hidden');
    startQuizMode();
};

document.getElementById('mode-view-btn').onclick = () => {
    document.getElementById('modal-mode').classList.add('hidden');
    startViewMode();
};

function showScreen(id) {
    Object.keys(screens).forEach(k => screens[k].classList.toggle('hidden', k !== id));
}

document.querySelectorAll('.back-to-catalog').forEach(b => b.onclick = () => {
    if (screens.quiz.classList.contains('hidden') || confirm("Прервать тест и вернуться в меню?")) {
        showScreen('welcome');
        renderCatalog();
    }
});

document.getElementById('restartBtn').onclick = () => showScreen('welcome');

// --- 8. Quiz Mode ---
function startQuizMode() {
    currentMode = 'quiz';
    currentQuestionIndex = 0;
    score = 0;
    currentQuiz.activeQuestions = JSON.parse(JSON.stringify(currentQuiz.questions));
    shuffle(currentQuiz.activeQuestions);
    showScreen('quiz');
    renderQuizQuestion();
}

function renderQuizQuestion() {
    isAnswered = false;
    document.getElementById('quiz-next-btn').classList.add('hidden');
    document.getElementById('quiz-skip-btn').classList.remove('hidden');
    const q = currentQuiz.activeQuestions[currentQuestionIndex];
    const total = currentQuiz.activeQuestions.length;

    document.getElementById('progress-text').innerText = `Вопрос ${currentQuestionIndex + 1} из ${total}`;
    document.getElementById('progress-fill').style.width = `${((currentQuestionIndex + 1) / total) * 100}%`;
    document.getElementById('question-text').innerText = q.question;

    const options = [...q.options];
    shuffle(options);
    document.getElementById('options-container').innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt.text;
        btn.onclick = () => {
            if (isAnswered) return;
            isAnswered = true;
            if (opt.isCorrect) { score++; btn.classList.add('correct'); }
            else {
                btn.classList.add('wrong');
                const correctText = currentQuiz.activeQuestions[currentQuestionIndex].options.find(o => o.isCorrect).text;
                document.querySelectorAll('#options-container .option-btn').forEach(b => {
                    if (b.innerText === correctText) b.classList.add('correct');
                });
            }
            document.getElementById('quiz-next-btn').classList.remove('hidden');
            document.getElementById('quiz-skip-btn').classList.add('hidden');
        };
        document.getElementById('options-container').appendChild(btn);
    });
}

document.getElementById('quiz-next-btn').onclick = () => nextStep();
document.getElementById('quiz-skip-btn').onclick = () => nextStep();
document.getElementById('quiz-finish-btn').onclick = () => { if (confirm("Завершить тест и показать результат?")) finishQuiz(); };

function nextStep() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuiz.activeQuestions.length) renderQuizQuestion();
    else finishQuiz();
}

function finishQuiz() {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    currentQuiz.lastScore = score;
    if (currentQuiz.highScore === null || score > currentQuiz.highScore) {
        currentQuiz.highScore = score;
        document.getElementById('high-score-msg').innerText = "🎉 Новый рекорд!";
    } else document.getElementById('high-score-msg').innerText = "";
    currentQuiz.totalTaken++;
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
    // Проверка сохраненного прогресса
    if (currentQuiz.lastIndexView > 0) {
        if (confirm(`Продолжить с вопроса №${currentQuiz.lastIndexView + 1}?`)) {
            currentQuestionIndex = currentQuiz.lastIndexView;
        } else {
            currentQuestionIndex = 0;
        }
    } else {
        currentQuestionIndex = 0;
    }
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

    // Сохранение прогресса просмотра в БД
    saveViewProgress();
}

function saveViewProgress() {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    currentQuiz.lastIndexView = currentQuestionIndex;
    store.put(currentQuiz);
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

// --- Helpers ---
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
