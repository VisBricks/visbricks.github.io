/** Force network whose node type selects one of four genuinely nested charts. */
export async function configure(context, compose = true) {
  const {
    MAX_ZOOM, MIN_ZOOM, applyNestedAppearance, axisBindingTarget, boundsFromNodeFrame,
    canvasNodes, canvasRef, chartDrilldown, chartRelationships, clamp,
    closeNestedPositionEditor, commitCompositionDrop, compositionDropZoneAtPoint,
    createCanvasItem, editingCompositionId, enterNestedDropLevel, findCanvasNode,
    implementedTemplateDefinitions, mergeBounds, nestedDropPath, nextTick,
    nodeLocalToSelectionScopePoint, openNestedPositionEditor, registerChartRelationship,
    renderChartNode, scheduleNestedChildLayout, setActiveDataset, setSelection,
    toSelectionScopePoint, useDatasetStore, viewPan, viewZoom,
  } = context;
  if (canvasNodes.value.length) return false;
  const base = "/site/gallery/cases/adaptive-network-profiles/data/";
  const read = async (name) => {
    const response = await fetch(base + name);
    if (!response.ok) throw new Error(`Case data unavailable: ${name}`);
    return new File([await response.text()], name, { type: "text/csv" });
  };
  const store = useDatasetStore();
  const graph = await store.importGraphDataset(await read("network_nodes.csv"), await read("network_edges.csv"), "adaptive-network");
  const profiles = {};
  for (const [type, file] of Object.entries({ bar: "bar_profiles.csv", line: "line_profiles.csv", heatmap: "heatmap_profiles.csv", radar: "radar_profiles.csv" })) {
    profiles[type] = await store.importDataset(await read(file));
  }
  if (!graph || Object.values(profiles).some((dataset) => !dataset)) throw new Error("Adaptive network data import failed");
  setActiveDataset(graph.id);

  const create = async (chartType, frame, datasetId) => {
    const candidate = implementedTemplateDefinitions.find((item) => item.chartType === chartType);
    if (!candidate) throw new Error(`Missing block: ${chartType}`);
    const created = (await createCanvasItem(candidate, { x: frame.x, y: frame.y }, false, datasetId))?.[0];
    const node = created ? findCanvasNode(created.id) : null;
    if (!node?.chartSpec) throw new Error(`Unable to create ${chartType}`);
    Object.assign(node, frame, { scaleX: 1, scaleY: 1 });
    return node;
  };
  const network = await create("ForceDirectedGraph", { x: 80, y: 80, width: 1380, height: 980 }, graph.id);
  network.name = "Force network — adaptive node profiles";
  network.chartSpec = {
    ...network.chartSpec,
    datasetId: graph.id,
    encodings: {
      key: { field: "node_id", type: "nominal" }, source: { field: "source", type: "nominal" },
      target: { field: "target", type: "nominal" }, value: { field: "weight", type: "quantitative" },
      color: { field: "node_type", type: "nominal" }, size: { field: "influence", type: "quantitative" },
    },
    markGroups: [{ id: `mark-group:${network.id}:node`, chartId: network.id, role: "node", memberKeys: [], allowOverrides: true,
      sharedConfig: { layoutXField: "layout_x", layoutYField: "layout_y", layoutNormalized: true,
        nodeLabelsVisible: true, collisionRadius: 55, size: 8 } }],
    renderer: undefined, scales: undefined, plotArea: undefined,
  };
  renderChartNode(network);
  registerChartRelationship(network);

  const sources = [];
  const bar = await create("StackedBarChart", { x: 1570, y: 70, width: 280, height: 210 }, profiles.bar.id);
  bar.name = "Engagement mix";
  bar.chartSpec = { ...bar.chartSpec, datasetId: profiles.bar.id,
    encodings: { x: { field: "period", type: "ordinal" } },
    valueFields: ["engagement", "reach", "response"].map((field) => ({ field, type: "quantitative" })),
    axes: { x: { visible: false, labelsVisible: false }, y: { visible: false, labelsVisible: false } },
    renderer: undefined, scales: undefined, plotArea: undefined };
  sources.push({ type: "bar", node: bar, ids: ["N01", "N02", "N03", "N04"], shape: "rounded-rect", fill: "none" });

  const line = await create("LineGraph", { x: 1570, y: 310, width: 280, height: 190 }, profiles.line.id);
  line.name = "Signal trajectory";
  line.chartSpec = { ...line.chartSpec, datasetId: profiles.line.id,
    encodings: { x: { field: "period", type: "ordinal" }, y: { field: "signal", type: "quantitative" } },
    axes: { x: { visible: false, labelsVisible: false }, y: { visible: false, labelsVisible: false } },
    renderer: undefined, scales: undefined, plotArea: undefined };
  sources.push({ type: "line", node: line, ids: ["N05", "N06", "N07", "N08"], shape: "rounded-rect", fill: "none" });

  const heatmap = await create("MatrixDiagram", { x: 1570, y: 540, width: 240, height: 240 }, profiles.heatmap.id);
  heatmap.name = "Local map heatmap";
  heatmap.chartSpec = { ...heatmap.chartSpec, datasetId: profiles.heatmap.id,
    encodings: { x: { field: "grid_x", type: "ordinal" }, y: { field: "grid_y", type: "ordinal" }, color: { field: "intensity", type: "quantitative" } },
    axes: { x: { visible: false, labelsVisible: false }, y: { visible: false, labelsVisible: false } },
    renderer: undefined, scales: undefined, plotArea: undefined };
  sources.push({ type: "heatmap", node: heatmap, ids: ["N09", "N10", "N11", "N12"], shape: "rounded-rect", fill: "none" });

  const radar = await create("RadarChart", { x: 1570, y: 820, width: 250, height: 250 }, profiles.radar.id);
  radar.name = "Capability radar";
  radar.chartSpec = { ...radar.chartSpec, datasetId: profiles.radar.id,
    encodings: { theta: { field: "metric", type: "nominal" }, radius: { field: "value", type: "quantitative" } },
    axes: { theta: { visible: false, labelsVisible: false }, radius: { visible: false, labelsVisible: false } },
    renderer: undefined, scales: undefined, plotArea: undefined };
  sources.push({ type: "radar", node: radar, ids: ["N13", "N14", "N15", "N16"], shape: "circle", fill: "none" });

  sources.forEach(({ node }) => {
    renderChartNode(node);
    registerChartRelationship(node);
    if (!node.renderedContent) throw new Error(`Block failed to render: ${node.name}`);
  });
  if (!network.renderedContent) throw new Error("Force network failed to render");
  await nextTick();

  const nestSubset = async ({ node, ids, shape, fill }) => {
    if (chartDrilldown.value?.nodeId !== network.id || chartDrilldown.value.level !== "part") {
      const plot = network.chartSpec.plotArea;
      const enterPoint = nodeLocalToSelectionScopePoint(network, { x: plot.x + plot.width / 2, y: plot.y + plot.height / 2 });
      const enterZone = compositionDropZoneAtPoint(enterPoint, node.id);
      if (!enterZone || !enterNestedDropLevel(enterZone)) throw new Error("Unable to enter Force node level");
      await nextTick();
    }
    const parentElement = canvasRef.value?.querySelector(`[data-node-id="${network.id}"]`);
    const mark = parentElement?.querySelector(`[data-chart-id="${network.id}"][data-mark-role="node"] circle`);
    const rect = mark?.getBoundingClientRect();
    if (!rect) throw new Error("Force node drop target unavailable");
    const point = toSelectionScopePoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const zone = compositionDropZoneAtPoint(point, node.id);
    if (zone?.type !== "nested" || !zone.nestedTargets) throw new Error(`No nested targets for ${node.name}`);
    const targets = zone.nestedTargets.filter((target) => {
      try { return ids.includes(JSON.parse(target.dataKey).nodeKey); } catch { return false; }
    });
    const first = targets[0];
    const subsetZone = first ? { ...zone, nestedTargets: targets, bounds: first.bounds,
      targetDataKey: first.dataKey, targetElementId: first.elementId, targetRowKey: first.rowKey,
      targetMarkGroupId: first.markGroupId } : null;
    if (!subsetZone || targets.length !== 4 || !commitCompositionDrop(subsetZone, node.id)) {
      throw new Error(`Unable to nest ${node.name} on its four typed nodes`);
    }
    const relationships = Object.values(chartRelationships.value.nestedRelationships)
      .filter((relationship) => relationship.parentChartId === network.id && relationship.parameters?.sourceChildId === node.id);
    relationships.forEach((relationship) => {
      const child = findCanvasNode(relationship.childChartId);
      if (!child?.chartSpec) return;
      let nodeId = "";
      try { nodeId = JSON.parse(relationship.parentDataKey ?? "{}").nodeKey ?? ""; } catch { /* no-op */ }
      child.chartSpec = { ...child.chartSpec, filters: { ...(child.chartSpec.filters ?? {}), node_id: nodeId },
        renderer: undefined, scales: undefined, plotArea: undefined, polarArea: undefined };
      renderChartNode(child);
      registerChartRelationship(child);
    });
    openNestedPositionEditor(relationships.map((relationship) => relationship.id));
    applyNestedAppearance({
      parentAnchor: { x: 0.5, y: 0.5 }, childAnchor: { x: 0.5, y: 0.5 },
      offset: { x: 0, y: 0 }, scale: { x: 0.48, y: 0.48 }, rotation: 0,
      retainParent: false, callout: { enabled: false, scale: 1 },
      decorations: [{ id: `${shape}-frame`, kind: shape, x: -0.08, y: -0.08, width: 1.16, height: 1.16,
        fill, stroke: "#475569", strokeWidth: 1.5, cornerRadius: 16, opacity: 0.95 }],
    });
    editingCompositionId.value = null;
    await nextTick();
  };

  if (compose) {
    for (const source of sources) await nestSubset(source);
    closeNestedPositionEditor();
    scheduleNestedChildLayout();
    await nextTick();
    await nextTick();
  }
  setActiveDataset(graph.id);
  setSelection([]);
  chartDrilldown.value = null;
  nestedDropPath.value = [];
  axisBindingTarget.value = null;
  const bounds = canvasNodes.value.reduce((current, item) => mergeBounds(current,
    boundsFromNodeFrame(item.x, item.y, item.width, item.height, item.scaleX, item.scaleY, item.rotation)), null);
  const viewport = canvasRef.value?.getBoundingClientRect();
  if (bounds && viewport) {
    const zoom = clamp(Math.min((viewport.width - 80) / bounds.width, (viewport.height - 80) / bounds.height), MIN_ZOOM, MAX_ZOOM);
    viewZoom.value = zoom;
    viewPan.value = { x: (viewport.width - bounds.width * zoom) / 2 - bounds.minX * zoom,
      y: (viewport.height - bounds.height * zoom) / 2 - bounds.minY * zoom };
  }
  return true;
}
