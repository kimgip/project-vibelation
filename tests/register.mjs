import { registerHooks, stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier))
      return next(specifier + ".ts", context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts"))
      return {
        format: "module",
        source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8")),
        shortCircuit: true,
      };
    return next(url, context);
  },
});
