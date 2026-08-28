const fs = require("fs");
const vm = require("vm");

const files = ["NutriFlow.html", "index.html"];
for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  if (!scripts.length) throw new Error(`${file}: no inline script found`);
  scripts.forEach((source, index) => {
    new vm.Script(source, { filename: `${file}#script${index + 1}` });
  });
  console.log(`${file}: inline JS syntax OK (${scripts.length} script(s))`);
}
