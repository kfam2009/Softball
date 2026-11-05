import grandi from "grandi";

grandi.initialize();
const finder = await grandi.find({ showLocalSources: true });

try {
  await finder.wait(Number(process.env.B5_NDI_FIND_MS || 3000));
  const sources = finder.sources();
  if (!sources.length) {
    console.log("No NDI sources found.");
  } else {
    for (const source of sources) {
      console.log(source.name);
    }
  }
} finally {
  finder.destroy();
  grandi.destroy();
}
