export function renderMinimalProductPactia(productName: string): string {
  return [
    "pactia 1.0",
    "",
    `product ${productName} {`,
    `  > ${productName} — describe what must stay true.`,
    `  > Add package imports here; pin dependencies with pactia add.`,
    "}",
    "",
  ].join("\n");
}
