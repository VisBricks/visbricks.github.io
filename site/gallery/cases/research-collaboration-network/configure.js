/** Force network with real per-node Nested Area Chart instances. */
export async function configure(context, compose = true) {
  const {
    MAX_ZOOM, MIN_ZOOM, axisBindingTarget, boundsFromNodeFrame, canvasNodes, canvasRef,
    chartDrilldown, clamp, closeNestedPositionEditor, commitCompositionDrop,
    compositionDropZoneAtPoint, createCanvasItem, editingCompositionId, enterNestedDropLevel,
    findCanvasNode, implementedTemplateDefinitions, mergeBounds, nestedDropPath, nextTick,
    nodeLocalToSelectionScopePoint, registerChartRelationship, renderChartNode,
    scheduleNestedChildLayout, setActiveDataset, setSelection, toSelectionScopePoint,
    updateNestedChildScale, updateNestedPosition, useDatasetStore, viewPan, viewZoom,
  } = context;
  if (canvasNodes.value.length) return false;
  const read = async (name) => {
    const response = await fetch(`/site/gallery/cases/research-collaboration-network/data/${name}`);
    if (!response.ok) throw new Error(`Case data unavailable: ${name}`);
    return new File([await response.text()], name, { type: "text/csv" });
  };
  const dataStore = useDatasetStore();
  const dataset = await dataStore.importGraphDataset(
    await read("research_nodes.csv"), await read("research_links.csv"), "research-collaboration",
  );
  const profiles = await dataStore.importDataset(await read("research_profiles.csv"));
  if (!dataset || !profiles) throw new Error("Research data import failed");
  setActiveDataset(dataset.id);
  const create = async (chartType, frame, datasetId = dataset.id) => {
    const candidate = implementedTemplateDefinitions.find((item) => item.chartType === chartType);
    if (!candidate) throw new Error(`Missing block: ${chartType}`);
    const created = (await createCanvasItem(candidate, { x: frame.x, y: frame.y }, false, datasetId))?.[0];
    const node = created ? findCanvasNode(created.id) : null;
    if (!node?.chartSpec) throw new Error(`Unable to create ${chartType}`);
    Object.assign(node, frame, { scaleX: 1, scaleY: 1 });
    return node;
  };
  const network = await create("ForceDirectedGraph", { x: 80, y: 80, width: 1100, height: 850 });
  network.name = "Force network — research collaborations";
  network.chartSpec = {
    ...network.chartSpec, datasetId: dataset.id,
    encodings: {
      key: { field: "lab_id", type: "nominal" },
      source: { field: "source", type: "nominal" },
      target: { field: "target", type: "nominal" },
      value: { field: "collaboration", type: "quantitative" },
      color: { field: "discipline", type: "nominal" },
      size: { field: "funding", type: "quantitative" },
    },
    renderer: undefined, scales: undefined, plotArea: undefined,
  };
  renderChartNode(network);
  registerChartRelationship(network);
  const area = await create("AreaChart", { x: 1280, y: 300, width: 300, height: 200 }, profiles.id);
  area.name = "Monthly research output";
  area.chartSpec = {
    ...area.chartSpec, datasetId: profiles.id,
    encodings: { x: { field: "month", type: "ordinal" }, y: { field: "output", type: "quantitative" } },
    axes: { x: { visible: false, labelsVisible: false }, y: { visible: false, labelsVisible: false } },
    renderer: undefined, scales: undefined, plotArea: undefined,
  };
  renderChartNode(area);
  registerChartRelationship(area);
  if (!network.renderedContent || !area.renderedContent) throw new Error("Research blocks failed to render");
  await nextTick();
  if (compose) {
    const plot = network.chartSpec.plotArea;
    if (!plot) throw new Error("Force plot unavailable");
    const enterPoint = nodeLocalToSelectionScopePoint(network, { x: plot.x + plot.width / 2, y: plot.y + plot.height / 2 });
    const enterZone = compositionDropZoneAtPoint(enterPoint, area.id);
    if (!enterZone || !enterNestedDropLevel(enterZone)) throw new Error("Unable to enter Force node level");
    await nextTick();
    const parentElement = canvasRef.value?.querySelector(`[data-node-id="${network.id}"]`);
    const mark = parentElement?.querySelector(`[data-chart-id="${network.id}"][data-mark-role="node"] circle`);
    const rect = mark?.getBoundingClientRect();
    if (!rect) throw new Error("Force node drop target unavailable");
    const point = toSelectionScopePoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const zone = compositionDropZoneAtPoint(point, area.id);
    if (zone?.type !== "nested" || zone.nestedTargets?.length !== 12 || !commitCompositionDrop(zone, area.id)) {
      throw new Error(`Unable to nest Area Charts on all 12 labs (${zone?.nestedTargets?.length ?? 0} targets)`);
    }
    updateNestedPosition({ offset: { x: 0, y: 0 }, retainParent: false });
    updateNestedChildScale(area.id, 0.62);
    closeNestedPositionEditor();
    editingCompositionId.value = null;
    scheduleNestedChildLayout();
    await nextTick();
    await nextTick();
  }
  setSelection([]);
  chartDrilldown.value = null;
  nestedDropPath.value = [];
  axisBindingTarget.value = null;
  const bounds = canvasNodes.value.reduce((current, node) => mergeBounds(current,
    boundsFromNodeFrame(node.x, node.y, node.width, node.height, node.scaleX, node.scaleY, node.rotation)), null);
  const viewport = canvasRef.value?.getBoundingClientRect();
  if (bounds && viewport) {
    const zoom = clamp(Math.min((viewport.width - 80) / bounds.width, (viewport.height - 80) / bounds.height), MIN_ZOOM, MAX_ZOOM);
    viewZoom.value = zoom;
    viewPan.value = { x: (viewport.width - bounds.width * zoom) / 2 - bounds.minX * zoom, y: (viewport.height - bounds.height * zoom) / 2 - bounds.minY * zoom };
  }
  return true;
}
