// TeX axis titles in 3D drawings. 1D/2D plots are SVG and JSROOT renders
// titles containing TeX (e.g. "p_\text{T}^\text{reco} \text{[GeV]}") with
// MathJax, but 3D axis titles are built as three.js geometry by JSROOT's own
// TLatex parser, which only understands ROOT's "#" syntax. While a histogram
// is drawn in 3D its TeX axis titles are therefore temporarily replaced with
// their TLatex translation ("p_{T}^{reco} [GeV]").
(() => {
  // TeX commands whose TLatex spelling differs from "#" + name
  const texToLatexCommands = {
    text: "",
    textrm: "",
    mathrm: "",
    rm: "",
    mathit: "#it",
    textit: "#it",
    mathbf: "#bf",
    textbf: "#bf",
    cdot: "#upoint",
    to: "#rightarrow",
    gets: "#leftarrow",
    le: "#leq",
    ge: "#geq",
    ne: "#neq",
    langle: "#LT",
    rangle: "#GT",
    ldots: "...",
    dots: "...",
    ",": " ",
    ":": " ",
    ";": " ",
    " ": " ",
    "!": "",
    quad: "  ",
    qquad: "    ",
  };

  const texToLatex = (tex) => {
    let pos = 0;

    // Reads a single argument: a {group}, a \command or one character
    const readArgument = () => {
      while (tex[pos] === " ") {
        ++pos;
      }
      if (tex[pos] === "{") {
        ++pos;
        return readUntil("}");
      }
      if (tex[pos] === "\\") {
        return readCommand();
      }
      return pos < tex.length ? tex[pos++] : "";
    };

    const readCommand = () => {
      ++pos; // skip the backslash
      let name = tex[pos++] ?? "";
      if (/[a-zA-Z]/.test(name)) {
        while (/[a-zA-Z]/.test(tex[pos] ?? "")) {
          name += tex[pos++];
        }
      }
      if ("{}%$&_#".includes(name)) {
        return name === "{" || name === "}" ? `#${name}` : name;
      }
      if (name === "left" || name === "right") {
        if (tex[pos] === "\\") {
          ++pos;
        }
        return `#${name}${tex[pos++] ?? ""}`;
      }
      if (name === "frac") {
        return `#frac{${readArgument()}}{${readArgument()}}`;
      }
      if (name === "sqrt") {
        return `#sqrt{${readArgument()}}`;
      }
      const replacement = texToLatexCommands[name];
      if (replacement === undefined) {
        return `#${name}`;
      }
      if (/^(text|textrm|mathrm|mathit|textit|mathbf|textbf)$/.test(name)) {
        const arg = readArgument();
        return replacement ? `${replacement}{${arg}}` : arg;
      }
      return replacement;
    };

    const readUntil = (end) => {
      let out = "";
      while (pos < tex.length) {
        const c = tex[pos];
        if (c === end) {
          ++pos;
          return out;
        }
        if (c === "\\") {
          out += readCommand();
        } else if (c === "_" || c === "^") {
          ++pos;
          out += `${c}{${readArgument()}}`;
        } else if (c === "{") {
          ++pos;
          out += readUntil("}");
        } else if (c === "$") {
          ++pos;
        } else {
          out += c;
          ++pos;
        }
      }
      return out;
    };

    return readUntil(undefined);
  };

  const isTex = (title) => /[\\$]/.test(title ?? "");

  // Original axis titles of histograms currently being drawn in 3D, with a
  // count of the draws in flight so that overlapping redraws (e.g. a resize
  // during a draw) restore the titles only once the last one finishes
  const active = new WeakMap();

  const translateAxisTitles = (histo) => {
    if (!histo) {
      return () => {};
    }
    const axes = [histo.fXaxis, histo.fYaxis, histo.fZaxis].filter(Boolean);
    let state = active.get(histo);
    if (!state) {
      state = { depth: 0, titles: axes.map((axis) => axis.fTitle) };
      axes.forEach((axis) => {
        if (isTex(axis.fTitle)) {
          axis.fTitle = texToLatex(axis.fTitle);
        }
      });
      active.set(histo, state);
    }
    ++state.depth;
    return () => {
      if (--state.depth === 0) {
        axes.forEach((axis, i) => (axis.fTitle = state.titles[i]));
        active.delete(histo);
      }
    };
  };

  // Methods that build the 3D frame, and with it the axis titles
  const draw3DMethods = [
    ["TH1Painter", "draw3D"],
    ["TH2Painter", "draw3D"],
    ["TH3Painter", "redraw"],
  ];

  const install = (jsroot) => {
    for (const [className, method] of draw3DMethods) {
      const prototype = jsroot[className]?.prototype;
      const original = prototype?.[method];
      if (typeof original !== "function") {
        continue;
      }
      prototype[method] = async function (...args) {
        const restore = translateAxisTitles(this.getHisto());
        try {
          return await original.apply(this, args);
        } finally {
          restore();
        }
      };
    }
  };

  globalThis.rootFileViewerLatex3D = { install, texToLatex };
})();
