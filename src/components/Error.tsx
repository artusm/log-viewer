import { Component } from "inferno"

interface Props {
  visible: boolean
  message: string | HTMLElement
}

export class Error extends Component<Props> {
  render() {
    return (
      <section id="log-error" class={`section ${this.props.visible ? "" : "is-hidden"}`}>
        <article class="message">
          <div class="message-header">
            <p>Произошла ошибка 😿</p>
          </div>
          <div class="message-body">
            <div class="content">
              <h4>Текст ошибки</h4>
              {(this.props.message instanceof HTMLElement) ? this.props.message : <pre>{this.props.message}</pre> }
            </div>
          </div>
        </article>
      </section>
    )
  }
}