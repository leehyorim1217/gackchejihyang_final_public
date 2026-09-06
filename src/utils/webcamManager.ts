// src/utils/webcamManager.ts
export interface WebcamConfig {
  width: number;
  height: number;
  facingMode: 'user' | 'environment';
}

export class WebcamManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private isActive = false;
  private config: WebcamConfig;

  // ✅ config를 선택적으로 변경 + 기본값 제공
  constructor(config: Partial<WebcamConfig> = {}) {
    this.config = {
      width: config.width || 1280,
      height: config.height || 720,
      facingMode: config.facingMode || 'user'
    };
  }

  async start(videoElement: HTMLVideoElement): Promise<void> {
    try {
      this.videoElement = videoElement;

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.config.width },
          height: { ideal: this.config.height },
          facingMode: this.config.facingMode,
        },
        audio: false,
      });

      this.videoElement.srcObject = this.stream;
      this.videoElement.play();

      await new Promise<void>((resolve) => {
        this.videoElement!.onloadedmetadata = () => {
          resolve();
        };
      });

      this.isActive = true;
      console.log('✅ 웹캠 시작');
    } catch (error) {
      console.error('❌ 웹캠 실패:', error);
      throw new Error('웹캠 접근 권한이 필요합니다.');
    }
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.isActive = false;
    console.log('🛑  웹캠 중지');
  }

  captureFrame(canvas: HTMLCanvasElement): ImageData | null {
    if (!this.videoElement || !this.isActive) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;

    ctx.drawImage(this.videoElement, 0, 0);

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  isWebcamActive(): boolean {
    return this.isActive;
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }
}