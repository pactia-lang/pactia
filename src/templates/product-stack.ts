export enum ProductStack {
  RustStack = "rust-stack",
  HtmlCssJs = "html-css-js",
}

export function parseProductStack(value: string | undefined): ProductStack {
  if (value === ProductStack.HtmlCssJs) {
    return ProductStack.HtmlCssJs;
  }
  return ProductStack.RustStack;
}

function stackImports(stack: ProductStack): string {
  if (stack === ProductStack.HtmlCssJs) {
    return ["import @pactia/kernel;", "import @pactia/html-css-js;"].join("\n");
  }
  return ["import @pactia/kernel;", "import @pactia/rust-stack;"].join("\n");
}

function stackBinding(stack: ProductStack): string {
  if (stack === ProductStack.HtmlCssJs) {
    return "  #html_css_js";
  }
  return "  #rust-stack";
}

function stackDependencies(stack: ProductStack): ReadonlyMap<string, string> {
  const deps = new Map<string, string>([["@pactia/kernel", "^1.0"]]);
  if (stack === ProductStack.HtmlCssJs) {
    deps.set("@pactia/html-css-js", "^1.0");
  } else {
    deps.set("@pactia/rust-stack", "^1.0");
  }
  return deps;
}

export function renderProductPactia(productName: string, stack: ProductStack): string {
  const moduleName = "core";
  const serviceName = "ApiService";
  return [
    "pactia 1.0",
    "",
    stackImports(stack),
    "",
    `product ${productName} {`,
    `  > ${productName} product intent — describe what must stay true.`,
    "",
    stackBinding(stack),
    "",
    `  module ${moduleName} {`,
    `    service ${serviceName} {`,
    "      #database",
    "",
    "      @api health {",
    '        method: GET,',
    '        path: "/health",',
    "      }",
    "    }",
    "  }",
    "}",
    "",
  ].join("\n");
}

export function stackDependenciesFor(stack: ProductStack): ReadonlyMap<string, string> {
  return stackDependencies(stack);
}
