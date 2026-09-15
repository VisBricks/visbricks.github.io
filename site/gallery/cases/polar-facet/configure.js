/** Case-owned bindings, frames, and replay of real editor composition operations. */
export async function configure(context, ...args) {
  const { MAX_ZOOM, MIN_ZOOM, canvasNodes, canvasRef, clamp, concatNodesAreCompatible, createCanvasItem, createFacetFromFields, executeComposition, findCanvasNode, getCanvasNodeListBounds, getDataset, getPolarOccupiedGeometry, getSelectionScopeNodes, implementedTemplateDefinitions, nodeLocalToSelectionScopePoint, registerChartRelationship, renderChartNode, setActiveDataset, setSelection, viewPan, viewZoom } = context;
  async function loadChordCircularStackedFacetCase(datasetId, compose = true) {
    const dataset = getDataset(datasetId);
    const chordCandidate = implementedTemplateDefinitions.find((candidate) => candidate.chartType === "Chord");
    const circularStackedCandidate = implementedTemplateDefinitions.find((candidate) => candidate.chartType === "CircularStackedBarChart");
    if (!dataset?.graph || !chordCandidate || !circularStackedCandidate
      || canvasNodes.value.length > 0) {
      return false;
    }
    setActiveDataset(datasetId);
    const createdChord = (await createCanvasItem(chordCandidate, { x: 520, y: 430 }, false))?.[0];
    const chord = createdChord ? findCanvasNode(createdChord.id) : null;
    const createdCircularStacked = (await createCanvasItem(circularStackedCandidate, { x: 940, y: 430 }, false))?.[0];
    const circularStacked = createdCircularStacked
      ? findCanvasNode(createdCircularStacked.id)
      : null;
    if (!chord?.chartSpec || !circularStacked?.chartSpec)
      return false;
    chord.name = "Chord — regional energy flow";
    chord.chartSpec = {
      ...chord.chartSpec,
      datasetId,
      encodings: {
        key: { field: "node_id", type: "nominal" },
        source: { field: "source", type: "nominal" },
        target: { field: "target", type: "nominal" },
        value: { field: "flow_twh", type: "quantitative" },
      },
      dataTransforms: undefined,
      filters: undefined,
      renderer: undefined,
      scales: undefined,
      plotArea: undefined,
      polarArea: undefined,
    };
    circularStacked.name = "Circular Stacked Bar Facet — weekly generation mix";
    circularStacked.chartSpec = {
      ...circularStacked.chartSpec,
      datasetId,
      encodings: {
        theta: { field: "generation_gwh", type: "quantitative" },
        radius: { field: "week", type: "ordinal" },
        color: { field: "energy_source", type: "nominal" },
      },
      series: { field: "energy_source", type: "nominal" },
      seriesFields: [{ field: "energy_source", type: "nominal" }],
      dataTransforms: [{
          id: "case:circular-stacked:six-weeks",
          kind: "filter",
          mode: "values",
          field: "week",
          values: [
            "2025-01-01",
            "2025-02-26",
            "2025-04-23",
            "2025-06-18",
            "2025-08-13",
            "2025-10-08",
          ],
          single: false,
          purpose: "filter",
        }],
      filters: undefined,
      defaultDataBinding: undefined,
      valueFields: undefined,
      axes: {
        theta: { visible: false, labelsVisible: false },
        radius: { visible: false, labelsVisible: false },
      },
      renderer: undefined,
      scales: undefined,
      plotArea: undefined,
      polarArea: undefined,
    };
    renderChartNode(chord);
    renderChartNode(circularStacked);
    registerChartRelationship(chord);
    registerChartRelationship(circularStacked);
    if (!compose) {
      circularStacked.x = chord.x + chord.width * Math.abs(chord.scaleX) + 140;
      circularStacked.y = chord.y;
    }
    else {
      setSelection([circularStacked.id]);
      if (!createFacetFromFields(circularStacked.id, {
        coordinateSystem: "Polar",
        thetaField: "node_id",
      }))
        return false;
      const facetRoot = getSelectionScopeNodes().find((node) => node.kind === "group" && node.compositionSpec?.type === "facet");
      if (!facetRoot || !concatNodesAreCompatible([chord, facetRoot], "radial", "angle")) {
        return false;
      }
      setSelection([chord.id, facetRoot.id]);
      if (!executeComposition("concat", false, ["angle"], "radial"))
        return false;
      const facetGeometry = getPolarOccupiedGeometry(facetRoot);
      const chordGeometry = getPolarOccupiedGeometry(chord);
      if (!facetGeometry || !chordGeometry)
        return false;
      const sharedCenter = nodeLocalToSelectionScopePoint(facetRoot, facetGeometry.origin);
      const facetScale = Math.min(Math.abs(facetRoot.scaleX), Math.abs(facetRoot.scaleY));
      const facetOuterRadius = facetGeometry.outerRadius * facetScale;
      const chordScale = facetOuterRadius * 0.46 / Math.max(chordGeometry.outerRadius, 1);
      const chordLocalMinX = chord.kind === "leaf" ? chord.contentMinX : 0;
      const chordLocalMinY = chord.kind === "leaf" ? chord.contentMinY : 0;
      chord.scaleX = chordScale;
      chord.scaleY = chordScale;
      chord.x = sharedCenter.x - (chordGeometry.origin.x - chordLocalMinX) * chordScale;
      chord.y = sharedCenter.y - (chordGeometry.origin.y - chordLocalMinY) * chordScale;
    }
    setSelection([]);
    const bounds = getCanvasNodeListBounds(getSelectionScopeNodes());
    const viewport = canvasRef.value?.getBoundingClientRect();
    if (bounds && viewport && bounds.width > 0 && bounds.height > 0) {
      const padding = 56;
      const zoom = clamp(Math.min((viewport.width - padding * 2) / bounds.width, (viewport.height - padding * 2) / bounds.height, 1), MIN_ZOOM, MAX_ZOOM);
      viewZoom.value = zoom;
      viewPan.value = {
        x: (viewport.width - bounds.width * zoom) / 2 - bounds.minX * zoom,
        y: (viewport.height - bounds.height * zoom) / 2 - bounds.minY * zoom,
      };
    }
    return true;
  }
  return loadChordCircularStackedFacetCase(...args);
}
