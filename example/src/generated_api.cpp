#include <napi.h>
#include "generated_structs.hpp"

// External function declarations (implement these in your C++ files)
extern OutputData Solver_process(const InputData& param);


// N-API wrapper functions

Napi::Value Solver_process_wrapper(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Expected an object").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    InputData input = InputData::FromNapi(info[0].As<Napi::Object>());
    OutputData result = Solver_process(input);
    return result.ToNapi(env);
}


// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("Solver_process", Napi::Function::New(env, Solver_process_wrapper));

    return exports;
}

NODE_API_MODULE(addon, Init)
