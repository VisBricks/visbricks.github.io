import { configureShowcase } from "../_shared/configureCase.js";

const definition = {
  "slug": "forest-carbon-rings",
  "data": {
    "kind": "table",
    "file": "forest_hierarchy.csv"
  },
  "blocks": [
    {
      "id": "sunburst",
      "chartType": "Sunburst",
      "name": "Carbon stock hierarchy",
      "frame": {
        "x": 100,
        "y": 100,
        "width": 680,
        "height": 680
      },
      "polar": {},
      "chartSpec": {
        "encodings": {
          "key": {
            "field": "node_id",
            "type": "nominal"
          },
          "parent": {
            "field": "parent_id",
            "type": "nominal"
          },
          "value": {
            "field": "carbon_tons",
            "type": "quantitative"
          },
          "color": {
            "field": "level",
            "type": "nominal"
          }
        }
      }
    },
    {
      "id": "tree",
      "chartType": "RadialDendrogram",
      "name": "Forest sampling hierarchy",
      "frame": {
        "x": 860,
        "y": 100,
        "width": 680,
        "height": 680
      },
      "polar": {},
      "chartSpec": {
        "encodings": {
          "key": {
            "field": "node_id",
            "type": "nominal"
          },
          "parent": {
            "field": "parent_id",
            "type": "nominal"
          },
          "color": {
            "field": "moisture",
            "type": "quantitative"
          }
        }
      }
    }
  ],
  "compositions": [
    {
      "type": "concat",
      "target": "sunburst",
      "source": "tree",
      "sharedChannels": [
        "radius"
      ],
      "direction": "angular",
      "position": "after"
    }
  ]
};

export async function configure(context, compose = true) {
  return configureShowcase(context, definition, compose);
}
