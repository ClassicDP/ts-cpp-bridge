#include <napi.h>
#include <memory>
#include <exception>
#include "generated_structs.hpp"

// External function declarations (implement these in your C++ files)
extern OutputData Solver_process(const InputData& param);
extern TaskResult Solver_processLongTask(const LongTask& param);
extern OutputData Solver_processHeavyComputation(const InputData& param);


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

// AsyncWorker class for Solver_processLongTask
class Solver_processLongTask_AsyncWorker : public Napi::AsyncWorker {
public:
    Solver_processLongTask_AsyncWorker(Napi::Function& callback, const LongTask& input)
        : Napi::AsyncWorker(callback), input_(input) {}
    ~Solver_processLongTask_AsyncWorker() {}

    void Execute() override {
        try {
            result_ = Solver_processLongTask(input_);
        } catch (const std::exception& e) {
            SetError(e.what());
        }
    }

    void OnOK() override {
        Napi::HandleScope scope(Env());
        Callback().Call({Env().Null(), result_.ToNapi(Env())});
    }

private:
    LongTask input_;
    TaskResult result_;
};

Napi::Value Solver_processLongTask_wrapper(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Expected an object").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    LongTask input = LongTask::FromNapi(info[0].As<Napi::Object>());
    
    // Создаем Promise
    auto deferred = Napi::Promise::Deferred::New(env);
    
    // Создаем callback функцию для Promise
    auto callback = Napi::Function::New(env, [deferred](const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (info.Length() > 0 && !info[0].IsNull()) {
            // Ошибка
            deferred.Reject(info[0]);
        } else if (info.Length() > 1) {
            // Успех
            deferred.Resolve(info[1]);
        } else {
            deferred.Reject(Napi::Error::New(env, "Invalid callback arguments").Value());
        }
        return env.Undefined();
    });
    
    // Запускаем AsyncWorker
    Solver_processLongTask_AsyncWorker* worker = new Solver_processLongTask_AsyncWorker(callback, input);
    worker->Queue();
    
    return deferred.Promise();
}

// AsyncWorker class for Solver_processHeavyComputation
class Solver_processHeavyComputation_AsyncWorker : public Napi::AsyncWorker {
public:
    Solver_processHeavyComputation_AsyncWorker(Napi::Function& callback, const InputData& input)
        : Napi::AsyncWorker(callback), input_(input) {}
    ~Solver_processHeavyComputation_AsyncWorker() {}

    void Execute() override {
        try {
            result_ = Solver_processHeavyComputation(input_);
        } catch (const std::exception& e) {
            SetError(e.what());
        }
    }

    void OnOK() override {
        Napi::HandleScope scope(Env());
        Callback().Call({Env().Null(), result_.ToNapi(Env())});
    }

private:
    InputData input_;
    OutputData result_;
};

Napi::Value Solver_processHeavyComputation_wrapper(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Expected an object").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    InputData input = InputData::FromNapi(info[0].As<Napi::Object>());
    
    // Создаем Promise
    auto deferred = Napi::Promise::Deferred::New(env);
    
    // Создаем callback функцию для Promise
    auto callback = Napi::Function::New(env, [deferred](const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (info.Length() > 0 && !info[0].IsNull()) {
            // Ошибка
            deferred.Reject(info[0]);
        } else if (info.Length() > 1) {
            // Успех
            deferred.Resolve(info[1]);
        } else {
            deferred.Reject(Napi::Error::New(env, "Invalid callback arguments").Value());
        }
        return env.Undefined();
    });
    
    // Запускаем AsyncWorker
    Solver_processHeavyComputation_AsyncWorker* worker = new Solver_processHeavyComputation_AsyncWorker(callback, input);
    worker->Queue();
    
    return deferred.Promise();
}


// Module initialization
Napi::Object InitGeneratedAPI(Napi::Env env, Napi::Object exports) {
    exports.Set("Solver_process", Napi::Function::New(env, Solver_process_wrapper));
    exports.Set("Solver_processLongTask", Napi::Function::New(env, Solver_processLongTask_wrapper));
    exports.Set("Solver_processHeavyComputation", Napi::Function::New(env, Solver_processHeavyComputation_wrapper));

    return exports;
}

// Main module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return InitGeneratedAPI(env, exports);
}

NODE_API_MODULE(addon, Init)