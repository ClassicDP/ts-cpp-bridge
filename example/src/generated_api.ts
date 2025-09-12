// Автоматически сгенерированные TypeScript обертки

import addon from './generated_addon';

export interface InputData {
  name: string;
  value: number;
  numbers: number[];
}

export interface OutputData {
  greeting: string;
  doubled: number;
  squared: number[];
}


export class Solver {
  static process(input: InputData): OutputData {
    return addon.Solver_process(input);
  }

}

