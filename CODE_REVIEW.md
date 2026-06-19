# Code review: AsystWebApp

Дата ревью: 2026-06-19

## Общая оценка

Проект хороший для PWA без зависимостей: понятная структура, IndexedDB, офлайн-режим, импорт/экспорт, режим просмотра и работа над ошибками. В исходной версии были runtime-баги, небезопасный рендеринг пользовательских данных через `innerHTML`, неполная PWA-настройка для GitHub Pages и отсутствие тестов для парсера. Основная часть этих замечаний уже исправлена в рабочей копии.

## Критичные проблемы

1. **Dino game падает при проверке столкновений**
   - Файл: `dino.js:190-191`
   - Используется `dinoX`, но переменная нигде не объявлена. При первом препятствии будет `ReferenceError`.
   - Быстрый фикс: добавить `const DINO_X = 50;` и использовать его в `drawDino()` и collision-check.

2. **XSS/HTML injection через названия файлов/тестов**
   - Файл: `app.js:217-233`
   - `test.name` вставляется в `innerHTML` и inline `onclick`. Имя `.txt` файла контролирует пользователь; можно сломать HTML или выполнить JS.
   - Фикс: собирать карточки через `document.createElement`, `textContent`, `addEventListener`; не использовать inline handlers.

3. **Service Worker не подходит для GitHub Pages / подпапки репозитория**
   - Файлы: `app.js:473`, `sw.js:2-8`
   - `navigator.serviceWorker.register('/sw.js')` и ассеты `'/index.html'` указывают на корень домена. Для `https://user.github.io/AsystWebApp/` это будет неправильный путь.
   - Фикс: `navigator.serviceWorker.register('./sw.js')`, ассеты сделать относительными: `'./', './index.html', './styles.css', ...`.

4. **Офлайн-кэш неполный**
   - Файл: `sw.js:2-8`
   - В кэш не добавлен `dino.js`. Если Dino открыт офлайн после установки — скрипта может не быть.
   - Если default tests должны работать офлайн, папку `Tests/` и файлы тоже надо кэшировать или убрать автозагрузку.

5. **В репозитории нет папки `Tests/`, но код пытается загрузить default tests**
   - Файл: `app.js:30-59`
   - При пустой базе будет серия 404/ошибок в консоли. Пользователь увидит пустой каталог.
   - Решить: добавить `Tests/` в репозиторий, либо удалить `DEFAULT_TESTS`, либо сделать явную настройку/сообщение.

## Баги логики

6. **`totalTaken` становится `NaN`**
   - Файл: `app.js:403`
   - В объектах теста поле `totalTaken` не инициализируется (`app.js:65-73`, `app.js:187-195`). `undefined++` даст `NaN`.
   - Фикс: при создании ставить `totalTaken: 0`, а при завершении: `currentQuiz.totalTaken = (currentQuiz.totalTaken || 0) + 1`.

7. **Кнопка темы есть, но переключатель не реализован**
   - Файлы: `index.html:24`, `app.js:99`
   - `themeToggle` объявлен, но не используется. README обещает темную тему.
   - Фикс: добавить обработчик, сохранять тему в `localStorage`, учитывать `prefers-color-scheme`.

8. **Прогресс просмотра делится на `questions.length - 1`**
   - Файл: `app.js:218`
   - Для теста из одного вопроса будет деление на 0. Кроме того, вопрос 1 отображается как 0%.
   - Лучше: `Math.round(((lastIndexView + 1) / questions.length) * 100)`.

9. **В исходной версии вопрос без правильного ответа мог уронить экзамен**
   - В реальных тестах могут встречаться вопросы без отмеченного правильного варианта (`+`), поэтому их не нужно удалять.
   - Исправлено: такие вопросы остаются в базе и отображаются, а обработчик ответа больше не падает, если правильный вариант не отмечен.

10. **High score некорректен при разном количестве вопросов**
    - Файлы: `app.js:317`, `app.js:397-403`
    - Сейчас сравнивается абсолютный score. 10/10 лучше, чем 15/30, но код считает наоборот.
    - Фикс: хранить `score`, `total`, `percent`, `date`; рекорд сравнивать по проценту, затем по количеству.

11. **Количество вопросов в экзамене не ограничивается явно**
    - Файл: `app.js:317-320`
    - Можно ввести отрицательное число или слишком большое. Браузерный `min` не защита.
    - Фикс: `const selectedCount = Math.min(total, Math.max(1, Number.parseInt(value, 10) || total));`.

12. **Импорт JSON почти не валидируется**
    - Файл: `app.js:123-132`
    - Любой массив объектов записывается в IndexedDB. Если структура неправильная, приложение может падать.
    - Фикс: проверять `name`, `questions`, `options`, `isCorrect`, массивы `failedIds` и т.д.

## PWA/UX улучшения

- Добавить `self.skipWaiting()` в install и `clients.claim()` в activate, чтобы обновления SW применялись понятнее.
- Добавить fallback в `fetch`: если сеть недоступна и ресурса нет в кэше — отдавать `index.html` для navigation-запросов.
- Добавить PNG-иконки 192/512. SVG в manifest поддерживается не везде одинаково, особенно для install prompt/maskable icon.
- Добавить `aria-label` для emoji-кнопок: экспорт, импорт, тема, dino, удалить.
- Убрать `maximum-scale=1.0, user-scalable=no` из viewport: это ухудшает доступность.
- Добавить состояние загрузки при импорте больших `.txt` и при автозагрузке default tests.

## Архитектура

Сейчас `app.js` — один файл на 475 строк со смешанными слоями: IndexedDB, parser, UI, state, quiz logic. Лучше разделить без фреймворков:

```text
src/
  db.js          // IndexedDB wrapper
  parser.js      // parseTestContent + validation
  catalog.js     // catalog render/events
  quiz.js        // exam/mistakes logic
  view.js        // learning mode
  theme.js       // theme persistence
  sw-register.js
```

Даже если оставить один файл, стоит убрать глобальные `window.deleteTest/openModeSelection` и inline `onclick`.

## Что уже исправлено в рабочей копии

1. Починен `dinoX` в `dino.js`.
2. Починен счетчик `totalTaken`.
3. Реализован переключатель светлой/темной темы с сохранением в `localStorage`.
4. Каталог переведен с опасного `innerHTML` на безопасный DOM-render через `textContent` и `addEventListener`.
5. Исправлены пути Service Worker для GitHub Pages/подпапки проекта.
6. В offline cache добавлен `dino.js`.
7. Добавлена базовая валидация импорта JSON.
8. Парсер сохраняет и показывает вопросы без отмеченного правильного ответа.
9. Исправлен расчет прогресса просмотра для тестов из одного вопроса.
10. Добавлен `bestPercent`/`lastResult` для более корректной статистики.
11. Добавлен `package.json` со скриптами `check`, `test`, `validate`.
12. Добавлены базовые Node.js-тесты парсера: `tests/parser.test.js`.
13. Убрано сохранение временного поля `activeQuestions` в IndexedDB.

## Что еще можно улучшить дальше

1. Разделить `app.js` на модули: `db`, `parser`, `catalog`, `quiz`, `view`, `theme`.
3. Добавить PNG-иконки 192/512 для лучшей совместимости PWA.
4. Решить судьбу папки `Tests/`: либо добавить файлы, либо убрать автозагрузку default tests.
5. Добавить экран/тост с подробными ошибками парсинга файла.

## Быстрые патчи-кандидаты

```js
// app.js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

currentQuiz.totalTaken = (currentQuiz.totalTaken || 0) + 1;
```

```js
// dino.js
const DINO_X = 50;
// collision: DINO_X + p ...
// drawDino: const x = DINO_X;
```

```js
// selected count
const totalQuestions = currentQuiz.questions.length;
const rawCount = Number.parseInt(document.getElementById('exam-q-count').value, 10);
const selectedCount = Math.min(totalQuestions, Math.max(1, rawCount || totalQuestions));
```
