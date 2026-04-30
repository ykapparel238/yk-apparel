import "@testing-library/jest-dom";

process.env.DATABASE_URL ||= "postgresql://postgres:postgres@localhost:5432/knitcraft_mes?schema=public";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

Object.defineProperty(window, "open", {
  writable: true,
  value: () => null,
});
