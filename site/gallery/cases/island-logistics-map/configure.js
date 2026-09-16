/** Geographic Layer plus real point-level Nested composition. */
export async function configure(context, compose = true) {
  const {
    MAX_ZOOM, MIN_ZOOM, adaptLegacyWideBindings, canvasNodes, canvasRef, chartRelationships,
    clamp, closeNestedPositionEditor, createCanvasItem, createDeckglLayer, deckglLightMapStyleUrl,
    findCanvasNode, getChartBlockSpecification, hasRequiredChartEncodings,
    implementedTemplateDefinitions, materializeGraphDataset, nestCanvasNodeOnDeckglPoint,
    nextTick, openNestedPositionEditor, registerChartRelationship, renderChartNode,
    setActiveDataset, setDeckglConfig, setDeckglDataBinding, setDeckglEncoding,
    setSelection, updateNestedCallout, updateNestedPosition, useDatasetStore, viewPan, viewZoom,
  } = context;
  if (canvasNodes.value.length) return false;
  const base = "/site/gallery/cases/island-logistics-map/data/";
  const read = async (name, type = "text/csv") => {
    const response = await fetch(base + name);
    if (!response.ok) throw new Error(`Case data unavailable: ${name}`);
    return new File([await response.text()], name, { type });
  };
  const store = useDatasetStore();
  const [table, graph, geometry] = await Promise.all([
    store.importDataset(await read("island_activity.csv")),
    store.importGraphDataset(await read("island_nodes.csv"), await read("island_links.csv"), "island-logistics"),
    store.importGeometrySource(await read("islands.geojson", "application/geo+json")),
  ]);
  if (!table || !graph || !geometry) throw new Error("Island data import failed");
  const create = async (chartType, x, y) => {
    const candidate = implementedTemplateDefinitions.find((item) => item.chartType === chartType);
    if (!candidate) throw new Error(`Missing block: ${chartType}`);
    const created = (await createCanvasItem(candidate, { x, y }, false))?.[0];
    const node = created ? findCanvasNode(created.id) : null;
    if (!node) throw new Error(`Unable to create ${chartType}`);
    node.scaleX = node.scaleY = 1;
    return node;
  };
  const polygon = await create("PolygonLayer", 80, 80);
  const scatter = await create("ScatterplotLayer", 1060, 80);
  for (const node of [polygon, scatter]) {
    node.width = 900; node.height = 760; node.y = 80;
    node.x = node === polygon ? 80 : 1060;
    node.mapStyleUrl = deckglLightMapStyleUrl;
    node.mapViewState = { longitude: 120.67, latitude: 14.02, zoom: 7.45, pitch: 0, bearing: 0 };
  }
  setDeckglDataBinding(polygon.id, table.id, geometry.id, "island_id");
  setDeckglEncoding(polygon.id, "color", "activity");
  setDeckglDataBinding(scatter.id, graph.id, geometry.id, "island_id");
  setDeckglConfig(scatter.id, { size: 9, color: "#173f5f", link: false });
  const bars = await create("StackedBarChart", 2100, 300);
  bars.width = 270; bars.height = 180;
  bars.chartSpec = {
    chartType: "StackedBarChart", blockId: bars.chartSpec.blockId, blockRevision: bars.chartSpec.blockRevision,
    datasetId: graph.id, encodings: { x: { field: "month", type: "ordinal" } },
    valueFields: ["cargo","passenger","relief"].map((field) => ({ field, type: "quantitative" })),
    axes: { x: { visible: false, labelsVisible: false }, y: { visible: false, labelsVisible: false } },
  };
  bars.chartSpec = adaptLegacyWideBindings(bars.chartSpec, materializeGraphDataset(graph, bars.chartSpec), getChartBlockSpecification("StackedBarChart"));
  renderChartNode(bars);
  registerChartRelationship(bars);
  if (!bars.renderedContent || !hasRequiredChartEncodings(bars.chartSpec)) throw new Error("Island bars failed to render");
  if (compose) {
    if (!createDeckglLayer(polygon.id, scatter.id, false)) throw new Error("Island map Layer failed");
    if (!nestCanvasNodeOnDeckglPoint(bars.id, {
      layerId: scatter.id, rowKey: "A1", clientX: 0, clientY: 0, radius: 9, position: [120.05, 14.15],
    })) throw new Error("Island map Nested failed");
    updateNestedCallout({ enabled: true, scale: 0.9 });
    const offsets = {
      A1: { x: -110, y: -80 }, B2: { x: -15, y: -115 }, C3: { x: 70, y: -80 }, D4: { x: 105, y: -20 },
      E5: { x: -115, y: 65 }, F6: { x: -30, y: 105 }, G7: { x: 65, y: 95 }, H8: { x: 115, y: 55 },
    };
    for (const relationship of Object.values(chartRelationships.value.nestedRelationships)) {
      if (relationship.parentChartId !== scatter.id || !relationship.parentDataKey) continue;
      openNestedPositionEditor([relationship.id]);
      updateNestedPosition({ offset: offsets[relationship.parentDataKey] ?? { x: 0, y: -90 }, retainParent: true });
    }
    closeNestedPositionEditor();
  }
  setActiveDataset(graph.id);
  setSelection([]);
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await new Promise((resolve) => setTimeout(resolve, 800));
  const viewport = canvasRef.value?.getBoundingClientRect();
  if (viewport) {
    const width = compose ? 900 : 2250;
    const zoom = clamp(Math.min((viewport.width - 64) / width, (viewport.height - 64) / 760), MIN_ZOOM, MAX_ZOOM);
    viewZoom.value = zoom;
    viewPan.value = { x: (viewport.width - width * zoom) / 2 - 80 * zoom, y: (viewport.height - 760 * zoom) / 2 - 80 * zoom };
  }
  return true;
}
