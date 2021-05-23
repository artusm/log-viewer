import { IRelative, Time, When } from "../../helpers/Time"
import { Query } from "../../services/Query"
import { FilterType } from "../../components/App"
import { FieldsConfig } from "../../services/Log"
import { ElasticsearchException } from "./ElasticsearchException"
import { DataSourceConfig } from "../../services/Manager"

export interface Result {
  overview: LogMessage[]
  full: Promise<Map<string, LogMessage>[]>
}

interface ElasticsearchHistogramResponse {
  aggregations: {
    n: {
      buckets: ElasticsearchHistogramBucket[],
    }
  }
}

interface ElasticsearchHistogramBucket {
  key_as_string: string,
  doc_count: number,
}

export interface HistogramResults {
  buckets: Bucket[]
}

export interface Bucket {
  when: When
  count: number
}

interface LogMessages {
  docs: LogMessage[]
}

export interface LogMessage {
  _full?: Promise<LogMessage>
  _id?: string
  _index?: string
  _type?: string

  [key: string]: any
}

interface ElasticsearchError {
  error: any
}

interface SortItem {
  [key: string]: {
    order: "asc" | "desc",
    numeric_type?: string
    missing?: any
  }
}

interface SearchQuery {
  query: any
  aggs?: any
  docvalue_fields?: { field: string; format: string }[]
  _source?: string[]
  search_after?: Cursor
  sort?: SortItem[]
  size?: number
  timeout?: string
}

interface ElasticsearchHits {
  hits: LogMessage[]
}

interface ElasticsearchResults {
  _shards: any
  hits: ElasticsearchHits
  timed_out: boolean
  took: number
}

export type Cursor = (number | string)[]

type Index = string
type Type = string
type IdOrLogMsg = string | LogMessage

type TypeIds = Map<Type, IdOrLogMsg[]>

type IndexTypeIds = Map<Index, TypeIds>

export interface IDataSource {
  historicSearch(query: Query, cursor?: Cursor, searchAfterAscending?: boolean): Promise<Result>

  surroundSearch(query: Query, cursor: Cursor, searchAfterAscending?: boolean): Promise<Result>

  histogram(query: Query, interval: IRelative, tz: string): Promise<HistogramResults>
}

export class Elasticsearch implements IDataSource {
  private fieldsConfig: FieldsConfig
  private ds: DataSourceConfig

  constructor(ds: DataSourceConfig, fieldsConfig: FieldsConfig) {
    this.ds = ds
    this.fieldsConfig = fieldsConfig
  }

  url(suffix: string, index: string): string {
    return `${this.ds.urlPrefix}/${index}/${suffix}`
  }

  static async fetch<T>(url, method = "POST", body?: object): Promise<T> {
    const request: RequestInit = {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }

    if (body !== undefined) {
      request.body = JSON.stringify(body)
    }

    let resp
    try {
      resp = await fetch(url, request)
    } catch (e) {
      throw new ElasticsearchException(`Ошибка при запросе ${url}`, e)
    }

    let response: T | ElasticsearchError
    try {
      response = await resp.json()
    } catch (e) {
      throw new ElasticsearchException("Не удалось распарсить JSON", e)
    }

    if ((response as ElasticsearchError).error !== undefined) {
      throw new ElasticsearchException("Ошибка в ответе", JSON.stringify(response, null, 4))
    }

    return response as T
  }

  async loadDocument(index: string, type: string, id: string): Promise<LogMessage> {
    const url = this.url(`${type}/${id}`, index)
    const data = await Elasticsearch.fetch<LogMessage>(url, "GET")
    return this.normaliseLog(data)
  }

  async historicSearch(query: Query, cursor?: Cursor, searchAfterAscending?: boolean): Promise<Result> {
    const search = this.historicRequest(query)
    search.sort = [
      {
        [this.fieldsConfig.timestamp]: {
          order: (searchAfterAscending === true) ? 'asc' : 'desc'
        }
      }
    ]

    if (this.fieldsConfig.disableTimestampNano) {
        search.sort[0][this.fieldsConfig.timestamp].numeric_type = "date"
    }

    if (cursor !== undefined) {
      search.search_after = cursor
    }

    const url = this.url(`_search`, this.ds.index)
    const data = await Elasticsearch.fetch<ElasticsearchResults>(url, "POST", search)
    if (data._shards && data._shards.failed) {
      throw new ElasticsearchException("Shard failure", JSON.stringify(data._shards.failures[0], null, 2))
    }

    if (data.hits === undefined || !data.hits.hits) {
      return null
    }

    const hits = data.hits.hits.map(r => this.normaliseLog(r))

    if (searchAfterAscending !== true) {
      hits.reverse()
    }

    const idsByIndex: IndexTypeIds = new Map<Index, TypeIds>()
    hits.forEach(hit => {
      idsByIndex.set(hit._index, idsByIndex.get(hit._index) || new Map<Type, IdOrLogMsg[]>())
      idsByIndex.get(hit._index).set(hit._type, idsByIndex.get(hit._index).get(hit._type) || [])
      idsByIndex.get(hit._index).get(hit._type).push(hit._id)
    })

    const full = this.injectFinalPromise(hits, idsByIndex)
    return {overview: hits, full}
  }

  async surroundSearch(query: Query, cursor?: Cursor, searchAfterAscending?: boolean): Promise<Result> {
    const backQuery = query.withPageSize(query.pageSize / 2 + 1)
    const backResults = await this.historicSearch(backQuery, cursor, !searchAfterAscending)
    if (backResults.overview.length === 0) {
      return Promise.resolve(backResults)
    }
    const backCursor = backResults.overview[0].__cursor
    return this.historicSearch(query, backCursor, searchAfterAscending)
  }

  private historicRequest(query: Query): SearchQuery {
    let stringQuery: any

    const extraTerms = query.enabledFilters()
      .filter(f => f.type === FilterType.addTerms)
      .filter(f => f.selected)
      .map(f => {
        const item = f.items.find(i => i.id === f.selected)
        if (!item) {
          throw new Error(`Не удалось найти элемент с id: "${f.selected}" в фильтре ${f.id}`)
        }
        return item.terms
      })
      .join(" ")

    let terms = query.terms || ""
    if (extraTerms) {
      terms += " " + extraTerms
    }
    if (this.ds.terms) {
      terms += " " + this.ds.terms
    }

    if (terms) {
      stringQuery = {
        query_string: {
          fields: this.fieldsConfig.elasticsearch?.queryStringFields,
          analyze_wildcard: true,
          default_operator: 'AND',
          fuzziness: 0,
          query: terms,
        }
      }
    } else {
      stringQuery = {
        match_all: {}
      }
    }
    const timeQuery = {
      range: {
        [this.fieldsConfig.timestamp]: {
          format: 'strict_date_optional_time',
          gte: Time.whenToElastic(query.startTime),
          lte: Time.whenToElastic(query.endTime),
        }
      }
    }

    const filterQuery = []
    for (const filter of query.enabledFilters()) {
      if (!filter.selected) {
        continue
      }

      switch (filter.type) {
        case FilterType.singleValue: {
          const must = {term: {}}
          must.term[filter.id] = {
            value: filter.selected,
          }
          filterQuery.push(must)
          break
        }
      }
    }

    return {
      _source: this.collapsedFields(),
      docvalue_fields: [
        {
          field: this.fieldsConfig.timestamp,
          format: 'date_time'
        }
      ],
      query: {
        bool: {
          must: [
            stringQuery,
            timeQuery,
            ...filterQuery,
          ]
        }
      },
      size: query.pageSize,
      timeout: '30000ms'
    }
  }

  private injectFinalPromise(hits: LogMessage[], indexes: IndexTypeIds): Promise<Map<string, LogMessage>[]> {
    if (hits.length === 0) {
      return Promise.resolve([])
    }
    const allPromises = []
    indexes.forEach((typeIds, index) => {
      typeIds.forEach((ids, type) => {
        const bulkGetPromise = this.bulkGet(index, type, ids as string[])
        allPromises.push(bulkGetPromise)
        hits
          .filter(hit => hit._index === index)
          .filter(hit => hit._type === type)
          .forEach(hit => hit._full = new Promise<LogMessage>(resolve => {
            bulkGetPromise.then(logMsgs => resolve(logMsgs.get(hit._id)))
          }))
      })
    })

    return Promise.all(allPromises)
  }

  async bulkGet(index: string, type: string, ids: string[]): Promise<Map<string, LogMessage>> {
    const url = this.url(`${type}/_mget`, index)
    const request = {docs: ids.map(id => ({_id: id}))}
    const data = await Elasticsearch.fetch<LogMessages>(url, "POST", request)
    return new Map<string, LogMessage>(data.docs.map((doc: LogMessage) => [doc._id, this.normaliseLog(doc)]))
  }

  private normaliseLog(r: LogMessage): LogMessage {
    return {
      ...r._source,
      _index: r._index,
      _id: r._id,
      _type: r._type,
      __cursor: r.sort,
    }
  }

  async histogram(query: Query, interval: IRelative, tz: string): Promise<HistogramResults> {
    const url = this.url(`_search?size=0`, this.ds.index)
    const search = this.historicRequest(query)

    const unit = (interval.unit === "millisecond") ? "ms" : interval.unit[0]

    search.aggs = {
      "n": {
        "date_histogram": {
          "field": this.fieldsConfig.timestamp,
          "interval": interval.count + unit,
          "time_zone": tz,
        }
      }
    }
    const results = await Elasticsearch.fetch<ElasticsearchHistogramResponse>(url, "POST", search)
    if (!results.aggregations) {
      return {
        buckets: [],
      }
    }

    return {
      buckets: results.aggregations.n.buckets.map(b => ({
        when: Time.parseText(b.key_as_string),
        count: b.doc_count,
      }))
    }
  }

  private collapsedFields() {
    return [
      this.fieldsConfig.timestamp,
      ...this.fieldsConfig.collapsedFormatting.map(f => f.field)
    ]
  }
}
