import { Muxer, ArrayBufferTarget, FileSystemWritableFileStreamTarget } from '../vendor/mp4-muxer.js';

export async function createMuxer(options) {
  let target;
  let isStreaming = false;
  let writable = null;
  
  try {
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'documentary.mp4',
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
    console.warn('File picker cancelled or failed, falling back to in-memory ArrayBuffer:', err);
  }
  
  if (!isStreaming) {
    target = new ArrayBufferTarget();
  }
  
  const muxerOptions = {
    target,
    video: {
      codec: 'avc',
      width: options.width,
      height: options.height,
    },
    fastStart: isStreaming ? false : 'in-memory',
    firstTimestampBehavior: 'offset'
  };
  
  if (options.fps) {
    // MP4 muxer sometimes expects framerate if we want proper metadata
  }
  
  if (options.sampleRate && options.numberOfChannels) {
    muxerOptions.audio = {
      codec: 'aac',
      numberOfChannels: options.numberOfChannels,
      sampleRate: options.sampleRate
    };
  }
  
  const muxer = new Muxer(muxerOptions);
  
  // Attach writable directly so we can close it later in finalize if streaming
  return { muxer, target, isStreaming, _writable: writable };
}

export function addVideoChunk(muxer, chunk, meta) {
  muxer.addVideoChunk(chunk, meta);
}

export function addAudioChunk(muxer, chunk, meta) {
  muxer.addAudioChunk(chunk, meta);
}

export async function finalize(muxerData) {
  const { muxer, target, isStreaming, _writable } = muxerData;
  
  muxer.finalize();
  
  if (isStreaming && _writable) {
    await _writable.close();
    return null; // File is already on disk
  } else {
    return new Blob([target.buffer], { type: 'video/mp4' });
  }
}
