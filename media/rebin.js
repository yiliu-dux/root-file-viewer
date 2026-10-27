// Rebin menu for 2D histograms (THn with two axes is drawn as TH2D, so it is
// covered too). Like JSROOT's 1D rebin, the drawn histogram is modified in
// place, so repeated rebins stack and reopening the item starts from scratch.
// For a 2D TEfficiency, rebinning and projections combine its passed and total
// histograms instead of summing the drawn efficiencies. Projections are drawn
// with error bars.
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
    // Projections are cached with the old binning. They are rebinned in place
    // rather than deleted: the side panel only follows zoom and log scale for
    // the histogram object it is drawing, not for a replacement.
    const histo = painter.getHisto();
    [painter.proj_hist, painter.proj_hist2].forEach((proj) => {
      if (proj) {
        const axis = proj.fName === "xproj" ? histo.fXaxis : histo.fYaxis;
        Object.assign(proj.fXaxis, pick(axis, axisKeys));
        proj.fNcells = axis.fNbins + 2;
        proj.fArray = new Array(proj.fNcells).fill(0);
        proj.fSumw2 = [];
      }
    });
    painter.scanContent();
    painter.interactiveRedraw("pad");
  };

  // Rebins one histogram in place: contents and sumw2 are summed
  const rebinHisto = (histo, nx, ny) => {
    const { fXaxis: xaxis, fYaxis: yaxis } = histo;
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
  };

  // A 2D TEfficiency is drawn as a TH2 of passed/total, which must not be
  // summed: its passed and total histograms are combined instead
  const getEfficiency = (painter) => {
    const primary = painter.getPrimary();
    return primary?.getObject()?._typename === "TEfficiency" ? primary : null;
  };

  const rebin = (painter, nx, ny) => {
    const histo = painter.getHisto();
    if (nx > histo.fXaxis.fNbins || ny > histo.fYaxis.fNbins) {
      return;
    }
    const effPainter = getEfficiency(painter);
    const eff = effPainter?.getObject();
    const histos = eff
      ? [histo, eff.fTotalHistogram, eff.fPassedHistogram]
      : [histo];
    if (!originals.has(painter)) {
      originals.set(
        painter,
        histos.map((h) => ({
          h,
          histo: pick(h, histoKeys),
          xaxis: pick(h.fXaxis, axisKeys),
          yaxis: pick(h.fYaxis, axisKeys),
        }))
      );
    }

    histos.forEach((h) => rebinHisto(h, nx, ny));
    effPainter?.fillHisto(histo);
    redraw(painter);
  };

  const reset = (painter) => {
    originals.get(painter).forEach(({ h, histo, xaxis, yaxis }) => {
      Object.assign(h, histo);
      Object.assign(h.fXaxis, xaxis);
      Object.assign(h.fYaxis, yaxis);
    });
    originals.delete(painter);
    redraw(painter);
  };

  // Sums f(bin) over the projected bins of the 2D histogram, for each bin of
  // the projection. The bin range is not passed on to drawInSpecialArea, hence
  // it is kept in redrawProjection.
  const projectSums = (painter, proj, f) => {
    const [i1, i2, j1, j2] = painter.projectionRange;
    const nx = painter.getHisto().fXaxis.fNbins + 2;
    const isX = proj.fName === "xproj";
    return Array.from({ length: proj.fXaxis.fNbins + 2 }, (_, k) => {
      let sum = 0;
      for (let l = isX ? j1 : i1; l < (isX ? j2 : i2); ++l) {
        sum += f(isX ? k + nx * (l + 1) : l + 1 + nx * k);
      }
      return sum;
    });
  };

  // JSROOT fills projections with sums of the drawn bins, so for TEfficiency
  // they are refilled from the summed passed and total histograms
  const projectEfficiency = (painter, effPainter, proj) => {
    const eff = effPainter.getObject();
    const { fTotalHistogram: total, fPassedHistogram: passed } = eff;
    const hasSumw2 = total.fSumw2?.length === total.fNcells;
    const sum = (array) => projectSums(painter, proj, (bin) => array[bin]);

    // Same statistics options as the TEfficiency; per-bin priors are dropped
    const projected = Object.create(eff);
    Object.assign(projected, {
      fTotalHistogram: {
        fArray: sum(total.fArray),
        fSumw2: hasSumw2 && sum(total.fSumw2),
      },
      fPassedHistogram: { fArray: sum(passed.fArray) },
    });
    projected.fBeta_bin_params = [];
    proj.fArray = projected.fTotalHistogram.fArray.map((_, k) =>
      effPainter.getEfficiency(projected, k)
    );

    // Asymmetric errors as for a 1D TEfficiency, see getBinErrors below.
    // Empty bins get none, so they are not drawn.
    proj.binErrors = proj.fArray.map((value, k) =>
      projected.fTotalHistogram.fArray[k]
        ? {
            low: effPainter.getEfficiencyErrorLow(projected, k, value),
            up: effPainter.getEfficiencyErrorUp(projected, k, value),
          }
        : { low: 0, up: 0 }
    );
    // Only used by JSROOT to decide that error bars are drawn
    proj.fSumw2 = proj.binErrors.map(({ low, up }) => ((low + up) / 2) ** 2);
  };

  const install = (jsroot) => {
    const prototype = jsroot.TH2Painter.prototype;

    const redrawProjection = prototype.redrawProjection;
    prototype.redrawProjection = function (i1, i2, j1, j2) {
      // Same default as JSROOT: the bin under the cursor
      if (j2 === undefined && this.tt_handle) {
        i1 = Math.round((this.tt_handle.i1 + this.tt_handle.i2) / 2);
        i2 = i1 + 1;
        j1 = Math.round((this.tt_handle.j1 + this.tt_handle.j2) / 2);
        j2 = j1 + 1;
      }
      this.projectionRange = [i1, i2, j1, j2];
      return redrawProjection.call(this, i1, i2, j1, j2);
    };

    const drawInSpecialArea = prototype.drawInSpecialArea;
    prototype.drawInSpecialArea = function (obj, opt, kind) {
      const effPainter = getEfficiency(this);
      if (effPainter && this.projectionRange) {
        projectEfficiency(this, effPainter, obj);
      } else if (this.projectionRange) {
        // Errors add in quadrature, as in TH2::ProjectionX
        const histo = this.getHisto();
        const err2 = (bin) => histo.getBinError(bin) ** 2;
        obj.fSumw2 = projectSums(this, obj, err2);
      }
      return drawInSpecialArea.call(this, obj, opt, kind);
    };

    // Lets a projection carry asymmetric errors (TH1 has no such field)
    const th1Prototype = jsroot.TH1Painter.prototype;
    const getBinErrors = th1Prototype.getBinErrors;
    th1Prototype.getBinErrors = function (histo, bin, content) {
      return (
        histo.binErrors?.[bin] ?? getBinErrors.call(this, histo, bin, content)
      );
    };

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
