import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";

export interface VoiceCapture {
  // Requests permission, starts listening, and invokes onResult once with the
  // final transcript (empty string if nothing was recognized).
  start(onResult: (transcript: string) => void): Promise<void>;
  stop(): void;
}

// If the recognizer never fires a final `result` or `end` (e.g. the user says
// nothing on a device that emits no timeout), deliver whatever we have after
// this long so callers never hang waiting on a transcript.
const SILENCE_TIMEOUT_MS = 12000;

export function createVoiceCapture(): VoiceCapture {
  let resultSub: { remove: () => void } | undefined;
  let endSub: { remove: () => void } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let delivered = false;
  let lastTranscript = "";

  const cleanup = () => {
    resultSub?.remove();
    endSub?.remove();
    if (timer) clearTimeout(timer);
    resultSub = undefined;
    endSub = undefined;
    timer = undefined;
  };

  return {
    async start(onResult) {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) throw new Error("microphone/speech permission denied");

      delivered = false;
      lastTranscript = "";

      const deliver = () => {
        if (delivered) return;
        delivered = true;
        cleanup();
        onResult(lastTranscript);
      };

      resultSub = ExpoSpeechRecognitionModule.addListener(
        "result",
        (event: ExpoSpeechRecognitionResultEvent) => {
          lastTranscript = event.results[0]?.transcript ?? "";
          if (event.isFinal) deliver();
        }
      );

      endSub = ExpoSpeechRecognitionModule.addListener("end", deliver);
      timer = setTimeout(deliver, SILENCE_TIMEOUT_MS);

      ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: false, continuous: false });
    },
    stop() {
      ExpoSpeechRecognitionModule.stop();
    },
  };
}
