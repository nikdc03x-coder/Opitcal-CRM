const fs = require("node:fs");
const path = require("node:path");

const serverRoot = path.resolve(__dirname, "../..");
const output = path.resolve(serverRoot, "dist");
if (path.dirname(output) !== serverRoot) throw new Error("Invalid build output directory.");
if (fs.existsSync(output)) {
  if (
    fs.lstatSync(output).isSymbolicLink() ||
    path.dirname(fs.realpathSync(output)) !== fs.realpathSync(serverRoot)
  ) {
    throw new Error("Refusing to clean redirected build output.");
  }
  fs.rmSync(output, { recursive: true, force: true });
}
