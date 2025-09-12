import { CppStruct, CppExport } from 'ts-cpp-bridge';

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

export class Solver {
  @CppExport()
  static process(input: InputData): OutputData {
    // Эта реализация будет заменена C++ кодом
    throw new Error('This method should be implemented in C++');
  }
}
