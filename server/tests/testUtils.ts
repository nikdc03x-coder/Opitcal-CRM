import type { TestContext } from "node:test";

// Prisma model methods are virtual proxy properties, so assign rather than
// mocking their property descriptors. Each test restores its own replacements.
export function mockPrismaMethod(
  t: TestContext,
  object: object,
  method: string,
  implementation: (...args: never[]) => unknown,
) {
  const target = object as Record<string, unknown>;
  const original = target[method];
  const replacement = t.mock.fn(implementation);
  target[method] = replacement;
  t.after(() => {
    target[method] = original;
  });
  return replacement;
}

export const TEST_DATABASE_URL =
  "postgresql://test:test@ep-test-pooler.eu-central-1.aws.neon.tech/test?sslmode=verify-full";
