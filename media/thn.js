// THn / THnSparse support. JSROOT can read these classes through their
// streamer infos but has no painter for them, so they are converted to an
// equivalent TH1D / TH2D / TH3D before drawing. Histograms with more than
// three dimensions are projected onto their first three axes.
(() => {
  // Same as THnSparseCompactBinCoord::GetNumBits in ROOT
  const getNumBits = (n) => {
    let r = n > 0 ? 1 : 0;
    while ((n = Math.floor(n / 2))) {
      ++r;
    }
    return r;
  };

  // Stream THnSparseArrayChunk by hand: the generic streamer reads the
  // Char_t* coordinate buffer as a string, which stops at the first zero byte
  const streamSparseChunk = (buf, obj) => {
    buf.classStreamer(obj, "TObject");
    obj.fSingleCoordinateSize = buf.ntoi4();
    obj.fCoordinatesSize = buf.ntoi4();
    obj.fCoordinates = new Uint8Array(obj.fCoordinatesSize);
    if (buf.ntou1() === 1) {
      for (let i = 0; i < obj.fCoordinatesSize; ++i) {
        obj.fCoordinates[i] = buf.ntou1();
      }
    }
    obj.fContent = buf.readObjectAny();
    obj.fSumw2 = buf.readObjectAny();
  };

  // Calls fn(coords, content, sumw2) for every stored bin, where coords holds
  // one bin index per dimension, including underflow (0) and overflow (n + 1)
  const forEachDenseBin = (thn, nbins, fn) => {
    const ndim = nbins.length;
    const data = thn.fArray.fData;
    const sumw2 = thn.fSumw2?.fData;
    const hasSumw2 = sumw2 && sumw2.length === data.length;
    const coords = new Array(ndim).fill(0);
    for (let i = 0; i < data.length; ++i) {
      if (data[i] || (hasSumw2 && sumw2[i])) {
        // Last dimension varies fastest (see TNDArray::GetBin)
        let rest = i;
        for (let d = ndim - 1; d >= 0; --d) {
          coords[d] = rest % (nbins[d] + 2);
          rest = Math.floor(rest / (nbins[d] + 2));
        }
        fn(coords, data[i], hasSumw2 ? sumw2[i] : undefined);
      }
    }
  };

  const forEachSparseBin = (thn, nbins, fn) => {
    const ndim = nbins.length;
    const bitOffsets = [0];
    for (let d = 0; d < ndim; ++d) {
      bitOffsets.push(bitOffsets[d] + getNumBits(nbins[d] + 2));
    }
    const coords = new Array(ndim).fill(0);
    for (const chunk of thn.fBinContent?.arr ?? []) {
      const size = chunk.fSingleCoordinateSize;
      const raw = chunk.fCoordinates;
      const content = chunk.fContent?.fArray ?? chunk.fContent ?? [];
      const sumw2 = chunk.fSumw2?.fArray ?? chunk.fSumw2;
      const nfilled = size ? Math.floor(chunk.fCoordinatesSize / size) : 0;
      for (let i = 0; i < nfilled; ++i) {
        const base = i * size;
        for (let d = 0; d < ndim; ++d) {
          // Coordinates are bit-packed, least significant bit first
          let value = 0;
          for (let b = bitOffsets[d]; b < bitOffsets[d + 1]; ++b) {
            if ((raw[base + (b >> 3)] >> (b & 7)) & 1) {
              value += 2 ** (b - bitOffsets[d]);
            }
          }
          coords[d] = value;
        }
        fn(coords, content[i], sumw2 ? sumw2[i] : undefined);
      }
    }
  };

  const copyAxis = (src, dst) => {
    dst.fName = src.fName;
    dst.fTitle = src.fTitle;
    dst.fNbins = src.fNbins;
    dst.fXmin = src.fXmin;
    dst.fXmax = src.fXmax;
    const edges = src.fXbins;
    dst.fXbins = edges?.length ? Array.from(edges) : [];
    dst.fLabels = src.fLabels;
    dst.fTimeDisplay = src.fTimeDisplay;
    dst.fTimeFormat = src.fTimeFormat;
  };

  const convertToHistogram = (jsroot, thn) => {
    const axes = thn.fAxes.arr;
    const ndim = Math.min(axes.length, 3);
    const nbins = axes.map((axis) => axis.fNbins);
    const typename = `TH${ndim}D`;
    const hist = jsroot.createHistogram(typename, ...nbins.slice(0, ndim));
    hist.fName = thn.fName;
    hist.fTitle =
      axes.length > 3
        ? `${thn.fTitle} (projection on axes 0, 1, 2)`
        : thn.fTitle;
    ["fXaxis", "fYaxis", "fZaxis"]
      .slice(0, ndim)
      .forEach((name, d) => copyAxis(axes[d], hist[name]));

    const isSparse = thn._typename.startsWith("THnSparse");
    // Dense THn only stores fSumw2 after Sumw2() was called; sparse chunks
    // have a null fSumw2 in that case
    let sumw2 = null;
    const fill = (coords, content, binSumw2) => {
      let bin = 0;
      for (let d = ndim - 1; d >= 0; --d) {
        bin = bin * (nbins[d] + 2) + coords[d];
      }
      hist.fArray[bin] += content;
      if (binSumw2 !== undefined) {
        sumw2 ??= new Float64Array(hist.fNcells);
        sumw2[bin] += binSumw2;
      }
    };
    (isSparse ? forEachSparseBin : forEachDenseBin)(thn, nbins, fill);

    hist.fSumw2 = sumw2 ? Array.from(sumw2) : [];
    hist.fEntries = thn.fEntries;
    return hist;
  };

  const install = (jsroot) => {
    jsroot.addUserStreamer("THnSparseArrayChunk", streamSparseChunk);
    jsroot.addDrawFunc({
      name: /^THn(Sparse)?T</,
      icon: "img_histo2d",
      func: (dom, obj, opt) =>
        jsroot.draw(dom, convertToHistogram(jsroot, obj), opt),
    });
  };

  globalThis.rootFileViewerTHn = { install, convertToHistogram };
})();
