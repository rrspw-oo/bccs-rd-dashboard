(function (root) {
  var LAYER_ORDER = ["app", "infra", "system", "output"];

  var DEFAULT_LAYER_META = {
    app:    { label: "權威資料來源層", sub: "單一事實、對外入口" },
    infra:  { label: "共用能力層",     sub: "建一次、全公司呼叫" },
    system: { label: "業務系統層",     sub: "只組裝、不重造" },
    output: { label: "產出物層",       sub: "交付客戶與內部" }
  };

  var BAND_FILL = {
    app:    "hsl(215,42%,97%)",
    infra:  "hsl(178,42%,96%)",
    system: "hsl(262,32%,97%)",
    output: "hsl(35,52%,96%)"
  };

  var BAND_STROKE = {
    app:    "hsl(215,42%,86%)",
    infra:  "hsl(178,42%,82%)",
    system: "hsl(262,32%,87%)",
    output: "hsl(35,52%,84%)"
  };

  var EDGE_STYLE = {
    active:  { stroke: "hsl(178,42%,40%)", width: 1.8, dasharray: "none" },
    planned: { stroke: "hsl(35,52%,48%)",  width: 1.8, dasharray: "6,4" },
    missing: { stroke: "hsl(8,48%,50%)",   width: 1.8, dasharray: "3,4" }
  };

  var DEFAULT_OPTIONS = {
    width: 1180,
    nodeWidth: 160,
    nodeHeight: 64,
    hGap: 24,
    vGap: 16,
    layerGap: 80,
    padding: 40,
    bandPaddingTop: 40,
    bandPaddingBottom: 20,
    bandPaddingX: 16
  };

  function mergeOptions(options) {
    var result = {};
    for (var k in DEFAULT_OPTIONS) result[k] = DEFAULT_OPTIONS[k];
    if (options) {
      for (var k in options) {
        if (options[k] !== undefined && options[k] !== null) result[k] = options[k];
      }
    }
    return result;
  }

  function mergeLayerMeta(override) {
    var result = {};
    for (var k in DEFAULT_LAYER_META) {
      result[k] = { label: DEFAULT_LAYER_META[k].label, sub: DEFAULT_LAYER_META[k].sub };
    }
    if (override) {
      for (var k in override) {
        if (!result[k]) result[k] = {};
        if (override[k].label !== undefined) result[k].label = override[k].label;
        if (override[k].sub !== undefined) result[k].sub = override[k].sub;
      }
    }
    return result;
  }

  function normalizeDep(dep) {
    if (typeof dep === "string") return { to: dep, type: "active" };
    if (dep && dep.to) return { to: dep.to, type: dep.type || "active" };
    return null;
  }

  function medianOf(arr) {
    if (arr.length === 0) return null;
    var sorted = arr.slice().sort(function(a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function assignPos(layerItems) {
    for (var i = 0; i < layerItems.length; i++) {
      layerItems[i]._pos = i;
    }
  }

  function barycenterSort(layerItems, neighborPosGetter) {
    var scores = [];
    for (var i = 0; i < layerItems.length; i++) {
      var item = layerItems[i];
      var neighborPositions = neighborPosGetter(item);
      var med = medianOf(neighborPositions);
      scores.push({ item: item, median: med === null ? item._pos : med, origPos: item._pos });
    }
    scores.sort(function(a, b) {
      if (a.median !== b.median) return a.median - b.median;
      return a.origPos - b.origPos;
    });
    var result = [];
    for (var i = 0; i < scores.length; i++) result.push(scores[i].item);
    assignPos(result);
    return result;
  }

  function layoutSystems(systems, options) {
    var opts = mergeOptions(options);
    var layerMeta = mergeLayerMeta(options && options.layerMeta ? options.layerMeta : null);

    var idSet = {};
    for (var i = 0; i < systems.length; i++) idSet[systems[i].id] = true;

    var incomingCount = {};
    for (var i = 0; i < systems.length; i++) incomingCount[systems[i].id] = 0;

    var rawEdges = [];
    for (var i = 0; i < systems.length; i++) {
      var sys = systems[i];
      if (sys.dependsOn) {
        for (var j = 0; j < sys.dependsOn.length; j++) {
          var nd = normalizeDep(sys.dependsOn[j]);
          if (nd && idSet[nd.to]) {
            incomingCount[nd.to] = (incomingCount[nd.to] || 0) + 1;
            rawEdges.push({ from: sys.id, to: nd.to, type: nd.type });
          }
        }
      }
    }

    var layerMap = {};
    for (var i = 0; i < systems.length; i++) {
      var sys = systems[i];
      var layer = sys.layer;
      if (!layerMap[layer]) layerMap[layer] = [];
      layerMap[layer].push(sys);
    }

    for (var layer in layerMap) {
      layerMap[layer].sort(function (a, b) {
        var ca = incomingCount[a.id] || 0;
        var cb = incomingCount[b.id] || 0;
        if (cb !== ca) return cb - ca;
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });
    }

    function getOrderedLayers() {
      var result = [];
      for (var i = 0; i < LAYER_ORDER.length; i++) {
        if (layerMap[LAYER_ORDER[i]] && layerMap[LAYER_ORDER[i]].length > 0) {
          result.push(LAYER_ORDER[i]);
        }
      }
      return result;
    }

    var orderedLayers = getOrderedLayers();

    for (var li = 0; li < orderedLayers.length; li++) {
      assignPos(layerMap[orderedLayers[li]]);
    }

    var sysLayerIndex = {};
    for (var li = 0; li < orderedLayers.length; li++) {
      var items = layerMap[orderedLayers[li]];
      for (var ii = 0; ii < items.length; ii++) {
        sysLayerIndex[items[ii].id] = li;
      }
    }

    var upNeighbors = {};
    var downNeighbors = {};
    for (var i = 0; i < systems.length; i++) upNeighbors[systems[i].id] = [];
    for (var i = 0; i < systems.length; i++) downNeighbors[systems[i].id] = [];

    for (var ei = 0; ei < rawEdges.length; ei++) {
      var e = rawEdges[ei];
      var fromLi = sysLayerIndex[e.from];
      var toLi = sysLayerIndex[e.to];
      if (fromLi === undefined || toLi === undefined) continue;
      if (Math.abs(fromLi - toLi) !== 1) continue;
      if (fromLi < toLi) {
        downNeighbors[e.from].push(e.to);
        upNeighbors[e.to].push(e.from);
      } else {
        upNeighbors[e.from].push(e.to);
        downNeighbors[e.to].push(e.from);
      }
    }

    function getPosOf(id) {
      var li = sysLayerIndex[id];
      if (li === undefined) return 0;
      var items = layerMap[orderedLayers[li]];
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return items[i]._pos;
      }
      return 0;
    }

    var ITERATIONS = 6;
    for (var iter = 0; iter < ITERATIONS; iter++) {
      if (iter % 2 === 0) {
        for (var li = 1; li < orderedLayers.length; li++) {
          var layer = orderedLayers[li];
          layerMap[layer] = barycenterSort(layerMap[layer], function(item) {
            var neighbors = upNeighbors[item.id];
            var positions = [];
            for (var k = 0; k < neighbors.length; k++) positions.push(getPosOf(neighbors[k]));
            return positions;
          });
        }
      } else {
        for (var li = orderedLayers.length - 2; li >= 0; li--) {
          var layer = orderedLayers[li];
          layerMap[layer] = barycenterSort(layerMap[layer], function(item) {
            var neighbors = downNeighbors[item.id];
            var positions = [];
            for (var k = 0; k < neighbors.length; k++) positions.push(getPosOf(neighbors[k]));
            return positions;
          });
        }
      }
    }

    var nodeMap = {};
    var nodes = [];

    var yPos = opts.padding + opts.bandPaddingTop;
    var innerWidth = opts.width - 2 * opts.padding;

    for (var li = 0; li < orderedLayers.length; li++) {
      var layer = orderedLayers[li];
      var items = layerMap[layer];
      var n = items.length;

      var usableWidth = innerWidth - 2 * opts.bandPaddingX;

      var hGapActual = opts.hGap;
      if (n > 1) {
        var spread = usableWidth - n * opts.nodeWidth;
        if (spread > 0) hGapActual = spread / (n - 1);
      }

      var rowW = n * opts.nodeWidth + (n - 1) * hGapActual;
      var startX = opts.padding + opts.bandPaddingX + (usableWidth - rowW) / 2;

      for (var ii = 0; ii < items.length; ii++) {
        var sys = items[ii];
        var xPos = startX + ii * (opts.nodeWidth + hGapActual);
        var node = {
          id: sys.id,
          name: sys.name,
          owner: sys.owner,
          layer: sys.layer,
          status: sys.status,
          x: xPos,
          y: yPos,
          w: opts.nodeWidth,
          h: opts.nodeHeight
        };
        nodes.push(node);
        nodeMap[sys.id] = node;
      }

      yPos += opts.nodeHeight + opts.bandPaddingBottom;
      if (li < orderedLayers.length - 1) {
        yPos += opts.layerGap + opts.bandPaddingTop;
      }
    }

    var edges = [];
    for (var i = 0; i < systems.length; i++) {
      var sys = systems[i];
      if (sys.dependsOn) {
        for (var j = 0; j < sys.dependsOn.length; j++) {
          var nd = normalizeDep(sys.dependsOn[j]);
          if (nd && idSet[nd.to]) {
            edges.push({ from: sys.id, to: nd.to, type: nd.type });
          }
        }
      }
    }

    var bands = [];
    for (var li = 0; li < orderedLayers.length; li++) {
      var layer = orderedLayers[li];
      var layerNodes = [];
      for (var ni = 0; ni < nodes.length; ni++) {
        if (nodes[ni].layer === layer) layerNodes.push(nodes[ni]);
      }
      if (layerNodes.length === 0) continue;
      var minY = Infinity;
      var maxY = -Infinity;
      for (var ni = 0; ni < layerNodes.length; ni++) {
        var nd = layerNodes[ni];
        if (nd.y < minY) minY = nd.y;
        if (nd.y + nd.h > maxY) maxY = nd.y + nd.h;
      }
      var bandY = minY - opts.bandPaddingTop;
      var bandH = (maxY - minY) + opts.bandPaddingTop + opts.bandPaddingBottom;
      var meta = layerMeta[layer] || { label: layer, sub: "" };
      bands.push({
        layer: layer,
        label: meta.label,
        sublabel: meta.sub,
        x: 0,
        y: bandY,
        w: opts.width,
        h: bandH
      });
    }

    var maxX = 0;
    var maxY = 0;
    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      if (nd.x + nd.w > maxX) maxX = nd.x + nd.w;
      if (nd.y + nd.h > maxY) maxY = nd.y + nd.h;
    }

    var totalWidth = Math.max(maxX + opts.padding, opts.width);
    var totalHeight = maxY + opts.bandPaddingBottom + opts.padding;

    return {
      nodes: nodes,
      edges: edges,
      bands: bands,
      width: totalWidth,
      height: totalHeight
    };
  }

  function renderLayoutToSVG(layoutResult, options, extra) {
    var opts = mergeOptions(options);
    var nodes = layoutResult.nodes;
    var edges = layoutResult.edges;
    var bands = layoutResult.bands || [];
    var W = layoutResult.width;
    var H = layoutResult.height;
    var transformGoal = extra && extra.transformGoal ? extra.transformGoal : null;

    var nodeMap = {};
    for (var i = 0; i < nodes.length; i++) nodeMap[nodes[i].id] = nodes[i];

    var statusStyle = {
      active: {
        fill: "#ffffff",
        stroke: "#c9ced4",
        strokeWidth: 1.5,
        strokeDasharray: "none"
      },
      transforming: {
        fill: "hsl(35,52%,94%)",
        stroke: "hsl(35,52%,44%)",
        strokeWidth: 2,
        strokeDasharray: "6,3"
      },
      stalled: {
        fill: "hsl(8,48%,95%)",
        stroke: "hsl(8,48%,46%)",
        strokeWidth: 2,
        strokeDasharray: "6,3"
      },
      missing: {
        fill: "#ffffff",
        stroke: "hsl(8,48%,50%)",
        strokeWidth: 2,
        strokeDasharray: "3,4"
      }
    };

    var BANNER_H = transformGoal ? 56 : 0;
    var BANNER_MARGIN = transformGoal ? 12 : 0;
    var totalH = H + BANNER_H + BANNER_MARGIN;

    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + totalH + '" viewBox="0 0 ' + W + ' ' + totalH + '">');
    parts.push('<defs>');
    parts.push('<marker id="arr-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="hsl(178,42%,40%)" opacity="0.85"/></marker>');
    parts.push('<marker id="arr-planned" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="hsl(35,52%,48%)" opacity="0.85"/></marker>');
    parts.push('<marker id="arr-missing" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="hsl(8,48%,50%)" opacity="0.85"/></marker>');
    parts.push('</defs>');
    parts.push('<style>text { font-family: "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif; }</style>');
    parts.push('<rect width="' + W + '" height="' + totalH + '" fill="#f5f6f8"/>');

    if (transformGoal) {
      var bx = opts.padding;
      var by = 10;
      var bw = W - opts.padding * 2;
      var bh = BANNER_H - 4;
      parts.push('<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="8" fill="hsl(35,52%,94%)" stroke="hsl(35,52%,44%)" stroke-width="1.5" stroke-dasharray="5,4"/>');
      parts.push('<text x="' + (bx + 16) + '" y="' + (by + 22) + '" font-size="13" font-weight="700" fill="hsl(35,52%,32%)">' + escapeXml(transformGoal.title) + '</text>');
      parts.push('<text x="' + (bx + 16) + '" y="' + (by + 40) + '" font-size="11" fill="#8a929b">' + escapeXml(transformGoal.sub || '') + '</text>');
    }

    var yOff = BANNER_H + BANNER_MARGIN;

    for (var i = 0; i < bands.length; i++) {
      var band = bands[i];
      var fill = BAND_FILL[band.layer] || "hsl(0,0%,96%)";
      var stroke = BAND_STROKE[band.layer] || "hsl(0,0%,86%)";
      parts.push('<rect data-band="' + escapeXml(band.layer) + '" x="' + (band.x + 4) + '" y="' + (band.y + yOff) + '" width="' + (band.w - 8) + '" height="' + band.h + '" rx="11" ry="11" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1"/>');
      var labelX = band.x + 20;
      var labelY = band.y + yOff + 22;
      parts.push('<text x="' + labelX + '" y="' + labelY + '" font-size="13" font-weight="700" fill="#5a626b">' + escapeXml(band.label) + '<tspan font-size="11" font-weight="400" fill="#8a929b">　' + escapeXml(band.sublabel) + '</tspan></text>');
    }

    var bandByLayer = {};
    for (var bi = 0; bi < bands.length; bi++) {
      bandByLayer[bands[bi].layer] = bands[bi];
    }

    var layerOrderForEdge = ["app", "infra", "system", "output"];
    var presentLayersForEdge = [];
    for (var li2 = 0; li2 < layerOrderForEdge.length; li2++) {
      if (bandByLayer[layerOrderForEdge[li2]]) presentLayersForEdge.push(layerOrderForEdge[li2]);
    }

    var gutterYMap = {};
    for (var gi = 0; gi < presentLayersForEdge.length - 1; gi++) {
      var topLayer = presentLayersForEdge[gi];
      var botLayer = presentLayersForEdge[gi + 1];
      var topBand = bandByLayer[topLayer];
      var botBand = bandByLayer[botLayer];
      var gutterTop = topBand.y + topBand.h + yOff;
      var gutterBot = botBand.y + yOff;
      gutterYMap[gi] = (gutterTop + gutterBot) / 2;
    }

    var gutterEdgeCount = {};
    for (var gi = 0; gi < presentLayersForEdge.length - 1; gi++) {
      gutterEdgeCount[gi] = 0;
    }

    var edgeGutterAssign = [];
    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      var fromNode = nodeMap[edge.from];
      var toNode = nodeMap[edge.to];
      if (!fromNode || !toNode) { edgeGutterAssign.push(null); continue; }
      var fromLi = presentLayersForEdge.indexOf(fromNode.layer);
      var toLi = presentLayersForEdge.indexOf(toNode.layer);
      if (fromLi === -1 || toLi === -1) { edgeGutterAssign.push(null); continue; }
      var topLi = Math.min(fromLi, toLi);
      var botLi = Math.max(fromLi, toLi);
      var span = botLi - topLi;
      if (span >= 2) {
        var gutterIdx = botLi - 1;
        var slotIndex = gutterEdgeCount[gutterIdx] || 0;
        gutterEdgeCount[gutterIdx] = slotIndex + 1;
        edgeGutterAssign.push({ gutterIdx: gutterIdx, slot: slotIndex, span: span });
      } else {
        edgeGutterAssign.push({ span: 1 });
      }
    }

    var gutterSlotTotal = {};
    for (var gi2 = 0; gi2 < presentLayersForEdge.length - 1; gi2++) {
      gutterSlotTotal[gi2] = gutterEdgeCount[gi2] || 0;
    }

    function makeRoundedPath(pts, r) {
      if (pts.length < 2) return "";
      var d = "M " + pts[0][0] + " " + pts[0][1];
      for (var pi = 1; pi < pts.length - 1; pi++) {
        var prev = pts[pi - 1];
        var cur = pts[pi];
        var next = pts[pi + 1];
        var dx1 = cur[0] - prev[0];
        var dy1 = cur[1] - prev[1];
        var len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        var dx2 = next[0] - cur[0];
        var dy2 = next[1] - cur[1];
        var len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (len1 < 0.01 || len2 < 0.01) {
          d += " L " + cur[0] + " " + cur[1];
          continue;
        }
        var actualR = Math.min(r, len1 / 2, len2 / 2);
        var bx = cur[0] - (dx1 / len1) * actualR;
        var by = cur[1] - (dy1 / len1) * actualR;
        var ex = cur[0] + (dx2 / len2) * actualR;
        var ey = cur[1] + (dy2 / len2) * actualR;
        d += " L " + bx + " " + by;
        d += " Q " + cur[0] + " " + cur[1] + " " + ex + " " + ey;
      }
      var last = pts[pts.length - 1];
      d += " L " + last[0] + " " + last[1];
      return d;
    }

    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      var fromNode = nodeMap[edge.from];
      var toNode = nodeMap[edge.to];
      if (!fromNode || !toNode) continue;

      var eType = edge.type || "active";
      var eStyle = EDGE_STYLE[eType] || EDGE_STYLE.active;
      var dashAttr = eStyle.dasharray !== "none" ? ' stroke-dasharray="' + eStyle.dasharray + '"' : '';
      var markerId = "arr-" + eType;

      var assign = edgeGutterAssign[i];
      var span = assign ? assign.span : 1;

      var fromLi2 = presentLayersForEdge.indexOf(fromNode.layer);
      var toLi2 = presentLayersForEdge.indexOf(toNode.layer);
      var goingDown = toLi2 > fromLi2;

      var pathD;

      if (span === 1) {
        var sx1 = fromNode.x + fromNode.w / 2;
        var sy1, sy2, sx2;
        sx2 = toNode.x + toNode.w / 2;
        if (goingDown) {
          sy1 = fromNode.y + fromNode.h + yOff;
          sy2 = toNode.y + yOff;
        } else {
          sy1 = fromNode.y + yOff;
          sy2 = toNode.y + toNode.h + yOff;
        }
        var dy = Math.abs(sy2 - sy1) * 0.4;
        if (dy < 20) dy = 20;
        if (goingDown) {
          pathD = "M " + sx1 + " " + sy1 + " C " + sx1 + " " + (sy1 + dy) + " " + sx2 + " " + (sy2 - dy) + " " + sx2 + " " + sy2;
        } else {
          pathD = "M " + sx1 + " " + sy1 + " C " + sx1 + " " + (sy1 - dy) + " " + sx2 + " " + (sy2 + dy) + " " + sx2 + " " + sy2;
        }
      } else {
        var gutterIdx2 = assign.gutterIdx;
        var slot2 = assign.slot;
        var total2 = gutterSlotTotal[gutterIdx2] || 1;
        var gutterCenterY = gutterYMap[gutterIdx2];
        var gutterSpread = Math.min(12, (total2 - 1) * 4);
        var slotOffset = total2 > 1 ? (slot2 / (total2 - 1) - 0.5) * gutterSpread : 0;
        var gutterY = gutterCenterY + slotOffset;

        var fCx = fromNode.x + fromNode.w / 2;
        var tCx = toNode.x + toNode.w / 2;
        var startY, endY;
        if (goingDown) {
          startY = fromNode.y + fromNode.h + yOff;
          endY = toNode.y + yOff;
        } else {
          startY = fromNode.y + yOff;
          endY = toNode.y + toNode.h + yOff;
        }

        var pts = [
          [fCx, startY],
          [fCx, gutterY],
          [tCx, gutterY],
          [tCx, endY]
        ];
        pathD = makeRoundedPath(pts, 7);
      }

      parts.push('<path class="edge" data-edge-from="' + escapeXml(edge.from) + '" data-edge-to="' + escapeXml(edge.to) + '" data-edge-type="' + eType + '" d="' + pathD + '" fill="none" stroke="' + eStyle.stroke + '" stroke-width="' + eStyle.width + '"' + dashAttr + ' marker-end="url(#' + markerId + ')" opacity="0.75"/>');
    }

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var style = statusStyle[node.status] || statusStyle.active;
      var dashAttr = style.strokeDasharray !== "none" ? ' stroke-dasharray="' + style.strokeDasharray + '"' : '';
      var ny = node.y + yOff;

      parts.push('<g class="node" data-node="' + escapeXml(node.id) + '" style="cursor:pointer">');
      parts.push('<rect x="' + node.x + '" y="' + ny + '" width="' + node.w + '" height="' + node.h + '" rx="8" ry="8" fill="' + style.fill + '" stroke="' + style.stroke + '" stroke-width="' + style.strokeWidth + '"' + dashAttr + '/>');

      var nameY = node.owner ? ny + node.h / 2 - 6 : ny + node.h / 2 + 5;
      parts.push('<text x="' + (node.x + node.w / 2) + '" y="' + nameY + '" text-anchor="middle" font-size="13" font-weight="700" fill="#2b3036">' + escapeXml(node.name) + '</text>');
      if (node.owner) {
        parts.push('<text x="' + (node.x + node.w / 2) + '" y="' + (ny + node.h / 2 + 12) + '" text-anchor="middle" font-size="11" fill="#8a929b">' + escapeXml(node.owner) + '</text>');
      }
      parts.push('</g>');
    }

    var legendY = totalH - 36;
    parts.push('<line x1="' + (opts.padding) + '" y1="' + (legendY - 6) + '" x2="' + (W - opts.padding) + '" y2="' + (legendY - 6) + '" stroke="#e3e6ea" stroke-width="1"/>');

    var lx = opts.padding;
    parts.push('<line x1="' + lx + '" y1="' + legendY + '" x2="' + (lx + 24) + '" y2="' + legendY + '" stroke="hsl(178,42%,40%)" stroke-width="1.8"/>');
    parts.push('<text x="' + (lx + 30) + '" y="' + (legendY + 4) + '" font-size="11" fill="#5a626b">現行介接</text>');

    lx += 110;
    parts.push('<line x1="' + lx + '" y1="' + legendY + '" x2="' + (lx + 24) + '" y2="' + legendY + '" stroke="hsl(35,52%,48%)" stroke-width="1.8" stroke-dasharray="6,4"/>');
    parts.push('<text x="' + (lx + 30) + '" y="' + (legendY + 4) + '" font-size="11" fill="#5a626b">應介接、尚未做（重複開發風險）</text>');

    lx += 230;
    parts.push('<line x1="' + lx + '" y1="' + legendY + '" x2="' + (lx + 24) + '" y2="' + legendY + '" stroke="hsl(8,48%,50%)" stroke-width="1.8" stroke-dasharray="3,4"/>');
    parts.push('<text x="' + (lx + 30) + '" y="' + (legendY + 4) + '" font-size="11" fill="#5a626b">權威來源缺位（應由此供應）</text>');

    lx += 230;
    parts.push('<text x="' + lx + '" y="' + (legendY + 4) + '" font-size="10" fill="#8a929b">橙虛框＝轉型中、紅虛框＝停擺；滑鼠移到任一系統會亮出上下游</text>');

    parts.push('</svg>');
    return parts.join('\n');
  }

  function escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  root.ArchitectCanvasLayout = { layoutSystems: layoutSystems, renderLayoutToSVG: renderLayoutToSVG };

  if (typeof window !== 'undefined') {
    window.ArchitectCanvasLayout = root.ArchitectCanvasLayout;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.layoutSystems = layoutSystems;
    globalThis.renderLayoutToSVG = renderLayoutToSVG;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

if (typeof window === 'undefined') {
  function countCrossings(layoutResult) {
    var nodeMap = {};
    for (var i = 0; i < layoutResult.nodes.length; i++) {
      nodeMap[layoutResult.nodes[i].id] = layoutResult.nodes[i];
    }

    var layerOrder = ["app", "infra", "system", "output"];
    var presentLayers = [];
    var layerSet = {};
    for (var i = 0; i < layoutResult.nodes.length; i++) {
      if (!layerSet[layoutResult.nodes[i].layer]) {
        layerSet[layoutResult.nodes[i].layer] = true;
      }
    }
    for (var i = 0; i < layerOrder.length; i++) {
      if (layerSet[layerOrder[i]]) presentLayers.push(layerOrder[i]);
    }

    var adjacentEdges = [];
    for (var ei = 0; ei < layoutResult.edges.length; ei++) {
      var e = layoutResult.edges[ei];
      var fn = nodeMap[e.from];
      var tn = nodeMap[e.to];
      if (!fn || !tn) continue;
      var fli = presentLayers.indexOf(fn.layer);
      var tli = presentLayers.indexOf(tn.layer);
      if (Math.abs(fli - tli) === 1) {
        adjacentEdges.push({ fromX: fn.x, toX: tn.x });
      }
    }

    var crossings = 0;
    for (var i = 0; i < adjacentEdges.length; i++) {
      for (var j = i + 1; j < adjacentEdges.length; j++) {
        var a = adjacentEdges[i];
        var b = adjacentEdges[j];
        var diffFrom = a.fromX - b.fromX;
        var diffTo = a.toX - b.toX;
        if ((diffFrom > 0 && diffTo < 0) || (diffFrom < 0 && diffTo > 0)) crossings++;
      }
    }
    return crossings;
  }

  var testSystems = [
    { id: "sys-1", name: "Web Portal", owner: "Alice", layer: "app", status: "active",
      dependsOn: [{ to: "sys-3", type: "active" }, { to: "sys-5", type: "planned" }] },
    { id: "sys-2", name: "Mobile App", owner: "Bob", layer: "app", status: "transforming",
      dependsOn: [{ to: "sys-3", type: "active" }] },
    { id: "sys-3", name: "API Gateway", owner: "Charlie", layer: "system", status: "active",
      dependsOn: [{ to: "sys-4", type: "active" }, { to: "sys-6", type: "missing" }] },
    { id: "sys-4", name: "Auth Service", owner: "Diana", layer: "system", status: "active",
      dependsOn: ["sys-7"] },
    { id: "sys-5", name: "CMS", owner: "Eve", layer: "system", status: "stalled",
      dependsOn: ["sys-7"] },
    { id: "sys-6", name: "Report Engine", owner: "", layer: "output", status: "missing",
      dependsOn: ["sys-7"] },
    { id: "sys-7", name: "PostgreSQL", owner: "Frank", layer: "infra", status: "active",
      dependsOn: [] },
    { id: "sys-8", name: "Cache Layer", owner: "Grace", layer: "infra", status: "active",
      dependsOn: [] }
  ];

  var result1 = layoutSystems(testSystems, {});
  var result2 = layoutSystems(testSystems, {});

  var allHaveCoords = true;
  for (var i = 0; i < result1.nodes.length; i++) {
    var n = result1.nodes[i];
    if (typeof n.x !== 'number' || typeof n.y !== 'number' || typeof n.w !== 'number' || typeof n.h !== 'number') {
      allHaveCoords = false;
    }
  }
  console.assert(allHaveCoords, "FAIL: not all nodes have numeric x,y,w,h");

  var layerYMap = {};
  var sameLayerSameY = true;
  for (var i = 0; i < result1.nodes.length; i++) {
    var n = result1.nodes[i];
    if (layerYMap[n.layer] === undefined) {
      layerYMap[n.layer] = n.y;
    } else if (layerYMap[n.layer] !== n.y) {
      sameLayerSameY = false;
    }
  }
  console.assert(sameLayerSameY, "FAIL: same layer nodes have different y");

  var appY = layerYMap["app"];
  var infY = layerYMap["infra"];
  var sysY = layerYMap["system"];
  var outY = layerYMap["output"];
  console.assert(appY < infY, "FAIL: app.y should be < infra.y");
  console.assert(infY < sysY, "FAIL: infra.y should be < system.y");
  console.assert(sysY < outY, "FAIL: system.y should be < output.y");

  var deterministic = true;
  for (var i = 0; i < result1.nodes.length; i++) {
    var n1 = result1.nodes[i];
    var n2 = result2.nodes[i];
    if (n1.x !== n2.x || n1.y !== n2.y) deterministic = false;
  }
  console.assert(deterministic, "FAIL: layout is not deterministic");

  console.assert(result1.edges.length > 0, "FAIL: no edges");
  var hasActive = false, hasPlanned = false, hasMissing = false;
  for (var i = 0; i < result1.edges.length; i++) {
    var t = result1.edges[i].type;
    if (t === "active") hasActive = true;
    if (t === "planned") hasPlanned = true;
    if (t === "missing") hasMissing = true;
  }
  console.assert(hasActive, "FAIL: no active edge");
  console.assert(hasPlanned, "FAIL: no planned edge");
  console.assert(hasMissing, "FAIL: no missing edge");

  console.assert(result1.bands !== undefined, "FAIL: bands missing");
  console.assert(Array.isArray(result1.bands), "FAIL: bands not array");

  var bandsHaveFields = true;
  for (var i = 0; i < result1.bands.length; i++) {
    var b = result1.bands[i];
    if (!b.layer || !b.label || typeof b.x !== 'number' || typeof b.y !== 'number' || typeof b.w !== 'number' || typeof b.h !== 'number') {
      bandsHaveFields = false;
    }
  }
  console.assert(bandsHaveFields, "FAIL: bands missing required fields");

  var deterministicBands = true;
  for (var i = 0; i < result1.bands.length; i++) {
    if (result1.bands[i].y !== result2.bands[i].y || result1.bands[i].h !== result2.bands[i].h) {
      deterministicBands = false;
    }
  }
  console.assert(deterministicBands, "FAIL: bands not deterministic");

  var svgResult = renderLayoutToSVG(result1, {}, { transformGoal: { title: "轉型目標測試", sub: "sub line" } });
  console.assert(svgResult.indexOf('<svg') === 0, "FAIL: SVG no <svg");
  console.assert(svgResult.indexOf('data-node=') !== -1, "FAIL: SVG no data-node");
  console.assert(svgResult.indexOf('data-band=') !== -1, "FAIL: SVG no data-band");
  console.assert(svgResult.indexOf('data-edge-from=') !== -1, "FAIL: SVG no data-edge-from");
  console.assert(svgResult.indexOf('hsl(178,42%,40%)') !== -1, "FAIL: active edge stroke missing");
  console.assert(svgResult.indexOf('6,4') !== -1, "FAIL: planned dasharray missing");
  console.assert(svgResult.indexOf('3,4') !== -1, "FAIL: missing dasharray missing");
  console.assert(/轉型目標|banner/.test(svgResult), "FAIL: banner text missing");
  console.assert(svgResult.indexOf('現行介接') !== -1, "FAIL: legend missing");

  var nodeCount = (svgResult.match(/data-node="sys-/g) || []).length;
  console.assert(nodeCount === 8, "FAIL: expected 8 nodes, got " + nodeCount);

  var reverseTestSystems = [
    { id: "A", name: "NodeA", owner: "", layer: "app", status: "active",
      dependsOn: [{ to: "Z", type: "active" }] },
    { id: "B", name: "NodeB", owner: "", layer: "app", status: "active",
      dependsOn: [{ to: "Y", type: "active" }] },
    { id: "C", name: "NodeC", owner: "", layer: "app", status: "active",
      dependsOn: [{ to: "X", type: "active" }] },
    { id: "X", name: "NodeX", owner: "", layer: "system", status: "active", dependsOn: [] },
    { id: "Y", name: "NodeY", owner: "", layer: "system", status: "active", dependsOn: [] },
    { id: "Z", name: "NodeZ", owner: "", layer: "system", status: "active", dependsOn: [] }
  ];

  function layoutWithoutBarycenter(systems, options) {
    var opts = { width:1180, nodeWidth:160, nodeHeight:64, hGap:24, vGap:16,
      layerGap:80, padding:40, bandPaddingTop:40, bandPaddingBottom:20, bandPaddingX:16 };
    var LAYER_ORDER_LOCAL = ["app", "infra", "system", "output"];
    function nd2(dep) {
      if (typeof dep === "string") return { to: dep, type: "active" };
      if (dep && dep.to) return { to: dep.to, type: dep.type || "active" };
      return null;
    }
    var idSet = {};
    for (var i = 0; i < systems.length; i++) idSet[systems[i].id] = true;
    var incomingCount = {};
    for (var i = 0; i < systems.length; i++) incomingCount[systems[i].id] = 0;
    var edges = [];
    for (var i = 0; i < systems.length; i++) {
      var sys = systems[i];
      if (sys.dependsOn) {
        for (var j = 0; j < sys.dependsOn.length; j++) {
          var nd = nd2(sys.dependsOn[j]);
          if (nd && idSet[nd.to]) {
            incomingCount[nd.to] = (incomingCount[nd.to] || 0) + 1;
            edges.push({ from: sys.id, to: nd.to, type: nd.type });
          }
        }
      }
    }
    var layerMap = {};
    for (var i = 0; i < systems.length; i++) {
      var sys = systems[i];
      if (!layerMap[sys.layer]) layerMap[sys.layer] = [];
      layerMap[sys.layer].push(sys);
    }
    for (var layer in layerMap) {
      layerMap[layer].sort(function(a, b) {
        var ca = incomingCount[a.id] || 0;
        var cb = incomingCount[b.id] || 0;
        if (cb !== ca) return cb - ca;
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });
    }
    var orderedLayers = [];
    for (var i = 0; i < LAYER_ORDER_LOCAL.length; i++) {
      if (layerMap[LAYER_ORDER_LOCAL[i]] && layerMap[LAYER_ORDER_LOCAL[i]].length > 0) orderedLayers.push(LAYER_ORDER_LOCAL[i]);
    }
    var nodeMap = {};
    var nodes = [];
    var yPos = opts.padding + opts.bandPaddingTop;
    var innerWidth = opts.width - 2 * opts.padding;
    for (var li = 0; li < orderedLayers.length; li++) {
      var layer = orderedLayers[li];
      var items = layerMap[layer];
      var n = items.length;
      var usableWidth = innerWidth - 2 * opts.bandPaddingX;
      var hGapActual = opts.hGap;
      if (n > 1) {
        var spread = usableWidth - n * opts.nodeWidth;
        if (spread > 0) hGapActual = spread / (n - 1);
      }
      var rowW = n * opts.nodeWidth + (n - 1) * hGapActual;
      var startX = opts.padding + opts.bandPaddingX + (usableWidth - rowW) / 2;
      for (var ii = 0; ii < items.length; ii++) {
        var sys = items[ii];
        var node = { id: sys.id, name: sys.name, layer: sys.layer, status: sys.status,
          x: startX + ii * (opts.nodeWidth + hGapActual), y: yPos, w: opts.nodeWidth, h: opts.nodeHeight };
        nodes.push(node);
        nodeMap[sys.id] = node;
      }
      yPos += opts.nodeHeight + opts.bandPaddingBottom;
      if (li < orderedLayers.length - 1) yPos += opts.layerGap + opts.bandPaddingTop;
    }
    return { nodes: nodes, edges: edges, bands: [], width: opts.width, height: yPos };
  }

  var reverseResultBefore = layoutWithoutBarycenter(reverseTestSystems, {});
  var reverseResultAfter = layoutSystems(reverseTestSystems, {});
  var crossBefore = countCrossings(reverseResultBefore);
  var crossAfter = countCrossings(reverseResultAfter);
  console.log("--- crossing test (reverse A->Z, B->Y, C->X) ---");
  console.log("crossings before barycenter:", crossBefore);
  console.log("crossings after barycenter:", crossAfter);
  console.assert(crossAfter <= crossBefore, "FAIL: barycenter did not reduce crossings on reverse test (" + crossAfter + " > " + crossBefore + ")");

  var sampleSystems = [
    { id:'sys-1', name:'官網 CMS', owner:'行銷組', layer:'app', status:'active',
      dependsOn:[{ to:'sys-3', type:'active' }, { to:'sys-8', type:'planned' }] },
    { id:'sys-2', name:'知識庫平台', owner:'產品研發組', layer:'app', status:'transforming',
      dependsOn:[{ to:'sys-3', type:'active' }, { to:'sys-8', type:'missing' }] },
    { id:'sys-3', name:'API 閘道', owner:'基礎架構組', layer:'system', status:'active',
      dependsOn:[{ to:'sys-4', type:'active' }, { to:'sys-6', type:'active' }] },
    { id:'sys-4', name:'資料倉儲', owner:'基礎架構組', layer:'infra', status:'active', dependsOn:[] },
    { id:'sys-5', name:'專案管理系統', owner:'PMO 辦公室', layer:'app', status:'stalled',
      dependsOn:[{ to:'sys-3', type:'active' }, { to:'sys-8', type:'planned' }] },
    { id:'sys-6', name:'監控中心', owner:'維運組', layer:'infra', status:'active',
      dependsOn:[{ to:'sys-4', type:'active' }] },
    { id:'sys-7', name:'報表引擎', owner:'數據分析組', layer:'output', status:'active',
      dependsOn:[{ to:'sys-3', type:'active' }, { to:'sys-4', type:'active' }] },
    { id:'sys-8', name:'統一認證服務', owner:'資安組', layer:'system', status:'missing', dependsOn:[] }
  ];
  var sampleBefore = layoutWithoutBarycenter(sampleSystems, {});
  var sampleAfter = layoutSystems(sampleSystems, {});
  var sampleCrossBefore = countCrossings(sampleBefore);
  var sampleCrossAfter = countCrossings(sampleAfter);
  console.log("--- SAMPLE_STATE crossing count ---");
  console.log("crossings before barycenter:", sampleCrossBefore);
  console.log("crossings after barycenter:", sampleCrossAfter);

  var sampleAfter2 = layoutSystems(sampleSystems, {});
  var deterministicSample = true;
  for (var i = 0; i < sampleAfter.nodes.length; i++) {
    if (sampleAfter.nodes[i].x !== sampleAfter2.nodes[i].x) deterministicSample = false;
  }
  console.assert(deterministicSample, "FAIL: SAMPLE_STATE layout not deterministic");
  console.log("deterministic check (SAMPLE_STATE): " + (deterministicSample ? "pass" : "FAIL"));

  console.log("self-test passed");
  console.log("nodes:", result1.nodes.length);
  console.log("edges:", result1.edges.length);
  console.log("edges with type:", result1.edges.map(function(e){ return e.from+"->"+e.to+"("+e.type+")"; }).join(", "));
  console.log("bands:", result1.bands.length);
  console.log("active edges:", result1.edges.filter(function(e){ return e.type==="active"; }).length);
  console.log("planned edges:", result1.edges.filter(function(e){ return e.type==="planned"; }).length);
  console.log("missing edges:", result1.edges.filter(function(e){ return e.type==="missing"; }).length);
  console.log("canvas:", result1.width, "x", result1.height);
  console.log("SVG render: ok, length=" + svgResult.length);
  for (var i = 0; i < result1.bands.length; i++) {
    var b = result1.bands[i];
    console.log("band[" + b.layer + "] label=" + b.label + " y=" + b.y + " h=" + b.h);
  }
}
