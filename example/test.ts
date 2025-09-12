import { Solver, InputData, OutputData } from './src/generated_api';

// Тестовые данные
const input: InputData = {
  name: 'Alice',
  value: 7,
  numbers: [1, 2, 3, 4, 5]
};

console.log('Input:', input);

// Вызываем C++ функцию через сгенерированный типобезопасный wrapper
const result: OutputData = Solver.process(input);

console.log('Result:', result);

// Ожидаемый результат:
// {
//   greeting: 'Hello, Alice!',
//   doubled: 14,
//   squared: [1, 4, 9, 16, 25]
// }
