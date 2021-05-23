import moment, { unitOfTime } from "moment"

interface IWhen {
  kind: string
}

export interface IMoment extends IWhen {
  kind: "moment"
  moment: moment.Moment
}

interface INow extends IWhen {
  kind: "now"
}

export const Now: INow = {kind: "now"}

export interface IRelative extends IWhen {
  kind: "relative"
  count: number
  unit: moment.unitOfTime.Base
}

interface IInvalidDate extends IWhen {
  kind: "invalid"
}

export const InvalidDate: IInvalidDate = {kind: "invalid"}

export type When = IMoment | INow | IRelative | IInvalidDate

export enum Endpoint {
  Start = 0,
  End = 1,
}

export type Range = [When, When]

export class Time {
  static isRangeEqual(a: Range, b: Range): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  static diff(a: When, b: When): moment.Duration {
    const start = Time.whenToMoment(a)
    const end = Time.whenToMoment(b)
    if (!start || !end) {
      return undefined
    }
    return moment.duration(end.diff(start))
  }

  static getRangeHuman(d: moment.Duration, maxSignificantIntervals?: number): string {
    if (d === undefined) {
      return ""
    }

    let items = [
      ["years", "г"],
      ["months", "Мес"],
      ["days", "д"],
      ["hours", "ч"],
      ["minutes", "м"],
      ["seconds", "с"],
      ["milliseconds", "мс"],
    ]
      .filter(c => d[c[0]]() > 0)
      .map(c => `${d[c[0]]()}${c[1]}`)

    if (maxSignificantIntervals !== undefined) {
      items = items.slice(0, maxSignificantIntervals)
    }

    return items.join(" ")
  }

  static wrapMovement(m: moment.Moment): When {
    return {
      kind: "moment",
      moment: m,
    }
  }

  static wrapDateRange(d: [Date, Date]): Range {
    return [
      this.wrapDate(d[0]),
      this.wrapDate(d[1]),
    ]
  }

  static wrapDate(d: Date): When {
    return {
      kind: "moment",
      moment: moment(d),
    }
  }

  static wrapRelative(count: number, unit: unitOfTime.Base): When {
    return {
      kind: "relative",
      count,
      unit,
    }
  }

  static whenToDate(when: When): Date | null {
    switch (when.kind) {
      case "now":
        return new Date()
      case "invalid":
        return null
      case "moment":
        return when.moment.toDate()
      case "relative":
        const amount = moment.duration(when.count, when.unit)
        return moment().add(amount).toDate()
      default:
        throw new Error(`Неизвестный тип: ${when}`)
    }
  }

  static whenToMoment(when: When): moment.Moment | null {
    const d = Time.whenToDate(when)
    if (d === null) {
      return null
    }

    return moment(d)
  }

  static whenToComputed(when: When): string {
    const w = Time.whenToMoment(when)
    return w && w.toISOString(true) || ""
  }

  static whenToElastic(when: When): string | undefined {
    switch (when.kind) {
      case "now":
        return "now"
      case "invalid":
        return undefined
      case "moment":
        return when.moment.toISOString()
      case "relative":
        return `now${when.count}${when.unit.substring(0, 1)}`
      default:
        throw new Error(`Неизвестный тип: ${when}`)
    }
  }

  static whenToText(when: When): string {
    switch (when.kind) {
      case "now":
        return ""
      case "invalid":
        return ""
      case "moment":
        return when.moment.toISOString()
      case "relative":
        return `${when.count}${when.unit.substring(0, 1)}`
      default:
        throw new Error(`Неизвестный тип: ${when}`)
    }
  }

  static whenToDuration(when: When): moment.Duration {
    if (when.kind !== "relative") {
      throw new Error(`${when.kind} не поддерживается`)
    }

    return moment.duration(when.count, when.unit)
  }

  static whenAdd(when: When, duration: moment.Duration): When {
    return Time.wrapMovement(this.whenToMoment(when).add(duration))
  }

  static parseText(text: string): When {
    if (text === "") {
      return Now
    }

    const re = new RegExp(/^(now)?(-\d+) ?(\w)/).exec(text)
    if (re !== null) {
      return Time.wrapRelative(Number(re[2]), re[3] as unitOfTime.Base)
    }

    const m = moment(text)
    if (m.isValid()) {
      return Time.wrapMovement(m)
    }

    return InvalidDate
  }
}

