{
  "targets": [
    {
      "target_name": "addon",
      "sources": [ 
        "implementation.cpp",
        "src/generated_structs.cpp",
        "src/generated_api.cpp"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "cflags_cc": [ "-std=c++17" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [ "NAPI_CPP_EXCEPTIONS" ],
      "dependencies": [ "<(module_root_dir)/node_modules/node-addon-api/node_api.gyp:nothing" ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15"
          }
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": ["/std:c++17"]
            }
          },
          "defines": [
            "WIN32_LEAN_AND_MEAN",
            "NOMINMAX"
          ]
        }],
        ["OS=='linux'", {
          "cflags_cc": [
            "-std=c++17",
            "-fexceptions"
          ]
        }]
      ]
    }
  ]
}
