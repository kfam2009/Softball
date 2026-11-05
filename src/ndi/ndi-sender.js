class NdiSender {
  constructor(options) {
    this.options = options;
    this.enabled = options.enabled;
    this.label = this.enabled ? "NDI sender" : "NDI preview";
    this.grandi = null;
    this.sender = null;
    this.lastFrameAt = 0;
  }

  async open() {
    if (!this.enabled) {
      console.log("NDI disabled. Running Electron offscreen preview only.");
      return;
    }

    const module = await import("grandi");
    this.grandi = module.default || module;
    this.grandi.initialize();
    this.sender = await this.grandi.send({
      name: this.options.sourceName,
      clockVideo: true,
      clockAudio: false
    });
    console.log(`NDI source active: ${this.sender.sourceName()}`);
  }

  async sendVideoFrame(bgraBuffer) {
    if (!this.enabled) return;
    if (!this.sender || !this.grandi) return;

    const now = Date.now();
    const frameInterval = Math.floor(1000 / this.options.fps);
    if (now - this.lastFrameAt < frameInterval) return;
    this.lastFrameAt = now;

    await this.sender.video({
      xres: this.options.width,
      yres: this.options.height,
      frameRateN: this.options.fps,
      frameRateD: 1,
      pictureAspectRatio: this.options.width / this.options.height,
      fourCC: this.grandi.FourCC.BGRA,
      frameFormatType: this.grandi.FrameType.Progressive,
      lineStrideBytes: this.options.width * 4,
      data: Buffer.from(bgraBuffer)
    });
  }

  close() {
    if (this.sender) this.sender.destroy();
    if (this.grandi) this.grandi.destroy();
  }
}

module.exports = NdiSender;
