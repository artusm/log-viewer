import { Component } from "inferno"
import compo from 'url:../../compo.png'

interface Props {
  visible: boolean
}

export class Welcome extends Component<Props> {
  render() {
    if (!this.props.visible) {
      return null
    }

    return (
      <section id="log-welcome" class="section">
        <article class="message">
          <div class="message-header">
            <div class="message-header">
              <a class="navbar-item" href="./"><img src={compo}/></a> Просмотрщик логов
            </div>
          </div>
          <div class="message-body">
            <div class="content">

            </div>
          </div>
        </article>
      </section>
    )
  }
}

