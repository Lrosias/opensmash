#include <atomic>
#include "wasmfs.h"
#include "memory_backend.h"
#include <emscripten.h>
#include <emscripten/wasmfs.h>
#include <algorithm>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <unistd.h>
#include <vector>
#include <mutex>
#include <condition_variable>

namespace {
constexpr size_t BlockSize = 4 * 1024 * 1024;
struct AssetEntry { const char* path; uint64_t size; unsigned first; };
#include "asset_manifest.inc"
struct PreparedBlock { std::unique_ptr<uint8_t[]> data; size_t size; bool ready = false; bool requested = false; };
std::mutex asset_mutex;
std::condition_variable asset_ready;
unsigned gate_sequence = 0, completed_gate = 0;
std::vector<PreparedBlock> blocks;
std::atomic<uint64_t> downloaded_bytes{0};
std::atomic<unsigned> missing_reads{0};


// Disc reads run on engine workers. The browser UI performs downloads/decompression
// and commits immutable blocks. Release the mutex while waiting; never fetch under it.
void await_block(unsigned index) {
  std::unique_lock lock(asset_mutex);
  if (blocks[index].ready) return;
  missing_reads++;
  if (!blocks[index].requested) {
    blocks[index].requested = true;
    EM_ASM({ postMessage({cmd:9,handler:'onMeleeAssetRequest',args:[$0]}); }, index);
  }
  asset_ready.wait(lock, [&] { return blocks[index].ready; });
}
ssize_t read_asset(const AssetEntry& entry, uint8_t* out, size_t len, off_t offset) {
  if (offset < 0) return -EINVAL;
  if (static_cast<uint64_t>(offset) >= entry.size) return 0;
  len = std::min<uint64_t>(len, entry.size - offset);
  const size_t result = len;
  while (len) {
    const unsigned index = entry.first + offset / BlockSize;
    const size_t start = offset % BlockSize;
    const size_t count = std::min(len, BlockSize - start);
    if (index >= blocks.size() || start + count > blocks[index].size) {
      missing_reads++;
      return -EIO;
    }
    await_block(index);
    std::memcpy(out, blocks[index].data.get() + start, count);
    out += count; offset += count; len -= count;
  }
  return result;
}
class AssetFile final : public wasmfs::DataFile {
  const AssetEntry& entry;
  off_t getSize() override { return entry.size; }
  // wasmfs_create_file initially opens O_RDWR; writes still always fail below.
  int open(wasmfs::oflags_t) override { return 0; }
  int close() override { return 0; }
  ssize_t read(uint8_t* data, size_t size, off_t offset) override { return read_asset(entry, data, size, offset); }
  ssize_t write(const uint8_t*, size_t, off_t) override { return -EROFS; }
  int setSize(off_t size) override { return static_cast<uint64_t>(size) == entry.size ? 0 : -EROFS; }
  int flush() override { return 0; }
public:
  AssetFile(mode_t mode, wasmfs::backend_t backend, const AssetEntry& entry) : DataFile(mode, backend), entry(entry) {}
};
class AssetBackend final : public wasmfs::Backend {
  const AssetEntry& entry;
public:
  explicit AssetBackend(const AssetEntry& entry) : entry(entry) {}
  std::shared_ptr<wasmfs::DataFile> createFile(mode_t mode) override { return std::make_shared<AssetFile>(mode, this, entry); }
  std::shared_ptr<wasmfs::Directory> createDirectory(mode_t mode) override { return std::make_shared<wasmfs::MemoryDirectory>(mode, this); }
  std::shared_ptr<wasmfs::Symlink> createSymlink(std::string) override { return nullptr; }
};
}

void MountGameAssets(const std::string& url) {
  if (blocks.empty()) {
    std::fputs("Melee asset metadata must be initialized before starting.\n", stderr);
    std::abort();
  }
  for (const auto& entry : assets) {
    auto path = std::filesystem::path("/game") / entry.path;
    std::filesystem::create_directories(path.parent_path());
    auto backend = wasmfs::wasmFS.addBackend(std::make_unique<AssetBackend>(entry));
    int fd = wasmfs_create_file(path.c_str(), 0644, reinterpret_cast<backend_t>(backend));
    if (fd < 0) std::abort();
    fchmod(fd, 0444);
    close(fd);
  }
}
extern "C" EMSCRIPTEN_KEEPALIVE double melee_downloaded_bytes() { return downloaded_bytes.load(); }

extern "C" EMSCRIPTEN_KEEPALIVE unsigned melee_prepare_assets() {
  if (!blocks.empty()) return blocks.size();
  for (const auto& entry : assets) {
    for (size_t offset = 0; offset < entry.size; offset += BlockSize)
      blocks.push_back({nullptr, static_cast<size_t>(std::min<uint64_t>(BlockSize, entry.size - offset))});
  }
  return blocks.size();
}
extern "C" EMSCRIPTEN_KEEPALIVE uint8_t* melee_asset_pointer(unsigned index, unsigned size) {
  if (index >= blocks.size() || size != blocks[index].size) return nullptr;
  if (!blocks[index].data) blocks[index].data = std::make_unique<uint8_t[]>(size);
  return blocks[index].data.get();
}
extern "C" EMSCRIPTEN_KEEPALIVE int melee_asset_commit(unsigned index, unsigned size, unsigned encoded_size) {
  {
    std::lock_guard lock(asset_mutex);
    if (index >= blocks.size() || size != blocks[index].size || !blocks[index].data || blocks[index].ready) return 0;
    blocks[index].ready = true;
    downloaded_bytes += encoded_size;
  }
  asset_ready.notify_all();
  return 1;
}
extern "C" void melee_asset_selection(int kind, int id) {
  EM_ASM({ postMessage({cmd:9,handler:'onMeleeAssetSelection',args:[$0,$1]}); }, kind, id);
}
extern "C" void melee_asset_menu() {
  EM_ASM({ postMessage({cmd:9,handler:'onMeleeAssetMenu',args:[]}); });
}
extern "C" void melee_asset_match(int stage, int p0, int p1, int p2, int p3) {
  std::unique_lock lock(asset_mutex);
  const unsigned ticket = ++gate_sequence;
  EM_ASM({ postMessage({cmd:9,handler:'onMeleeAssetMatch',args:[$0,$1,$2,$3,$4,$5]}); }, ticket, stage, p0,p1,p2,p3);
  asset_ready.wait(lock, [&] { return completed_gate >= ticket; });
}
extern "C" EMSCRIPTEN_KEEPALIVE void melee_asset_match_ready(unsigned ticket) {
  { std::lock_guard lock(asset_mutex); completed_gate = std::max(completed_gate, ticket); }
  asset_ready.notify_all();
}

extern "C" EMSCRIPTEN_KEEPALIVE unsigned melee_asset_misses() { return missing_reads.load(); }
