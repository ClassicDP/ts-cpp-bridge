// Временный mock для демонстрации TypeScript API
// В реальном проекте этот файл будет создан компиляцией C++ addon

const mockAddon = {
  Solver_process: (input: any) => {
    return {
      greeting: `Hello, ${input.name}!`,
      doubled: input.value * 2,
      squared: input.numbers.map((n: number) => n * n)
    };
  }
};

export default mockAddon;
