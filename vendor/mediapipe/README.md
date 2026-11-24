# MediaPipe Tasks Vision (vendored)

Used by the Avatar Lab (`avatar-lab.html`) for webcam face tracking, so the page loads
nothing from other sites and the camera video never leaves the browser.

- `vision_bundle.mjs`, `wasm/`: `@mediapipe/tasks-vision` 1.2.3 from npm (Apache-2.0).
- `face_landmarker.task`: Google's Face Landmarker model (float16, Apache-2.0), from
  `storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/`.

Licence: Apache License 2.0, https://www.apache.org/licenses/LICENSE-2.0
