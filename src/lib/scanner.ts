import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'

export type ScanResult = {
  text: string
  format: string
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  return BrowserMultiFormatReader.listVideoInputDevices()
}

export function createBarcodeScanner(
  videoElement: HTMLVideoElement,
  onScan: (result: ScanResult) => void,
  onError?: (err: Error) => void,
): () => void {
  const reader = new BrowserMultiFormatReader()
  let controls: IScannerControls | null = null
  let stopped = false

  reader
    .decodeFromVideoDevice(undefined, videoElement, (result) => {
      if (result) {
        onScan({ text: result.getText(), format: result.getBarcodeFormat().toString() })
      }
    })
    .then((c) => {
      controls = c
      if (stopped) c.stop()
    })
    .catch((err: unknown) => {
      onError?.(err as Error)
    })

  return () => {
    stopped = true
    controls?.stop()
  }
}
