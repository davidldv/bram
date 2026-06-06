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

export function createVoiceCapture(): VoiceCapture {
  let resultSub: { remove: () => void } | undefined;
  let endSub: { remove: () => void } | undefined;
  let delivered = false;
  let lastTranscript = "";

  const cleanup = () => {
    resultSub?.remove();
    endSub?.remove();
    resultSub = undefined;
    endSub = undefined;
  };

  return {
    async start(onResult) {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) throw new Error("microphone/speech permission denied");

      delivered = false;
      lastTranscript = "";

      resultSub = ExpoSpeechRecognitionModule.addListener(
        "result",
        (event: ExpoSpeechRecognitionResultEvent) => {
          lastTranscript = event.results[0]?.transcript ?? "";
          if (event.isFinal && !delivered) {
            delivered = true;
            cleanup();
            onResult(lastTranscript);
          }
        }
      );

      endSub = ExpoSpeechRecognitionModule.addListener("end", () => {
        if (!delivered) {
          delivered = true;
          cleanup();
          onResult(lastTranscript);
        }
      });

      ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: false, continuous: false });
    },
    stop() {
      ExpoSpeechRecognitionModule.stop();
    },
  };
}
