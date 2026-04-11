export interface ParsedArgs {
  flags: Record<string, boolean>;
  options: Record<string, string>;
  positional: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, boolean> = {};
  const options: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, options, positional };
}

export function getOption(args: ParsedArgs, key: string, defaultValue: string): string {
  return args.options[key] ?? defaultValue;
}

export function getFlag(args: ParsedArgs, key: string): boolean {
  return args.flags[key] === true;
}
