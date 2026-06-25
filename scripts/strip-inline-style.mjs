import fs from "fs";
const path = process.argv[2];
let h = fs.readFileSync(path, "utf8");
h = h.replace(/<style hidden[\s\S]*?<\/style>\s*/, "");
fs.writeFileSync(path, h);
console.log("stripped", path);
