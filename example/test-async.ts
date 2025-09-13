import { Solver } from './src/generated_api';
import { InputData, LongTask } from './src/generated_types';

async function testAsyncFunctions() {
  console.log('🚀 Testing async functions...');

  // Тест обычного синхронного вызова
  const syncInput: InputData = {
    name: 'Sync Test',
    value: 42,
    numbers: [1, 2, 3, 4, 5]
  };

  console.log('📋 Sync call...');
  const syncResult = Solver.process(syncInput);
  console.log('✅ Sync result:', syncResult);

  // Тест асинхронного вызова
  const asyncInput: LongTask = {
    duration: 2000,  // 2 секунды
    data: 'Heavy computation task'
  };

  console.log('⏳ Starting async task...');
  const startTime = Date.now();
  
  try {
    const asyncResult = await Solver.processLongTask(asyncInput);
    const endTime = Date.now();
    
    console.log('✅ Async result:', asyncResult);
    console.log(`⏱️  Total time: ${endTime - startTime}ms`);
  } catch (error) {
    console.error('❌ Async error:', error);
  }

  // Тест нескольких параллельных вызовов
  console.log('🔄 Testing parallel async calls...');
  
  const tasks: LongTask[] = [
    { duration: 1000, data: 'Task 1' },
    { duration: 1500, data: 'Task 2' },
    { duration: 800, data: 'Task 3' }
  ];

  const parallelStart = Date.now();
  
  try {
    const promises = tasks.map(task => Solver.processLongTask(task));
    const results = await Promise.all(promises);
    
    const parallelEnd = Date.now();
    
    console.log('✅ All parallel tasks completed:', results);
    console.log(`⏱️  Parallel execution time: ${parallelEnd - parallelStart}ms`);
    console.log('   (Note: should be ~1.5s, not 3.3s if truly parallel)');
  } catch (error) {
    console.error('❌ Parallel execution error:', error);
  }

  // Тест тяжелых вычислений
  console.log('💪 Testing heavy computation...');
  
  try {
    const heavyResult = await Solver.processHeavyComputation(syncInput);
    console.log('✅ Heavy computation result:', heavyResult);
  } catch (error) {
    console.error('❌ Heavy computation error:', error);
  }
}

// Запуск тестов
testAsyncFunctions().catch(console.error);