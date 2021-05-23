import { render } from 'inferno'
import { App } from "./components/App"
import {Config, Manager} from "./services/Manager"
import { Error } from "./components/Error"

const app = document.getElementById('app')

const config: Config = {
  "dataSources": [
    {
      id: "elasticsearch-server",
      type: "elasticsearch",
      "index": "*",
      "urlPrefix": "/es",
      "fields": "main"
    }
  ],
  "filters": [
    {
      "id": "level",
      "urlKey": "ll",
      "title": "Log Level",
      "default": null,
      "type": "singleValue",
      "items": [
        {
          "title": "Все",
          "id": null
        },
        {
          "title": "Debug",
          "id": "debug"
        },
        {
          "title": "Info",
          "id": "info"
        },
        {
          "title": "Warn",
          "id": "warn"
        },
        {
          "title": "Error",
          "id": "error"
        }
      ]
    },
  ],
  "fields": {
    "main": {
      "timestamp": "@timestamp",
      "collapsedFormatting": [
        {
          "field": "@timestamp",
          "transforms": [
            "timestamp"
          ]
        },
        {
          "field": "level",
          // @ts-ignore
          "transforms": [
            "upperCase",
            {
              "mapValue": {
                "DEBUG": "DEBU",
                "WARNING": "WARN",
                "ERROR": "ERRO"
              }
            },
            {
              "mapClass": {
                "DEBU": "has-text-success",
                "INFO": "has-text-info",
                "WARN": "has-text-warning",
                "ERRO": "has-text-danger"
              }
            },
            {
              "addClass": "has-text-weight-bold"
            }
          ]
        },
        {
          "field": "esl",
          "transforms": [
            "randomStableColor"
          ]
        },
        {
          "field": "message",
          "transforms": [
            {
              "addClass": "strong"
            }
          ]
        }
      ],
      "collapsedIgnore": [
        "_id",
        "_index"
      ],
      "contextFilters": [
        {
          "title": "Очистить фильтры"
        },
        {
          "title": "Логи с таким же ESL",
          "keep": [
            "esl"
          ],
          "icon": "mdi-cloud-circle"
        }
      ]
    }
  }
}

const delay = (ml = 300) => {
  return new Promise(r => {
    setTimeout(r, ml)
  })
}
export async function loadConfig() {
  try {
    await delay()
    const manager = new Manager(config)
    render(<App log={manager}/>, app)
  } catch (e) {
    // tslint:disable-next-line:no-console
    console.log(e)
    // tslint:disable-next-line:no-console

    render((
      <Error message={`Произошла ошибка при загрузке: ${e}`} visible={true}/>
    ), app)
  }
}

loadConfig()

