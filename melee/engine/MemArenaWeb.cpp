// SPDX-License-Identifier: GPL-2.0-or-later
#include "Common/MemArena.h"
#include <cstdlib>
#include <cstring>

// StaticRecompCore uses Dolphin's page tables and explicitly disables fastmem.
// Wasm linear memory cannot implement the desktop virtual-address aliases.
namespace Common {
MemArena::MemArena() = default;
MemArena::~MemArena() = default;
void MemArena::GrabSHMSegment(size_t size, std::string_view) {
  m_web_memory = static_cast<u8*>(std::calloc(1, size));
  m_web_size = size;
}
void MemArena::ReleaseSHMSegment() { std::free(m_web_memory); m_web_memory = nullptr; m_web_size = 0; }
void* MemArena::CreateView(s64 offset, size_t size) {
  if (offset < 0 || size > m_web_size || static_cast<size_t>(offset) > m_web_size - size) return nullptr;
  return m_web_memory + offset;
}
void MemArena::ReleaseView(void*, size_t) {}
u8* MemArena::ReserveMemoryRegion(size_t) { return nullptr; }
void MemArena::ReleaseMemoryRegion() {}
void* MemArena::MapInMemoryRegion(s64, size_t, void*, bool) { return nullptr; }
bool MemArena::ChangeMappingProtection(void*, size_t, bool) { return false; }
void MemArena::UnmapFromMemoryRegion(void*, size_t) {}
size_t MemArena::GetPageSize() const { return 65536; }
LazyMemoryRegion::LazyMemoryRegion() = default;
LazyMemoryRegion::~LazyMemoryRegion() { Release(); }
void* LazyMemoryRegion::Create(size_t size) {
  m_memory = std::calloc(1, size); m_size = size; return m_memory;
}
void LazyMemoryRegion::Clear() { std::memset(m_memory, 0, m_size); }
void LazyMemoryRegion::Release() { std::free(m_memory); m_memory = nullptr; m_size = 0; }
}
