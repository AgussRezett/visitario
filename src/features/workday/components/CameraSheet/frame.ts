// How the camera's picture is saved: turned to match how the phone is held, and focus.

export type Turn = 0 | 90 | -90

/**
 * The phone held sideways while the screen stays upright (rotation lock, or the app does
 * not turn): the camera still gives a standing picture, so it is turned to lie down.
 * `x`, `y` are the accelerometer with gravity, `ios` flips its signs (iOS reports them
 * the other way round); a screen already turned needs nothing.
 */
export function turnFor(motion: { x: number; y: number } | null, ios: boolean, screenAngle: number): Turn {
  if (!motion || screenAngle % 180 !== 0) return 0
  const sign = ios ? -1 : 1
  const x = motion.x * sign
  const y = motion.y * sign
  // Clearly sideways: most of gravity along the phone's width.
  if (Math.abs(x) < 6 || Math.abs(x) < Math.abs(y) * 1.5) return 0
  // "Up" towards the phone's left side: turned clockwise, so the picture turns clockwise too.
  return x < 0 ? 90 : -90
}

/** The size of the picture once turned. */
export const turnedSize = (width: number, height: number, turn: Turn) => (turn === 0 ? { width, height } : { width: height, height: width })

/**
 * The shot straight at the size it is kept (the long side at most `maxSide`): the frame is
 * drawn `draw` big, then turned into a canvas `width` × `height`. One small picture, encoded
 * once, instead of the full camera frame encoded and then shrunk and encoded again.
 */
export function shotSize(videoWidth: number, videoHeight: number, turn: Turn, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(videoWidth, videoHeight))
  const draw = { width: Math.max(1, Math.round(videoWidth * scale)), height: Math.max(1, Math.round(videoHeight * scale)) }
  return { draw, ...turnedSize(draw.width, draw.height, turn) }
}

/** Where a tap on the preview lands in the camera's picture, from 0 to 1 (object-fit: contain). */
export function focusPoint(tap: { x: number; y: number }, box: { width: number; height: number }, video: { width: number; height: number }) {
  const scale = Math.min(box.width / video.width, box.height / video.height)
  const shownW = video.width * scale
  const shownH = video.height * scale
  const left = (box.width - shownW) / 2
  const top = (box.height - shownH) / 2
  const clamp = (n: number) => Math.min(1, Math.max(0, n))
  return { x: clamp((tap.x - left) / shownW), y: clamp((tap.y - top) / shownH) }
}
