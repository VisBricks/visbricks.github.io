/** Case-owned bindings, frames, and replay of real editor composition operations. */
export async function configure(context, ...args) {
  const { MAX_ZOOM, MIN_ZOOM, adaptLegacyWideBindings, boundsFromNodeFrame, canvasNodes, canvasRef, clamp, createCanvasItem, executeComposition, findCanvasNode, getChartBlockSpecification, getDataset, globalPalette, implementedTemplateDefinitions, mergeBounds, nextTick, registerChartRelationship, renderChartNode, setActiveDataset, setSelection, viewPan, viewZoom } = context;
  async function loadMatrixPieNetworkCase(datasetId, compose = true) {
    const failMatrixCase = (reason) => {
      if (typeof document !== "undefined") {
        document.documentElement.dataset.galleryStarterError = `matrix-network:${reason}`;
      }
      return false;
    };
    if (typeof document !== "undefined") {
      delete document.documentElement.dataset.galleryStarterError;
    }
    const dataset = getDataset(datasetId);
    const matrixCandidate = implementedTemplateDefinitions.find((candidate) => candidate.chartType === "MatrixDiagram");
    const stackedBarCandidate = implementedTemplateDefinitions.find((candidate) => candidate.chartType === "StackedBarChart");
    if (!dataset?.graph || !matrixCandidate || !stackedBarCandidate
      || canvasNodes.value.length > 0) {
      return failMatrixCase([
        !dataset?.graph ? "missing-graph-dataset" : "",
        !matrixCandidate ? "missing-matrix-candidate" : "",
        !stackedBarCandidate ? "missing-stacked-bar-candidate" : "",
        canvasNodes.value.length > 0 ? "canvas-not-empty" : "",
      ].filter(Boolean).join(","));
    }
    setActiveDataset(datasetId);
    const createdMatrix = (await createCanvasItem(matrixCandidate, { x: 820, y: 610 }, false))?.[0];
    const createdTopBar = (await createCanvasItem(stackedBarCandidate, { x: 820, y: 190 }, false))?.[0];
    const createdLeftBar = (await createCanvasItem(stackedBarCandidate, { x: 260, y: 610 }, false))?.[0];
    const matrix = createdMatrix ? findCanvasNode(createdMatrix.id) : null;
    const topBar = createdTopBar ? findCanvasNode(createdTopBar.id) : null;
    const leftBar = createdLeftBar ? findCanvasNode(createdLeftBar.id) : null;
    if (!matrix?.chartSpec || !topBar?.chartSpec || !leftBar?.chartSpec) {
      return failMatrixCase("create-node-failed");
    }
    const valueFields = ["channel_a", "channel_b", "channel_c", "channel_d", "channel_e"];
    const componentColors = [
      globalPalette.categorical[0],
      globalPalette.categorical[1],
      globalPalette.categorical[2],
      globalPalette.categorical[3],
      globalPalette.categorical[4],
    ];
    const seriesColors = Object.fromEntries(valueFields.map((field, index) => [
      field,
      { color: componentColors[index] },
    ]));
    const resetFrame = (node, x, y, width, height) => {
      node.x = x;
      node.y = y;
      node.width = width;
      node.height = height;
      node.scaleX = 1;
      node.scaleY = 1;
    };
    resetFrame(matrix, 350, 300, 920, 920);
    resetFrame(topBar, 350, 40, 920, 220);
    resetFrame(leftBar, 1310, 300, 300, 920);
    if (matrix.coordinateGuide?.type === "Cartesian")
      matrix.coordinateGuide.yDirection = 1;
    if (leftBar.coordinateGuide?.type === "Cartesian")
      leftBar.coordinateGuide.yDirection = 1;
    matrix.name = "Graph-derived heatmap — weighted force network";
    matrix.chartSpec = {
      ...matrix.chartSpec,
      datasetId,
      link: true,
      encodings: {
        x: { field: "column_group", type: "ordinal" },
        y: { field: "row_group", type: "ordinal" },
        color: { field: "heat_value", type: "quantitative" },
        key: { field: "id", type: "nominal" },
        source: { field: "source", type: "nominal" },
        target: { field: "target", type: "nominal" },
        value: { field: "weight", type: "quantitative" },
        size: { field: "weight", type: "quantitative" },
      },
      series: { field: "dominant_component", type: "nominal" },
      aggregations: undefined,
      dataTransforms: undefined,
      filters: undefined,
      defaultDataBinding: undefined,
      axes: {
        x: { visible: false, labelsVisible: false },
        y: { visible: false, labelsVisible: false },
      },
      markGroups: [
        {
          id: `mark-group:${matrix.id}:cell`,
          chartId: matrix.id,
          role: "cell",
          memberKeys: [],
          sharedConfig: {
            opacity: 0.94,
            colorMapping: {
              type: "linear",
              domain: [0, 25],
              stops: globalPalette.gradient.map((color, index) => ({
                offset: index / Math.max(1, globalPalette.gradient.length - 1),
                color,
              })),
            },
          },
          allowOverrides: true,
        },
        {
          id: `mark-group:${matrix.id}:node`,
          chartId: matrix.id,
          role: "node",
          memberKeys: [],
          sharedConfig: {
            layoutXField: "layout_x",
            layoutYField: "layout_y",
            layoutNormalized: true,
            nodeShape: "pie",
            pieFields: valueFields.join(","),
            nodeLabelsVisible: false,
            sizeMapping: {
              type: "linear",
              stops: [{ offset: 0, size: 8 }, { offset: 1, size: 24 }],
            },
            colorMapping: {
              type: "categorical",
              values: Object.fromEntries(valueFields.map((field, index) => [
                field,
                componentColors[index],
              ])),
            },
          },
          allowOverrides: true,
        },
        {
          id: `mark-group:${matrix.id}:link`,
          chartId: matrix.id,
          role: "link",
          memberKeys: [],
          sharedConfig: {
            color: "#ffffff",
            opacity: 0.24,
            internalOpacity: 0.12,
            internalWidth: 2,
            crossOpacity: 0.22,
            crossWidth: 3,
            radialOpacity: 0.62,
            radialWidth: 4.8,
          },
          allowOverrides: true,
        },
      ],
      renderer: undefined,
      scales: undefined,
      plotArea: undefined,
    };
    matrix.nestedSpec = null;
    topBar.name = "Top marginal — stacked totals by column";
    topBar.chartSpec = {
      ...topBar.chartSpec,
      datasetId,
      axisSwapped: false,
      encodings: {
        x: { field: "column_group", type: "ordinal" },
        y: { field: "heat_value", type: "quantitative" },
      },
      valueFields: valueFields.map((field) => ({ field, type: "quantitative" })),
      markGroups: [{
          id: `mark-group:${topBar.id}:bar`,
          chartId: topBar.id,
          role: "bar",
          memberKeys: [],
          sharedConfig: { seriesStyleMapping: { type: "series-style", values: seriesColors } },
          allowOverrides: true,
        }],
      axes: {
        x: { visible: false, labelsVisible: false },
        y: { visible: false, labelsVisible: false },
      },
      series: undefined,
      seriesFields: undefined,
      dataTransforms: undefined,
      filters: undefined,
      defaultDataBinding: undefined,
      renderer: undefined,
      scales: undefined,
      plotArea: undefined,
    };
    leftBar.name = "Right marginal — stacked totals by row";
    leftBar.chartSpec = {
      ...leftBar.chartSpec,
      datasetId,
      axisSwapped: true,
      encodings: {
        x: { field: "row_group", type: "ordinal" },
        y: { field: "heat_value", type: "quantitative" },
      },
      valueFields: valueFields.map((field) => ({ field, type: "quantitative" })),
      markGroups: [{
          id: `mark-group:${leftBar.id}:bar`,
          chartId: leftBar.id,
          role: "bar",
          memberKeys: [],
          sharedConfig: { seriesStyleMapping: { type: "series-style", values: seriesColors } },
          allowOverrides: true,
        }],
      axes: {
        x: { visible: false, labelsVisible: false },
        y: { visible: false, labelsVisible: false },
      },
      series: undefined,
      seriesFields: undefined,
      dataTransforms: undefined,
      filters: undefined,
      defaultDataBinding: undefined,
      renderer: undefined,
      scales: undefined,
      plotArea: undefined,
    };
    [topBar, leftBar].forEach((node) => {
      if (!node.chartSpec)
        return;
      node.chartSpec = adaptLegacyWideBindings(node.chartSpec, dataset, getChartBlockSpecification(node.chartSpec.chartType));
    });
    [matrix, topBar, leftBar].forEach((node) => {
      renderChartNode(node);
      registerChartRelationship(node);
    });
    const unrenderedNode = [matrix, topBar, leftBar].find((node) => !node.renderedContent);
    if (unrenderedNode) {
      const rendererError = unrenderedNode.chartSpec?.renderer?.status === "error"
        ? unrenderedNode.chartSpec.renderer.error
        : "incomplete-binding";
      return failMatrixCase(`render-failed:${unrenderedNode.name}:${rendererError}`);
    }
    if (compose) {
      setSelection([matrix.id, topBar.id]);
      if (!executeComposition("concat", false, ["x"], "vertical", "before", matrix.id, topBar.id)) {
        return failMatrixCase("top-concat-failed");
      }
      if (matrix.coordinateSystem?.type === "Cartesian") {
        matrix.coordinateSystem = {
          ...matrix.coordinateSystem,
          sharedChannels: ["x", "y"],
        };
      }
      setSelection([matrix.id, leftBar.id]);
      if (!executeComposition("concat", false, ["y"], "horizontal", "after", matrix.id, leftBar.id)) {
        return failMatrixCase("right-concat-failed");
      }
      [matrix, topBar, leftBar].forEach((node) => {
        if (!node.chartSpec)
          return;
        node.chartSpec = {
          ...node.chartSpec,
          axes: {
            x: { visible: false, labelsVisible: false },
            y: { visible: false, labelsVisible: false },
          },
        };
      });
    }
    setSelection([]);
    await nextTick();
    if (typeof requestAnimationFrame === "function") {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    const bounds = canvasNodes.value.reduce((current, node) => mergeBounds(current, boundsFromNodeFrame(node.x, node.y, node.width, node.height, node.scaleX, node.scaleY, node.rotation)), null);
    const viewport = canvasRef.value?.getBoundingClientRect();
    if (bounds && viewport && bounds.width > 0 && bounds.height > 0) {
      const padding = 48;
      const zoom = clamp(Math.min((viewport.width - padding * 2) / bounds.width, (viewport.height - padding * 2) / bounds.height), MIN_ZOOM, MAX_ZOOM);
      viewZoom.value = zoom;
      viewPan.value = {
        x: (viewport.width - bounds.width * zoom) / 2 - bounds.minX * zoom,
        y: (viewport.height - bounds.height * zoom) / 2 - bounds.minY * zoom,
      };
    }
    return true;
  }
  return loadMatrixPieNetworkCase(...args);
}
