/** Case-owned bindings, frames, and replay of real editor composition operations. */
export async function configure(context, ...args) {
  const { MAX_ZOOM, MIN_ZOOM, adaptLegacyWideBindings, canvasNodes, canvasRef, chartRelationships, clamp, closeNestedPositionEditor, createCanvasItem, createDeckglLayer, deckglLightMapStyleUrl, findCanvasNode, getChartBlockSpecification, hasRequiredChartEncodings, implementedTemplateDefinitions, materializeGraphDataset, nestCanvasNodeOnDeckglPoint, nextTick, onCanvasDrop, openNestedPositionEditor, registerChartRelationship, renderChartNode, setActiveDataset, setDeckglConfig, setDeckglDataBinding, setDeckglEncoding, setSelection, updateNestedCallout, updateNestedPosition, useDatasetStore, viewPan, viewZoom } = context;
  async function loadGeographicNetworkCase(compose) {
    if (canvasNodes.value.length)
      return false;
    const dataStore = useDatasetStore();
    const base = "/site/gallery/cases/geographic-network/data/";
    const read = async (name) => {
      const response = await fetch(base + name);
      if (!response.ok)
        throw new Error(`Case data unavailable: ${name}`);
      return new File([await response.text()], name);
    };
    const [tableFile, nodesFile, linksFile, geometryFile] = await Promise.all([
      read("case2.csv"), read("case2_graph_nodes.csv"), read("case2_graph_links.csv"), read("nyc-zip-boundaries.geojson"),
    ]);
    const table = await dataStore.importDataset(tableFile);
    const graph = await dataStore.importGraphDataset(nodesFile, linksFile, "geo");
    const geometry = await dataStore.importGeometrySource(geometryFile);
    if (!table || !graph || !geometry)
      throw new Error("Case data import failed");
    const create = async (chartType, x, y) => {
      const candidate = implementedTemplateDefinitions.find((item) => item.chartType === chartType);
      if (!candidate)
        throw new Error(`Missing block: ${chartType}`);
      const item = (await createCanvasItem(candidate, { x, y }, false))?.[0];
      const node = item && findCanvasNode(item.id);
      if (!node)
        throw new Error(`Unable to create ${chartType}`);
      node.scaleX = node.scaleY = 1;
      return node;
    };
    const polygon = await create("PolygonLayer", 480, 480);
    const scatter = await create("ScatterplotLayer", 1400, 480);
    for (const node of [polygon, scatter]) {
      node.width = 900;
      node.height = 800;
      node.x = node === polygon ? 80 : 1080;
      node.y = 80;
      node.mapStyleUrl = deckglLightMapStyleUrl;
      node.mapViewState = { longitude: -73.94, latitude: 40.69, zoom: 9.65, pitch: 0, bearing: 0 };
    }
    setDeckglDataBinding(polygon.id, table.id, geometry.id, "incident_zip");
    setDeckglEncoding(polygon.id, "color", "sighting_count");
    setDeckglDataBinding(scatter.id, graph.id, geometry.id, "point");
    setDeckglConfig(scatter.id, { size: 7, color: "#185876", link: false });
    const bars = await create("StackedBarChart", 2420, 440);
    bars.width = 260;
    bars.height = 180;
    bars.x = 2100;
    bars.y = 240;
    bars.chartSpec = {
      chartType: "StackedBarChart", blockId: bars.chartSpec.blockId, blockRevision: bars.chartSpec.blockRevision, datasetId: graph.id,
      encodings: { x: { field: "month", type: "ordinal" } },
      valueFields: ["pedestrian_trips", "bicycle_trips", "transit_rides", "vehicle_trips", "delivery_trips"]
        .map((field) => ({ field, type: "quantitative" })),
      axes: { x: { visible: false, labelsVisible: false }, y: { visible: false, labelsVisible: false } },
    };
    bars.chartSpec = adaptLegacyWideBindings(bars.chartSpec, materializeGraphDataset(graph, bars.chartSpec), getChartBlockSpecification("StackedBarChart"));
    renderChartNode(bars);
    if (!bars.renderedContent || !hasRequiredChartEncodings(bars.chartSpec))
      throw new Error("Stacked Bar bindings did not render");
    registerChartRelationship(bars);
    if (compose) {
      const candidate = implementedTemplateDefinitions.find((item) => item.graphLinkMode === "geographic");
      const viewport = canvasRef.value?.getBoundingClientRect();
      if (!candidate || !viewport)
        throw new Error("Link drop target unavailable");
      const transfer = new DataTransfer();
      transfer.setData("application/x-svg-candidate", candidate.id);
      await onCanvasDrop(new DragEvent("drop", { dataTransfer: transfer,
        clientX: viewport.left + viewPan.value.x + (scatter.x + 100) * viewZoom.value,
        clientY: viewport.top + viewPan.value.y + (scatter.y + 80) * viewZoom.value,
      }));
      if (!scatter.deckglConfig?.link)
        throw new Error("Graph Link drop failed");
      if (!createDeckglLayer(polygon.id, scatter.id, false))
        throw new Error("Map Layer failed");
      if (!nestCanvasNodeOnDeckglPoint(bars.id, {
        layerId: scatter.id, rowKey: "10307", clientX: 0, clientY: 0, radius: 7, position: [-74.24, 40.51],
      }))
        throw new Error("Map Nested failed");
      updateNestedCallout({ enabled: true, scale: 1.12 });
      // Keep message frames clear of their points and of neighboring nodes.
      const offsets = {
        "10307": { x: 15, y: 60 }, "11231": { x: -135, y: -30 },
        "11224": { x: -105, y: 65 }, "10021": { x: -140, y: -20 },
        "10039": { x: -85, y: -100 }, "11234": { x: 55, y: 105 },
        "11370": { x: 15, y: -110 }, "11417": { x: 100, y: 90 },
        "11432": { x: 125, y: 10 }, "11004": { x: 0, y: -95 },
      };
      for (const relationship of Object.values(chartRelationships.value.nestedRelationships)) {
        if (relationship.parentChartId !== scatter.id || !relationship.parentDataKey)
          continue;
        openNestedPositionEditor([relationship.id]);
        updateNestedPosition({ offset: offsets[relationship.parentDataKey] ?? { x: 0, y: -100 }, retainParent: true });
      }
      closeNestedPositionEditor();
    }
    setActiveDataset(graph.id);
    setSelection([]);
    await nextTick();
    const viewport = canvasRef.value?.getBoundingClientRect();
    if (viewport) {
      const width = compose ? 900 : 2280;
      const zoom = clamp(Math.min((viewport.width - 64) / width, (viewport.height - 64) / 800), MIN_ZOOM, MAX_ZOOM);
      viewZoom.value = zoom;
      viewPan.value = { x: (viewport.width - width * zoom) / 2 - 80 * zoom, y: (viewport.height - 800 * zoom) / 2 - 80 * zoom };
    }
    return true;
  }
  return loadGeographicNetworkCase(...args);
}
