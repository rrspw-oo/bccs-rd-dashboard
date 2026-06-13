const fs = require('fs');

function strip(s){
  const i = s.indexOf("if (typeof window === 'undefined')");
  return i === -1 ? s : s.slice(0, i).trimEnd() + "\n";
}

function removeStub(shell, declMarker){
  const declAt = shell.indexOf(declMarker);
  if(declAt === -1) throw new Error("decl not found: " + declMarker);
  const guardOpen = shell.indexOf("{", shell.indexOf("if (!window.ArchitectCanvas", declAt));
  let depth = 0, i = guardOpen, end = -1;
  for(; i < shell.length; i++){
    const c = shell[i];
    if(c === '{') depth++;
    else if(c === '}'){ depth--; if(depth === 0){ end = i + 1; break; } }
  }
  if(end === -1) throw new Error("guard not closed: " + declMarker);
  return shell.slice(0, declAt) + shell.slice(end);
}

let layout = strip(fs.readFileSync("engine-layout.js","utf8"));
let pos = strip(fs.readFileSync("engine-positioning.js","utf8"));
if(!/window\.ArchitectCanvasPositioning/.test(pos)){
  pos += "\nif(typeof window!=='undefined'){window.ArchitectCanvasPositioning=ArchitectCanvasPositioning;}\n";
}

let shell = fs.readFileSync("shell.html","utf8");
shell = removeStub(shell, "var STUB_LAYOUT = true;");
shell = removeStub(shell, "var STUB_POSITIONING = true;");

const block = "\n/* === ENGINE: layout (inlined) === */\n" + layout +
              "\n/* === ENGINE: positioning (inlined) === */\n" + pos +
              "\n/* === END ENGINES === */\n";

const at = shell.indexOf("<script>");
const scriptEnd = at + "<script>".length;
const out = shell.slice(0, scriptEnd) + block + shell.slice(scriptEnd);

fs.writeFileSync("../architect-canvas.html", out);
console.log("assembled bytes", out.length);
console.log("STUB_LAYOUT removed:", !out.includes("var STUB_LAYOUT"));
console.log("STUB_POSITIONING removed:", !out.includes("var STUB_POSITIONING"));
console.log("broken concat gone:", !out.includes("' + n.id + '") && !out.includes("' + node.id + '") ? "check-render" : "still-present-in-real-engine(ok if escaped)");
console.log("real layout engine present:", out.includes("window.ArchitectCanvasLayout = root.ArchitectCanvasLayout"));
