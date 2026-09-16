import { configureShowcase } from "../_shared/configureCase.js";

const definition = {
  "slug": "climate-risk-dashboard",
  "data": {
    "kind": "table",
    "file": "climate_risk.csv"
  },
  "blocks": [
    {
      "id": "risk",
      "chartType": "StackedAreaChart",
      "name": "Seasonal risk composition",
      "frame": {
        "x": 100,
        "y": 70,
        "width": 820,
        "height": 300
      },
      "adaptWide": true,
      "chartSpec": {
        "encodings": {
          "x": {
            "field": "month",
            "type": "ordinal"
          }
        },
        "valueFields": [
          {
            "field": "heat",
            "type": "quantitative"
          },
          {
            "field": "flood",
            "type": "quantitative"
          },
          {
            "field": "wind",
            "type": "quantitative"
          },
          {
            "field": "fire",
            "type": "quantitative"
          }
        ]
      }
    },
    {
      "id": "districts",
      "chartType": "Scatterplot",
      "name": "District anomaly and exposure",
      "frame": {
        "x": 100,
        "y": 430,
        "width": 820,
        "height": 400
      },
      "chartSpec": {
        "encodings": {
          "x": {
            "field": "month",
            "type": "ordinal"
          },
          "y": {
            "field": "temperature_anomaly",
            "type": "quantitative"
          },
          "color": {
            "field": "region",
            "type": "nominal"
          },
          "size": {
            "field": "exposure",
            "type": "quantitative"
          }
        }
      }
    },
    {
      "id": "hazards",
      "chartType": "PieChart",
      "name": "Hazard mix",
      "frame": {
        "x": 1020,
        "y": 330,
        "width": 250,
        "height": 250
      },
      "adaptWide": true,
      "chartSpec": {
        "encodings": {},
        "angleFields": [
          {
            "field": "heat",
            "type": "quantitative"
          },
          {
            "field": "flood",
            "type": "quantitative"
          },
          {
            "field": "wind",
            "type": "quantitative"
          },
          {
            "field": "fire",
            "type": "quantitative"
          }
        ]
      }
    }
  ],
  "compositions": [
    {
      "type": "nested-pie",
      "parent": "districts",
      "child": "hazards",
      "angleFields": [
        "heat",
        "flood",
        "wind",
        "fire"
      ],
      "radiusField": "exposure"
    },
    {
      "type": "concat",
      "target": "districts",
      "source": "risk",
      "sharedChannels": [
        "x"
      ],
      "direction": "vertical",
      "position": "before"
    }
  ]
};

export async function configure(context, compose = true) {
  return configureShowcase(context, definition, compose);
}
