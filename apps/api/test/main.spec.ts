import { configureHttpMiddleware } from "../src/main";

describe("main bootstrap middleware order", () => {
  it("enables CORS before serving local uploads so browser downloads can fetch blobs", () => {
    const calls: string[] = [];
    const app = {
      use: jest.fn((pathOrMiddleware: unknown) => {
        calls.push(pathOrMiddleware === "/uploads" ? "uploads" : "middleware");
      }),
      enableCors: jest.fn(() => {
        calls.push("cors");
      }),
      useGlobalPipes: jest.fn()
    };

    configureHttpMiddleware(app as never, {
      uploadRoot: "/tmp/base-card-test-uploads",
      bodyLimit: "1mb"
    });

    expect(calls.indexOf("cors")).toBeLessThan(calls.indexOf("uploads"));
  });
});
