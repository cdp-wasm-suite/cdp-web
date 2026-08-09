// Capability-based WAV transport for native WebView hosts.
const PROTOCOL = 'binary-xhr-v1';
let readyReply = null;

export function rememberNativeReadyReply(reply) {
  if (reply && typeof reply === 'object') readyReply = reply;
}

function binaryCapability(capabilities = readyReply?.details?.capabilities) {
  const upload = capabilities?.audioUpload;
  return upload?.protocols?.find((item) =>
    item?.name === PROTOCOL && item.version === 1 && item.method === 'POST'
      && item.contentType === 'audio/wav' && typeof item.endpoint === 'string'
  ) || null;
}

async function requestReadyReply() {
  if (readyReply) return readyReply;
  if (typeof IPlugSendMsg !== 'function') return null;
  try {
    const reply = await IPlugSendMsg({ msg: 'SUIRDY' });
    rememberNativeReadyReply(reply);
    return reply;
  } catch {
    return null;
  }
}

function postJSON(url, body) {
  // Studio's reply bridge owns the upload state transitions. Only raw chunk
  // bodies are sent through the custom-scheme XHR data plane; sending begin,
  // commit, or cancel to the chunk URL would be rejected as an invalid path.
  if (typeof IPlugSendMsg === 'function') {
    return IPlugSendMsg(body);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'text';
    xhr.setRequestHeader('content-type', 'application/json');
    xhr.onload = () => {
      let value = null;
      try { value = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && value?.success === true) resolve(value);
      else reject(new Error(value?.message || `Native control request failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Native control request failed'));
    xhr.send(JSON.stringify(body));
  });
}

function postChunk(url, bytes) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'text';
    xhr.setRequestHeader('content-type', 'audio/wav');
    xhr.onload = () => {
      let value = null;
      try { value = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && value?.success === true) resolve(value);
      else reject(new Error(value?.message || `Native audio chunk failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Native audio chunk failed'));
    xhr.send(bytes);
  });
}

export async function uploadWavToNative(bytes) {
  const wavBytes = bytes instanceof Uint8Array
    ? bytes
    : bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : ArrayBuffer.isView(bytes)
        ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : null;
  if (!wavBytes) throw new Error('Rendered Output is not a binary WAV buffer');

  const reply = await requestReadyReply();
  const capability = binaryCapability(reply?.details?.capabilities);
  if (!capability) throw new Error('Native host does not advertise binary-xhr-v1');

  const randomID = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const clientUploadID = `cdp-web-${randomID}`;
  let descriptor = null;
  try {
    const begin = await postJSON(capability.endpoint, {
      msg: 'STUDIO_AUDIO_UPLOAD', operation: 'begin', protocolVersion: 1,
      clientUploadID, contentType: 'audio/wav', totalByteCount: wavBytes.byteLength,
      preferredChunkByteCount: capability.preferredChunkByteCount,
    });
    descriptor = begin.details;
    const chunkSize = descriptor.chunkByteCount;
    for (let offset = 0, sequence = 0; offset < wavBytes.byteLength; offset += chunkSize, sequence++) {
      const chunk = wavBytes.subarray(offset, Math.min(offset + chunkSize, wavBytes.byteLength));
      await postChunk(`${descriptor.endpoint}/${descriptor.token}?sequence=${sequence}&offset=${offset}`, chunk);
    }
    await postJSON(capability.endpoint, {
      msg: 'STUDIO_AUDIO_UPLOAD', operation: 'commit', clientUploadID,
      token: descriptor.token,
    });
    return true;
  } catch (error) {
    if (descriptor?.token) {
      try {
        await postJSON(capability.endpoint, {
          msg: 'STUDIO_AUDIO_UPLOAD', operation: 'cancel', clientUploadID,
          token: descriptor.token,
        });
      } catch {}
    }
    throw error;
  }
}
