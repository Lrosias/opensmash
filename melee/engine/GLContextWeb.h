#pragma once
#include "Common/GL/GLContext.h"
#include <emscripten/html5.h>
#include <emscripten/html5_webgl.h>
#include <atomic>
#include "MeleeRollback.h"

inline std::atomic<unsigned> web_present_count{0};
inline std::atomic<unsigned> web_frames_in_flight{0};
inline bool web_lite_resolution = true;
extern "C" void melee_yield_frame();

class GLContextWeb final : public GLContext {
  EMSCRIPTEN_WEBGL_CONTEXT_HANDLE context = 0;
protected:
  bool Initialize(const WindowSystemInfo&, bool, bool) override {
    EM_ASM({ GL.offscreenCanvases.engine = new OffscreenCanvas($0, $1); },
           web_lite_resolution ? 320 : 640, web_lite_resolution ? 240 : 480);
    EmscriptenWebGLContextAttributes attr;
    emscripten_webgl_init_context_attributes(&attr);
    attr.majorVersion = 2;
    attr.alpha = false;
    attr.antialias = false;
    attr.depth = false;
    attr.stencil = false;
    attr.explicitSwapControl = true;
    attr.proxyContextToMainThread = EMSCRIPTEN_WEBGL_CONTEXT_PROXY_DISALLOW;
    context = emscripten_webgl_create_context("#engine", &attr);
    m_opengl_mode = Mode::OpenGLES;
    Update();
    if (context <= 0 || !MakeCurrent()) return false;
    EM_ASM({
      const gl=GL.currentContext.GLctx; const ext=gl.getExtension('WEBGL_debug_renderer_info');
      console.warn('WebGL renderer:',ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));
    });
    return true;
  }
public:
  ~GLContextWeb() override { if (context) emscripten_webgl_destroy_context(context); }
  bool IsHeadless() const override { return false; }
  bool MakeCurrent() override { return emscripten_webgl_make_context_current(context) == EMSCRIPTEN_RESULT_SUCCESS; }
  bool ClearCurrent() override { return emscripten_webgl_make_context_current(0) == EMSCRIPTEN_RESULT_SUCCESS; }
  void Update() override {
    int w = 640, h = 480;
    emscripten_get_canvas_element_size("#engine", &w, &h);
    m_backbuffer_width = w;
    m_backbuffer_height = h;
  }
  void Swap() override {
    if (melee_rb_replaying.load(std::memory_order_relaxed)) return;
    // A native pthread loop never returns to the JS event loop. Modern browsers
    // removed OffscreenCanvas.commit(), so explicitly transfer a GPU bitmap.
    // Command 9 is CMD_CALL_HANDLER in the pinned Emscripten 6.0.9 runtime.
    if (web_frames_in_flight.load(std::memory_order_relaxed) < 2) {
      web_frames_in_flight.fetch_add(1, std::memory_order_relaxed);
      EM_ASM({
        const bitmap = GL.offscreenCanvases.engine.transferToImageBitmap();
        postMessage({cmd: 9, handler: 'onMeleeFrame', args: [bitmap]}, [bitmap]);
      });
    }
    web_present_count.fetch_add(1, std::memory_order_relaxed);
    melee_yield_frame();
  }
  void SwapInterval(int) override {}
  void* GetFuncAddress(const std::string& name) override {
    return emscripten_webgl_get_proc_address(name.c_str());
  }
};
