cmake_minimum_required(VERSION 3.20)
project(OpenSmashMelee LANGUAGES C CXX)
if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "Use the Emscripten toolchain")
endif()
get_filename_component(ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../.." ABSOLUTE)
set(RUNTIME "${ROOT}/build/melee-web/runtime")
set(DOLPHIN "${RUNTIME}/vendor/dolphin")
set(GENERATED "${ROOT}/build/melee4mac/build/native/recomp/private/recompiled/generated" CACHE PATH "Recompiled game C source directory")
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_compile_options(-pthread -msimd128 -fwasm-exceptions)
add_link_options(-pthread -msimd128 -fwasm-exceptions)
set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(ENABLE_GENERIC ON CACHE BOOL "" FORCE)
set(ENABLE_VULKAN OFF CACHE BOOL "" FORCE)
set(ENABLE_X11 OFF CACHE BOOL "" FORCE)
set(ENABLE_WAYLAND OFF CACHE BOOL "" FORCE)
set(ENABLE_EGL OFF CACHE BOOL "" FORCE)
set(USE_SYSTEM_LIBS OFF CACHE STRING "" FORCE)
set(MODERNGEKKO_ENABLE_DYNAMIC_MODULES OFF CACHE BOOL "" FORCE)
if(NOT TARGET moderngekko)
  add_subdirectory("${RUNTIME}" runtime EXCLUDE_FROM_ALL)
endif()
target_include_directories(common PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
target_include_directories(core PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
target_include_directories(audiocommon PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
target_sources(common PRIVATE MemArenaWeb.cpp)
target_sources(core PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/Rollback.cpp")

find_package(Python3 REQUIRED COMPONENTS Interpreter)
set(TABLES "${CMAKE_CURRENT_BINARY_DIR}/module_tables.inc")
add_custom_command(OUTPUT "${TABLES}"
  COMMAND Python3::Interpreter "${DOLPHIN}/module-template/gen_module_tables.py"
    "${GENERATED}/generated.h" "${GENERATED}/generated_smc.txt"
    "${GENERATED}/main.dol" "${TABLES}"
  DEPENDS "${GENERATED}/generated.h" "${GENERATED}/generated_smc.txt"
    "${GENERATED}/main.dol")
file(GLOB CHUNKS CONFIGURE_DEPENDS "${GENERATED}/chunks/*.c")
add_library(melee_game STATIC ${CHUNKS} "${TABLES}"
  "${DOLPHIN}/module-template/module_export.c"
  "${DOLPHIN}/GXRuntime/src/core/cpu.c"
  "${DOLPHIN}/GXRuntime/src/core/cpu_interpreter.c"
  "${DOLPHIN}/GXRuntime/src/core/cpu_interpreter_table.c"
  "${DOLPHIN}/GXRuntime/src/core/cpu_interpreter_float.c"
  "${DOLPHIN}/GXRuntime/src/core/cpu_interpreter_integer.c")
target_include_directories(melee_game PRIVATE "${GENERATED}"
  "${DOLPHIN}/GXRuntime/include" "${DOLPHIN}/Source/Core/Core/PowerPC/StaticRecomp"
  "${CMAKE_CURRENT_BINARY_DIR}")
target_compile_definitions(melee_game PRIVATE MODULE_GAME_ID="GALE01"
  DOLRECOMP_CPU_HEADER="core/cpu.h")
target_compile_options(melee_game PRIVATE -O2 -ffp-contract=off -fno-fast-math)
option(MELEE_GAME_THIN_LTO "Cross-file optimization of the recompiled game and CPU helpers" ON)
if(MELEE_GAME_THIN_LTO)
  target_compile_options(melee_game PRIVATE -flto=thin)
endif()
option(MELEE_EXACT_FMA "Use exact-product fast path for software fused multiply-add" ON)
set_property(SOURCE "${DOLPHIN}/GXRuntime/src/core/cpu_interpreter_float.c"
  APPEND PROPERTY INCLUDE_DIRECTORIES "${CMAKE_CURRENT_SOURCE_DIR}")
set_property(SOURCE "${DOLPHIN}/GXRuntime/src/core/cpu_interpreter_float.c"
  APPEND PROPERTY COMPILE_DEFINITIONS "MELEE_EXACT_FMA=$<BOOL:${MELEE_EXACT_FMA}>")

add_executable(melee main.cpp Assets.cpp)
if(MELEE_GAME_THIN_LTO)
  target_link_options(melee PRIVATE -flto=thin -Wl,--lto-O2
    "-Wl,--thinlto-cache-dir=${CMAKE_CURRENT_BINARY_DIR}/thinlto-cache")
endif()
target_include_directories(melee PRIVATE "${DOLPHIN}/Source/Core" "${RUNTIME}/include"
  "${DOLPHIN}/GXRuntime/include" "${ROOT}/build/melee-web/generated"
  "${ROOT}/tools/emsdk/upstream/emscripten/system/lib/wasmfs")
target_compile_definitions(melee PRIVATE _ARCH_32=1 _M_GENERIC=1)
target_link_libraries(melee PRIVATE moderngekko melee_game core uicommon ZLIB::ZLIB)
set(MELEE_LINK_OPTIMIZATION "0" CACHE STRING "Binaryen optimization level; game C remains optimized")
target_link_options(melee PRIVATE
  -sASSERTIONS=0
  "-O${MELEE_LINK_OPTIMIZATION}"
  -g2 -sJSPI=1
  -sWASMFS=1 -sFETCH=1 -sPROXY_TO_PTHREAD=1 -sPTHREAD_POOL_SIZE=8
  -sOFFSCREENCANVAS_SUPPORT=1 "-sOFFSCREENCANVASES_TO_PTHREAD=\"\""
  -sMIN_WEBGL_VERSION=2 -sMAX_WEBGL_VERSION=2 -sFULL_ES3=1
  -sGL_ENABLE_GET_PROC_ADDRESS=1 -sALLOW_MEMORY_GROWTH=1
  -sINITIAL_MEMORY=268435456 -sMAXIMUM_MEMORY=2147483648
  -sSTACK_SIZE=4194304 -sDEFAULT_PTHREAD_STACK_SIZE=4194304
  "SHELL:--embed-file ${DOLPHIN}/Data/Sys/GC@/dolphin-sys/GC"
  -sMODULARIZE=1 -sEXPORT_NAME=createMelee -sENVIRONMENT=web,worker
  "-sINCOMING_MODULE_JS_API=['canvas','wasmMemory','noInitialRun','locateFile','print','printErr','instantiateWasm','onAbort','onMeleeFrame','onMeleeRollback','onMeleeAssetRequest','onMeleeAssetSelection','onMeleeAssetMenu','onMeleeAssetMatch']"
  "-sEXPORTED_FUNCTIONS=['_main','_melee_input','_melee_stats','_melee_downloaded_bytes','_melee_prepare_assets','_melee_asset_pointer','_melee_asset_commit','_melee_asset_match_ready','_melee_asset_misses','_melee_shader_count','_melee_shader_millis','_melee_shader_max','_melee_shader_cache_format','_melee_lite_effects','_melee_set_lite_effects','_melee_audio_ring','_melee_frame_ack','_melee_speed','_melee_vps','_melee_save_state','_melee_load_state','_melee_match_configure','_melee_match_configure_slots','_melee_rb_enable','_melee_rb_command','_malloc','_free']"
  "-sEXPORTED_RUNTIME_METHODS=['FS','callMain','ccall','UTF8ToString']")
set_target_properties(melee PROPERTIES SUFFIX ".js"
  RUNTIME_OUTPUT_DIRECTORY "${ROOT}/build/melee-web/engine")
