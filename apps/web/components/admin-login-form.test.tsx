import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextEncoder } from "node:util";
import * as rsaModule from "@/lib/rsa";
import { AdminLoginForm } from "./admin-login-form";

describe("AdminLoginForm", () => {
  afterEach(() => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true
    });
    jest.restoreAllMocks();
  });

  it("gets a public key first and only sends encrypted credentials when logging in", async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          publicKey: "-----BEGIN PUBLIC KEY-----\\nVEVTVA==\\n-----END PUBLIC KEY-----"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: "signed-token"
        })
      });
    const importKey = jest.fn().mockResolvedValue("imported-key");
    const encrypt = jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);

    global.fetch = fetchMock as typeof fetch;
    Object.defineProperty(global, "TextEncoder", {
      configurable: true,
      value: TextEncoder
    });
    Object.defineProperty(global, "crypto", {
      configurable: true,
      value: {
        subtle: {
          importKey,
          encrypt
        }
      }
    });

    render(<AdminLoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/用户名/i), "admin");
    await user.type(screen.getByLabelText(/密码/i), "secret");
    await user.click(screen.getByRole("button", { name: /登录后台/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/auth/public-key"), expect.anything()));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/auth/login"),
        expect.objectContaining({
          body: JSON.stringify({
            encryptedCredentials: "AQID"
          })
        })
      )
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("signed-token"));
  });

  it("shows a clear Chinese error when secure encryption fails", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        publicKey: "-----BEGIN PUBLIC KEY-----\\nVEVTVA==\\n-----END PUBLIC KEY-----"
      })
    });

    global.fetch = fetchMock as typeof fetch;
    Object.defineProperty(global, "TextEncoder", {
      configurable: true,
      value: TextEncoder
    });
    jest
      .spyOn(rsaModule, "encryptLoginCredentials")
      .mockRejectedValue(new Error("当前访问环境不支持安全加密登录，请使用 localhost 或 HTTPS 访问后台。"));

    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText(/用户名/i), "admin");
    await user.type(screen.getByLabelText(/密码/i), "secret");
    await user.click(screen.getByRole("button", { name: /登录后台/i }));

    await waitFor(() => {
      expect(screen.getByText("当前访问环境不支持安全加密登录，请使用 localhost 或 HTTPS 访问后台。")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
