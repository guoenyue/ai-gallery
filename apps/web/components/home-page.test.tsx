import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("renders the gallery as the home experience", async () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "灵感画廊" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "API Keys" })).toHaveAttribute("href", "https://sub.appdock.cn");
    fireEvent.click(screen.getByTitle("设置"));
    expect(screen.getByLabelText("Base URL")).toHaveValue("https://sub.appdock.cn/v1");
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });
});
