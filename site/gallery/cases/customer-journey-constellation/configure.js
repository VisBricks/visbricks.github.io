import { configureShowcase } from "../_shared/configureCase.js";

const definition = {
  "slug": "customer-journey-constellation",
  "data": {
    "kind": "table",
    "file": "customer_journey.csv"
  },
  "blocks": [
    {
      "id": "journey",
      "chartType": "Scatterplot",
      "name": "Journey satisfaction and effort",
      "frame": {
        "x": 100,
        "y": 140,
        "width": 760,
        "height": 600
      },
      "chartSpec": {
        "encodings": {
          "x": {
            "field": "satisfaction",
            "type": "quantitative"
          },
          "y": {
            "field": "effort",
            "type": "quantitative"
          },
          "color": {
            "field": "stage",
            "type": "nominal"
          },
          "size": {
            "field": "engagement",
            "type": "quantitative"
          }
        }
      }
    },
    {
      "id": "duration",
      "chartType": "MultipleBoxplot",
      "name": "Duration by stage",
      "frame": {
        "x": 930,
        "y": 140,
        "width": 420,
        "height": 600
      },
      "chartSpec": {
        "encodings": {
          "x": {
            "field": "stage",
            "type": "ordinal"
          },
          "y": {
            "field": "duration_days",
            "type": "quantitative"
          },
          "color": {
            "field": "segment",
            "type": "nominal"
          }
        }
      }
    },
    {
      "id": "channel",
      "chartType": "PieChart",
      "name": "Touchpoint channels",
      "frame": {
        "x": 550,
        "y": 820,
        "width": 240,
        "height": 240
      },
      "adaptWide": true,
      "chartSpec": {
        "encodings": {},
        "angleFields": [
          {
            "field": "web",
            "type": "quantitative"
          },
          {
            "field": "store",
            "type": "quantitative"
          },
          {
            "field": "advisor",
            "type": "quantitative"
          }
        ]
      }
    }
  ],
  "compositions": [
    {
      "type": "nested-pie",
      "parent": "journey",
      "child": "channel",
      "angleFields": [
        "web",
        "store",
        "advisor"
      ],
      "radiusField": "engagement"
    },
    {
      "type": "concat",
      "target": "journey",
      "source": "duration",
      "sharedChannels": [
        "y"
      ],
      "direction": "horizontal",
      "position": "after"
    }
  ]
};

export async function configure(context, compose = true) {
  return configureShowcase(context, definition, compose);
}
