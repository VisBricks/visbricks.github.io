import { configureShowcase } from "../_shared/configureCase.js";

const definition = {
  "slug": "athlete-performance-radar",
  "data": {
    "kind": "table",
    "file": "athlete_metrics.csv"
  },
  "blocks": [
    {
      "id": "radar",
      "chartType": "RadarChart",
      "name": "Balanced athlete profiles",
      "frame": {
        "x": 120,
        "y": 100,
        "width": 650,
        "height": 650
      },
      "polar": {},
      "chartSpec": {
        "encodings": {
          "theta": {
            "field": "metric",
            "type": "ordinal"
          },
          "radius": {
            "field": "score",
            "type": "quantitative"
          },
          "series": {
            "field": "athlete",
            "type": "nominal"
          }
        },
        "series": {
          "field": "athlete",
          "type": "nominal"
        }
      }
    },
    {
      "id": "load",
      "chartType": "RadialBarChart",
      "name": "Training load sectors",
      "frame": {
        "x": 850,
        "y": 100,
        "width": 650,
        "height": 650
      },
      "polar": {},
      "chartSpec": {
        "encodings": {
          "segment": {
            "field": "metric",
            "type": "ordinal"
          },
          "radius": {
            "field": "training_load",
            "type": "quantitative"
          },
          "color": {
            "field": "athlete",
            "type": "nominal"
          }
        }
      }
    }
  ],
  "compositions": [
    {
      "type": "concat",
      "target": "radar",
      "source": "load",
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
