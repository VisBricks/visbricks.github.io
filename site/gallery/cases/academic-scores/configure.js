/** Case-owned bindings, frames, and replay of real editor composition operations. */
export async function configure(context, ...args) {
  const { MAX_ZOOM, MIN_ZOOM, adaptLegacyWideBindings, applyNestedPiesToNode, canvasNodes, canvasRef, clamp, createCanvasItem, createDefaultChartSpec, executeComposition, findCanvasNode, getCanvasNodeListBounds, getChartBlockSpecification, getDataset, hasRequiredChartEncodings, implementedTemplateDefinitions, nextTick, registerChartRelationship, renderChartNode, resolveChartEncodingIssues, setSelection, viewPan, viewZoom } = context;
  async function loadGalleryStarter(starterId, preferredDatasetId, compose = false) {
    const failGalleryStarter = (reason) => {
      if (typeof document !== "undefined") {
        document.documentElement.dataset.galleryStarterError = reason;
      }
      return false;
    };
    if (typeof document !== "undefined") {
      delete document.documentElement.dataset.galleryStarterError;
    }
    const starterChartTypes = {
      "academic-scores": ["Streamgraph", "Scatterplot", "PieChart"],
    };
    const configuredChartTypes = starterChartTypes[starterId];
    const chartTypes = compose && starterId === "academic-scores"
      ? configuredChartTypes?.filter((chartType) => chartType !== "PieChart")
      : configuredChartTypes;
    if (!chartTypes)
      return failGalleryStarter(`unknown-starter:${starterId}`);
    if (canvasNodes.value.length > 0)
      return failGalleryStarter("canvas-not-empty");
    const academicAwardFields = [
      "Literature",
      "Mathematics",
      "Biology",
      "Chemistry",
      "Physics",
      "Computer Science",
      "Politics",
      "History",
    ];
    const academicAwardEncodings = academicAwardFields.map((field) => ({
      field,
      type: "quantitative",
    }));
    const createdNodes = [];
    for (const [index, chartType] of chartTypes.entries()) {
      const candidate = implementedTemplateDefinitions.find((item) => item.chartType === chartType);
      const defaultSpec = createDefaultChartSpec(chartType);
      if (!candidate)
        return failGalleryStarter(`missing-candidate:${chartType}`);
      if (!defaultSpec)
        return failGalleryStarter(`missing-default-spec:${chartType}`);
      const datasetId = starterId === "academic-scores"
        ? preferredDatasetId
        : defaultSpec.datasetId;
      if (!datasetId)
        return failGalleryStarter(`missing-dataset:${chartType}`);
      const created = (await createCanvasItem(candidate, { x: 480 + index * 900, y: 520 }, false, datasetId))?.[0];
      const node = created ? findCanvasNode(created.id) : null;
      if (!node?.chartSpec)
        return failGalleryStarter(`create-node-failed:${chartType}`);
      const starterSpec = starterId !== "academic-scores"
        ? defaultSpec
        : chartType === "Streamgraph"
          ? {
            chartType,
            datasetId,
            encodings: {
              x: { field: "academic_level", type: "quantitative" },
            },
            valueFields: academicAwardEncodings,
          }
          : chartType === "Scatterplot"
            ? {
              chartType,
              datasetId,
              encodings: {
                x: { field: "academic_level", type: "quantitative" },
                y: { field: "university_size", type: "quantitative" },
                color: { field: "university_id", type: "nominal" },
                size: { field: "total_awards", type: "quantitative" },
              },
            }
            : {
              chartType,
              datasetId,
              encodings: {},
              angleFields: academicAwardEncodings,
              axes: {
                theta: { visible: false, labelsVisible: false },
                radius: { visible: false, labelsVisible: false },
              },
            };
      const starterDataset = getDataset(datasetId);
      if (!starterDataset)
        return failGalleryStarter(`dataset-not-found:${chartType}`);
      const configuredStarterSpec = starterId === "academic-scores"
        ? adaptLegacyWideBindings(starterSpec, starterDataset, getChartBlockSpecification(chartType))
        : starterSpec;
      if (starterId === "academic-scores"
        && (chartType === "Streamgraph" || chartType === "Scatterplot")) {
        node.width = 720;
        node.height = 330;
        node.scaleX = 1;
        node.scaleY = 1;
      }
      node.chartSpec = {
        ...node.chartSpec,
        ...configuredStarterSpec,
        blockId: node.chartSpec.blockId,
        blockRevision: node.chartSpec.blockRevision,
        defaultDataBinding: undefined,
        renderer: undefined,
        scales: undefined,
        plotArea: undefined,
        polarArea: undefined,
      };
      renderChartNode(node);
      registerChartRelationship(node);
      createdNodes.push(node);
    }
    const unrenderedNode = createdNodes.find((node) => !node.renderedContent);
    if (unrenderedNode) {
      const rendererError = unrenderedNode.chartSpec?.renderer?.status === "error"
        ? unrenderedNode.chartSpec.renderer.error
        : undefined;
      const encodingState = unrenderedNode.chartSpec
        ? `complete=${hasRequiredChartEncodings(unrenderedNode.chartSpec)},issues=${resolveChartEncodingIssues(unrenderedNode.chartSpec).length}`
        : "missing-chart-spec";
      const coordinateState = `coordinate=${unrenderedNode.coordinateGuide?.type ?? "missing"}`;
      return failGalleryStarter([
        `render-failed:${unrenderedNode.chartSpec?.chartType ?? unrenderedNode.name}`,
        encodingState,
        coordinateState,
        rendererError,
      ].filter(Boolean).join(":"));
    }
    if (compose && starterId === "academic-scores") {
      const streamgraph = createdNodes.find((node) => node.chartSpec?.chartType === "Streamgraph");
      const scatterplot = createdNodes.find((node) => node.chartSpec?.chartType === "Scatterplot");
      if (!streamgraph || !scatterplot)
        return failGalleryStarter("missing-composition-node");
      if (!applyNestedPiesToNode(scatterplot, "*", {
        angleFields: academicAwardFields,
        radiusField: "total_awards",
      }, false))
        return failGalleryStarter("nested-pie-failed");
      setSelection([scatterplot.id, streamgraph.id]);
      if (!executeComposition("concat", false, ["x"], "vertical", "before", scatterplot.id, streamgraph.id))
        return failGalleryStarter("vertical-concat-failed");
    }
    setSelection([]);
    await nextTick();
    const bounds = getCanvasNodeListBounds(createdNodes);
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
  return loadGalleryStarter(...args);
}
