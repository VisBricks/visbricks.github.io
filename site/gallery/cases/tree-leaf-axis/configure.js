/** Case-owned bindings, frames, and replay of real editor composition operations. */
export async function configure(context, ...args) {
  const { MAX_ZOOM, MIN_ZOOM, axisBindingTarget, boundsFromNodeFrame, canvasNodes, canvasRef, chartDrilldown, chartRelationships, clamp, closeNestedPositionEditor, commitCompositionDrop, compositionDropZoneAtPoint, createCanvasItem, editingCompositionId, enterNestedDropLevel, findCanvasNode, implementedTemplateDefinitions, mergeBounds, nestedDropPath, nextTick, nodeLocalToSelectionScopePoint, openNestedPositionEditor, registerChartRelationship, renderChartNode, scheduleNestedChildLayout, setActiveDataset, setSelection, toSelectionScopePoint, updateNestedChildScale, updateNestedPosition, useDatasetStore, viewPan, viewZoom } = context;
  async function loadDendrogramProfilesCase(compose) {
    if (canvasNodes.value.length)
      return false;
    const response = await fetch("/site/gallery/cases/tree-leaf-axis/data/tree_nodes.csv");
    if (!response.ok)
      throw new Error("Monthly hierarchy CSV unavailable");
    const dataset = await useDatasetStore().importDataset(new File([await response.text()], "tree_nodes.csv", { type: "text/csv" }));
    if (!dataset)
      throw new Error("Monthly hierarchy import failed");
    setActiveDataset(dataset.id);
    const create = async (chartType, x, y, width, height) => {
      const candidate = implementedTemplateDefinitions.find((item) => item.chartType === chartType);
      if (!candidate)
        throw new Error(`Missing block: ${chartType}`);
      const created = (await createCanvasItem(candidate, { x, y }, false))?.[0];
      const node = created && findCanvasNode(created.id);
      if (!node?.chartSpec)
        throw new Error(`Unable to create ${chartType}`);
      node.x = x;
      node.y = y;
      node.width = width;
      node.height = height;
      node.scaleX = node.scaleY = 1;
      node.chartSpec = { chartType, datasetId: dataset.id, blockId: node.chartSpec.blockId, blockRevision: node.chartSpec.blockRevision, encodings: {} };
      return node;
    };
    const tree = await create("Dendrogram", 80, 80, 1600, 1800);
    tree.name = "Dendrogram — monthly node profiles";
    tree.chartSpec = {
      ...tree.chartSpec,
      encodings: { key: { field: "node_id", type: "nominal" }, parent: { field: "parent_id", type: "nominal" } },
      axes: { x: { visible: false, labelsVisible: false }, y: { visible: false, labelsVisible: false } },
      markGroups: [{ id: `mark-group:${tree.id}:node`, chartId: tree.id, role: "node", memberKeys: [], allowOverrides: true,
          sharedConfig: { treeDirection: "right", nodeLabelsVisible: false, leafLabelsVisible: false, size: 5 } }],
    };
    renderChartNode(tree);
    registerChartRelationship(tree);
    const radial = await create("RadialStackedBarChart", 1800, 200, 320, 320);
    radial.name = "Radial Stacked Bar (Sector) — five monthly metrics";
    if (radial.coordinateGuide?.type !== "Polar")
      throw new Error("Radial block requires polar coordinates");
    radial.coordinateGuide = { ...radial.coordinateGuide, origin: { x: 160, y: 160 }, angleSpan: 360, angleOffset: 0 };
    const metrics = ["metric_1", "metric_2", "metric_3", "metric_4", "metric_5"];
    radial.chartSpec = {
      ...radial.chartSpec,
      encodings: { segment: { field: "month", type: "ordinal" }, radius: { field: "metric_value", type: "quantitative" }, series: { field: "metric", type: "nominal" } },
      series: { field: "metric", type: "nominal" },
      dataTransforms: [{ id: "node-metric-fold", kind: "fold", sourceFields: metrics, keyOutputField: "metric", valueOutputField: "metric_value", lineage: { sourceFields: metrics, operation: "fold" } }],
      axes: { theta: { visible: false, labelsVisible: false }, radius: { visible: false, labelsVisible: false } },
    };
    renderChartNode(radial);
    registerChartRelationship(radial);
    const area = await create("AreaChart", 2240, 240, 320, 220);
    area.name = "Area Chart — monthly metric_1";
    area.chartSpec = { ...area.chartSpec, encodings: { x: { field: "month", type: "ordinal" }, y: { field: "metric_1", type: "quantitative" } },
      aggregations: { y: "sum" }, axes: { x: { visible: false, labelsVisible: false }, y: { visible: false, labelsVisible: false } } };
    renderChartNode(area);
    registerChartRelationship(area);
    for (const node of [tree, radial, area]) {
      if (!node.renderedContent || node.chartSpec?.renderer?.status !== "ready")
        throw new Error(`Block failed to render: ${node.name}`);
    }
    await nextTick();
    if (compose) {
      for (const [source, offset, diameter] of [[radial, -78, 210], [area, 80, 225]]) {
        await nextTick();
        if (chartDrilldown.value?.nodeId !== tree.id || chartDrilldown.value.level !== "part") {
          const plot = tree.chartSpec.plotArea;
          const enterPoint = nodeLocalToSelectionScopePoint(tree, { x: plot.x + plot.width / 2, y: plot.y + plot.height / 2 });
          const enterZone = compositionDropZoneAtPoint(enterPoint, source.id);
          if (!enterZone || !enterNestedDropLevel(enterZone))
            throw new Error("Unable to enter Dendrogram node level");
          await nextTick();
        }
        const parentElement = canvasRef.value?.querySelector(`[data-node-id="${tree.id}"]`);
        const mark = parentElement?.querySelector(`[data-chart-id="${tree.id}"][data-mark-role="node"] circle`);
        const rect = mark?.getBoundingClientRect();
        if (!rect)
          throw new Error("Dendrogram node drop target unavailable");
        const point = toSelectionScopePoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const zone = compositionDropZoneAtPoint(point, source.id);
        if (zone?.type !== "nested" || zone.nestedTargets?.length !== 15 || !commitCompositionDrop(zone, source.id)) {
          throw new Error(`Unable to nest ${source.name} on all 15 nodes`);
        }
        updateNestedPosition({ offset: { x: offset, y: 0 }, retainParent: true });
        updateNestedChildScale(source.id, diameter / 360);
        closeNestedPositionEditor();
        editingCompositionId.value = null;
        await nextTick();
      }
      openNestedPositionEditor(Object.values(chartRelationships.value.nestedRelationships)
        .filter((relationship) => relationship.parentChartId === tree.id)
        .map((relationship) => relationship.id));
      updateNestedPosition({ retainParent: false });
      closeNestedPositionEditor();
      scheduleNestedChildLayout();
      await nextTick();
      await nextTick();
    }
    setSelection([]);
    chartDrilldown.value = null;
    nestedDropPath.value = [];
    axisBindingTarget.value = null;
    const viewport = canvasRef.value?.getBoundingClientRect();
    const bounds = canvasNodes.value.reduce((current, node) => mergeBounds(current, boundsFromNodeFrame(node.x, node.y, node.width, node.height, node.scaleX, node.scaleY, node.rotation)), null);
    if (viewport && bounds) {
      const zoom = clamp(Math.min((viewport.width - 80) / bounds.width, (viewport.height - 80) / bounds.height), MIN_ZOOM, MAX_ZOOM);
      viewZoom.value = zoom;
      viewPan.value = { x: (viewport.width - bounds.width * zoom) / 2 - bounds.minX * zoom, y: (viewport.height - bounds.height * zoom) / 2 - bounds.minY * zoom };
    }
    await nextTick();
    return true;
  }
  return loadDendrogramProfilesCase(...args);
}
