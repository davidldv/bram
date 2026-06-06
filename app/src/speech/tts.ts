import * as Speech from "expo-speech";

export interface Speaker {
  speak(text: string): Promise<void>;
  stop(): void;
}

export function createSpeaker(): Speaker {
  return {
    speak(text: string) {
      return new Promise<void>((resolve) => {
        Speech.speak(text, {
          onDone: () => resolve(),
          onError: () => resolve(),
        });
      });
    },
    stop() {
      Speech.stop();
    },
  };
}
