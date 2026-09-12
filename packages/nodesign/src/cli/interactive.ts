import readline, { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { color } from "./output.js";

export const TOKEN_URLS = {
  figma: "https://www.figma.com/settings",
  zeplin: "https://app.zeplin.io/profile/developer",
};

export async function selectMenu(
  title: string,
  options: Array<{ label: string; value: "figma" | "zeplin"; hint?: string }>,
): Promise<"figma" | "zeplin"> {
  if (!process.stdin.isTTY) {
    console.log(`\x1b[36m◇\x1b[0m  \x1b[1m${title}\x1b[0m`);
    options.forEach((opt, idx) => console.log(`  ${idx + 1}) ${opt.label}${opt.hint ? ` (${opt.hint})` : ""}`));
    const rl = createInterface({ input, output });
    try {
      const ans = await new Promise<string>((res) => rl.question("\x1b[36m│\x1b[0m  Choice (1-2): ", res));
      const num = parseInt(ans.trim(), 10);
      if (num >= 1 && num <= options.length) return options[num - 1].value;
      return options[0].value;
    } finally {
      rl.close();
    }
  }

  let selectedIndex = 0;
  readline.emitKeypressEvents(input);
  if (process.stdin.setRawMode) process.stdin.setRawMode(true);

  const render = () => {
    output.write("\x1b[?25l");
    output.write(`\x1b[36m◇\x1b[0m  \x1b[1m${title}\x1b[0m \x1b[90m(↑/↓ to navigate, Enter to select)\x1b[0m\n`);
    options.forEach((opt, idx) => {
      const isSelected = idx === selectedIndex;
      const radio = isSelected ? "\x1b[36m●\x1b[0m" : "\x1b[90m○\x1b[0m";
      const labelStr = isSelected ? `\x1b[1m\x1b[36m${opt.label}\x1b[0m` : `\x1b[37m${opt.label}\x1b[0m`;
      const hintStr = opt.hint ? ` \x1b[90m— ${opt.hint}\x1b[0m` : "";
      output.write(`\x1b[36m│\x1b[0m  ${radio} ${labelStr}${hintStr}\n`);
    });
    output.write("\x1b[36m│\x1b[0m\n");
  };

  const clear = () => {
    const totalLines = options.length + 2;
    output.write(`\x1b[${totalLines}A\x1b[J`);
  };

  render();

  return new Promise((resolve) => {
    const onKeypress = (str: string, key: readline.Key) => {
      if (key && key.ctrl && key.name === "c") {
        output.write("\x1b[?25h\x1b[36m└\x1b[0m  \x1b[31mCancelled\x1b[0m\n");
        process.exit(1);
      }

      if (key && (key.name === "up" || key.name === "k")) {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        clear();
        render();
      } else if (key && (key.name === "down" || key.name === "j")) {
        selectedIndex = (selectedIndex + 1) % options.length;
        clear();
        render();
      } else if (key && (key.name === "return" || key.name === "enter" || key.name === "space")) {
        cleanup();
        clear();
        output.write(`\x1b[32m◆\x1b[0m  ${title} \x1b[90m›\x1b[0m \x1b[1m\x1b[32m${options[selectedIndex].label}\x1b[0m\n`);
        resolve(options[selectedIndex].value);
      } else if (str && /^[1-9]$/.test(str)) {
        const num = parseInt(str, 10) - 1;
        if (num >= 0 && num < options.length) {
          selectedIndex = num;
          cleanup();
          clear();
          output.write(`\x1b[32m◆\x1b[0m  ${title} \x1b[90m›\x1b[0m \x1b[1m\x1b[32m${options[selectedIndex].label}\x1b[0m\n`);
          resolve(options[selectedIndex].value);
        }
      }
    };

    const cleanup = () => {
      input.removeListener("keypress", onKeypress);
      if (process.stdin.setRawMode) process.stdin.setRawMode(false);
      output.write("\x1b[?25h");
    };

    input.on("keypress", onKeypress);
  });
}

export async function askToken(provider: "figma" | "zeplin"): Promise<string> {
  const tokenUrl = TOKEN_URLS[provider];
  console.log(`${color.cyan}│${color.reset}  Create a token: ${color.dim}${tokenUrl}${color.reset}`);
  console.log(`${color.cyan}│${color.reset}`);
  return new Promise((resolve) => {
    const rl = createInterface({ input, output });
    rl.question(`\x1b[36m◇\x1b[0m  \x1b[1mPaste ${provider} token\x1b[0m \x1b[90m(hidden input)\x1b[0m: `, (token) => {
      rl.close();
      resolve(token.trim());
    });
  });
}
