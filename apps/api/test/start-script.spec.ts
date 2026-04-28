import apiPackageJson from "../package.json";

describe("API production start script", () => {
  it("points to the compiled NestJS entry file", () => {
    expect(apiPackageJson.scripts.start).toBe("node dist/src/main.js");
  });
});
