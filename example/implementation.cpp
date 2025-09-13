#include "src/generated_structs.hpp"
#include <thread>
#include <chrono>
#include <ctime>
#include <sstream>

// TODO: Реализуйте эти функции:
// OutputData Solver_process(const InputData& param);
// TaskResult Solver_processLongTask(const LongTask& param);
// OutputData Solver_processHeavyComputation(const InputData& param);


// Пример реализации:

OutputData Solver_process(const InputData& input) {
    OutputData result;
    
    // Создаем приветствие
    result.greeting = "Hello, " + input.name + "!";
    
    // Удваиваем значение
    result.doubled = input.value * 2;
    
    // Возводим числа в квадрат
    for (int num : input.numbers) {
        result.squared.push_back(num * num);
    }
    
    return result;
}

TaskResult Solver_processLongTask(const LongTask& input) {
    TaskResult result;
    
    // Получаем текущее время в начале
    auto start = std::chrono::high_resolution_clock::now();
    
    // Симулируем долгую задачу
    std::this_thread::sleep_for(std::chrono::milliseconds(static_cast<int>(input.duration)));
    
    // Получаем время окончания
    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);
    
    // Формируем результат
    std::ostringstream ss;
    ss << "Completed task: " << input.data << " (took " << duration.count() << "ms)";
    result.message = ss.str();
    result.duration = duration.count();
    
    // Используем timestamp в миллисекундах с эпохи Unix
    auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
    result.timestamp = timestamp;
    
    return result;
}

OutputData Solver_processHeavyComputation(const InputData& input) {
    OutputData result;
    
    // Симулируем тяжелые вычисления
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    
    // Создаем приветствие с дополнительной информацией
    result.greeting = "Heavy computation for " + input.name + " completed!";
    
    // Применяем более сложную формулу
    result.doubled = input.value * input.value + input.value;
    
    // Применяем сложную операцию к массиву
    for (size_t i = 0; i < input.numbers.size(); i++) {
        int num = input.numbers[i];
        // Фибоначчи-подобная операция для демонстрации
        int heavy_result = num;
        for (int j = 0; j < 1000; j++) {
            heavy_result = (heavy_result * 2 + 1) % 10000;
        }
        result.squared.push_back(heavy_result);
    }
    
    return result;
}

