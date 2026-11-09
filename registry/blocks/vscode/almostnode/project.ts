/* The project the block opens on: plain CommonJS, so all of it runs with no network. Replace it with the `project` prop. */

export const ROOT = '/project';

export const STARTER_PROJECT: Record<string, string> = {
  'README.md': `# Hello

This whole window runs in your browser. The terminal is [wterm](https://github.com/vercel-labs/wterm), and behind it is a
Node runtime on a virtual disk, with the same files you see in the Explorer.

Try these in the terminal:

    ls
    cd src && cat greet.js
    node index.js
    node -e "console.log(process.version)"
    npm run count
    opencode
    npm install lodash
    node -e "console.log(require('lodash').capitalize('hello'))"

Edit a file and run it again: what you run is what you see. A command that writes a file
shows up here too. Try \`echo hi >> notes.txt\`.

Ctrl-C stops a command, even \`node -e "while (true) {}"\`.

Type \`opencode\` to open OpenCode in this terminal, using these same files and commands.
Stop OpenCode or choose Return to terminal to get back to your shell.

Connect Tailscale from the status bar to reach your tailnet from Node's \`fetch\`, for example:

    node -e "fetch('http://your-device.your-tailnet.ts.net/').then(r => r.text()).then(console.log)"
`,
  'package.json': `${JSON.stringify(
    {
      name: 'hello',
      version: '1.0.0',
      private: true,
      scripts: {
        start: 'node index.js',
        greet: 'node src/greet.js World',
        count: 'node src/count.js',
        test: 'node test.js',
      },
    },
    null,
    2,
  )}\n`,
  'index.js': `const { greet } = require('./src/greet');

console.log(greet('browser'));
console.log('Running on', process.platform, 'in', process.cwd());
`,
  'test.js': `const assert = require('assert');
const { greet } = require('./src/greet');

assert.strictEqual(greet('you'), 'Hello, you!');
console.log('1 test passed');
`,
  'src/greet.js': `function greet(name) {
  return \`Hello, \${name}!\`;
}

module.exports = { greet };

// Run directly: node src/greet.js Ada
if (process.argv[2]) console.log(greet(process.argv[2]));
`,
  'src/count.js': `// Prints as it goes. Ctrl-C stops it.
let n = 0;
const timer = setInterval(() => {
  n += 1;
  console.log('tick', n);
  if (n === 10) clearInterval(timer);
}, 500);
`,
};
