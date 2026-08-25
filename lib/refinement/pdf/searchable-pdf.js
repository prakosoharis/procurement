const DEFAULT_MINIMUM_TEXT_CHARACTERS = 20;

let pdfJsModulePromise;

/**
 * Trigger.dev imports task modules in a restricted Node runtime before a task
 * runs. pdfjs-dist normally fills these browser globals from node-canvas, but
 * that fallback relies on `process.getBuiltinModule`, which is not available
 * during Trigger's task discovery. Text extraction does not render pages, so a
 * small affine-matrix implementation is sufficient for pdfjs' display module
 * initialisation and keeps the browser-only APIs out of the module top level.
 */
function installPdfJsRuntimeGlobals() {
  if (!globalThis.DOMMatrix) {
    class RuntimeDOMMatrix {
      constructor(input) {
        const values = Array.isArray(input) || ArrayBuffer.isView(input)
          ? Array.from(input)
          : input && typeof input === "object"
            ? [
                input.a ?? input.m11 ?? 1,
                input.b ?? input.m12 ?? 0,
                input.c ?? input.m21 ?? 0,
                input.d ?? input.m22 ?? 1,
                input.e ?? input.m41 ?? 0,
                input.f ?? input.m42 ?? 0,
              ]
            : [1, 0, 0, 1, 0, 0];

        [this.a, this.b, this.c, this.d, this.e, this.f] = values;
        this.#syncMatrixAliases();
      }

      #syncMatrixAliases() {
        this.m11 = this.a;
        this.m12 = this.b;
        this.m21 = this.c;
        this.m22 = this.d;
        this.m41 = this.e;
        this.m42 = this.f;
        this.is2D = true;
      }

      multiplySelf(other) {
        const matrix = new RuntimeDOMMatrix(other);
        const { a, b, c, d, e, f } = this;
        this.a = a * matrix.a + c * matrix.b;
        this.b = b * matrix.a + d * matrix.b;
        this.c = a * matrix.c + c * matrix.d;
        this.d = b * matrix.c + d * matrix.d;
        this.e = a * matrix.e + c * matrix.f + e;
        this.f = b * matrix.e + d * matrix.f + f;
        this.#syncMatrixAliases();
        return this;
      }

      preMultiplySelf(other) {
        const matrix = new RuntimeDOMMatrix(other);
        const current = new RuntimeDOMMatrix(this);
        this.a = matrix.a;
        this.b = matrix.b;
        this.c = matrix.c;
        this.d = matrix.d;
        this.e = matrix.e;
        this.f = matrix.f;
        return this.multiplySelf(current);
      }

      translate(tx = 0, ty = 0) {
        return new RuntimeDOMMatrix(this).translateSelf(tx, ty);
      }

      translateSelf(tx = 0, ty = 0) {
        return this.multiplySelf([1, 0, 0, 1, tx, ty]);
      }

      scale(scaleX = 1, scaleY = scaleX, scaleZ = 1, originX = 0, originY = 0) {
        return new RuntimeDOMMatrix(this).scaleSelf(
          scaleX,
          scaleY,
          scaleZ,
          originX,
          originY,
        );
      }

      scaleSelf(scaleX = 1, scaleY = scaleX, scaleZ = 1, originX = 0, originY = 0) {
        if (scaleZ !== 1) this.is2D = false;
        return this.translateSelf(originX, originY)
          .multiplySelf([scaleX, 0, 0, scaleY, 0, 0])
          .translateSelf(-originX, -originY);
      }

      invertSelf() {
        const determinant = this.a * this.d - this.b * this.c;
        if (!determinant) {
          this.a = this.b = this.c = this.d = this.e = this.f = Number.NaN;
          this.#syncMatrixAliases();
          return this;
        }

        const { a, b, c, d, e, f } = this;
        this.a = d / determinant;
        this.b = -b / determinant;
        this.c = -c / determinant;
        this.d = a / determinant;
        this.e = (c * f - d * e) / determinant;
        this.f = (b * e - a * f) / determinant;
        this.#syncMatrixAliases();
        return this;
      }

      inverse() {
        return new RuntimeDOMMatrix(this).invertSelf();
      }
    }

    globalThis.DOMMatrix = RuntimeDOMMatrix;
  }

  // pdfjs checks Path2D while its display bundle is loading. We only extract
  // text in this worker path, never render a page, so a no-op implementation is
  // intentionally enough and avoids adding a native canvas dependency.
  if (!globalThis.Path2D) {
    globalThis.Path2D = class RuntimePath2D {
      addPath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
      roundRect() {}
      closePath() {}
    };
  }
}

async function loadPdfJs() {
  installPdfJsRuntimeGlobals();
  pdfJsModulePromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfJsModulePromise;
}

function assertPdfBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new TypeError("A non-empty PDF byte array is required.");
  }
}

function assertMinimumTextCharacters(value) {
  if (!Number.isInteger(value) || value < 1 || value > 100_000) {
    throw new TypeError("minimumTextCharacters must be an integer between 1 and 100000.");
  }
}

function normalizePageText(textContent) {
  return textContent.items
    .map((item) => item.str)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts text from a PDF without relying on a browser worker. This is safe
 * for Trigger.dev's Node runtime and deliberately does not persist the file.
 */
export async function inspectSearchablePdf({
  bytes,
  minimumTextCharacters = DEFAULT_MINIMUM_TEXT_CHARACTERS,
}) {
  assertPdfBytes(bytes);
  assertMinimumTextCharacters(minimumTextCharacters);

  const { getDocument } = await loadPdfJs();

  // pdfjs-dist refuses a Node Buffer specifically (even though Buffer is a
  // Uint8Array subclass and passes assertPdfBytes above) because a Buffer's
  // underlying ArrayBuffer can be a larger shared allocation pool -- copying
  // into a plain Uint8Array here removes that ambiguity. A caller that
  // already has a plain Uint8Array pays no extra copy.
  const data = bytes.constructor === Uint8Array ? bytes : new Uint8Array(bytes);

  const loadingTask = getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
    useWorkerFetch: false,
  });

  let document;
  try {
    document = await loadingTask.promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = normalizePageText(textContent);

      pages.push({
        pageNumber,
        text,
        characterCount: text.replace(/\s/g, "").length,
      });
    }

    const text = pages
      .map((page) => page.text)
      .filter(Boolean)
      .join("\n");
    const characterCount = text.replace(/\s/g, "").length;

    return {
      pageCount: document.numPages,
      pages,
      text,
      characterCount,
      minimumTextCharacters,
      isSearchable: characterCount >= minimumTextCharacters,
    };
  } finally {
    document?.cleanup?.();
    await loadingTask.destroy();
  }
}
