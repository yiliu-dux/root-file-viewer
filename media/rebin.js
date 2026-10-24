// Rebin menu for 2D histograms (THn with two axes is drawn as TH2D, so it is
// covered too). Like JSROOT's 1D rebin, the drawn histogram is modified in
// place, so repeated rebins stack and reopening the item starts from scratch.
(() => {
  const factors = [2, 3, 4, 5, 10];
  const axisKeys = ["fNbins", "fXmax", "fXbins"];
  const histoKeys = ["fNcells", "fArray", "fSumw2"];
  const originals = new WeakMap();

  const pick = (obj, keys) =>
    Object.fromEntries(keys.map((key) => [key, obj[key]]));

  // Same as TH2::Rebin2D: when the bin count is not a multiple of ngroup the
  // upper edge is lowered and the leftover bins go to the overflow bin.
  // Labels stay attached to their bin number, as in ROOT.
  // Returns a function mapping old bin indices to new ones.
  const rebinAxis = (axis, ngroup) => {
    const nbins = Math.floor(axis.fNbins / ngroup);
    const edges = axis.fXbins;
    if (edges.length) {
      axis.fXbins = Array.from({ length: nbins + 1 }, (_, i) => edges[i * ngroup]);
      axis.fXmax = axis.fXbins[nbins];
    } else {
      axis.fXmax =
        axis.fXmin + ((axis.fXmax - axis.fXmin) * nbins * ngroup) / axis.fNbins;
    }
    axis.fNbins = nbins;
    return (bin) => Math.min(Math.ceil(bin / ngroup), nbins + 1);
  };

  const redraw = (painter) => {
    // Projections are cached with the old binning
    delete painter.proj_hist;
    delete painter.proj_hist2;
    painter.scanContent();
    painter.interactiveRedraw("pad");
  };

  const rebin = (painter, nx, ny) => {
    const histo = painter.getHisto();
    const { fXaxis: xaxis, fYaxis: yaxis } = histo;
    if (nx > xaxis.fNbins || ny > yaxis.fNbins) {
      return;
    }
    if (!originals.has(painter)) {
      originals.set(painter, {
        histo: pick(histo, histoKeys),
        xaxis: pick(xaxis, axisKeys),
        yaxis: pick(yaxis, axisKeys),
      });
    }

    const oldNx = xaxis.fNbins + 2;
    const oldNy = yaxis.fNbins + 2;
    const mapX = rebinAxis(xaxis, nx);
    const mapY = rebinAxis(yaxis, ny);
    const newNx = xaxis.fNbins + 2;
    const ncells = newNx * (yaxis.fNbins + 2);
    const hasSumw2 = histo.fSumw2?.length === histo.fNcells;
    const content = new Array(ncells).fill(0);
    const sumw2 = hasSumw2 ? new Array(ncells).fill(0) : [];
    for (let j = 0; j < oldNy; ++j) {
      for (let i = 0; i < oldNx; ++i) {
        const bin = mapX(i) + newNx * mapY(j);
        content[bin] += histo.fArray[i + oldNx * j];
        if (hasSumw2) {
          sumw2[bin] += histo.fSumw2[i + oldNx * j];
        }
      }
    }

    Object.assign(histo, { fNcells: ncells, fArray: content, fSumw2: sumw2 });
    redraw(painter);
  };

  const reset = (painter) => {
    const original = originals.get(painter);
    const histo = painter.getHisto();
    Object.assign(histo, original.histo);
    Object.assign(histo.fXaxis, original.xaxis);
    Object.assign(histo.fYaxis, original.yaxis);
    originals.delete(painter);
    redraw(painter);
  };

  const install = (jsroot) => {
    const prototype = jsroot.TH2Painter.prototype;
    const fillHistContextMenu = prototype.fillHistContextMenu;
    prototype.fillHistContextMenu = function (menu) {
      fillHistContextMenu.call(this, menu);
      if (this.isTH2Poly() || this.hasSnapId()) {
        return;
      }
      // Same layout as JSROOT's "Projections" menu
      menu.sub("Rebin");
      ["X", "Y", "XY"].forEach((name) => {
        menu.column();
        if (originals.has(this)) {
          menu.add("Reset", () => reset(this));
        }
        factors.forEach((n) =>
          menu.add(name + n, () =>
            rebin(this, name === "Y" ? 1 : n, name === "X" ? 1 : n)
          )
        );
        menu.endcolumn();
      });
      menu.endsub();
    };
  };

  globalThis.rootFileViewerRebin = { install };
})();
