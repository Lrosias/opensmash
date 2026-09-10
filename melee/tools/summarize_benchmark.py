#!/usr/bin/env python3
"""Summarize an explicitly selected gameplay window from tests/stalls.mjs.

Use presentation counter deltas rather than averaging per-second FPS. Keep
profiler runs and scene transitions outside the supplied window.
"""
import argparse
import json
import math
from pathlib import Path


def summarize(data, start_ms, end_ms):
    samples = [s for s in data['samples'] if start_ms <= s['time'] <= end_ms]
    if len(samples) < 2:
        raise ValueError('The selected window needs at least two samples')
    first, last = samples[0], samples[-1]
    elapsed = last['time'] - first['time']
    if elapsed <= 0:
        raise ValueError('Sample times must increase')
    pairs = list(zip(samples, samples[1:]))
    if any(b['time'] <= a['time'] or b['presents'] < a['presents'] for a, b in pairs):
        raise ValueError('Window crosses a reset or contains unordered samples')
    frames = [t for t in data['frames'] if first['time'] <= t <= last['time']]
    gaps = sorted(b - a for a, b in zip(frames, frames[1:]))
    def percentile(q):
        return gaps[max(0, math.ceil(len(gaps) * q) - 1)] if gaps else None
    def delta(key):
        return last[key] - first[key]
    return {
        'engineSha256': data['engine'],
        'startMs': first['time'], 'endMs': last['time'],
        'durationSeconds': elapsed / 1000,
        'sampleCount': len(samples),
        'presentedFps': delta('presents') * 1000 / elapsed,
        'displayedFps': delta('displayedFrames') * 1000 / elapsed,
        'meanSimulationSpeed': sum(b['speed'] * (b['time'] - a['time']) for a, b in pairs) / elapsed,
        'frameGapMs': {'p50': percentile(.5), 'p95': percentile(.95),
                       'p99': percentile(.99), 'max': max(gaps, default=None)},
        'gapsOver50Ms': sum(g > 50 for g in gaps),
        'gapsOver100Ms': sum(g > 100 for g in gaps),
        'peakHeapBytes': max(s['heapBytes'] for s in samples),
        'renderSizes': sorted({tuple(s['renderSize']) for s in samples}),
        'newAssetMisses': delta('assetMisses'),
        'newShaderCount': delta('shaderCount'),
        'shaderMilliseconds': delta('shaderMillis'),
        'newAudioUnderruns': delta('audioUnderruns'),
        'downloadedByteDelta': delta('downloadedBytes'),
        'engineErrors': data['errors'],
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('measurement', type=Path)
    parser.add_argument('--start-ms', type=float, required=True)
    parser.add_argument('--end-ms', type=float, required=True)
    parser.add_argument('--scene', required=True)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    raw = json.loads(args.measurement.read_text())
    report = summarize(raw['data'], args.start_ms, args.end_ms)
    report.update(scene=args.scene, measurement=str(args.measurement), pageErrors=raw['errors'])
    encoded = json.dumps(report, indent=2) + '\n'
    if args.output:
        args.output.write_text(encoded)
    print(encoded, end='')
