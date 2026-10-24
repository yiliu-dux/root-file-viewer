(() => {
  const vscode = acquireVsCodeApi();

  const jsroot = this.JSROOT;
  const dataset = document.getElementById("script").dataset;

  this.rootFileViewerTHn.install(jsroot);
  this.rootFileViewerLatex3D.install(jsroot);
  this.rootFileViewerRebin.install(jsroot);

  // projections of a 2D histogram use log y by default when log z is on
  const canvasPrototype = jsroot.TCanvasPainter.prototype;
  const drawInSidePanel = canvasPrototype.drawInSidePanel;
  canvasPrototype.drawInSidePanel = function (canv, opt, kind) {
    canv.fLogy = this.getRootPad().fLogz;
    return drawInSidePanel.call(this, canv, opt, kind);
  };

  const th2Prototype = jsroot.TH2Painter.prototype;
  const redraw = th2Prototype.redraw;
  th2Prototype.redraw = function (reason) {
    if (reason === "logz") {
      const logz = this.getPadPainter().getRootPad().fLogz;
      Object.values(this.getCanvPainter()?.proj_painter ?? {}).forEach((p) => {
        const pad = p?.getRootPad?.();
        if (pad) {
          pad.fLogy = logz;
          p.redrawPad();
        }
      });
    }
    return redraw.call(this, reason);
  };

  const settings = jsroot.settings;
  settings.DarkMode = dataset.darkMode === "true";
  settings.Palette = parseInt(dataset.palette);

  const h = new jsroot.HierarchyPainter("ROOT File Hierarchy");
  h.no_select = true;
  h.show_overflow = true;
  h.prepareGuiDiv("hierarchy", dataset.layout);
  h.createBrowser("browser").then(() => {
    const titleParagraph = document.querySelector(".jsroot_browser_title");
    if (titleParagraph) {
      titleParagraph.remove();
    }

    h.openRootFile(dataset.fileUri);
  });

  // add "Copy path" to the item context menu, just above "Close"
  const treeContextMenu = h.tree_contextmenu.bind(h);
  h.tree_contextmenu = (evnt, elem) => {
    const name = elem.parentNode.parentNode.getAttribute("item");
    const item = name && h.findItem(name);
    if (item && !item._copyPath) {
      const menu = item._menu;
      item._copyPath = true;
      item._menu = (m, ...args) => {
        m.add("Copy path", () => navigator.clipboard.writeText(name));
        if (menu) menu(m, ...args);
      };
    }
    return treeContextMenu(evnt, elem);
  };

  jsroot.setSaveFile((filename, content) => {
    vscode.postMessage({
      type: "save",
      filename,
      content: window.btoa(content),
    });
  });
})();
