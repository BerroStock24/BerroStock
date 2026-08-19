// Corre todas las suites de prueba. Uso:  node tests/run-all.js
const {execFileSync} = require("child_process");
const fs   = require("fs");
const path = require("path");

const suites = fs.readdirSync(__dirname)
  .filter(f => f.endsWith("-test.js"))
  .sort();

let fallaron = 0;
for (const s of suites) {
  process.stdout.write("── " + s.padEnd(24));
  try {
    execFileSync(process.execPath, [path.join(__dirname, s)], {stdio:"pipe"});
    console.log("PASA");
  } catch (e) {
    fallaron++;
    console.log("FALLA");
    console.log(String(e.stdout || "").split("\n").filter(l => l.startsWith("FALLA")).map(l => "     " + l).join("\n"));
  }
}
console.log(fallaron === 0 ? "\nTodas las suites pasaron." : "\n" + fallaron + " suite(s) con fallas.");
process.exit(fallaron === 0 ? 0 : 1);
