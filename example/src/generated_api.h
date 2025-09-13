#pragma once
#include <napi.h>
#include "generated_structs.hpp"

// External function declarations (implement these in addon.cpp)
extern OutputData Solver_process(const InputData& param);
extern TaskResult Solver_processLongTask(const LongTask& param);
extern OutputData Solver_processHeavyComputation(const InputData& param);


// API wrapper initialization
Napi::Object InitGeneratedAPI(Napi::Env env, Napi::Object exports);
