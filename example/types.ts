import { CppStruct, CppExport, CppAsync } from 'ts-cpp-bridge';

@CppStruct()
export class InputData {
  name!: string;
  value!: number;
  numbers!: number[];
}

@CppStruct()
export class OutputData {
  greeting!: string;
  doubled!: number;
  squared!: number[];
}

@CppStruct()
export class LongTask {
  duration!: number;  // продолжительность задачи в миллисекундах
  data!: string;
}

@CppStruct()
export class TaskResult {
  message!: string;
  duration!: number;
  timestamp!: number;
}

export class Solver {
  @CppExport()
  static process(input: InputData): OutputData {
    // Эта реализация будет заменена C++ кодом
    throw new Error('This method should be implemented in C++');
  }

  @CppAsync()
  static processLongTask(input: LongTask): TaskResult {
    // Асинхронная реализация будет заменена C++ кодом
    throw new Error('This method should be implemented in C++');
  }

  @CppAsync()
  static processHeavyComputation(input: InputData): OutputData {
    // Тяжелые вычисления в отдельном потоке
    throw new Error('This method should be implemented in C++');
  }
}
