if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:mock-preview";
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}

window.matchMedia =
  window.matchMedia ||
  ((query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }));

/**
 * @param {HTMLInputElement} input
 * @param {File[]} files
 */
export function setInputFiles(input, files) {
  const list = {
    length: files.length,
    item: (index) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      for (const f of files) yield f;
    },
  };
  files.forEach((f, i) => {
    list[i] = f;
  });
  Object.defineProperty(input, "files", { configurable: true, value: list });
}
