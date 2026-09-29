import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Person from "./page";

describe("Person", () => {
  it("renders a registration form with email and password fields", () => {
    const page = renderToStaticMarkup(createElement(Person));

    expect(page).toContain('type="email"');
    expect(page).toContain('name="email"');
    expect(page).toContain('type="password"');
    expect(page).toContain('name="password"');
    expect(page).toContain("Зарегистрироваться");
  });
});
