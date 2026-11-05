import grandi from "grandi";

const width = 1280;
const height = 720;
const fps = 30;
const sourceName = process.env.B5_NDI_TEST_SOURCE || "B5 NDI Test Pattern";
const runtimeMs = Number(process.env.B5_NDI_TEST_MS || 120000);

function drawFrame(frameNo) {
  const buffer = Buffer.alloc(width * height * 4);
  const barWidth = Math.floor(width / 8);
  const colors = [
    [255, 255, 255],
    [0, 255, 255],
    [255, 255, 0],
    [0, 255, 0],
    [255, 0, 255],
    [0, 0, 255],
    [255, 0, 0],
    [20, 20, 20]
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const bar = Math.min(colors.length - 1, Math.floor(x / barWidth));
      const pulse = Math.floor((Math.sin((frameNo / 12) + (x / 90)) + 1) * 24);
      const [r, g, b] = colors[bar];
      const offset = (y * width + x) * 4;
      buffer[offset] = Math.min(255, b + pulse);
      buffer[offset + 1] = Math.min(255, g + pulse);
      buffer[offset + 2] = Math.min(255, r + pulse);
      buffer[offset + 3] = 255;
    }
  }

  return buffer;
}

grandi.initialize();

const sender = await grandi.send({
  name: sourceName,
  clockVideo: true,
  clockAudio: false
});

console.log(`NDI test source active: ${sender.sourceName()}`);
console.log(`Look for: ${sourceName}`);
console.log(`Running for ${Math.round(runtimeMs / 1000)} seconds...`);

let frameNo = 0;
const timer = setInterval(async () => {
  const data = drawFrame(frameNo);
  frameNo += 1;
  await sender.video({
    xres: width,
    yres: height,
    frameRateN: fps,
    frameRateD: 1,
    pictureAspectRatio: width / height,
    fourCC: grandi.FourCC.BGRA,
    frameFormatType: grandi.FrameType.Progressive,
    lineStrideBytes: width * 4,
    data
  });
}, 1000 / fps);

setTimeout(() => {
  clearInterval(timer);
  sender.destroy();
  grandi.destroy();
  console.log("NDI test source stopped.");
}, runtimeMs);
