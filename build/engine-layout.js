(function (root) {
  var LAYER_ORDER = ["app", "system", "output", "infra"];

  var DEFAULT_OPTIONS = {
    width: 1180,
    nodeWidth: 160,
    nodeHeight: 64,
    hGap: 24,
    vGap: 16,
    layerGap: 80,
    padding: 40
  };

  function mergeOptions(options) {
    var result = {};
    for (var k in DEFAULT_OPTIONS) {
      result[k] = DEFAULT_OPTIONS[k];
    }
    if (options) {
      for (var k in options) {
        if (options[k] !== undefined && options[k] !== null) {
          result[k] = options[k];
        }
      }
    }
    return result;
  }

  function layoutSystems(systems, options) {
    var opts = mergeOptions(options);

    var idSet = {};
    for (var i = 0; i < systems.length; i++) {
      idSet[systems[i].id] = true;
    }

    var incomingCount = {};
    for (var i = 0; i < systems.length; i++) {
      incomingCount[systems[i].id] = 0;
    }
    for (var i = 0; i < systems.length; i++) {
      var sys = systems[i];
      if (sys.dependsOn) {
        for (var j = 0; j < sys.dependsOn.length; j++) {
          var dep = sys.dependsOn[j];
          if (idSet[dep]) {
            incomingCount[dep] = (incomingCount[dep] || 0) + 1;
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

    function arrangeLayerPositions(sortedItems) {
      var n = sortedItems.length;
      var positions = new Array(n);
      if (n === 0) return positions;
      var center = Math.floor(n / 2);
      positions[center] = 0;
      var left = center - 1;
      var right = center + 1;
      var offset = 1;
      var turn = "right";
      var idx = 1;
      while (idx < n) {
        if (turn === "right" && right < n) {
          positions[right] = offset;
          right++;
          turn = "left";
          offset++;
          idx++;
        } else if (turn === "left" && left >= 0) {
          positions[left] = -offset;
          left--;
          turn = "right";
          offset++;
          idx++;
        } else if (right < n) {
          positions[right] = offset;
          right++;
          offset++;
          idx++;
        } else if (left >= 0) {
          positions[left] = -offset;
          left--;
          offset++;
          idx++;
        } else {
          break;
        }
      }
      return positions;
    }

    var orderedLayers = getOrderedLayers();
    var nodeMap = {};
    var nodes = [];

    var yPos = opts.padding;

    for (var li = 0; li < orderedLayers.length; li++) {
      var layer = orderedLayers[li];
      var items = layerMap[layer];
      var positions = arrangeLayerPositions(items);

      var n = items.length;
      var totalWidth = n * opts.nodeWidth + (n - 1) * opts.hGap;
      var startX = opts.padding + (opts.width - 2 * opts.padding - totalWidth) / 2;

      var minPos = 0;
      var maxPos = 0;
      for (var pi = 0; pi < positions.length; pi++) {
        if (positions[pi] < minPos) minPos = positions[pi];
        if (positions[pi] > maxPos) maxPos = positions[pi];
      }

      var centerIndex = 0;
      for (var ii = 0; ii < positions.length; ii++) {
        if (positions[ii] === 0) { centerIndex = ii; break; }
      }

      var centerX = startX + centerIndex * (opts.nodeWidth + opts.hGap);

      for (var ii = 0; ii < items.length; ii++) {
        var sys = items[ii];
        var pos = positions[ii];
        var xPos = centerX + pos * (opts.nodeWidth + opts.hGap);
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

      yPos += opts.nodeHeight;
      if (li < orderedLayers.length - 1) {
        yPos += opts.layerGap;
      }
    }

    var edges = [];
    for (var i = 0; i < systems.length; i++) {
      var sys = systems[i];
      if (sys.dependsOn) {
        for (var j = 0; j < sys.dependsOn.length; j++) {
          var dep = sys.dependsOn[j];
          if (idSet[dep]) {
            edges.push({ from: sys.id, to: dep });
          }
        }
      }
    }

    var maxX = 0;
    var maxY = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.x + n.w > maxX) maxX = n.x + n.w;
      if (n.y + n.h > maxY) maxY = n.y + n.h;
    }

    var totalWidth = maxX + opts.padding;
    var totalHeight = maxY + opts.padding;

    return {
      nodes: nodes,
      edges: edges,
      width: totalWidth,
      height: totalHeight
    };
  }

  function renderLayoutToSVG(layoutResult, options) {
    var opts = mergeOptions(options);
    var nodes = layoutResult.nodes;
    var edges = layoutResult.edges;
    var W = layoutResult.width;
    var H = layoutResult.height;

    var nodeMap = {};
    for (var i = 0; i < nodes.length; i++) {
      nodeMap[nodes[i].id] = nodes[i];
    }

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
        strokeDasharray: "2,4"
      }
    };

    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">');
    parts.push('<style>text { font-family: "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif; }</style>');

    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      var fromNode = nodeMap[edge.from];
      var toNode = nodeMap[edge.to];
      if (!fromNode || !toNode) continue;

      var x1 = fromNode.x + fromNode.w / 2;
      var y1 = fromNode.y + fromNode.h / 2;
      var x2 = toNode.x + toNode.w / 2;
      var y2 = toNode.y + toNode.h / 2;

      var dx = x2 - x1;
      var dy = y2 - y1;
      var len = Math.sqrt(dx * dx + dy * dy);

      var hw = fromNode.w / 2;
      var hh = fromNode.h / 2;
      var tx = (len > 0) ? (dx / len) : 0;
      var ty = (len > 0) ? (dy / len) : 0;

      var sx1, sy1;
      if (Math.abs(tx * hh) > Math.abs(ty * hw)) {
        sx1 = fromNode.x + (tx > 0 ? fromNode.w : 0);
        sy1 = fromNode.y + fromNode.h / 2;
      } else {
        sx1 = fromNode.x + fromNode.w / 2;
        sy1 = fromNode.y + (ty > 0 ? fromNode.h : 0);
      }

      var hw2 = toNode.w / 2;
      var hh2 = toNode.h / 2;
      var sx2, sy2;
      if (Math.abs(tx * hh2) > Math.abs(ty * hw2)) {
        sx2 = toNode.x + (tx > 0 ? 0 : toNode.w);
        sy2 = toNode.y + toNode.h / 2;
      } else {
        sx2 = toNode.x + toNode.w / 2;
        sy2 = toNode.y + (ty > 0 ? 0 : toNode.h);
      }

      var mx = (sx1 + sx2) / 2;
      parts.push('<path d="M ' + sx1 + ' ' + sy1 + ' C ' + mx + ' ' + sy1 + ' ' + mx + ' ' + sy2 + ' ' + sx2 + ' ' + sy2 + '" fill="none" stroke="hsl(178,42%,40%)" stroke-width="1.5" marker-end="url(#arrowhead)" opacity="0.7"/>');
    }

    parts.push('<defs>');
    parts.push('<marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">');
    parts.push('<polygon points="0 0, 8 3, 0 6" fill="hsl(178,42%,40%)" opacity="0.7"/>');
    parts.push('</marker>');
    parts.push('</defs>');

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var style = statusStyle[node.status] || statusStyle.active;
      var dashAttr = style.strokeDasharray !== "none" ? ' stroke-dasharray="' + style.strokeDasharray + '"' : '';

      parts.push('<g data-node="' + node.id + '">');
      parts.push('<rect x="' + node.x + '" y="' + node.y + '" width="' + node.w + '" height="' + node.h + '" rx="8" ry="8" fill="' + style.fill + '" stroke="' + style.stroke + '" stroke-width="' + style.strokeWidth + '"' + dashAttr + '/>');

      var nameY = node.owner ? node.y + node.h / 2 - 6 : node.y + node.h / 2 + 5;
      parts.push('<text x="' + (node.x + node.w / 2) + '" y="' + nameY + '" text-anchor="middle" font-size="13" font-weight="bold" fill="#2b3036">' + escapeXml(node.name) + '</text>');

      if (node.owner) {
        parts.push('<text x="' + (node.x + node.w / 2) + '" y="' + (node.y + node.h / 2 + 12) + '" text-anchor="middle" font-size="11" fill="#8a929b">' + escapeXml(node.owner) + '</text>');
      }

      parts.push('</g>');
    }

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
  var layoutSystems_export = layoutSystems;
  var renderLayoutToSVG_export = renderLayoutToSVG;

  if (typeof window !== 'undefined') {
    window.ArchitectCanvasLayout = root.ArchitectCanvasLayout;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

if (typeof window === 'undefined') {
    var testSystems = [
      { id: "s1", name: "Web Portal", owner: "Alice", layer: "app", dependsOn: ["s3", "s5"], status: "active" },
      { id: "s2", name: "Mobile App", owner: "Bob", layer: "app", dependsOn: ["s3"], status: "transforming" },
      { id: "s3", name: "API Gateway", owner: "Charlie", layer: "system", dependsOn: ["s4", "s6"], status: "active" },
      { id: "s4", name: "Auth Service", owner: "Diana", layer: "system", dependsOn: ["s7"], status: "active" },
      { id: "s5", name: "CMS", owner: "Eve", layer: "system", dependsOn: ["s7"], status: "stalled" },
      { id: "s6", name: "Report Engine", owner: "", layer: "output", dependsOn: ["s7"], status: "missing" },
      { id: "s7", name: "PostgreSQL", owner: "Frank", layer: "infra", dependsOn: [], status: "active" }
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
    var sysY = layerYMap["system"];
    var outY = layerYMap["output"];
    var infY = layerYMap["infra"];
    console.assert(appY < sysY, "FAIL: app.y should be < system.y");
    console.assert(sysY < outY, "FAIL: system.y should be < output.y");
    console.assert(outY < infY, "FAIL: output.y should be < infra.y");

    var deterministic = true;
    for (var i = 0; i < result1.nodes.length; i++) {
      var n1 = result1.nodes[i];
      var n2 = result2.nodes[i];
      if (n1.x !== n2.x || n1.y !== n2.y) {
        deterministic = false;
      }
    }
    console.assert(deterministic, "FAIL: layout is not deterministic");

    var totalDeps = 0;
    for (var i = 0; i < testSystems.length; i++) {
      if (testSystems[i].dependsOn) {
        totalDeps += testSystems[i].dependsOn.length;
      }
    }
    console.assert(result1.edges.length === totalDeps, "FAIL: edges count mismatch, expected " + totalDeps + " got " + result1.edges.length);

    console.log("self-test passed");
    console.log("nodes:", result1.nodes.length);
    console.log("edges:", result1.edges.length);
    console.log("canvas:", result1.width, "x", result1.height);
    console.log("layer y values -> app:" + appY + " system:" + sysY + " output:" + outY + " infra:" + infY);

    var svgResult = renderLayoutToSVG(result1, {});
    console.assert(svgResult.indexOf('<svg') === 0, "FAIL: SVG output does not start with <svg");
    console.assert(svgResult.indexOf('data-node=') !== -1, "FAIL: SVG missing data-node attributes");
    console.log("SVG render: ok, length=" + svgResult.length);
  }
