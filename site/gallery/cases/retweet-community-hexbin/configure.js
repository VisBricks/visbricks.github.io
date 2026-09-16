import { configureShowcase } from "../_shared/configureCase.js";

const definition = {
  slug: "retweet-community-hexbin",
  data: { kind: "graph", nodes: "retweet_users.csv", links: "retweet_links.csv", name: "retweet-community" },
  blocks: [
    {
      id: "users", chartType: "Hexbin", name: "Retweet communities — one user per hex",
      frame: { x: 80, y: 70, width: 980, height: 860 },
      chartSpec: {
        encodings: {
          x: { field: "x", type: "quantitative" }, y: { field: "y", type: "quantitative" },
          color: { field: "community", type: "nominal" }, shape: { field: "user_type", type: "nominal" },
        },
        markGroups: [{ id: "retweet-user-hexagons", chartId: "retweet-users", role: "hexagon", memberKeys: [],
          allowOverrides: true, sharedConfig: { radius: 10 } }],
        axes: { x: { visible: false, labelsVisible: false }, y: { visible: false, labelsVisible: false } },
      },
    },
    {
      id: "retweets", chartType: "GraphLink", name: "Retweet relationships",
      frame: { x: 1180, y: 70, width: 980, height: 860 },
      chartSpec: {
        encodings: {
          source: { field: "source", type: "nominal" }, target: { field: "target", type: "nominal" },
          value: { field: "weight", type: "quantitative" }, color: { field: "relation_type", type: "nominal" },
          size: { field: "weight", type: "quantitative" },
        },
        markGroups: [{ id: "retweet-arcs", chartId: "retweet-links", role: "link", memberKeys: [],
          allowOverrides: true, sharedConfig: { curve: "arc" } }],
      },
    },
  ],
  compositions: [{ type: "layer", target: "users", source: "retweets", sharedChannels: ["x", "y"] }],
};

export async function configure(context, compose = true) {
  const loaded = await configureShowcase(context, definition, compose);
  if (loaded && compose) {
    const root = context.canvasNodes.value[0];
    if (root?.kind === "group" && root.compositionSpec?.type === "layer") {
      Object.assign(root, { x: 80, y: 70, width: 980, height: 860, scaleX: 1, scaleY: 1 });
    }
    const viewport = context.canvasRef.value?.getBoundingClientRect();
    if (viewport) {
      const zoom = Math.min(1, (viewport.width - 80) / 980, (viewport.height - 80) / 860);
      context.viewZoom.value = zoom;
      context.viewPan.value = {
        x: (viewport.width - 980 * zoom) / 2 - 80 * zoom,
        y: (viewport.height - 860 * zoom) / 2 - 70 * zoom,
      };
    }
    await context.nextTick();
    await context.nextTick();
  }
  return loaded;
}
