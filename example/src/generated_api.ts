// Сгенерированный API с удобными классами

import { InputData, OutputData, LongTask, TaskResult } from './generated_types';
import addon from './generated_addon';

export class Solver {
  static process(input: InputData): OutputData {
    return addon.Solver_process(input);
  }

  static async processLongTask(input: LongTask): Promise<TaskResult> {
    return addon.Solver_processLongTask(input);
  }

  static async processHeavyComputation(input: InputData): Promise<OutputData> {
    return addon.Solver_processHeavyComputation(input);
  }

}

