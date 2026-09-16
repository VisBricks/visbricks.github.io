/** Shared runner for case-owned declarative Gallery configurations. */
export async function configureShowcase(context, definition, compose = true) {
  const {
    MAX_ZOOM,
    MIN_ZOOM,
    adaptLegacyWideBindings,
    applyNestedPiesToNode,
    canvasNodes,
    canvasRef,
    clamp,
    createCanvasItem,
    executeComposition,
    findCanvasNode,
    getCanvasNodeListBounds,
    getChartBlockSpecification,
    hasRequiredChartEncodings,
    implementedTemplateDefinitions,
    nextTick,
    registerChartRelationship,
    renderChartNode,
    setActiveDataset,
    setSelection,
    useDatasetStore,
    viewPan,
    viewZoom,
  } = context;

  const fail = (reason) => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.galleryStarterError = `${definition.slug}:${reason}`;
    }
    return false;
  };
  if (typeof document !== "undefined") delete document.documentElement.dataset.galleryStarterError;
  if (canvasNodes.value.length > 0) return fail("canvas-not-empty");

  const store = useDatasetStore();
  const read = async (name) => {
    const response = await fetch(`/site/gallery/cases/${definition.slug}/data/${name}`);
    if (!response.ok) throw new Error(`Case data unavailable: ${name}`);
    return new File([await response.text()], name, { type: "text/csv" });
  };
  const dataset = definition.data.kind === "graph"
    ? await store.importGraphDataset(
      await read(definition.data.nodes),
      await read(definition.data.links),
      definition.data.name,
    )
    : await store.importDataset(await read(definition.data.file));
  if (!dataset) return fail("data-import-failed");
  setActiveDataset(dataset.id);

  const nestedChildren = new Set(compose
    ? definition.compositions.filter((item) => item.type === "nested-pie").map((item) => item.child)
    : []);
  const nodes = new Map();
  for (const [index, block] of definition.blocks.entries()) {
    if (nestedChildren.has(block.id)) continue;
    const candidate = implementedTemplateDefinitions.find((item) => item.chartType === block.chartType);
    if (!candidate) return fail(`missing-block:${block.chartType}`);
    const created = (await createCanvasItem(candidate, {
      x: block.frame?.x ?? 120 + index * 760,
      y: block.frame?.y ?? 160,
    }, false, dataset.id))?.[0];
    const node = created ? findCanvasNode(created.id) : null;
    if (!node?.chartSpec) return fail(`create-failed:${block.chartType}`);
    node.name = block.name;
    node.x = block.frame?.x ?? node.x;
    node.y = block.frame?.y ?? node.y;
    node.width = block.frame?.width ?? node.width;
    node.height = block.frame?.height ?? node.height;
    node.scaleX = node.scaleY = 1;
    if (block.polar && node.coordinateGuide?.type === "Polar") {
      node.coordinateGuide = {
        ...node.coordinateGuide,
        origin: { x: node.width / 2, y: node.height / 2 },
        angleOffset: block.polar.angleOffset ?? 0,
        angleSpan: block.polar.angleSpan ?? 360,
        innerRadiusRatio: block.polar.innerRadiusRatio ?? 0,
        outerRadiusRatio: block.polar.outerRadiusRatio ?? 1,
      };
    }
    let chartSpec = {
      ...node.chartSpec,
      ...block.chartSpec,
      chartType: block.chartType,
      datasetId: dataset.id,
      blockId: node.chartSpec.blockId,
      blockRevision: node.chartSpec.blockRevision,
      defaultDataBinding: undefined,
      renderer: undefined,
      scales: undefined,
      plotArea: undefined,
      polarArea: undefined,
    };
    if (block.adaptWide) {
      chartSpec = adaptLegacyWideBindings(
        chartSpec,
        dataset,
        getChartBlockSpecification(block.chartType),
      );
    }
    node.chartSpec = chartSpec;
    renderChartNode(node);
    registerChartRelationship(node);
    if (!node.renderedContent || !hasRequiredChartEncodings(node.chartSpec)) {
      return fail(`render-failed:${block.chartType}:${node.chartSpec.renderer?.error ?? "incomplete-binding"}`);
    }
    nodes.set(block.id, node);
  }

  if (compose) {
    for (const operation of definition.compositions) {
      if (operation.type === "nested-pie") {
        const parent = nodes.get(operation.parent);
        if (!parent || !applyNestedPiesToNode(parent, "*", {
          angleFields: operation.angleFields,
          radiusField: operation.radiusField,
        }, false)) return fail(`nested-pie-failed:${operation.parent}`);
        continue;
      }
      const target = nodes.get(operation.target);
      const source = nodes.get(operation.source);
      if (!target || !source) return fail(`missing-composition-member:${operation.target}:${operation.source}`);
      setSelection([target.id, source.id]);
      if (!executeComposition(
        operation.type,
        false,
        operation.sharedChannels,
        operation.direction,
        operation.position,
        target.id,
        source.id,
      )) return fail(`${operation.type}-failed:${operation.target}:${operation.source}`);
    }
  }

  setSelection([]);
  await nextTick();
  const bounds = getCanvasNodeListBounds(canvasNodes.value);
  const viewport = canvasRef.value?.getBoundingClientRect();
  if (bounds && viewport && bounds.width > 0 && bounds.height > 0) {
    const padding = 56;
    const zoom = clamp(Math.min(
      (viewport.width - padding * 2) / bounds.width,
      (viewport.height - padding * 2) / bounds.height,
    ), MIN_ZOOM, MAX_ZOOM);
    viewZoom.value = zoom;
    viewPan.value = {
      x: (viewport.width - bounds.width * zoom) / 2 - bounds.minX * zoom,
      y: (viewport.height - bounds.height * zoom) / 2 - bounds.minY * zoom,
    };
  }
  return true;
}
