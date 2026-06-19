const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function extractFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  if (start === -1) throw new Error(`Function ${functionName} not found`);

  const bodyStart = source.indexOf('{', start);
  let depth = 0;

  for (let i = bodyStart; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }

  throw new Error(`Function ${functionName} end not found`);
}

const sandbox = { Date };
vm.createContext(sandbox);
vm.runInContext(`${extractFunction(appSource, 'parseTestContent')}; this.parseTestContent = parseTestContent;`, sandbox);

const { parseTestContent } = sandbox;

{
  const result = parseTestContent(`
? Вопрос 1
продолжение вопроса
+ Правильный ответ
- Неправильный ответ

? Вопрос 2
- Неверно
+ Верно
`);

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].question, 'Вопрос 1 продолжение вопроса');
  assert.strictEqual(result[0].options.length, 2);
  assert.strictEqual(result[0].options[0].isCorrect, true);
}

{
  const result = parseTestContent(`
? Без правильного ответа
- Вариант 1
- Вариант 2
`);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].options.length, 2);
  assert.strictEqual(result[0].options.some((option) => option.isCorrect), false);
}

{
  const result = parseTestContent(`
? С неразмеченным вариантом
+ Правильный
Неразмеченный вариант считается неправильным
`);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].options.length, 2);
  assert.strictEqual(result[0].options[1].isCorrect, false);
}

console.log('Parser tests passed');
