/**
 * Ассистент - Enhanced Edition (Vibration & Mistake Review)
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
dbRequest.onsuccess = e => { 
    db = e.target.result; 
    loadDefaultTests().then(() => renderCatalog());
};

// --- 2. State ---
let currentQuiz = { name: '', questions: [], activeQuestions: [] };
let currentQuestionIndex = 0;
let score = 0;
let isAnswered = false;
let currentMode = 'quiz'; // 'quiz', 'view', 'mistakes'
let catalogData = [];

// --- 3. Default Tests ---
const DEFAULT_TESTS = [
    'Анатомияи одам - 200 руси.txt',
    'Гистология руси.txt',
    'гостест стом 5000 ха.txt',
    'детс стом 600.txt',
    'материал 200.txt',
    'Ортодонтия 600.txt',
    'ортопед 600.txt',
    'проп ортопед 200.txt',
    'проп терап 200.txt',
    'терстом 600.txt',
    'Физиология нормали руси.txt',
    'хирург проп 200.txt',
    'хирургия 600.txt',
    'хирургия детс 600.txt'
];

async function loadDefaultTests() {
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const countRequest = store.count();

        countRequest.onsuccess = async () => {
            if (countRequest.result === 0) {
                console.log("Initializing default tests...");
                for (const fileName of DEFAULT_TESTS) {
                    try {
                        const response = await fetch(`Tests/${encodeURIComponent(fileName)}`);
                        if (!response.ok) {
                            if (response.status !== 404) throw new Error(`HTTP error! status: ${response.status}`);
                            continue;
                        }
                        const text = await response.text();
                        const questions = parseTestContent(text);
                        if (questions.length > 0) {
                            await new Promise((resolvePut, rejectPut) => {
                                const writeTx = db.transaction(STORE_NAME, 'readwrite');
                                writeTx.objectStore(STORE_NAME).put(createTestRecord(fileName, questions));
                                writeTx.oncomplete = resolvePut;
                                writeTx.onerror = rejectPut;
                            });
                        }
                    } catch (err) {
                        console.error(`Failed to load default test: ${fileName}`, err);
                    }
                }
            }
            resolve();
        };
        countRequest.onerror = () => resolve();
    });
}

// --- 4. DOM Elements ---
const screens = {
    welcome: document.getElementById('screen-welcome'),
    quiz: document.getElementById('screen-quiz'),
    view: document.getElementById('screen-viewing'),
    results: document.getElementById('screen-results'),
    dino: document.getElementById('screen-dino')
};

// --- 5. Theme, Search & Backup ---
const themeToggle = document.getElementById('theme-toggle');
const exportBtn = document.getElementById('export-db');
const importInput = document.getElementById('import-db-input');

function applyTheme(theme) {
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
    document.body.classList.toggle('dark-theme', normalizedTheme === 'dark');
    document.body.classList.toggle('light-theme', normalizedTheme !== 'dark');
    localStorage.setItem('assistantTheme', normalizedTheme);
    themeToggle?.setAttribute('aria-pressed', String(normalizedTheme === 'dark'));
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
        'content',
        normalizedTheme === 'dark' ? '#121212' : '#2196F3'
    );
}

const savedTheme = localStorage.getItem('assistantTheme');
const preferredTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
applyTheme(savedTheme || preferredTheme);

themeToggle.onclick = () => {
    applyTheme(document.body.classList.contains('dark-theme') ? 'light' : 'dark');
};

exportBtn.onclick = () => {
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    store.getAll().onsuccess = e => {
        const data = e.target.result;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `assistent_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    };
};

importInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm("Внимание! Импорт заменит существующие тесты с такими же названиями. Продолжить?")) {
        importInput.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const importedData = JSON.parse(ev.target.result);
            if (!Array.isArray(importedData)) throw new Error("Неверный формат");

            const normalizedTests = importedData.map(normalizeImportedTest);

            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            normalizedTests.forEach(test => store.put(test));
            
            tx.oncomplete = () => {
                alert("Данные успешно импортированы!");
                importInput.value = '';
                renderCatalog();
            };
            tx.onerror = () => alert("Ошибка записи в базу данных.");
        } catch (err) {
            importInput.value = "";
            alert("Ошибка при импорте: файл поврежден или имеет неверный формат.");
        }
    };
    reader.readAsText(file);
};

document.getElementById('catalog-search').oninput = e => {
    const term = e.target.value.toLowerCase();
    renderCatalogUI(catalogData.filter(t => t.name.toLowerCase().includes(term)));
};

function createTestRecord(name, questions) {
    return {
        name,
        questions,
        lastScore: null,
        highScore: null,
        bestPercent: null,
        lastResult: null,
        lastIndexView: 0,
        failedIds: [],
        totalTaken: 0,
        date: Date.now()
    };
}

function getPersistableTest(test) {
    const questionCount = Array.isArray(test.questions) ? test.questions.length : 0;
    const lastIndexView = Math.min(
        Math.max(Number.parseInt(test.lastIndexView, 10) || 0, 0),
        Math.max(questionCount - 1, 0)
    );

    return {
        name: test.name,
        questions: Array.isArray(test.questions) ? test.questions : [],
        lastScore: Number.isFinite(Number(test.lastScore)) ? Number(test.lastScore) : null,
        highScore: Number.isFinite(Number(test.highScore)) ? Number(test.highScore) : null,
        bestPercent: Number.isFinite(Number(test.bestPercent)) ? Number(test.bestPercent) : null,
        lastResult: test.lastResult || null,
        lastIndexView,
        failedIds: Array.isArray(test.failedIds) ? test.failedIds : [],
        totalTaken: Number.parseInt(test.totalTaken, 10) || 0,
        date: Number.isFinite(Number(test.date)) ? Number(test.date) : Date.now()
    };
}

function normalizeImportedTest(test) {
    if (!test || typeof test.name !== 'string' || !Array.isArray(test.questions)) {
        throw new Error('Неверная структура теста');
    }

    const name = test.name.trim();
    if (!name) throw new Error('Название теста не может быть пустым');

    const questions = test.questions
        .map((q, index) => ({
            id: Number.isFinite(Number(q.id)) ? Number(q.id) : Date.now() + index,
            question: String(q.question || '').trim(),
            options: Array.isArray(q.options) ? q.options
                .map(opt => ({ text: String(opt.text || '').trim(), isCorrect: Boolean(opt.isCorrect) }))
                .filter(opt => opt.text.length > 0) : []
        }))
        .filter(q => q.question && q.options.length > 0);

    if (questions.length === 0) throw new Error('В тесте нет валидных вопросов');

    const questionIds = new Set(questions.map(q => q.id));
    const failedIds = Array.isArray(test.failedIds)
        ? test.failedIds.map(Number).filter(id => questionIds.has(id))
        : [];

    return {
        name,
        questions,
        lastScore: Number.isFinite(Number(test.lastScore)) ? Number(test.lastScore) : null,
        highScore: Number.isFinite(Number(test.highScore)) ? Number(test.highScore) : null,
        bestPercent: Number.isFinite(Number(test.bestPercent)) ? Number(test.bestPercent) : null,
        lastResult: test.lastResult || null,
        lastIndexView: Math.min(Math.max(Number.parseInt(test.lastIndexView, 10) || 0, 0), questions.length - 1),
        failedIds,
        totalTaken: Number.parseInt(test.totalTaken, 10) || 0,
        date: Number.isFinite(Number(test.date)) ? Number(test.date) : Date.now()
    };
}

// --- 6. Robust Parser ---
function parseTestContent(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const questions = [];
    let currentQ = null;

    const pushQuestion = () => {
        if (!currentQ) return;
        const options = currentQ.options.filter(opt => opt.text.length > 0);
        if (currentQ.questionParts.join(' ').trim() && options.length > 0) {
            questions.push({ ...currentQ, options });
        }
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('?')) {
            pushQuestion();
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
    pushQuestion();

    return questions.map(q => ({
        id: q.id,
        question: q.questionParts.join(' ').trim(),
        options: q.options
    }));
}

// --- 7. Catalog Logic ---
document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const questions = parseTestContent(ev.target.result);
        if (questions.length > 0) {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(createTestRecord(file.name, questions));
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
    container.replaceChildren();

    if (tests.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        const logo = document.createElement('div');
        logo.className = 'logo';
        logo.textContent = '📘';
        const text = document.createElement('p');
        text.textContent = 'Нет тестов. Нажмите +';
        empty.append(logo, text);
        container.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();

    tests.forEach(test => {
        const totalQuestions = Array.isArray(test.questions) ? test.questions.length : 0;
        const progress = totalQuestions > 0
            ? Math.min(100, Math.round((((test.lastIndexView || 0) + 1) / totalQuestions) * 100))
            : 0;
        const mistakes = Array.isArray(test.failedIds) ? test.failedIds.length : 0;

        const card = document.createElement('div');
        card.className = 'test-card';

        const cardTop = document.createElement('div');
        cardTop.className = 'card-top';

        const info = document.createElement('div');
        info.className = 'test-info';
        const title = document.createElement('h3');
        title.textContent = test.name;
        const count = document.createElement('p');
        count.textContent = `${totalQuestions} вопр.`;
        info.append(title, count);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.type = 'button';
        deleteBtn.textContent = '🗑️';
        deleteBtn.setAttribute('aria-label', `Удалить тест ${test.name}`);
        deleteBtn.addEventListener('click', () => deleteTest(test.name));

        cardTop.append(info, deleteBtn);

        const stats = document.createElement('div');
        stats.className = 'card-stats';

        if (test.bestPercent !== null && test.bestPercent !== undefined) {
            const tag = document.createElement('span');
            tag.className = 'stat-tag';
            tag.textContent = `🏆 ${test.bestPercent}%`;
            stats.appendChild(tag);
        } else if (test.highScore !== null && test.highScore !== undefined) {
            const tag = document.createElement('span');
            tag.className = 'stat-tag';
            tag.textContent = `🏆 ${test.highScore}`;
            stats.appendChild(tag);
        }

        if (progress > 0) {
            const tag = document.createElement('span');
            tag.className = 'stat-tag';
            tag.textContent = `📖 ${progress}%`;
            stats.appendChild(tag);
        }

        if (mistakes > 0) {
            const tag = document.createElement('span');
            tag.className = 'stat-tag stat-tag-mistakes';
            tag.textContent = `🔥 ${mistakes} ош.`;
            stats.appendChild(tag);
        }

        const runBtn = document.createElement('button');
        runBtn.className = 'btn-run';
        runBtn.type = 'button';
        runBtn.textContent = 'Открыть тест';
        runBtn.addEventListener('click', () => openModeSelection(test.name));

        card.append(cardTop, stats, runBtn);
        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}


function deleteTest(name) {
    if (confirm(`Удалить тест "${name}"?`)) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(name);
        tx.oncomplete = renderCatalog;
    }
}

// --- 8. Mode Selection ---
function openModeSelection(name) {
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    store.get(name).onsuccess = e => {
        currentQuiz = e.target.result;
        document.getElementById('modal-test-title').innerText = currentQuiz.name;

        const examCountInput = document.getElementById('exam-q-count');
        examCountInput.max = currentQuiz.questions.length;
        examCountInput.value = Math.min(20, currentQuiz.questions.length);

        const best = currentQuiz.bestPercent !== null && currentQuiz.bestPercent !== undefined
            ? `Лучший результат: ${currentQuiz.bestPercent}%`
            : (currentQuiz.highScore !== null && currentQuiz.highScore !== undefined ? `Рекорд: ${currentQuiz.highScore}` : 'Рекорда пока нет');
        document.getElementById('test-stats-brief').innerText = `${currentQuiz.questions.length} вопросов · ${best}`;
        
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
}

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
    startQuizMode('view');
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

// --- 9. Quiz Mode (Standard & Mistakes) ---
function startQuizMode(mode) {
    currentMode = mode;
    currentQuestionIndex = 0;
    score = 0;
    
    if (mode === 'mistakes') {
        const failedIds = Array.isArray(currentQuiz.failedIds) ? currentQuiz.failedIds : [];
        const failedQuestions = currentQuiz.questions.filter(q => failedIds.includes(q.id));
        if (failedQuestions.length === 0) {
            alert('Ошибок для повторения пока нет.');
            return;
        }
        currentQuiz.activeQuestions = JSON.parse(JSON.stringify(failedQuestions));
    } else if (mode === 'view') {
        startViewMode();
        return;
    } else {
        const totalQuestions = currentQuiz.questions.length;
        const rawCount = Number.parseInt(document.getElementById('exam-q-count').value, 10);
        const selectedCount = Math.min(totalQuestions, Math.max(1, rawCount || totalQuestions));
        const allQuestions = JSON.parse(JSON.stringify(currentQuiz.questions));
        shuffle(allQuestions);
        currentQuiz.activeQuestions = allQuestions.slice(0, selectedCount);
    }
    
    if (mode !== 'mistakes' && mode !== 'view') shuffle(currentQuiz.activeQuestions);
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
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.replaceChildren();
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt.text;
        btn.onclick = () => handleAnswer(btn, opt.isCorrect, q.id);
        optionsContainer.appendChild(btn);
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
        const correctOption = currentQuiz.activeQuestions[currentQuestionIndex].options.find(o => o.isCorrect);

        if (!correctOption) {
            btn.classList.add('no-correct');
            if (navigator.vibrate) navigator.vibrate(40);
        } else {
            btn.classList.add('wrong');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

            if (!currentQuiz.failedIds) currentQuiz.failedIds = [];
            if (!currentQuiz.failedIds.includes(qId)) currentQuiz.failedIds.push(qId);

            document.querySelectorAll('#options-container .option-btn').forEach(b => {
                if (b.textContent === correctOption.text) b.classList.add('correct');
            });
        }
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
        const total = currentQuiz.activeQuestions.length || 1;
        const percent = Math.round((score / total) * 100);
        currentQuiz.lastScore = score;
        currentQuiz.lastResult = { score, total, percent, date: Date.now() };
        const isBestResult = currentQuiz.bestPercent === null
            || currentQuiz.bestPercent === undefined
            || percent > currentQuiz.bestPercent
            || (percent === currentQuiz.bestPercent && score > (currentQuiz.highScore || 0));

        if (isBestResult) {
            currentQuiz.bestPercent = percent;
            currentQuiz.highScore = score;
            document.getElementById('high-score-msg').innerText = "🎉 Новый рекорд!";
        } else document.getElementById('high-score-msg').innerText = "";
        currentQuiz.totalTaken = (currentQuiz.totalTaken || 0) + 1;
    } else {
        document.getElementById('high-score-msg').innerText = "💪 Работа над ошибками завершена!";
    }
    
    store.put(getPersistableTest(currentQuiz));
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

    const viewOptionsContainer = document.getElementById('view-options-container');
    viewOptionsContainer.replaceChildren();
    q.options.forEach(opt => {
        const div = document.createElement('div');
        div.className = 'option-btn' + (opt.isCorrect ? ' correct-view' : '');
        div.textContent = opt.text;
        viewOptionsContainer.appendChild(div);
    });

    document.getElementById('prevQuestionBtn').disabled = (currentQuestionIndex === 0);
    document.getElementById('nextQuestionBtn').disabled = (currentQuestionIndex === total - 1);
    
    const tx = db.transaction(STORE_NAME, 'readwrite');
    currentQuiz.lastIndexView = currentQuestionIndex;
    tx.objectStore(STORE_NAME).put(getPersistableTest(currentQuiz));
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

