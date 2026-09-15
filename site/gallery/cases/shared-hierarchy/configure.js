/** Case-owned bindings, frames, and replay of real editor composition operations. */
export async function configure(context, ...args) {
  const { sharedHierarchyChartSpec, MAX_ZOOM, MIN_ZOOM, boundsFromNodeFrame, canvasNodes, canvasRef, clamp, createCanvasItem, executeComposition, findCanvasNode, getDataset, getSelectionScopeNodes, implementedTemplateDefinitions, mergeBounds, nextTick, registerChartRelationship, renderChartNode, setActiveDataset, setSelection, viewPan, viewZoom } = context;
  /** Starter and completed recording use identical hierarchy bindings. */
  async function loadSharedHierarchyCase(datasetId, compose = true) {
    if (!getDataset(datasetId) || canvasNodes.value.length > 0)
      return false;
    setActiveDataset(datasetId);
    const nodes = [];
    for (const [index, chartType] of ["Sunburst", "RadialDendrogram"].entries()) {
      const candidate = implementedTemplateDefinitions.find((item) => item.chartType === chartType);
      if (!candidate)
        return false;
      const created = (await createCanvasItem(candidate, { x: 400 + index * 720, y: 400 }, false))?.[0];
      const node = created ? findCanvasNode(created.id) : null;
      if (!node?.chartSpec || node.coordinateGuide?.type !== "Polar")
        return false;
      node.name = chartType === "Sunburst" ? "Sunburst — organization weight" : "Radial Dendrogram — organization hierarchy";
      node.width = 640;
      node.height = 640;
      node.scaleX = node.scaleY = 1;
      node.rotation = 0;
      node.coordinateGuide = { ...node.coordinateGuide, origin: { x: 320, y: 320 }, angleOffset: 0, angleSpan: 360, innerRadiusRatio: 0, outerRadiusRatio: 1 };
      node.chartSpec = {
        ...sharedHierarchyChartSpec(chartType, datasetId, node.id),
        blockId: node.chartSpec.blockId, blockRevision: node.chartSpec.blockRevision,
      };
      renderChartNode(node);
      registerChartRelationship(node);
      nodes.push(node);
    }
    if (compose) {
      setSelection(nodes.map((node) => node.id));
      if (!executeComposition("concat", false, ["radius"], "angular"))
        return false;
    }
    else {
      nodes[1].x = nodes[0].x + nodes[0].width + 100;
      nodes[1].y = nodes[0].y;
    }
    setSelection([]);
    await nextTick();
    // Imported template child bounds are stale after resizing the chart frame.
    const bounds = getSelectionScopeNodes().reduce((current, node) => mergeBounds(current, boundsFromNodeFrame(node.x, node.y, node.width, node.height, node.scaleX, node.scaleY, node.rotation)), null);
    const viewport = canvasRef.value?.getBoundingClientRect();
    if (bounds && viewport && bounds.width > 0 && bounds.height > 0) {
      const zoom = clamp(Math.min((viewport.width - 112) / bounds.width, (viewport.height - 112) / bounds.height, 1), MIN_ZOOM, MAX_ZOOM);
      viewZoom.value = zoom;
      viewPan.value = { x: (viewport.width - bounds.width * zoom) / 2 - bounds.minX * zoom, y: (viewport.height - bounds.height * zoom) / 2 - bounds.minY * zoom };
    }
    return true;
  }
  return loadSharedHierarchyCase(...args);
}
