/**
 * mux.js - MP4 Multiplexing with Disk Streaming & In-Memory Fallback
 * 
 * Uses vendored mp4-muxer ES module.
 * Prioritizes FileSystemWritableFileStreamTarget via showSaveFilePicker
 * to support unlimited length video with flat RAM usage.
 */

import { Muxer, ArrayBufferTarget, FileSystemWritableFileStreamTarget } from './vendor/mp4-muxer.js';

export async function createMuxer(options = {}) {
  let target;
  let isStreaming = false;
  let writable = null;

  const {
    suggestedName = 'docuforge-video.mp4',
    width = 720,
    height = 1280,
    sampleRate = 48000,
    numberOfChannels = 2
  } = options;

  try {
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window && !options.forceInMemory) {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{
          description: 'MP4 Video',
          accept: { 'video/mp4': ['.mp4'] }
        }]
      });
      writable = await handle.createWritable();
      target = new FileSystemWritableFileStreamTarget(writable);
      isStreaming = true;
    }
  } catch (err) {
    console.warn('[mux] showSaveFilePicker unavailable or cancelled, falling back to ArrayBufferTarget:', err.message);
  }

  if (!isStreaming) {
    target = new ArrayBufferTarget();
  }

  const muxerOptions = {
    target,
    video: {
      codec: 'avc',
      width,
      height
    },
    fastStart: isStreaming ? false : 'in-memory',
    firstTimestampBehavior: 'offset'
  };

  if (sampleRate && numberOfChannels) {
    muxerOptions.audio = {
      codec: 'aac',
      numberOfChannels,
      sampleRate
    };
  }

  const muxer = new Muxer(muxerOptions);
  return { muxer, target, isStreaming, _writable: writable };
}

export function addVideoChunk(muxer, chunk, meta) {
  muxer.addVideoChunk(chunk, meta);
}

export function addAudioChunk(muxer, chunk, meta) {
  muxer.addAudioChunk(chunk, meta);
}

export async function finalizeMuxer(muxerData) {
  const { muxer, target, isStreaming, _writable } = muxerData;
  muxer.finalize();

  if (isStreaming && _writable) {
    await _writable.close();
    return null; // Directly streamed to disk
  } else {
    return new Blob([target.buffer], { type: 'video/mp4' });
  }
}
