import {
  FilesetResolver,
  GestureRecognizer,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

export type ReadyStateVideo = HTMLVideoElement & { readyState: number };

let recognizer: GestureRecognizer | null = null;
let video: ReadyStateVideo | null = null;

export const ensureRecognizer = async (_video: ReadyStateVideo) => {
  if (recognizer !== null) return;
  if (!video) video = _video;

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
  );

  recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
  });
};

export type HandCenter = {
  x: number;
  y: number;
  handedness?: string;
  landmarks: NormalizedLandmark[];
};

export const getHandCentersOnce = async (): Promise<HandCenter[]> => {
  if (!recognizer || !video) return [];

  const now = performance.now();
  const res = recognizer.recognizeForVideo(video, now);

  const hands = res?.landmarks ?? [];
  if (!hands.length) return [];

  const out: HandCenter[] = [];

  for (let i = 0; i < hands.length; i++) {
    const lm: NormalizedLandmark[] = hands[i];
    if (!lm?.length) continue;

    // compute centroid
    let sx = 0,
      sy = 0;

    for (const p of lm) {
      sx += p.x;
      sy += p.y;
    }

    const x = sx / lm.length;
    const y = sy / lm.length;

    // handedness (may be missing)
    let handedness: string | undefined;
    const handed = res.handedness?.[i]?.[0];
    if (handed?.categoryName) handedness = handed.categoryName;

    out.push({
      x,
      y,
      handedness,
      landmarks: lm,
    });
  }

  return out;
};
