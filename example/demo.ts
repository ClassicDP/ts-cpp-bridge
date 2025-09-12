import { Solver, InputData, OutputData } from './src/generated_api';

// Демонстрация типобезопасного API
console.log('🚀 Демонстрация типобезопасного TypeScript API для C++ addon');

// Создаем данные с полной типизацией
const input: InputData = {
  name: 'Alice',
  value: 7,
  numbers: [1, 2, 3, 4, 5]
};

console.log('\n📤 Входные данные:');
console.log(JSON.stringify(input, null, 2));

// Вызываем C++ функцию через типобезопасный wrapper
// Пользователь использует чистый TypeScript API: Solver.process()
// Внутри генерированного кода происходит вызов addon.Solver_process()
try {
  const result: OutputData = Solver.process(input);
  
  console.log('\n📤 Результат обработки:');
  console.log(JSON.stringify(result, null, 2));
  
  console.log('\n✅ Успешно! API скрывает детали вызова addon и обеспечивает типобезопасность.');
} catch (error: any) {
  console.log('\n⚠️  Addon еще не скомпилирован. Для тестирования реального вызова:');
  console.log('1. Скомпилируйте C++ код: npm run build');
  console.log('2. Запустите: node demo.js');
  console.log('\nОшибка:', error.message);
}

// Демонстрация типобезопасности
console.log('\n🔒 Типобезопасность обеспечена:');
console.log('- input.name имеет тип string');
console.log('- input.value имеет тип number');  
console.log('- input.numbers имеет тип number[]');
console.log('- Solver.process() возвращает OutputData');
console.log('- Вызов addon скрыт от пользователя');
